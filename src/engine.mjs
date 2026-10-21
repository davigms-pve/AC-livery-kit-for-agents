// The one place this repo touches liverykit's internals.
//
// liverykit is pinned (package.json) to a commit, and everything else in this repo goes through the
// functions below. If liverykit changes shape, or we swap the engine, this is the only file to edit.
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire(import.meta.url);
const lkRoot = path.dirname(require.resolve('liverykit/package.json'));
const lk = (rel) => import(`liverykit/src/${rel}`);

export const liverykitVersion = () => require('liverykit/package.json').version;
export const liverykitCli = () => path.join(lkRoot, 'bin', 'liverykit.mjs');

export async function readModel(kn5Path, { textures = false } = {}) {
  const { parseKn5 } = await lk('engine/kn5.mjs');
  return parseKn5(kn5Path, { keepTextureData: textures });
}

export async function decodeTexture(buffer, maxSize = 4096) {
  const { decodeDds } = await lk('engine/pipeline.mjs');
  return decodeDds(buffer, { maxSize });
}

/** Everything `renderViews` needs: geometry grouped by material, and the car's own stock sheets. */
export async function prepareScene(model, profile, roles) {
  const { wholeModelGeometry } = await lk('engine/geometry.mjs');
  const { carSheets } = await lk('engine/shot.mjs');
  const files = roles.map((role) => ({ role, file: profile.textures[role].file }));
  const geometry = wholeModelGeometry(model, files, { livery: {}, profile });
  const byName = new Map((model.textures ?? []).map((t) => [t.name.toLowerCase(), t]));
  const stock = await carSheets(geometry.groups, (file) => byName.get(String(file).toLowerCase())?.data ?? null);
  return { geometry, sheets: stock.sheets, absent: stock.absent };
}

/** Extra named cameras, so a reference photo's angle can be matched. Yaw 0 = nose, +PI/2 = car's left. */
export async function cameras() {
  const { VIEWS } = await lk('engine/shot.mjs');
  VIEWS['front-right'] ??= { yaw: -Math.PI / 4, pitch: 0.22 };
  VIEWS['rear-right'] ??= { yaw: -3 * Math.PI / 4, pitch: 0.22 };
  return VIEWS;
}

/** One image holding every requested view, labelled. One image is one model turn. */
export async function renderSheet(scene, { views, width = 1400, height = 840 }) {
  const { shootSheet } = await lk('engine/shot.mjs');
  await cameras();
  return shootSheet(scene.geometry, scene.geometry.groups, [], { sheets: scene.sheets, views, width, height });
}

export async function renderView(scene, { view, width = 1200, height = 700 }) {
  const { shoot } = await lk('engine/shot.mjs');
  await cameras();
  return shoot(scene.geometry, scene.geometry.groups, [], { sheets: scene.sheets, view, width, height });
}

export async function encodeDds(rgba, width, height, { alpha = false } = {}) {
  const dds = await lk('engine/dds.mjs');
  return dds.encodeDds(rgba, width, height, { alpha });
}

export async function packageSkinZip(opts) {
  const { packageZip } = await lk('engine/package.mjs');
  return packageZip(opts);
}

/**
 * For textures liverykit measured no panels on (door plates, decal sheets), find where the model actually samples
 * them: the UV bounding box of every triangle that uses the texture, overall and split by car side (x > 0 is left).
 * Returns { role: { rect:[u,v,w,h], triangles, sides: { left: rect, right: rect } } }.
 */
export function measureTextureUsage(model, profile, roles) {
  return lk('engine/geometry.mjs').then(({ wholeModelGeometry }) => {
    const files = roles.map((role) => ({ role, file: profile.textures[role].file }));
    const g = wholeModelGeometry(model, files, { livery: {}, profile });
    const out = {};
    const grow = (b, u, v) => { b[0] = Math.min(b[0], u); b[1] = Math.min(b[1], v); b[2] = Math.max(b[2], u); b[3] = Math.max(b[3], v); };
    const toRect = (b) => [b[0], b[1], b[2] - b[0], b[3] - b[1]].map((n) => +n.toFixed(4));
    for (const role of roles) {
      const all = [1, 1, 0, 0], sides = { left: [1, 1, 0, 0], right: [1, 1, 0, 0] };
      let tris = 0;
      for (const grp of g.groups.filter((x) => x.role === role)) {
        for (let i = grp.start; i + 2 < grp.start + grp.count; i += 3) {
          const ids = [g.indices[i], g.indices[i + 1], g.indices[i + 2]];
          const cx = (g.positions[ids[0] * 3] + g.positions[ids[1] * 3] + g.positions[ids[2] * 3]) / 3;
          for (const id of ids) {
            const u = g.uvs[id * 2], v = g.uvs[id * 2 + 1];
            grow(all, u, v); grow(cx > 0 ? sides.left : sides.right, u, v);
          }
          tris++;
        }
      }
      if (tris) out[role] = { rect: toRect(all), triangles: tris, sides: { left: sides.left[2] >= sides.left[0] ? toRect(sides.left) : null, right: sides.right[2] >= sides.right[0] ? toRect(sides.right) : null } };
    }
    return out;
  });
}
