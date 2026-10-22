import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { packDir, root, loadPack } from '../lib/paths.mjs';
import { readModel, liverykitCli, liverykitVersion, measureTextureUsage } from '../engine.mjs';

export const help = `aclivery car prep <car.kn5> [--car-id id] [--skins dir] [--psd EXT_Main.psd] [--regions panel_map.json]
  One-time, heavy step. Reads the car model and writes a small "car pack" under .aclivery/cars/<id>/ :
  profile.json (panels measured from the model), index.json (compact panel table), meta.json, and
  optionally template/ PNGs (UV wireframe, AO) extracted from the modder's PSD. The agent never opens the .kn5.
aclivery car info <car-id>      what a prepared pack contains
aclivery car notes <car-id>     facts we already know about this car (panels, textures, pitfalls): read before starting
aclivery car size <car-id> <texture-role> <WxH>   record a texture's real size when the model only has a low-res copy
  (e.g. door_plates 2048x640 from the modder's PSD). Panels are UV fractions, so this only fixes the canvas aspect ratio.
aclivery car stock <car-id> <texture-role> [--out file.dds] [--force]   save the car's own copy of a texture (default assets/stock/<file>.dds), to use as a design's "base"
  (it keeps the stock tint, stickers and cut-outs). Reads the model once; the file is the modder's work, so it stays local and is never committed.
  An existing file is never overwritten without --force (it may be a better copy, for example the modder's full-size template).`;

