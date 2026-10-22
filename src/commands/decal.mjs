import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { loadPack } from '../lib/paths.mjs';

export const help = `aclivery decal <car> --panel <name> (--image <png> | --color #RRGGBB) --out <texture.png>
                 [--texture role] [--base existing.png | --fill #RRGGBB] [--size 4096]
                 [--at x,y,w,h] [--opacity 0..1] [--rotate extra-degrees]
  Places one image on one named panel so it reads upright on the car, and writes the texture PNG.
  Call it again with --base <the same file> to add the next decal. Names the panel, never pixels.
  --at     where inside the panel, as fractions of the UPRIGHT panel box (default 0.05,0.05,0.9,0.9). The
           image keeps its aspect ratio and is centred in that box.
  --color  paint the panel (or the --at box) a solid colour instead of placing an image, e.g. cyan mirrors.
  --label  a name for this placement in overlap messages (default: the image file name)
  --overlap allow this to cover art already placed (default: refused, so logos never sit on each other by accident)
  --under  this is quiet background art (tonal ink, texture): it may sit under logos, so it skips the overlap check and is
           not remembered by it. Everything else is placed over it.
  --fill   start from a flat colour, or "transparent" (door plates and other cut-out textures) (paints the whole texture) instead of --base.
  --size   canvas width for a NEW texture. Default: the texture's real size (e.g. 8192x2956 for the P92 body).
           Smaller is fine for quick tests; height follows the real aspect ratio, rounded to a multiple of 4.
  Then check it: aclivery render <car> --skin <folder holding the png> --views left,right
  Limits: a panel's rect is the bounding box of its UV island, so art can spill into empty atlas space;
  mirrored UV islands are not detected, so check text is not reversed in the render.`;


