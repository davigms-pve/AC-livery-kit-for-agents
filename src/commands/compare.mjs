import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { home } from '../lib/paths.mjs';
import { quiet } from '../lib/quiet.mjs';
import { run as render } from './render.mjs';

export const help = `aclivery compare <car> --skin <dir> --ref a.jpg,b.jpg --views front-right,left   [--out file.png]
aclivery compare <car> --skin <dir> --brief <slug>        use the references recorded in the project brief
  One image: each reference photo on the left, our render from the same view on the right, one row per reference.
  Look at it, then say what differs (position, size, colour, missing parts) and fix those, not everything.
  --views  the closest car view to each reference, in order: front-left front-right left right front rear rear-left
           rear-right top three-quarter. left = the car's LEFT side (nose points to the left of the picture).
           In the brief, record it per reference: aclivery brief add <slug> references '{"file":"photo.jpg","view":"right"}'.
  Rows are matched by order. A view is a fixed camera, so expect similar, not identical, framing.`;


export async function run(argv) {
  const { flags, positional } = parseArgs(argv);
  const [carId] = positional;
  if (!carId || !flags.skin || !(flags.brief || (flags.ref && flags.views))) throw new UsageError(help);

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

  const H = 560, RW = 1000;
  const tmp = path.join(home(), 'renders', `_cmp-${Date.now()}`);
  const views = [...new Set(pairs.map((p) => p.view))];
  await quiet(() => render([carId, '--skin', flags.skin, '--views', views.join(','), '--each', '--size', `${RW}x${H}`, '--out', tmp]));

  const rows = [];
  for (const p of pairs) {
    const ref = await sharp(p.file).rotate().resize({ height: H, width: 900, fit: 'contain', background: { r: 16, g: 16, b: 22, alpha: 1 } }).png().toBuffer();
    const ours = fs.readFileSync(path.join(tmp, `${p.view}.png`));
    rows.push({ ref, ours, view: p.view, name: path.basename(p.file) });
  }
  const W = 900 + RW, total = rows.length * H;
  const label = (x, y, t) => `<text x="${x}" y="${y}" font-family="DejaVu Sans, sans-serif" font-size="16" fill="#d8dde3">${t.replace(/[<&]/g, '')}</text>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${total}">` +
    rows.map((r, i) => label(10, i * H + 22, `reference: ${r.name}`) + label(910, i * H + 22, `ours: ${r.view}`)).join('') + '</svg>';
  const sheet = await sharp({ create: { width: W, height: total, channels: 4, background: { r: 12, g: 13, b: 16, alpha: 1 } } })
    .composite([...rows.flatMap((r, i) => [{ input: r.ref, left: 0, top: i * H }, { input: r.ours, left: 900, top: i * H }]), { input: Buffer.from(svg), left: 0, top: 0 }])
    .png().toBuffer();
  const out = flags.out ? path.resolve(flags.out) : path.join(home(), 'renders', `${carId}-compare-${Date.now()}.png`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, sheet);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`wrote ${out}\n  ${rows.length} row(s): ${rows.map((r) => r.view).join(', ')}. Left = reference, right = our render.`);
  return 0;
}