const sha1 = (file) => crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['json', 'force'] });
  const [sub, target] = positional;
  if (sub === 'info') return info(target, flags);
  if (sub === 'notes') {
    const f = path.join(root, 'cars', target ?? '', 'notes.md');
    if (!target || !fs.existsSync(f)) { console.log(`no notes for ${target ?? '<car>'} yet. Write cars/<id>/notes.md as you learn the car (see cars/rss_gtm_protech_p92_f6/notes.md).`); return 0; }
    console.log(fs.readFileSync(f, 'utf8')); return 0;
  }
  if (sub === 'size') return setSize(target, positional[2], positional[3]);
  if (sub === 'stock') return stock(target, positional[2], flags);
  if (sub !== 'prep' || !target) throw new UsageError(help);

  const kn5 = path.resolve(target);
  if (!fs.existsSync(kn5)) throw new UsageError(`model not found: ${kn5}`);
  const carId = flags['car-id'] ?? path.basename(kn5, path.extname(kn5));
  const dir = packDir(carId);
  fs.mkdirSync(dir, { recursive: true });

  const model = await readModel(kn5);
  if (model.encrypted) {
    throw new UsageError(`${path.basename(kn5)} is CSP-encrypted: its geometry cannot be read, so panels cannot be measured.\n  This kit does not decrypt third-party models. Ask the car's author for an unencrypted copy.`);
  }
  console.log(`model: ${model.meshes.length} meshes, ${model.textures.length} textures, not encrypted`);
  if (!flags.skins) console.log('note: no --skins given, so texture sizes in the pack are the model\'s low-res embedded copies (EXT_Main shows 780x256, not its real size). Pass a skins/ folder for true sizes.');

  // Let liverykit measure the panels (it owns that logic); we keep only its output.
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'aclivery-'));
  const args = [liverykitCli(), '--from-kn5', kn5, '--car-id', carId, '--out', tmp];
  if (flags.skins) args.push('--skins', path.resolve(flags.skins));
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', maxBuffer: 1 << 26 });
  const produced = path.join(tmp, `${carId}.json`);
  if (r.status !== 0 || !fs.existsSync(produced)) throw new Error(`liverykit failed to build a profile:\n${r.stdout}\n${r.stderr}`);
  const profile = JSON.parse(fs.readFileSync(produced, 'utf8'));
  // Textures liverykit measured no panels on (door plates, decal sheets) get a synthesized panel from where the model
  // really samples them, so "decal --texture door_plates --panel whole" works.
  // Keep sizes the user recorded with "car size": re-running prep must not forget them.
  const oldFile = path.join(dir, 'profile.json');
  if (fs.existsSync(oldFile)) {
    const old = JSON.parse(fs.readFileSync(oldFile, 'utf8'));
    for (const [role, tex] of Object.entries(old.textures ?? {})) {
      if (tex.sizeFrom === 'user' && profile.textures?.[role]) Object.assign(profile.textures[role], { width: tex.width, height: tex.height, sizeFrom: 'user' });
    }
  }
  const empty = Object.keys(profile.textures ?? {}).filter((r) => !Object.keys(profile.panels?.[r] ?? {}).length);
  const usage = empty.length ? await measureTextureUsage(model, profile, empty) : {};
  profile.panels ??= {};
  for (const [role, u] of Object.entries(usage)) {
    const panels = { whole: { rect: u.rect, textRotation: 0, synthesized: true, triangles: u.triangles } };
    // If the two sides sample different parts of the texture (a door plate: left half for the left door, right half
    // for the right), give each side its own panel so one design can address them separately.
    const [l, r] = [u.sides.left, u.sides.right];
    if (l && r) {
      const ix = Math.max(0, Math.min(l[0] + l[2], r[0] + r[2]) - Math.max(l[0], r[0])), iy = Math.max(0, Math.min(l[1] + l[3], r[1] + r[3]) - Math.max(l[1], r[1]));
      const overlap = (ix * iy) / Math.min(l[2] * l[3], r[2] * r[3]);
      if (overlap < 0.25) { panels.left = { rect: l, textRotation: 0, synthesized: true }; panels.right = { rect: r, textRotation: 0, synthesized: true }; }
    }
    profile.panels[role] = panels;
  }
  if (Object.keys(usage).length) console.log(`synthesized whole-texture panels: ${Object.keys(usage).join(', ')}`);
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify(profile));
  fs.rmSync(tmp, { recursive: true, force: true });

  // Compact index: what a small model can afford to read.
  const index = { car: carId, textures: {} };
  for (const [role, tex] of Object.entries(profile.textures ?? {})) {
    const panels = profile.panels?.[role] ?? {};
    index.textures[role] = {
      file: tex.file, width: tex.width, height: tex.height, panels: Object.keys(panels).length,
      bound: Object.entries(profile.bind ?? {}).filter(([, b]) => b.roles?.includes(role)).map(([k]) => k),
    };
  }
  fs.writeFileSync(path.join(dir, 'index.json'), JSON.stringify(index, null, 1));

  fs.writeFileSync(path.join(dir, 'meta.json'), JSON.stringify({
    carId, kn5: kn5, kn5Bytes: fs.statSync(kn5).size, kn5Sha1: sha1(kn5),
    liverykit: liverykitVersion(), createdAt: new Date().toISOString(),
    note: 'kn5 path is read at render time; the pack itself holds only measurements',
  }, null, 1));

  if (flags.regions) {
    fs.copyFileSync(path.resolve(flags.regions), path.join(dir, 'regions.json'));
    console.log('regions: copied');
  } else {
    const shipped = path.join(root, 'cars', carId, 'panel_map.json');
    if (fs.existsSync(shipped)) { fs.copyFileSync(shipped, path.join(dir, 'regions.json')); console.log('regions: using cars/' + carId + '/panel_map.json'); }
  }
  if (flags.psd) await extractTemplate(path.resolve(flags.psd), path.join(dir, 'template'));

  const total = Object.values(index.textures).reduce((n, t) => n + t.panels, 0);
  console.log(`pack written: ${dir}\n  ${Object.keys(index.textures).length} textures, ${total} panels`);
  return 0;
}

async function stock(carId, role, flags) {
  if (!carId || !role) throw new UsageError(help);
  const pack = loadPack(carId);
  const tex = pack.profile.textures?.[role];
  if (!tex) throw new UsageError(`no texture role "${role}". Try: aclivery panel textures ${carId}`);
  const out = path.resolve(flags.out ?? path.join(root, 'assets', 'stock', tex.file));
  if (fs.existsSync(out) && !flags.force) { console.log(`kept ${out}: it already exists (use --force to replace it with the model's embedded copy)`); return 0; }
  const kn5 = pack.meta?.kn5;
  if (!kn5 || !fs.existsSync(kn5)) throw new UsageError(`the car model is not at ${kn5}. Re-run: aclivery car prep <kn5>`);
  const model = await readModel(kn5, { textures: true });
  const found = (model.textures ?? []).find((x) => x.name.toLowerCase() === tex.file.toLowerCase());
  if (!found?.data) throw new UsageError(`the model does not embed ${tex.file}`);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, found.data);
  console.log(`wrote ${out} (${found.data.length} bytes). This is the model's embedded copy, which can be smaller than the real texture (check ${tex.width}x${tex.height} against the modder's template).`);
  return 0;
}

