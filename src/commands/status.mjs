import fs from 'node:fs';
import path from 'node:path';
import { home, root } from '../lib/paths.mjs';
import { liverykitVersion } from '../engine.mjs';

export const help = `aclivery status      what this machine has ready: car packs, projects, logos, tools, and the usual next step
  Run this first when you do not know where you are. It changes nothing.`;

const list = (dir, filter = () => true) => (fs.existsSync(dir) ? fs.readdirSync(dir).filter(filter) : []);

export async function run() {
  const packs = list(path.join(home(), 'cars'), (n) => fs.existsSync(path.join(home(), 'cars', n, 'profile.json')));
  const projects = list(path.join(home(), 'projects'), (n) => fs.existsSync(path.join(home(), 'projects', n, 'brief.json')));
  const logos = list(path.join(root, 'assets', 'logos'), (n) => /\.(png|jpe?g|webp|svg)$/i.test(n));
  const shippedMaps = list(path.join(root, 'cars'));

  console.log(`aclivery status  (node ${process.version}, liverykit ${liverykitVersion()})`);
  console.log(`  car packs   : ${packs.length ? packs.join(', ') : 'none'}`);
  console.log(`  projects    : ${projects.length ? projects.join(', ') : 'none'}`);
  console.log(`  logos       : ${logos.length ? logos.length + ' file(s) in assets/logos' : 'none'}`);
  console.log(`  region maps : ${shippedMaps.length ? shippedMaps.join(', ') : 'none shipped'} (cars with a hand-made region map)`);

  let next;
  if (!packs.length) next = 'No car pack yet. Ask the user which car and whether they have its .kn5 file, then: aclivery car prep <kn5> --skins <skins dir>. No .kn5? See docs/user-journey.md, "when something is missing".';
  else if (!projects.length) next = `Start a project: aclivery brief init <slug> --title "..." --car ${packs[0]}`;
  else next = `Resume: aclivery brief show ${projects[0]}`;
  console.log(`\nnext: ${next}`);
  return 0;
}
