import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { validateDds, worst } from '../lib/dds.mjs';
import { packDir } from '../lib/paths.mjs';

export const help = `aclivery validate dds <file.dds>        check one DDS header, mips and size
aclivery validate skin <skinDir> [--car <id>]   check a whole skin folder before installing
  exit code 1 when anything is an error. --json for machine output.`;

const print = (name, { info, issues }) => {
  const detail = info.width ? `${info.width}x${info.height} ${info.fourCC ?? 'RGB'} mips=${info.mips}` : '';
  console.log(`${worst(issues).toUpperCase().padEnd(5)} ${name} ${detail}`);
  for (const i of issues) console.log(`   ${i.level}: ${i.message}`);
};

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['json'] });
  const [what, target] = positional;
  if (!what || !target) throw new UsageError(help);

  if (what === 'dds') {
    const result = validateDds(target);
    if (flags.json) console.log(JSON.stringify(result, null, 1)); else print(path.basename(target), result);
    return worst(result.issues) === 'error' ? 1 : 0;
  }

  if (what === 'skin') {
    const results = [];
    const add = (level, message) => results.push({ level, message });
    if (!fs.existsSync(target)) throw new UsageError(`skin folder not found: ${target}`);
    const files = fs.readdirSync(target);
    const lower = new Map(files.map((f) => [f.toLowerCase(), f]));

    // ui_skin.json: community sources disagree on the exact key names, so only structure is checked.
    if (!lower.has('ui_skin.json')) add('warn', 'ui_skin.json is missing (the skin shows no name or number in the car list)');
    else {
      try {
        const ui = JSON.parse(fs.readFileSync(path.join(target, lower.get('ui_skin.json')), 'utf8'));
        if (typeof ui !== 'object' || Array.isArray(ui)) add('error', 'ui_skin.json is not a JSON object');
        else if (!Object.keys(ui).some((k) => /^skin ?name$/i.test(k))) add('warn', 'ui_skin.json has no skinname key');
        else if (!('number' in ui)) add('note', 'ui_skin.json has no "number" key; the car number shows only if the car reads it');
      } catch (e) { add('error', `ui_skin.json is not valid JSON: ${e.message}`); }
    }
    if (lower.has('cm_skin.json')) add('warn', 'cm_skin.json is present: Content Manager dynamic paint can tint the body over the livery (delete it unless intended)');
    if (!lower.has('preview.jpg')) add('note', 'preview.jpg is missing (blank tile in the car list)');

    let known = null;
    if (flags.car) {
      const p = path.join(packDir(flags.car), 'profile.json');
      if (fs.existsSync(p)) known = new Set(Object.values(JSON.parse(fs.readFileSync(p, 'utf8')).textures ?? {}).map((t) => t.file.toLowerCase()));
      else add('note', `no car pack for ${flags.car}; texture names not cross-checked`);
    }

    const dds = files.filter((f) => /\.dds$/i.test(f));
    if (!dds.length) add('error', 'no .dds files in the skin folder: it changes nothing in-game');
    const perFile = [];
    for (const f of dds) {
      const r = validateDds(path.join(target, f));
      perFile.push([f, r]);
      if (known && !known.has(f.toLowerCase())) add('warn', `${f} is not a texture this car's model uses; it will be ignored`);
    }

    if (flags.json) console.log(JSON.stringify({ skin: results, files: Object.fromEntries(perFile) }, null, 1));
    else {
      console.log(`${target}: ${files.length} files, ${dds.length} DDS`);
      for (const r of results) console.log(`   ${r.level}: ${r.message}`);
      for (const [f, r] of perFile) print(f, r);
    }
    return results.some((r) => r.level === 'error') || perFile.some(([, r]) => worst(r.issues) === 'error') ? 1 : 0;
  }
  throw new UsageError(help);
}