function setSize(carId, role, wh) {
  if (!carId || !role || !/^\d+x\d+$/.test(wh ?? '')) throw new UsageError(help);
  const file = path.join(packDir(carId), 'profile.json');
  if (!fs.existsSync(file)) throw new UsageError(`no pack for ${carId}`);
  const profile = JSON.parse(fs.readFileSync(file, 'utf8'));
  const tex = profile.textures?.[role];
  if (!tex) throw new UsageError(`no texture role "${role}". Try: aclivery panel textures ${carId}`);
  const [w, h] = wh.split('x').map(Number);
  console.log(`${role}: ${tex.width}x${tex.height} -> ${w}x${h}${Math.abs(w / h / (tex.width / tex.height) - 1) > 0.02 ? '  (aspect changes: check that this is the real size)' : ''}`);
  tex.width = w; tex.height = h; tex.sizeFrom = 'user';
  fs.writeFileSync(file, JSON.stringify(profile));
  return 0;
}

async function info(carId, flags) {
  if (!carId) throw new UsageError(help);
  const dir = packDir(carId);
  if (!fs.existsSync(dir)) throw new UsageError(`no pack for ${carId}`);
  const index = JSON.parse(fs.readFileSync(path.join(dir, 'index.json'), 'utf8'));
  const meta = JSON.parse(fs.readFileSync(path.join(dir, 'meta.json'), 'utf8'));
  if (flags.json) { console.log(JSON.stringify({ meta, index })); return 0; }
  console.log(`${carId}  (prepared ${meta.createdAt}, liverykit ${meta.liverykit})\n  model: ${meta.kn5}`);
  for (const [role, t] of Object.entries(index.textures)) console.log(`  ${role.padEnd(14)} ${t.file.padEnd(28)} ${String(t.width) + 'x' + t.height}  ${t.panels} panels${t.bound.length ? '  [' + t.bound.join(',') + ']' : ''}`);
  console.log(`  region map: ${fs.existsSync(path.join(dir, 'regions.json')) ? 'yes' : 'no'}   template PNGs: ${fs.existsSync(path.join(dir, 'template')) ? 'yes' : 'no'}   notes: ${fs.existsSync(path.join(root, 'cars', carId, 'notes.md')) ? 'yes (aclivery car notes ' + carId + ')' : 'none yet'}`);
  return 0;
}

/** Pull the UV wireframe, AO and a layer map out of a modder's PSD as small PNGs. */
async function extractTemplate(psdPath, outDir) {
  const { readPsd, initializeCanvas } = await import('ag-psd');
  const sharp = (await import('sharp')).default;
  const mk = (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) });
  initializeCanvas((w, h) => ({ width: w, height: h, getContext: () => ({ createImageData: mk, putImageData() {}, getImageData: (x, y, w2, h2) => mk(w2, h2) }) }), undefined, mk);
  const psd = readPsd(fs.readFileSync(psdPath), { skipCompositeImageData: true, skipThumbnail: true, useImageData: true });
  fs.mkdirSync(outDir, { recursive: true });
  const find = (layers, name, parent) => {
    for (const l of layers ?? []) {
      if (l.name === name && (!parent || l._p === parent)) return l;
      for (const c of l.children ?? []) c._p = l.name;
      const hit = find(l.children, name, parent);
      if (hit) return hit;
    }
  };
  const W = psd.width, H = psd.height, targetW = 2048;
  for (const [file, layer] of [['uv', find(psd.children, 'UV')], ['ao', find(psd.children, 'AO', 'AO')]]) {
    if (!layer?.imageData) { console.log(`template: layer for ${file} not found`); continue; }
    const full = Buffer.alloc(W * H * 4);
    const d = layer.imageData;
    for (let y = 0; y < d.height; y++) for (let x = 0; x < d.width; x++) {
      const t = ((layer.top + y) * W + layer.left + x) * 4, s = (y * d.width + x) * 4;
      if (t >= 0 && t < full.length) { full[t] = d.data[s]; full[t + 1] = d.data[s + 1]; full[t + 2] = d.data[s + 2]; full[t + 3] = d.data[s + 3]; }
    }
    await sharp(full, { raw: { width: W, height: H, channels: 4 } }).resize(targetW).png().toFile(path.join(outDir, `${file}_${targetW}.png`));
    console.log(`template: wrote ${file}_${targetW}.png`);
  }
}
