import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { home } from '../lib/paths.mjs';

export const help = `aclivery photos <folder> [--brief <slug>] [--out <dir>] [--per 6]
  Takes EVERY photo the user gave you: makes numbered contact sheets (6 photos per image) so you can look at all of them in
  a few images instead of guessing which ones matter. With --brief, each photo is also added to the project's references
  (numbered as in the brief), still without a view: you give each one a view after looking.
  --out   where the sheets go (default .aclivery/renders/photos-<time>). --per  photos per sheet (4 to 9, default 6).
  Then: open each sheet, and for every number decide the view (left, right, front, rear, top, front-left, front-right,
  rear-left, rear-right) and a one-line note of what it shows: aclivery brief set <slug> references.N.view <view>
  Safe to run again after the user adds photos: photos already in the brief are skipped.`;

const IMAGE = /\.(jpe?g|png|webp)$/i;
const CELL_W = 640, CELL_H = 440;

export async function run(argv) {
  const { flags, positional } = parseArgs(argv);
  const [folder] = positional;
  if (!folder) throw new UsageError(help);
  if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) throw new UsageError(`not a folder: ${folder}`);
  const per = Math.max(4, Math.min(9, Number(flags.per ?? 6) || 6));
  const names = fs.readdirSync(folder).filter((n) => IMAGE.test(n)).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  if (!names.length) throw new UsageError(`no photos (jpg, png, webp) in ${folder}`);
  const asGiven = (n) => path.join(folder, n).replace(/\\/g, '/');

  // With a brief: register what is new; numbers are the brief's own reference numbers.
  let brief = null, briefFile = null, numberOf = new Map();
  if (flags.brief) {
    briefFile = path.join(home(), 'projects', String(flags.brief), 'brief.json');
    if (!fs.existsSync(briefFile)) throw new UsageError(`no project "${flags.brief}". Start one: aclivery brief init ${flags.brief} --title "..."`);
    brief = JSON.parse(fs.readFileSync(briefFile, 'utf8'));
    brief.references ??= [];
    const known = new Map(brief.references.map((r, i) => [path.resolve(String(r.file ?? '')), i]));
    let added = 0;
    for (const n of names) {
      const abs = path.resolve(asGiven(n));
      if (!known.has(abs)) { brief.references.push({ file: asGiven(n) }); known.set(abs, brief.references.length - 1); added++; }
      numberOf.set(n, known.get(abs));
    }
    if (added) fs.writeFileSync(briefFile, JSON.stringify(brief, null, 1));
    console.log(`${names.length} photo(s) in ${folder}: ${added} added to the brief, ${names.length - added} already there`);
  } else names.forEach((n, i) => numberOf.set(n, i));

  const out = path.resolve(flags.out ?? path.join(home(), 'renders', `photos-${new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)}`));
  fs.mkdirSync(out, { recursive: true });
  const cols = 3, rows = Math.ceil(per / cols);
  const sheets = [];
  for (let s = 0; s * per < names.length; s++) {
    const chunk = names.slice(s * per, (s + 1) * per);
    const cells = [], labels = [];
    for (const [k, n] of chunk.entries()) {
      const left = (k % cols) * CELL_W, top = Math.floor(k / cols) * CELL_H;
      const buf = await sharp(path.join(folder, n)).rotate().resize({ width: CELL_W - 8, height: CELL_H - 8, fit: 'contain', background: { r: 18, g: 19, b: 24, alpha: 1 } }).png().toBuffer();
      cells.push({ input: buf, left: left + 4, top: top + 4 });
      const nm = n.length > 30 ? n.slice(0, 27) + '...' : n;
      labels.push(`<rect x="${left + 4}" y="${top + 4}" width="${60 + String(numberOf.get(n)).length * 14}" height="34" fill="#000" fill-opacity="0.7"/>` +
        `<text x="${left + 12}" y="${top + 31}" font-family="DejaVu Sans, sans-serif" font-size="26" font-weight="bold" fill="#ffd54a">${numberOf.get(n)}</text>` +
        `<text x="${left + 10}" y="${top + CELL_H - 14}" font-family="DejaVu Sans, sans-serif" font-size="14" fill="#c9ced6">${nm.replace(/[<&]/g, '')}</text>`);
    }
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${cols * CELL_W}" height="${rows * CELL_H}">${labels.join('')}</svg>`;
    const file = path.join(out, `photos-${s + 1}.png`);
    await sharp({ create: { width: cols * CELL_W, height: rows * CELL_H, channels: 4, background: { r: 12, g: 13, b: 16, alpha: 1 } } })
      .composite([...cells, { input: Buffer.from(svg), left: 0, top: 0 }]).png().toFile(file);
    sheets.push({ file, numbers: chunk.map((n) => numberOf.get(n)) });
  }
  for (const s of sheets) console.log(`sheet: ${s.file}  (photos ${s.numbers.join(', ')})`);
  console.log(`\nNEXT: open ${sheets.length === 1 ? 'the sheet' : 'every sheet'} and look at each photo. For each number decide its view and what it shows` +
    (flags.brief ? `: aclivery brief set ${flags.brief} references.N.view <view>   (and references.N.notes "<what to copy from it>")` : '.'));
  return 0;
}
