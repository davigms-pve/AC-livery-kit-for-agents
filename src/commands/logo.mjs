import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { root } from '../lib/paths.mjs';

export const help = `aclivery logo fetch <url> --name <name> [--yes]   download one logo into assets/logos/ (asks first)
aclivery logo inspect <file>                        size, transparency, background, and quality warnings
aclivery logo prep <in> --out <png> [--key-bg] [--tint #RRGGBB] [--trim] [--size 2000]
    --key-bg  turn a near-uniform background (taken from the corners) transparent
    --tint    recolour every opaque pixel, keeping the shape (for one-colour decals)
    --trim    crop to the artwork    --size  longest side in px (SVG is rasterised at this size)
Without --yes, fetch only prints what it would do and exits 2: confirm with the user, then re-run with --yes.
Logos are third-party trademarks. They live in assets/ (gitignored) and are never committed.`;

const MAX_BYTES = 15 * 1024 * 1024;
const LOGO_DIR = () => path.resolve(process.env.ACLIVERY_LOGOS ?? path.join(root, 'assets', 'logos'));

const sniff = (b) =>
  b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) ? 'png'
    : b[0] === 0xff && b[1] === 0xd8 ? 'jpg'
      : b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' ? 'webp'
        : /^\s*(<\?xml|<svg)/i.test(b.subarray(0, 256).toString('utf8')) ? 'svg' : null;

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['yes', 'key-bg', 'trim', 'json'] });
  const [sub, target] = positional;
  if (sub === 'fetch') return fetchLogo(target, flags);
  if (sub === 'inspect' && target) return inspect(target, flags);
  if (sub === 'prep' && target) return prep(target, flags);
  throw new UsageError(help);
}

