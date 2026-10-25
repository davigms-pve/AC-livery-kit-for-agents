import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { home } from '../lib/paths.mjs';
import { quiet } from '../lib/quiet.mjs';
import { run as render } from './render.mjs';

export const help = `aclivery compare <car> --skin <dir> --ref a.jpg,b.jpg --views front-right,left   [--out file.png] [--each] [--crop x,y,w,h]
aclivery compare <car> --skin <dir> --brief <slug>        use the references recorded in the project brief
  One image: each reference photo on the left, our render from the same view on the right, one row per reference.
  Look at it, then say what differs (position, size, colour, missing parts) and fix those, not everything.
  --views  the closest car view to each reference, in order: front-left front-right left right front rear rear-left
           rear-right top three-quarter. left = the car's LEFT side (nose points to the left of the picture).
           In the brief, record it per reference: aclivery brief add <slug> references '{"file":"photo.jpg","view":"right"}'.
  --each   one image per reference (reference | ours) in a FOLDER (--out), named <n>-<view>.png, instead of one tall sheet.
           A small model reads one pair better than five rows.
  --crop   zoom in: keep only this part of BOTH the reference and our render, as fractions x,y,w,h of each picture
           (for example 0.1,0.3,0.4,0.4 for the door), and show it larger. To read detail (the number's font, a logo's shape).
           The same box is cut from every row, so use it with one pair (--ref one.jpg --views right) or rows of the same view.
  Rows are matched by order. A view is a fixed camera, so expect similar, not identical, framing.`;

const H = 560, RW = 1000, REFW = 900;
const IMAGE_EXT = /\.(png|jpe?g|webp)$/i;

/** x,y,w,h as fractions of a picture. */
export function parseCrop(s) {
  const c = String(s).split(',').map(Number);
  if (c.length !== 4 || c.some((n) => Number.isNaN(n)) || c[0] < 0 || c[1] < 0 || c[2] <= 0 || c[3] <= 0 || c[0] + c[2] > 1.0001 || c[1] + c[3] > 1.0001) {
    throw new UsageError('--crop must be x,y,w,h fractions inside the picture, like 0.1,0.3,0.4,0.4');
  }
  return c;
}

/** Cut a fractional box out of an image and scale it to fit w x h (padded with the sheet's dark colour). */
async function fit(buf, w, h, crop) {
  let img = sharp(buf);
  if (crop) {
    const m = await sharp(buf).metadata();
    const left = Math.min(m.width - 1, Math.round(crop[0] * m.width)), top = Math.min(m.height - 1, Math.round(crop[1] * m.height));
    img = img.extract({ left, top, width: Math.max(1, Math.min(m.width - left, Math.round(crop[2] * m.width))), height: Math.max(1, Math.min(m.height - top, Math.round(crop[3] * m.height))) });
  }
  return img.resize({ width: w, height: h, fit: 'contain', background: { r: 16, g: 16, b: 22, alpha: 1 } }).png().toBuffer();
}

/** Reference (left) next to ours (right), one row per pair. rows: [{ ref, ours, view, name }] as encoded images. */
export async function pairSheet(rows, crop = null) {
  const W = REFW + RW, total = rows.length * H;
  const label = (x, y, t) => `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#d8dde3">${t.replace(/[<&]/g, '')}</text>`;
  const zoom = crop ? ' (zoomed)' : '';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${total}">` +
    rows.map((r, i) => label(10, i * H + 22, `reference: ${r.name}${zoom}`) + label(REFW + 10, i * H + 22, `ours: ${r.view}${zoom}`)).join('') + '</svg>';
  const cells = [];
  for (const [i, r] of rows.entries()) cells.push({ input: await fit(r.ref, REFW, H, crop), left: 0, top: i * H }, { input: await fit(r.ours, RW, H, crop), left: REFW, top: i * H });
  return sharp({ create: { width: W, height: total, channels: 4, background: { r: 12, g: 13, b: 16, alpha: 1 } } })
    .composite([...cells, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toBuffer();
}

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['each'] });
  const [carId] = positional;
  if (!carId || !flags.skin || !(flags.brief || (flags.ref && flags.views))) throw new UsageError(help);
  const crop = flags.crop ? parseCrop(flags.crop) : null;
  if (flags.each && IMAGE_EXT.test(String(flags.out ?? ''))) throw new UsageError(`--each writes one image per reference into a folder, so --out must be a folder, not a file (${flags.out}). Drop --each for one sheet in a file, or give a folder.`);

  let pairs;
  if (flags.brief) {
    const f = path.join(home(), 'projects', String(flags.brief), 'brief.json');
    if (!fs.existsSync(f)) throw new UsageError(`no project "${flags.brief}"`);
    const refs = (JSON.parse(fs.readFileSync(f, 'utf8')).references ?? []).filter((r) => r.file && r.view);
    if (!refs.length) throw new UsageError('the brief has no references with both "file" and "view". Add them: aclivery brief add <slug> references \'{"file":"photo.jpg","view":"right"}\'');
    pairs = refs.map((r) => ({ file: r.file, view: r.view }));
  } else {
    const files = String(flags.ref).split(','), views = String(flags.views).split(',');
    if (files.length !== views.length) throw new UsageError(`${files.length} reference(s) but ${views.length} view(s): give one view per reference`);
    pairs = files.map((file, i) => ({ file, view: views[i] }));
  }
  for (const p of pairs) if (!fs.existsSync(p.file)) throw new UsageError(`reference not found: ${p.file}`);

  // A zoomed crop keeps only a part of our render, so draw it larger first (up to 3x) or it would be soft.
  const f = crop ? Math.min(3, Math.max(1, 1 / Math.max(crop[2], crop[3]))) : 1;
  const tmp = path.join(home(), 'renders', `_cmp-${Date.now()}`);
  const views = [...new Set(pairs.map((p) => p.view))];
  await quiet(() => render([carId, '--skin', flags.skin, '--views', views.join(','), '--each', '--size', `${Math.round(RW * f)}x${Math.round(H * f)}`, '--out', tmp]));

  const rows = [];
  for (const p of pairs) {
    const ref = await sharp(p.file).rotate().png({ compressionLevel: 1 }).toBuffer();
    const ours = fs.readFileSync(path.join(tmp, `${p.view}.png`));
    rows.push({ ref, ours, view: p.view, name: path.basename(p.file) });
  }
  const stamp = Date.now();
  let written;
  if (flags.each) {
    const dir = path.resolve(flags.out ?? path.join(home(), 'renders', `${carId}-compare-${stamp}`));
    fs.mkdirSync(dir, { recursive: true });
    written = [];
    for (const [i, r] of rows.entries()) {
      const out = path.join(dir, `${i + 1}-${r.view}.png`);
      fs.writeFileSync(out, await pairSheet([r], crop)); written.push(out);
    }
    console.log(`wrote ${written.join('\n      ')}\n  ${rows.length} image(s), one per reference. Left = reference, right = our render.`);
  } else {
    const out = flags.out ? path.resolve(flags.out) : path.join(home(), 'renders', `${carId}-compare-${stamp}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, await pairSheet(rows, crop));
    console.log(`wrote ${out}\n  ${rows.length} row(s): ${rows.map((r) => r.view).join(', ')}. Left = reference, right = our render.`);
  }
  fs.rmSync(tmp, { recursive: true, force: true });
  return 0;
}
