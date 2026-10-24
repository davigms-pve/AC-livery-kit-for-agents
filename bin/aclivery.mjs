#!/usr/bin/env node
import { UsageError } from '../src/lib/args.mjs';

const commands = {
  car: () => import('../src/commands/car.mjs'),
  panel: () => import('../src/commands/panel.mjs'),
  render: () => import('../src/commands/render.mjs'),
  logo: () => import('../src/commands/logo.mjs'),
  validate: () => import('../src/commands/validate.mjs'),
  decal: () => import('../src/commands/decal.mjs'),
  text: () => import('../src/commands/text.mjs'),
  compare: () => import('../src/commands/compare.mjs'),
  brief: () => import('../src/commands/brief.mjs'),
  status: () => import('../src/commands/status.mjs'),
  apply: () => import('../src/commands/apply.mjs'),
  export: () => import('../src/commands/export.mjs'),
  photos: () => import('../src/commands/photos.mjs'),
};

const summary = `aclivery: Assetto Corsa livery helper for agents. Few commands, short output.

  aclivery status                      where am I? what is ready, and the usual next step
  aclivery brief init|show|set|add     the project's memory: decisions, what is missing, THE next step
  aclivery photos <folder>             look at ALL the user's photos: numbered contact sheets, added to the brief
  aclivery car prep <car.kn5>          one-time: build a small car pack from the model
  aclivery panel list <car> ...        which panels exist, where, which way up, how visible
  aclivery render <car> --skin <dir>   draw the car wearing a skin (one contact-sheet image)
  aclivery logo fetch|inspect|prep     get and prepare logos (asks before downloading)
  aclivery decal <car> --panel ...     place one image on a named panel, upright
  aclivery text <car> --panel ...      draw text (names, number) and place it the same way
  aclivery compare <car> --skin ...    reference photo next to our render from the same view
  aclivery apply <design.json>         build the whole skin from one design file (assets, layers, sheet, optional export)
  aclivery validate dds|skin ...       check DDS files and skin folders before installing
  aclivery export <workDir> ...        encode textures to DDS and zip for Content Manager

  aclivery <command> --help            details`;

const [name, ...rest] = process.argv.slice(2);
if (!name || name === '--help' || name === '-h') { console.log(summary); process.exit(0); }
if (!commands[name]) { console.error(`unknown command "${name}"\n\n${summary}`); process.exit(2); }

try {
  const mod = await commands[name]();
  if (rest.includes('--help') || rest.includes('-h')) { console.log(mod.help); process.exit(0); }
  process.exitCode = (await mod.run(rest)) ?? 0;
} catch (e) {
  if (e instanceof UsageError) { console.error(e.message); process.exitCode = 2; }
  else { console.error(`error: ${e.message}`); if (process.env.ACLIVERY_DEBUG) console.error(e.stack); process.exitCode = 1; }
}
