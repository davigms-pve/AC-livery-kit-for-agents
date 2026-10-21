import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { UsageError } from './args.mjs';

/** The repo root, so commands behave the same whatever folder an agent was started in. */
export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

/** Where derived car packs live. Overridable (ACLIVERY_HOME) so a pack can sit on a bigger disk or be shared. */
export const home = () => path.resolve(process.env.ACLIVERY_HOME ?? path.join(root, '.aclivery'));
export const packDir = (carId) => path.join(home(), 'cars', carId);

/** Read a car pack, or fail with the one command that creates it. */
export function loadPack(carId) {
  const dir = packDir(carId);
  const file = path.join(dir, 'profile.json');
  if (!fs.existsSync(file)) {
    throw new UsageError(`No car pack for "${carId}" (looked in ${dir}).\n  Create it once with: aclivery car prep <path to ${carId}.kn5>`);
  }
  const read = (name) => {
    const p = path.join(dir, name);
    return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
  };
  return { dir, profile: read('profile.json'), meta: read('meta.json'), regions: read('regions.json') };
}
