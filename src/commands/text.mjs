import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { run as decal } from './decal.mjs';

export const help = `aclivery text <car> --panel <name> --text "A. DRIVER" --out <texture.png>
              [--ink #111111] [--font "Verdana, Arial, sans-serif"] [--bold] [--italic] [--spacing 0]
              [--outline #RRGGBB] [--texture role] [--base file | --fill #RRGGBB] [--at x,y,w,h] [--rotate deg]
  Draws the text, then places it on the panel exactly like "aclivery decal" (upright, fitted in the --at box, aspect kept).
  Use it for driver names, the number, plate lettering. --ink is the text colour (not --color: that paints a panel).
  Font note: only fonts installed on this machine are used; the first available of the list wins, otherwise a default
  serif is drawn (the command says so). Check the render for reversed text on mirrored panels.`;

const esc = (s) => s.replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' }[c]));

export async function textImage(text, { ink = '#111111', font = 'Verdana, Arial, DejaVu Sans, sans-serif', bold = false, italic = false, spacing = 0, outline = null } = {}) {
  const size = 320;
  const w = Math.ceil(text.length * size * 0.8 + 80), h = Math.ceil(size * 1.6);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><text x="40" y="${Math.round(size * 1.2)}" ` +
    `font-family="${esc(font)}" font-size="${size}" font-weight="${bold ? 700 : 400}" font-style="${italic ? 'italic' : 'normal'}" ` +
    `letter-spacing="${spacing}" fill="${ink}"${outline ? ` stroke="${outline}" stroke-width="${Math.round(size / 28)}" paint-order="stroke"` : ''}>${esc(text)}</text></svg>`;
  const png = await sharp(Buffer.from(svg), { density: 144 }).png().toBuffer();
  return sharp(png).trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 1 }).png().toBuffer();
}

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['bold', 'italic', 'overlap', 'under'] });
  const [carId] = positional;
  if (!carId || !flags.text || typeof flags.text !== 'string' || !flags.panel || !flags.out) throw new UsageError(help);
  if (flags.text.length > 60) throw new UsageError('text is limited to 60 characters; place longer text in pieces');
  const img = await textImage(flags.text, {
    ink: flags.ink ?? '#111111', font: flags.font, bold: !!flags.bold, italic: !!flags.italic, spacing: Number(flags.spacing ?? 0), outline: flags.outline ?? null,
  });
  const tmp = path.join(os.tmpdir(), `aclivery-text-${process.pid}-${Date.now()}.png`);
  fs.writeFileSync(tmp, img);
  try {
    const pass = [carId, '--panel', flags.panel, '--image', tmp, '--out', flags.out];
    for (const k of ['texture', 'base', 'fill', 'size', 'at', 'rotate', 'opacity']) if (flags[k] !== undefined) pass.push(`--${k}`, String(flags[k]));
    if (flags.overlap) pass.push('--overlap');
    if (flags.under) pass.push('--under');
    pass.push('--label', `text "${flags.text}"`);
    return await decal(pass);
  } finally { fs.rmSync(tmp, { force: true }); }
}
