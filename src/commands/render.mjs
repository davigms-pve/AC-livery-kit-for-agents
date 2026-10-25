import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { loadPack, home } from '../lib/paths.mjs';
import { readModel, decodeTexture, prepareScene, renderSheet, renderView } from '../engine.mjs';

export const DEFAULT_VIEWS = ['front-left', 'front-right', 'left', 'right', 'top', 'rear-left'];

export const help = `aclivery render <car> (--skin <dir|file> | --regions) [--views a,b,c] [--size 1400x840] [--out file.png] [--each]
                         [--probe panelA,panelB] [--texture role] [--kn5 path]
  Draws the car wearing the skin, headless (about 2 s per view). By default ONE image holding every view,
  because every image shown to a model costs a turn.
  --skin   a folder of .dds/.png overrides named like the car's textures (a body texture, a small texture ...)
           or a single texture file. PNGs let you preview work in progress without encoding DDS.
  --views  front-left, front-right, left, right, front, rear, rear-left, rear-right, top, three-quarter
           (default: ${DEFAULT_VIEWS.join(', ')}). left = the car's left, as in the game.
  --probe  paint these panels flat magenta first, to see where a panel lands. Needs --texture if not the body.
  --regions  no skin needed: paint each named region of the car a different colour and print the legend. Use it to
           learn the layout and let the user point at the part they mean.
  --each   one PNG per view instead of a contact sheet. With --out, give a FOLDER (it gets <view>.png per view), not a file.
  Limits: no reflections or normal maps; textures other than the ones you pass show the car's own stock art.`;