async function fetchLogo(url, flags) {
  if (!url || !flags.name) throw new UsageError(help);
  let u;
  try { u = new URL(url); } catch { throw new UsageError(`not a URL: ${url}`); }
  if (u.protocol !== 'https:') throw new UsageError('only https:// sources are fetched');
  if (!/^[\w-]+$/.test(flags.name)) throw new UsageError('--name must be letters, digits, - or _');
  const dir = LOGO_DIR();
  console.log(`plan: download ${u.href}\n  from host ${u.host}\n  into ${dir}/${flags.name}.<ext>  (max ${MAX_BYTES / 1048576} MB, image types only)`);
  if (!flags.yes) { console.log('not downloaded: ask the user to confirm, then re-run with --yes'); return 2; }

  const res = await fetch(u, { redirect: 'follow', headers: { 'user-agent': 'aclivery/0.1 (logo fetch)' } });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${u.host}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_BYTES) throw new Error(`file is ${declared} bytes, over the ${MAX_BYTES} limit`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > MAX_BYTES) throw new Error('file is over the size limit');
  const kind = sniff(buf);
  if (!kind) throw new Error(`not a recognised image (content-type ${res.headers.get('content-type')}); nothing saved`);

  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${flags.name}.${kind}`);
  fs.writeFileSync(file, buf);
  const meta = kind === 'svg' ? {} : await sharp(buf).metadata();
  const manifestPath = path.join(dir, 'manifest.json');
  const manifest = fs.existsSync(manifestPath) ? JSON.parse(fs.readFileSync(manifestPath, 'utf8')) : {};
  manifest[flags.name] = {
    file: path.basename(file), url: u.href, sha256: crypto.createHash('sha256').update(buf).digest('hex'), bytes: buf.length,
    width: meta.width ?? null, height: meta.height ?? null, fetchedAt: new Date().toISOString(),
    note: 'third-party trademark; personal use; not for redistribution',
  };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 1));
  console.log(`saved ${file} (${buf.length} bytes${meta.width ? `, ${meta.width}x${meta.height}` : ', vector'})`);
  return inspect(file, flags);
}

/** Estimate the background colour from the four corners and how much of the image matches it. */
async function backgroundInfo(img, w, h) {
  const { data, info } = await img.clone().ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => { const o = (y * info.width + x) * 4; return [data[o], data[o + 1], data[o + 2], data[o + 3]]; };
  const corners = [px(0, 0), px(info.width - 1, 0), px(0, info.height - 1), px(info.width - 1, info.height - 1)];
  const d = (a, b) => Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]), Math.abs(a[2] - b[2]));
  const uniform = corners.every((c) => d(c, corners[0]) < 8 && Math.abs(c[3] - corners[0][3]) < 8);
  let transparent = 0, bgLike = 0;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 16) transparent++;
    else if (uniform && d([data[i], data[i + 1], data[i + 2]], corners[0]) < 24) bgLike++;
  }
  const n = info.width * info.height;
  return { corner: corners[0], uniformCorners: uniform, transparentFrac: transparent / n, bgLikeFrac: bgLike / n, data, info };
}

async function inspect(file, flags) {
  const buf = fs.readFileSync(file);
  const kind = sniff(buf);
  if (!kind) throw new UsageError(`${file} is not a recognised image`);
  const warnings = [];
  if (kind === 'svg') {
    console.log(`${path.basename(file)}: vector (SVG). Best source quality; rasterise with: aclivery logo prep ${file} --out out.png --size 3000`);
    return 0;
  }
  const img = sharp(buf);
  const meta = await img.metadata();
  const longest = Math.max(meta.width, meta.height);
  const bg = await backgroundInfo(img, meta.width, meta.height);
  if (longest < 800) warnings.push(`only ${longest}px on the longest side: will look soft on a large panel (aim for 1500+, or find an SVG)`);
  if (!meta.hasAlpha || bg.transparentFrac < 0.01) {
    if (bg.uniformCorners) warnings.push(`no transparency, background is a flat colour rgb(${bg.corner.slice(0, 3).join(',')}) covering ${(bg.bgLikeFrac * 100).toFixed(0)}%: run prep with --key-bg`);
    else warnings.push('no transparency and the background is not a flat colour: needs manual cut-out');
  }
  const out = { file: path.basename(file), format: meta.format, width: meta.width, height: meta.height, hasAlpha: !!meta.hasAlpha,
    transparentPercent: +(bg.transparentFrac * 100).toFixed(1), warnings };
  if (flags.json) console.log(JSON.stringify(out));
  else console.log(`${out.file}: ${out.format} ${out.width}x${out.height}, alpha=${out.hasAlpha}, transparent ${out.transparentPercent}%${warnings.map((w) => `\n  ! ${w}`).join('')}`);
  return 0;
}

async function prep(file, flags) {
  if (!flags.out) throw new UsageError(help);
  const buf = fs.readFileSync(file);
  const kind = sniff(buf);
  if (!kind) throw new UsageError(`${file} is not a recognised image`);
  const size = flags.size ? Number(flags.size) : null;
  let img = kind === 'svg' ? sharp(buf, { density: 300 }) : sharp(buf);
  if (kind === 'svg' && size) img = img.resize({ width: size, height: size, fit: 'inside' });
  let { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  if (flags['key-bg']) {
    const bg = await backgroundInfo(sharp(data, { raw: { width: w, height: h, channels: 4 } }), w, h);
    if (!bg.uniformCorners) throw new UsageError('--key-bg needs a flat background colour in all four corners; this one is not flat');
    const [r0, g0, b0] = bg.corner;
    const lo = 12, hi = 48; // inside lo: fully transparent; lo..hi: soft edge, so anti-aliased fringes do not keep a halo
    for (let i = 0; i < data.length; i += 4) {
      const dist = Math.max(Math.abs(data[i] - r0), Math.abs(data[i + 1] - g0), Math.abs(data[i + 2] - b0));
      const a = dist <= lo ? 0 : dist >= hi ? 255 : Math.round(((dist - lo) / (hi - lo)) * 255);
      data[i + 3] = Math.min(data[i + 3], a);
    }
  }
  if (flags.tint) {
    const m = /^#?([0-9a-f]{6})$/i.exec(String(flags.tint));
    if (!m) throw new UsageError('--tint must be a hex colour like #111111');
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
    for (let i = 0; i < data.length; i += 4) { data[i] = r; data[i + 1] = g; data[i + 2] = b; }
  }
  let out = sharp(data, { raw: { width: w, height: h, channels: 4 } });
  if (flags.trim) out = sharp(await out.png().toBuffer()).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 });
  if (size && kind !== 'svg') out = out.resize({ width: size, height: size, fit: 'inside', withoutEnlargement: false });
  fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
  const info2 = await out.png().toFile(flags.out);
  console.log(`wrote ${flags.out} (${info2.width}x${info2.height})`);
  return 0;
}