/** Map a box in the panel's upright frame (uw x uh) into UV-space panel coordinates for a clockwise rotation. */
function toUv([x, y, w, h], [uw, uh], rot) {
  if (rot === 90) return [uh - (y + h), x, h, w];
  if (rot === 180) return [uw - (x + w), uh - (y + h), w, h];
  if (rot === 270) return [y, uw - (x + w), h, w];
  return [x, y, w, h];
}

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['overlap', 'under'] });
  const [carId] = positional;
  if (!carId || !flags.panel || !(flags.image || flags.color) || !flags.out) throw new UsageError(help);
  const pack = loadPack(carId);
  const role = flags.texture ?? pack.profile.bind?.body?.roles?.[0] ?? 'ext_main';
  const tex = pack.profile.textures[role];
  const panel = pack.profile.panels?.[role]?.[flags.panel];
  if (!tex) throw new UsageError(`no texture role "${role}". Try: aclivery panel textures ${carId}`);
  if (!panel) throw new UsageError(`no panel "${flags.panel}" in ${role}. Try: aclivery panel list ${carId} --texture ${role}`);

  // Canvas: an existing texture, or a flat fill at the real aspect ratio.
  let base, W, H;
  if (flags.base) {
    const r = await sharp(flags.base).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    base = r.data; W = r.info.width; H = r.info.height;
  } else {
    W = Number(flags.size ?? tex.width); H = flags.size ? Math.round(W * tex.height / tex.width / 4) * 4 : tex.height;
    if (W % 4) throw new UsageError('--size must be a multiple of 4');
    const transparent = flags.fill === 'transparent';
    const m = /^#?([0-9a-f]{6})$/i.exec(String(transparent ? '#ffffff' : (flags.fill ?? '#ffffff')));
    if (!m) throw new UsageError('--fill must be a hex colour like #ffffff, or "transparent"');
    base = Buffer.alloc(W * H * 4);
    const [r, g, b] = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16));
    for (let i = 0; i < base.length; i += 4) { base[i] = r; base[i + 1] = g; base[i + 2] = b; base[i + 3] = transparent ? 0 : 255; }
  }

  // Texels are physically square only if the canvas keeps the texture's real aspect ratio (the panels' metresPerUv
  // assume it). A wrong-aspect base would stretch every logo.
  const aspect = W / H, want = tex.width / tex.height;
  if (Math.abs(aspect / want - 1) > 0.02) {
    throw new UsageError(`canvas is ${W}x${H} (aspect ${aspect.toFixed(2)}) but ${role} is ${tex.width}x${tex.height} (aspect ${want.toFixed(2)}). Art would stretch. Use a base with the real aspect, or start over with --fill.`);
  }

  const rot = (((panel.textRotation ?? 0) + Number(flags.rotate ?? 0)) % 360 + 360) % 360;
  if (![0, 90, 180, 270].includes(rot)) throw new UsageError(`panel rotation ${rot} is not a multiple of 90`);
  const [u, v, w, h] = panel.rect;
  const px = u * W, py = v * H, pw = w * W, ph = h * H;
  const upright = rot % 180 ? [ph, pw] : [pw, ph];   // panel size as the viewer sees it
  const at = String(flags.at ?? (flags.color && !flags.image ? '0,0,1,1' : '0.05,0.05,0.9,0.9')).split(',').map(Number);
  if (at.length !== 4 || at.some(Number.isNaN)) throw new UsageError('--at must be x,y,w,h fractions, like 0.1,0.2,0.5,0.3');
  const slot = [at[0] * upright[0], at[1] * upright[1], at[2] * upright[0], at[3] * upright[1]];

  let img;
  if (flags.image) img = await sharp(flags.image).ensureAlpha().toBuffer({ resolveWithObject: true });
  else {
    // --color: a solid block exactly the size of the slot (default: the whole panel rectangle).
    const m = /^#?([0-9a-f]{6})$/i.exec(String(flags.color));
    if (!m) throw new UsageError('--color must be a hex colour like #4fc3d9');
    img = await sharp({ create: { width: Math.max(1, Math.round(slot[2])), height: Math.max(1, Math.round(slot[3])), channels: 4, background: '#' + m[1] } })
      .png().toBuffer({ resolveWithObject: true });
  }
  const scale = Math.min(slot[2] / img.info.width, slot[3] / img.info.height);
  const dw = Math.max(1, Math.round(img.info.width * scale)), dh = Math.max(1, Math.round(img.info.height * scale));
  const box = [slot[0] + (slot[2] - dw) / 2, slot[1] + (slot[3] - dh) / 2, dw, dh];
  // Resize in its own step, then rotate: sharp runs rotate BEFORE resize inside one pipeline, which would squash or crop a non-square image on a 90/270 panel.
  let piece = sharp(await sharp(img.data).resize(dw, dh).png().toBuffer());
  if (rot) piece = piece.rotate(rot);
  if (flags.opacity) {
    const k = Math.max(0, Math.min(1, Number(flags.opacity)));
    const { data, info } = await piece.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    for (let i = 3; i < data.length; i += 4) data[i] = Math.round(data[i] * k);
    piece = sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } });
  }
  const [bx, by] = toUv(box, upright, rot);
  const left = Math.round(px + bx), top = Math.round(py + by);

  const { data: pieceBuf, info: pieceInfo } = await piece.png().toBuffer({ resolveWithObject: true });

  // Overlap guard: art must not land on top of other art unless the design shows it. Placements are remembered in a
  // sidecar file next to the texture; a fresh canvas (no --base) starts a new list.
  const what = flags.label ?? (flags.image ? path.basename(flags.image) : flags.color);
  const sidecar = `${flags.out}.placements.json`;
  const placed = flags.base && fs.existsSync(sidecar) ? JSON.parse(fs.readFileSync(sidecar, 'utf8')) : [];
  const mine = [left, top, pieceInfo.width, pieceInfo.height];
  if (!flags.overlap && !flags.under) {
    for (const p of placed) {
      const ix = Math.max(0, Math.min(mine[0] + mine[2], p.box[0] + p.box[2]) - Math.max(mine[0], p.box[0]));
      const iy = Math.max(0, Math.min(mine[1] + mine[3], p.box[1] + p.box[3]) - Math.max(mine[1], p.box[1]));
      if ((ix * iy) / Math.min(mine[2] * mine[3], p.box[2] * p.box[3]) > 0.08) {
        throw new UsageError(`${what} on ${flags.panel} would cover "${p.what}" (already on ${p.panel}). Logos should not sit on top of each other unless the reference or the user shows it.\n  Move it with --at, or pass --overlap if the design really overlaps (for example text on a plate card).`);
      }
    }
  }
  if (!flags.under) placed.push({ what, panel: flags.panel, box: mine });

  const out = await sharp(base, { raw: { width: W, height: H, channels: 4 } })
    .composite([{ input: pieceBuf, left, top }]).png().toBuffer();
  fs.mkdirSync(path.dirname(path.resolve(flags.out)), { recursive: true });
  fs.writeFileSync(flags.out, out);
  fs.writeFileSync(sidecar, JSON.stringify(placed));
  console.log(`placed ${what} on ${flags.panel} (rotation ${rot}) -> ${flags.out} (${W}x${H})`);
  return 0;
}