async function loadOverride(file, maxSize = 4096) {
  if (/\.dds$/i.test(file)) {
    const s = await decodeTexture(fs.readFileSync(file), maxSize);
    if (!s) throw new Error(`could not decode ${file} (try: aclivery validate dds ${file})`);
    return s;
  }
  const img = sharp(file).ensureAlpha();
  const meta = await img.metadata();
  const scale = Math.min(1, maxSize / Math.max(meta.width, meta.height));
  const { data, info } = await img.resize(Math.round(meta.width * scale), Math.round(meta.height * scale)).raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

function paintProbe(sheet, rect, [r, g, b] = [255, 0, 255]) {
  const [u, v, w, h] = rect;
  const x0 = Math.floor(u * sheet.w), x1 = Math.ceil((u + w) * sheet.w), y0 = Math.floor(v * sheet.h), y1 = Math.ceil((v + h) * sheet.h);
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
    const o = (y * sheet.w + x) * 4; sheet.data[o] = r; sheet.data[o + 1] = g; sheet.data[o + 2] = b; sheet.data[o + 3] = 255;
  }
}

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['each', 'json'] });
  const [carId] = positional;
  if (!carId || !(flags.skin || flags.regions)) throw new UsageError(help);
  if (flags.each && /\.(png|jpe?g|webp)$/i.test(String(flags.out ?? ''))) throw new UsageError(`--each writes one PNG per view (<view>.png) into a folder, so --out must be a folder, not a file (${flags.out}). Drop --each for one contact sheet in a file, or give a folder.`);
  const pack = loadPack(carId);
  const kn5 = path.resolve(flags.kn5 ?? pack.meta?.kn5 ?? '');
  if (!fs.existsSync(kn5)) throw new UsageError(`car model not found at ${kn5}. Pass --kn5 <path>, or re-run: aclivery car prep <kn5>`);
  const profile = pack.profile;

  // --regions: no skin needed; paint each named region of the car a different colour, to learn the layout.
  const REGION_COLOURS = [[230, 60, 60], [240, 150, 40], [235, 210, 50], [70, 190, 90], [60, 190, 200], [70, 110, 230], [150, 90, 220], [230, 90, 180], [140, 140, 140]];
  let regionLegend = null;
  if (flags.regions) {
    if (!pack.regions) throw new UsageError('this car pack has no region map; use --probe with panel names instead');
    const role = flags.texture ?? profile.bind?.body?.roles?.[0] ?? 'ext_main';
    const t = profile.textures[role], w = Math.min(2048, t.width), h = Math.round(w * t.height / t.width);
    const data = Buffer.alloc(w * h * 4, 235);
    for (let i = 3; i < data.length; i += 4) data[i] = 255;
    regionLegend = [];
    for (const [k, region] of pack.regions.regions.entries()) {
      const c = REGION_COLOURS[k % REGION_COLOURS.length];
      regionLegend.push(`${region.id} ${region.name} = rgb(${c.join(',')})`);
      for (const p of region.panels) {
        const [u, v, pw, ph] = p.rect;
        for (let y = Math.floor(v * h); y < Math.ceil((v + ph) * h); y++) for (let x = Math.floor(u * w); x < Math.ceil((u + pw) * w); x++) {
          const o = (y * w + x) * 4; data[o] = c[0]; data[o + 1] = c[1]; data[o + 2] = c[2];
        }
      }
    }
    flags._regionSheet = { role, sheet: { data, w, h } };
  }

  // Collect overrides: file stem -> texture role (if the profile knows it) or stock texture name.
  const skinPath = flags.skin ? path.resolve(flags.skin) : '';
  const files = flags.regions && !flags.skin ? [] : fs.statSync(skinPath).isDirectory()
    ? fs.readdirSync(skinPath).filter((f) => /\.(dds|png)$/i.test(f)).map((f) => path.join(skinPath, f))
    : [skinPath];
  const roleByStem = new Map(Object.entries(profile.textures).map(([role, t]) => [path.parse(t.file).name.toLowerCase(), role]));
  const overrides = [];
  for (const f of files) {
    const stem = path.parse(f).name.toLowerCase();
    // A .png next to a .dds of the same name is a work-in-progress; prefer the PNG.
    if (/\.dds$/i.test(f) && files.some((g) => path.parse(g).name.toLowerCase() === stem && /\.png$/i.test(g))) continue;
    overrides.push({ file: f, stem, role: roleByStem.get(stem) ?? null });
  }
  if (!overrides.length && !flags.regions) throw new UsageError(`no .dds or .png textures found in ${skinPath}`);

  const t0 = Date.now();
  const model = await readModel(kn5, { textures: true });
  const roles = overrides.filter((o) => o.role).map((o) => o.role);
  const probeRole = flags.texture ?? profile.bind?.body?.roles?.[0] ?? 'ext_main';
  if (flags.probe && !roles.includes(probeRole)) roles.push(probeRole);
  if (flags._regionSheet && !roles.includes(flags._regionSheet.role)) roles.push(flags._regionSheet.role);
  const scene = await prepareScene(model, profile, roles);
  if (flags._regionSheet) scene.sheets.set(flags._regionSheet.role, flags._regionSheet.sheet);

  const notes = [];
  for (const o of overrides) {
    const sheet = await loadOverride(o.file);
    if (o.role) scene.sheets.set(o.role, sheet);
    else {
      // Not a design role: replace the car's stock art for that file name, whatever the model spells it.
      const key = [...scene.sheets.keys()].find((k) => path.parse(String(k)).name.toLowerCase() === o.stem) ?? path.basename(o.file).replace(/\.png$/i, '.dds');
      scene.sheets.set(key, sheet);
      notes.push(`${path.basename(o.file)} applied as stock-texture override`);
    }
  }
  if (flags.probe) {
    if (!scene.sheets.has(probeRole)) {
      const t = profile.textures[probeRole];
      const w = Math.min(2048, t.width), h = Math.round(w * t.height / t.width), data = Buffer.alloc(w * h * 4, 160);
      for (let i = 3; i < data.length; i += 4) data[i] = 255;
      scene.sheets.set(probeRole, { data, w, h });
    }
    for (const name of String(flags.probe).split(',').filter(Boolean)) {
      const panel = profile.panels?.[probeRole]?.[name];
      if (!panel) throw new UsageError(`no panel "${name}" in ${probeRole}. Try: aclivery panel list ${carId} --texture ${probeRole}`);
      paintProbe(scene.sheets.get(probeRole), panel.rect);
    }
  }

  const views = flags.views ? String(flags.views).split(',') : DEFAULT_VIEWS;
  const [W, H] = String(flags.size ?? (flags.each ? '1200x700' : '1400x840')).split('x').map(Number);
  const outDir = path.resolve(path.join(home(), 'renders'));
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const written = [];
  if (flags.each) {
    for (const view of views) {
      const { png } = await renderView(scene, { view, width: W, height: H });
      const out = flags.out ? path.join(path.resolve(flags.out), `${view}.png`) : path.join(outDir, `${carId}-${stamp}-${view}.png`);
      fs.mkdirSync(path.dirname(out), { recursive: true });
      fs.writeFileSync(out, png); written.push(out);
    }
  } else {
    const { png } = await renderSheet(scene, { views, width: W, height: H });
    const out = flags.out ? path.resolve(flags.out) : path.join(outDir, `${carId}-${stamp}.png`);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    fs.writeFileSync(out, png); written.push(out);
  }
  const result = { regionLegend, written, views, seconds: +((Date.now() - t0) / 1000).toFixed(1), stockTexturesMissing: scene.absent.length, notes };
  if (flags.json) console.log(JSON.stringify(result));
  else {
    console.log(`wrote ${written.join('\n      ')}\n  views: ${views.join(', ')}  (${result.seconds}s)`);
    if (scene.absent.length) console.log(`  note: ${scene.absent.length} stock textures could not be decoded and draw grey`);
    for (const n of notes) console.log(`  note: ${n}`);
    if (regionLegend) console.log(['  regions (colour on the car):', ...regionLegend.map((l) => `    ${l}`)].join('\n'));
  }
  return 0;
}
