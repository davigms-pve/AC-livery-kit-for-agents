import fs from 'node:fs';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { loadPack } from '../lib/paths.mjs';
import { encodeDds, packageSkinZip } from '../engine.mjs';
import { validateDds, worst } from '../lib/dds.mjs';

export const help = `aclivery export <workDir> --car <id> --name <SkinFolderName> [--out dist] [--alpha EXT_Main,...] [--no-zip]
  Builds an installable skin from a work folder:
    <workDir>/*.png          full-size textures named like the car's (EXT_Main.png ...), encoded to DDS with a full mip chain
    <workDir>/*.dds          already-encoded textures, copied as they are
    <workDir>/ui_skin.json, preview.jpg, ext_config.ini ...   copied as they are
  Output: <out>/<Name>/ (the skin folder) and <out>/<Name>.zip laid out as content/cars/<car>/skins/<Name>/ for
  Content Manager (drag the zip onto it). DXT1 by default; list textures that need transparency in --alpha (DXT5).
  Every DDS produced is validated; the export fails if one is broken.
  Prefer: aclivery apply <design.json> --export. It does this AND writes ui_skin.json (the name and number in the car list) and a
  preview.jpg. This low-level command only packages what is in <workDir>; it warns when those two are missing.`;

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['no-zip'] });
  const [work] = positional;
  if (!work || !flags.car || !flags.name) throw new UsageError(help);
  if (!/^[\w .-]+$/.test(flags.name)) throw new UsageError('--name may contain letters, digits, space, . _ -');
  const pack = loadPack(flags.car);
  const known = new Map(Object.values(pack.profile.textures).map((t) => [path.parse(t.file).name.toLowerCase(), t.file]));

  const outRoot = path.resolve(flags.out ?? 'dist');
  const skinDir = path.join(outRoot, flags.name);
  fs.rmSync(skinDir, { recursive: true, force: true });
  fs.mkdirSync(skinDir, { recursive: true });
  const alpha = new Set(String(flags.alpha ?? '').split(',').filter(Boolean).map((s) => s.toLowerCase()));

  let failed = false;
  for (const f of fs.readdirSync(work)) {
    const src = path.join(work, f), { name, ext } = path.parse(f);
    if (/^\.png$/i.test(ext) && known.has(name.toLowerCase())) {
      const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const target = known.get(name.toLowerCase());
      const dds = await encodeDds(data, info.width, info.height, { alpha: alpha.has(name.toLowerCase()) });
      fs.writeFileSync(path.join(skinDir, target), dds);
      console.log(`encoded ${f} -> ${target} (${info.width}x${info.height}, ${alpha.has(name.toLowerCase()) ? 'DXT5' : 'DXT1'})`);
    } else if (/^\.png$/i.test(ext) && !['preview', 'livery'].includes(name.toLowerCase())) {
      console.log(`skipped ${f}: not a texture this car uses (known: ${[...known.values()].slice(0, 4).join(', ')} ...)`);
    } else if (/.placements.json$|^.aclivery-work$/i.test(f)) {
      continue;   // the kit's own bookkeeping, never part of a skin
    } else if (fs.statSync(src).isFile()) {
      fs.copyFileSync(src, path.join(skinDir, f));
    }
  }

  for (const f of fs.readdirSync(skinDir).filter((x) => /\.dds$/i.test(x))) {
    const { issues, info } = validateDds(path.join(skinDir, f));
    const level = worst(issues);
    console.log(`${level.toUpperCase().padEnd(5)} ${f} ${info.width}x${info.height} ${info.fourCC} mips=${info.mips}`);
    for (const i of issues) console.log(`   ${i.level}: ${i.message}`);
    if (level === 'error') failed = true;
  }
  if (failed) { console.log('export failed: fix the errors above'); return 1; }
  for (const [f, what] of [['ui_skin.json', 'the skin shows no name or number in the car list'], ['preview.jpg', 'the skin shows a blank tile in the car list']]) {
    if (!fs.existsSync(path.join(skinDir, f))) console.log(`warning: no ${f} in ${work}: ${what}. aclivery apply <design.json> --export writes both.`);
  }
  console.log(`skin folder: ${skinDir}`);
  if (!flags['no-zip']) {
    const zipPath = path.join(outRoot, `${flags.name}.zip`);
    const n = await packageSkinZip({ skinDir, zipPath, carId: flags.car, skinFolder: flags.name, layout: 'cm' });
    console.log(`zip: ${zipPath} (${n} files). Drag onto Content Manager, then fully restart Assetto Corsa (it caches skin names).`);
  }
  console.log('not verified: this has not been loaded in the game. Check it in Content Manager before sharing.');
  return 0;
}
