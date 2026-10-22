import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import sharp from 'sharp';
import { parseArgs } from '../src/lib/args.mjs';
import { validateDds, worst } from '../src/lib/dds.mjs';
import { encodeDds } from '../src/engine.mjs';

const bin = path.resolve('bin/aclivery.mjs');
const run = (args, env = {}) => spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'aclivery-test-'));

test('args: flags, booleans and positionals', () => {
  const r = parseArgs(['a', '--x', '1', '--yes', 'b', '--k=v'], { bools: ['yes'] });
  assert.deepEqual(r.positional, ['a', 'b']);
  assert.deepEqual(r.flags, { x: '1', yes: true, k: 'v' });
});

test('dds: an encoded file validates, a truncated one does not', async () => {
  const dir = tmp();
  const rgba = Buffer.alloc(64 * 32 * 4, 200);
  const good = path.join(dir, 'good.dds');
  fs.writeFileSync(good, await encodeDds(rgba, 64, 32));
  assert.equal(worst(validateDds(good).issues), 'ok');
  const cut = path.join(dir, 'cut.dds');
  fs.writeFileSync(cut, fs.readFileSync(good).subarray(0, 300));
  assert.ok(validateDds(cut).issues.some((i) => i.level === 'error' && /truncated/.test(i.message)));
});

test('dds: RGB flag with a zero bit count is reported as the invalid-bpp case', () => {
  const dir = tmp();
  const head = Buffer.alloc(128 + 64);
  head.write('DDS ', 0, 'latin1'); head.writeUInt32LE(124, 4); head.writeUInt32LE(0x1007 | 0x20000, 8);
  head.writeUInt32LE(4, 12); head.writeUInt32LE(4, 16); head.writeUInt32LE(1, 28);
  head.writeUInt32LE(32, 76); head.writeUInt32LE(0x40, 80); head.writeUInt32LE(0, 88);
  const f = path.join(dir, 'bad.dds'); fs.writeFileSync(f, head);
  assert.ok(validateDds(f).issues.some((i) => i.level === 'error' && /bit count is 0/.test(i.message)));
});

test('logo prep: --key-bg turns a flat white background transparent, --tint recolours, --trim crops', async () => {
  const dir = tmp();
  const src = path.join(dir, 'in.png');
  const w = 200, h = 100, data = Buffer.alloc(w * h * 3, 255);
  for (let y = 40; y < 60; y++) for (let x = 80; x < 120; x++) { const o = (y * w + x) * 3; data[o] = 200; data[o + 1] = 30; data[o + 2] = 30; }
  await sharp(data, { raw: { width: w, height: h, channels: 3 } }).png().toFile(src);
  const out = path.join(dir, 'out.png');
  const r = run(['logo', 'prep', src, '--out', out, '--key-bg', '--tint', '#102030', '--trim']);
  assert.equal(r.status, 0, r.stderr);
  const { data: px, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  assert.deepEqual([info.width, info.height], [40, 20]);
  assert.deepEqual([...px.subarray(0, 4)], [0x10, 0x20, 0x30, 255]);
});

test('logo fetch never downloads without --yes', () => {
  const r = run(['logo', 'fetch', 'https://example.invalid/logo.png', '--name', 'x']);
  assert.equal(r.status, 2);
  assert.match(r.stdout, /not downloaded/);
});

test('panel list reads a prepared pack', () => {
  const home = tmp();
  const dir = path.join(home, 'cars', 'testcar');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({
    bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 100, height: 50 } },
    panels: { ext_main: {
      left_door: { rect: [0.1, 0.6, 0.2, 0.2], textRotation: 0, visible: 0.9 },
      right_door: { rect: [0.1, 0.1, 0.2, 0.2], textRotation: 180, visible: 0.4 },
    } },
  }));
  const r = run(['panel', 'list', 'testcar', '--side', 'right', '--json'], { ACLIVERY_HOME: home });
  assert.equal(r.status, 0, r.stderr);
  const rows = JSON.parse(r.stdout);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, 'right_door');
  assert.equal(rows[0].rot, 180);
});

test('unknown car gives the one command that fixes it', () => {
  const r = run(['panel', 'list', 'nope'], { ACLIVERY_HOME: tmp() });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /aclivery car prep/);
});

test('decal: a marked corner lands where each panel rotation says (0/90/180/270)', async () => {
  const home = tmp();
  const dir = path.join(home, 'cars', 'rotcar');
  fs.mkdirSync(dir, { recursive: true });
  const rects = { p0: [0.0, 0.0], p90: [0.5, 0.0], p180: [0.0, 0.5], p270: [0.5, 0.5] };
  const panels = {};
  for (const [name, [u, v]] of Object.entries(rects)) panels[name] = { rect: [u, v, 0.5, 0.5], textRotation: Number(name.slice(1)) };
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({
    bind: { body: { roles: ['ext_main'] } }, textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 400 } }, panels: { ext_main: panels },
  }));
  // 8x8 marker: top-left quadrant red, the rest blue.
  const mk = Buffer.alloc(8 * 8 * 3);
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) { const o = (y * 8 + x) * 3; const red = x < 4 && y < 4; mk[o] = red ? 255 : 0; mk[o + 1] = 0; mk[o + 2] = red ? 0 : 255; }
  const img = path.join(dir, 'marker.png');
  await sharp(mk, { raw: { width: 8, height: 8, channels: 3 } }).png().toFile(img);
  const out = path.join(dir, 'out.png');
  let base = null;
  for (const name of Object.keys(rects)) {
    const a = ['decal', 'rotcar', '--panel', name, '--image', img, '--out', out, '--at', '0,0,1,1', ...(base ? ['--base', base] : ['--fill', '#ffffff'])];
    const r = run(a, { ACLIVERY_HOME: home });
    assert.equal(r.status, 0, r.stderr);
    base = out;
  }
  const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const at = (x, y) => [...data.subarray((y * info.width + x) * 3, (y * info.width + x) * 3 + 3)];
  const isRed = (c) => c[0] > 200 && c[2] < 60;
  // The red corner starts top-left; turning clockwise by r moves it to TL (0), TR (90), BR (180), BL (270) of each 200x200 panel.
  const corner = { TL: [5, 5], TR: [195, 5], BR: [195, 195], BL: [5, 195] };
  const expect = { p0: 'TL', p90: 'TR', p180: 'BR', p270: 'BL' };
  for (const [name, [u, v]] of Object.entries(rects)) {
    const ox = u * 400, oy = v * 400;
    for (const [k, [cx, cy]] of Object.entries(corner)) {
      assert.equal(isRed(at(ox + cx, oy + cy)), k === expect[name], `${name} corner ${k}`);
    }
  }
});

test('decal refuses a base whose aspect would stretch the art', async () => {
  const home = tmp();
  const dir = path.join(home, 'cars', 'asp');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({ bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 800, height: 400 } }, panels: { ext_main: { a: { rect: [0, 0, 1, 1], textRotation: 0 } } } }));
  const base = path.join(dir, 'base.png');
  await sharp({ create: { width: 400, height: 400, channels: 3, background: '#fff' } }).png().toFile(base);
  const r = run(['decal', 'asp', '--panel', 'a', '--image', base, '--base', base, '--out', path.join(dir, 'o.png')], { ACLIVERY_HOME: home });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /stretch/);
});

test('dds: a block-compressed size that is not a multiple of 4 is warned about', async () => {
  const dir = tmp();
  const f = path.join(dir, 'odd.dds');
  fs.writeFileSync(f, await encodeDds(Buffer.alloc(30 * 30 * 4, 255), 30, 30));
  assert.ok(validateDds(f).issues.some((i) => /multiples of 4/.test(i.message)));
});

test('brief: names exactly one next step, then moves on as answers arrive', async () => {
  const { gaps } = await import('../src/commands/brief.mjs');
  const none = () => false;
  assert.match(gaps({ car: {} }, {})[0].ask, /Which car/);
  assert.match(gaps({ car: { id: 'x' } }, { packExists: false })[0].ask, /\.kn5/);
  const b = { car: { id: 'x' }, baseColour: 'white', references: [], elements: [{ what: 'Monster logo', target: 'rear quarters' }] };
  const t = gaps(b, { packExists: true, fileExists: none });
  assert.match(t[0].ask, /Which panel/);
  b.elements[0].panel = 'left_rear';
  assert.match(gaps(b, { packExists: true, fileExists: none })[0].ask, /needs an image file/);
  b.elements[0].asset = 'assets/logos/monster.png';
  assert.match(gaps(b, { packExists: true, fileExists: none })[0].ask, /asset .* is missing/);
  assert.match(gaps(b, { packExists: true, fileExists: () => true })[0].do, /aclivery decal/);
});

test('brief: init, set, add and show work through the CLI', () => {
  const home = tmp(), env = { ACLIVERY_HOME: home };
  assert.equal(run(['brief', 'init', 'demo', '--title', 'Demo', '--car', 'c1'], env).status, 0);
  assert.equal(run(['brief', 'set', 'demo', 'baseColour', 'white'], env).status, 0);
  assert.equal(run(['brief', 'add', 'demo', 'elements', '{"what":"stripe","target":"roof"}'], env).status, 0);
  const r = run(['brief', 'show', 'demo', '--json'], env);
  const out = JSON.parse(r.stdout);
  assert.equal(out.brief.baseColour, 'white');
  assert.equal(out.brief.elements.length, 1);
  assert.ok(out.todo.length >= 1);
});

function fakeCar(home, id, texture = { file: 'EXT_Main.dds', width: 200, height: 100 }, panels = { a: { rect: [0.25, 0.25, 0.5, 0.5], textRotation: 0 } }) {
  const dir = path.join(home, 'cars', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({ bind: { body: { roles: ['ext_main'] } }, textures: { ext_main: texture }, panels: { ext_main: panels } }));
}

test('decal: --fill transparent keeps untouched pixels transparent and --color paints the panel', async () => {
  const home = tmp(); fakeCar(home, 'tc');
  const out = path.join(home, 'o.png');
  const r = run(['decal', 'tc', '--panel', 'a', '--color', '#ff0000', '--fill', 'transparent', '--out', out], { ACLIVERY_HOME: home });
  assert.equal(r.status, 0, r.stderr);
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
  assert.equal(px(2, 2)[3], 0);                 // outside the panel: transparent
  assert.deepEqual(px(100, 50), [255, 0, 0, 255]); // inside: solid red
});

test('text: draws pixels inside the panel box and nowhere else', async () => {
  const home = tmp(); fakeCar(home, 'tt', { file: 'EXT_Main.dds', width: 800, height: 400 }, { a: { rect: [0.25, 0.25, 0.5, 0.5], textRotation: 0 } });
  const out = path.join(home, 't.png');
  const r = run(['text', 'tt', '--panel', 'a', '--text', 'HI', '--ink', '#000000', '--bold', '--fill', 'transparent', '--out', out], { ACLIVERY_HOME: home });
  assert.equal(r.status, 0, r.stderr);
  const { data, info } = await sharp(out).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let inside = 0, outside = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 0) { if (x >= 200 && x < 600 && y >= 100 && y < 300) inside++; else outside++; }
  }
  assert.ok(inside > 50, 'some text pixels');
  assert.equal(outside, 0);
});

test('car size: records a real size and a wrong role is explained', () => {
  const home = tmp(); fakeCar(home, 'cs');
  assert.equal(run(['car', 'size', 'cs', 'ext_main', '400x200'], { ACLIVERY_HOME: home }).status, 0);
  const p = JSON.parse(fs.readFileSync(path.join(home, 'cars', 'cs', 'profile.json'), 'utf8'));
  assert.deepEqual([p.textures.ext_main.width, p.textures.ext_main.height, p.textures.ext_main.sizeFrom], [400, 200, 'user']);
  const bad = run(['car', 'size', 'cs', 'nope', '400x200'], { ACLIVERY_HOME: home });
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /no texture role/);
});

test('compare: rejects mismatched reference and view counts before doing any work', () => {
  const home = tmp(); fakeCar(home, 'cc');
  const r = run(['compare', 'cc', '--skin', home, '--ref', 'a.jpg,b.jpg', '--views', 'left'], { ACLIVERY_HOME: home });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /one view per reference/);
});

test('decal: refuses to cover art already placed unless --overlap, and a fresh canvas starts clean', async () => {
  const home = tmp(); fakeCar(home, 'ov', { file: 'EXT_Main.dds', width: 400, height: 200 }, { a: { rect: [0, 0, 1, 1], textRotation: 0 } });
  const out = path.join(home, 'o.png'), env = { ACLIVERY_HOME: home };
  const one = (extra) => run(['decal', 'ov', '--panel', 'a', '--color', '#ff0000', '--out', out, '--at', '0.1,0.1,0.4,0.4', ...extra], env);
  assert.equal(one(['--fill', '#ffffff']).status, 0);
  const again = one(['--base', out]);
  assert.equal(again.status, 2);
  assert.match(again.stderr, /would cover/);
  assert.equal(one(['--base', out, '--overlap']).status, 0);
  const elsewhere = run(['decal', 'ov', '--panel', 'a', '--color', '#00ff00', '--base', out, '--out', out, '--at', '0.6,0.1,0.3,0.4'], env);
  assert.equal(elsewhere.status, 0, elsewhere.stderr);
  assert.equal(one(['--fill', '#ffffff']).status, 0); // new canvas: placements reset
});

test('brief: references without an analysis ask for the analysis; subtle art cannot be dropped silently', async () => {
  const { gaps } = await import('../src/commands/brief.mjs');
  const b = { car: { id: 'x' }, references: [{ file: 'a.jpg', view: 'left' }], baseColour: 'white', elements: [{ what: 'Monster logo', target: 'door', panel: 'p', asset: 'a.png' }] };
  const yes = () => true;
  assert.match(gaps(b, { packExists: true, fileExists: yes })[0].do, /ac-analyze/);
  b.analysis = { layers: [{ kind: 'tonal-art', what: 'grey ink feathers', tone: 'subtle', confidence: 'high', evidence: 'a.jpg left' }] };
  assert.match(gaps(b, { packExists: true, fileExists: yes })[0].ask, /subtle tonal art/);
  b.elements.push({ what: 'grey ink feathers', tone: 'subtle', target: 'body', panel: 'q', asset: 'ink.png' });
  assert.ok(!gaps(b, { packExists: true, fileExists: yes }).some((t) => /subtle tonal art/.test(t.ask ?? '')));
});

function applyCar(home, id) {
  const dir = path.join(home, 'cars', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({
    bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 200 }, plates: { file: 'Plates.dds', width: 200, height: 100 } },
    panels: { ext_main: { a: { rect: [0, 0, 1, 1], textRotation: 0 }, b: { rect: [0, 0, 0.5, 1], textRotation: 0 } }, plates: { whole: { rect: [0, 0, 1, 1], textRotation: 0 } } },
  }));
}
const px = async (file) => {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return (x, y) => [...data.subarray((y * info.width + x) * 4, (y * info.width + x) * 4 + 4)];
};

test('apply: lists every problem in a design before drawing anything', async () => {
  const { validateDesign } = await import('../src/commands/apply.mjs');
  const profile = { textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 200 } }, panels: { ext_main: { a: { rect: [0, 0, 1, 1] } } } };
  const bad = validateDesign({
    car: 'x', colour: 'nope', colors: { c: '#123456' }, assets: { logo: 'no/such/file.png' },
    textures: { ext_main: { elements: [
      { panel: 'zzz', image: 'logo' }, { panel: 'a', image: 'ghost' }, { panel: 'a', image: 'logo', color: 'c' },
      { panel: 'a', color: 'blue' }, { panel: 'a', text: 'HI', at: [0.5, 0.5, 0.9, 0.9] }, { panel: 'a', color: 'c', ink: '#000000' } ] }, nope: { elements: [] } },
  }, profile, () => false);
  const all = bad.join('\n');
  for (const re of [/unknown key "colour"/, /file not found: no\/such\/file.png/, /no panel "zzz"/, /"ghost" is not in "assets"/,
    /exactly one of image \/ color \/ text/, /"blue" is neither a hex colour/, /\.at: four fractions/, /ink: only on text elements/, /textures\.nope: the car has no such texture/]) {
    assert.match(all, re);
  }
  assert.deepEqual(validateDesign({ car: 'x', textures: { ext_main: { elements: [{ panel: 'a', color: '#ffffff' }] } } }, profile), []);
});

test('apply: draws in layer order (tone under logo under text), cards get their lines, cut-out textures stay transparent', async () => {
  const home = tmp(); applyCar(home, 'ap');
  const dir = tmp(), env = { ACLIVERY_HOME: home };
  const red = path.join(dir, 'red.png'), blue = path.join(dir, 'blue.png');
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ff0000' } }).png().toFile(red);
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#0000ff' } }).png().toFile(blue);
  const design = { car: 'ap', name: 'Test skin', colors: { teal: '#00aaaa' }, assets: { red, blue }, textures: {
    ext_main: { fill: '#ffffff', elements: [
      { panel: 'a', image: 'red', at: [0.1, 0.1, 0.4, 0.8] },                       // logo, written first
      { panel: 'a', image: 'blue', at: [0.1, 0.1, 0.4, 0.8], layer: 'tone' },       // tone, written second but drawn first, so under the logo
      { panel: 'a', color: 'teal', at: [0.7, 0.1, 0.2, 0.8] } ] },
    plates: { fill: 'transparent', elements: [{ panel: 'whole', color: '#ffffff', at: [0.1, 0.1, 0.4, 0.8], lines: [{ text: 'HI', ink: '#000000', bold: true, at: [0.1, 0.1, 0.8, 0.8] }] }] },
  } };
  const file = path.join(dir, 'design.json'), out = path.join(dir, 'build');
  fs.writeFileSync(file, JSON.stringify(design));
  const chk = run(['apply', file, '--check', '--out', out], env);
  assert.equal(chk.status, 0, chk.stderr);
  assert.ok(!fs.existsSync(out), '--check draws nothing');
  const r = run(['apply', file, '--no-render', '--out', out], env);
  assert.equal(r.status, 0, r.stderr);
  const body = await px(path.join(out, 'work', 'EXT_Main.png'));
  assert.deepEqual(body(100, 100), [255, 0, 0, 255]);        // logo over the tone art
  assert.deepEqual(body(300, 100), [0, 170, 170, 255]);      // named colour
  assert.deepEqual(body(5, 5), [255, 255, 255, 255]);        // fill
  const plate = await px(path.join(out, 'work', 'Plates.png'));
  assert.equal(plate(190, 90)[3], 0);                         // cut-out stays transparent
  assert.deepEqual(plate(21, 11), [255, 255, 255, 255]);      // card corner, outside the text box
  let ink = 0; for (let y = 10; y < 90; y++) for (let x = 20; x < 100; x++) if (plate(x, y)[0] < 80) ink++;
  assert.ok(ink > 30, 'card text drawn');
  // Same file again rebuilds the same result.
  assert.equal(run(['apply', file, '--no-render', '--out', out], env).status, 0);
});

test('apply: a real overlap stops with the element named; a folder it did not make is left alone', async () => {
  const home = tmp(); applyCar(home, 'ao');
  const dir = tmp(), env = { ACLIVERY_HOME: home };
  const red = path.join(dir, 'red.png');
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ff0000' } }).png().toFile(red);
  const file = path.join(dir, 'd.json');
  fs.writeFileSync(file, JSON.stringify({ car: 'ao', assets: { red }, textures: { ext_main: { elements: [
    { panel: 'a', image: 'red', at: [0.1, 0.1, 0.4, 0.4] }, { panel: 'a', image: 'red', at: [0.2, 0.2, 0.4, 0.4] }] } } }));
  const r = run(['apply', file, '--no-render', '--out', path.join(dir, 'o')], env);
  assert.equal(r.status, 2);
  assert.match(r.stderr, /ext_main\.elements\[1\].*would cover/s);
  const mine = path.join(dir, 'keep'); fs.mkdirSync(path.join(mine, 'work'), { recursive: true }); fs.writeFileSync(path.join(mine, 'work', 'precious.txt'), 'x');
  const r2 = run(['apply', file, '--no-render', '--out', mine], env);
  assert.equal(r2.status, 2);
  assert.ok(fs.existsSync(path.join(mine, 'work', 'precious.txt')));
});

test('apply --check: says where each element lands and about how big, and skips tone art', async () => {
  const home = tmp();
  const dir = path.join(home, 'cars', 'pt'); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'profile.json'), JSON.stringify({ bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 200 } },
    panels: { ext_main: { door: { rect: [0, 0, 1, 1], textRotation: 0, metresPerUv: [2, 1], centroid3d: [0.8, 0.6, 0], visible: 0.9 },
      strip: { rect: [0, 0, 1, 0.1], textRotation: 0, metresPerUv: [2, 1], centroid3d: [-0.6, 1.05, 0], visible: 0.8 } } } }));
  const file = path.join(home, 'd.json');
  fs.writeFileSync(file, JSON.stringify({ car: 'pt', textures: { ext_main: { elements: [
    { panel: 'door', color: '#ff0000', at: [0, 0, 0.5, 0.5] }, { panel: 'strip', text: 'NAME', bold: true }, { panel: 'door', color: '#00ff00', layer: 'tone' }] } } }));
  const r = run(['apply', file, '--check'], { ACLIVERY_HOME: home });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /on door\s+about 100 x 50 cm, left, 0\.60 m high, vis 0\.90/);
  assert.match(r.stdout, /NAME\s+on strip\s+about \d+ x [1-9]\d? cm, right, 1\.05 m high/);
  assert.equal(r.stdout.split('\n').filter((l) => /^ {2}ext_main\[/.test(l)).length, 2);
});

test('patterns: same seed gives the same art, another seed differs, and the coverage estimate matches the pixels', async () => {
  const { makePattern, renderPattern } = await import('../src/lib/patterns.mjs');
  const o = { widthM: 1.2, heightM: 0.6, pxPerM: 400, density: 1 };
  assert.equal(makePattern('ink-lines', { ...o, seed: 3 }).svg, makePattern('ink-lines', { ...o, seed: 3 }).svg);
  assert.notEqual(makePattern('ink-lines', { ...o, seed: 3 }).svg, makePattern('ink-lines', { ...o, seed: 4 }).svg);
  for (const kind of ['ink-lines', 'leaves', 'cracks', 'splatter', 'brush']) {
    const p = await renderPattern(kind, { ...o, seed: 5 });
    assert.deepEqual([p.width, p.height], [480, 240]);
    const { data } = await sharp(p.png).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let a = 0; for (let i = 3; i < data.length; i += 4) a += data[i] / 255;
    const real = a / (p.width * p.height);
    assert.ok(real > 0, `${kind} drew something`);
    assert.ok(p.coverage / real > 0.5 && p.coverage / real < 2, `${kind}: estimate ${p.coverage.toFixed(4)} vs real ${real.toFixed(4)}`);
  }
});

test('apply: a pattern fills the chosen panels only, logos can still sit on it, and strong ink is warned about', async () => {
  const home = tmp(), dir = tmp(), env = { ACLIVERY_HOME: home };
  const car = path.join(home, 'cars', 'pc'); fs.mkdirSync(car, { recursive: true });
  fs.writeFileSync(path.join(car, 'profile.json'), JSON.stringify({ bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 200 } },
    panels: { ext_main: {
      door: { rect: [0.25, 0.25, 0.5, 0.5], textRotation: 0, metresPerUv: [2, 1], visible: 0.9 },
      hidden: { rect: [0, 0, 0.2, 0.2], textRotation: 0, metresPerUv: [2, 1], visible: 0.1 },
      bare: { rect: [0.8, 0.8, 0.2, 0.2], textRotation: 0 } } } }));
  const red = path.join(dir, 'red.png');
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#ff0000' } }).png().toFile(red);
  const mk = (extra) => ({ car: 'pc', assets: { red }, textures: { ext_main: { fill: '#f6f6f6', elements: [
    { panel: 'door', image: 'red', at: [0.4, 0.3, 0.2, 0.4] }, { pattern: 'ink-lines', panels: 'visible', seed: 2, density: 1, color: '#555555', opacity: 1, ...extra }] } } });
  const file = path.join(dir, 'd.json'), out = path.join(dir, 'o');
  fs.writeFileSync(file, JSON.stringify(mk({})));
  const chk = run(['apply', file, '--check'], env);
  assert.equal(chk.status, 0, chk.stderr);
  assert.match(chk.stdout, /warning: ext_main\.elements\[1\] ink-lines: marks are too strong/);
  const r = run(['apply', file, '--no-render', '--out', out], env);
  assert.equal(r.status, 0, r.stderr);
  const body = await px(path.join(out, 'work', 'EXT_Main.png'));
  assert.deepEqual(body(200, 100), [255, 0, 0, 255]);        // the logo sits over the ink: no overlap error, ink is under it
  const { data, info } = await sharp(path.join(out, 'work', 'EXT_Main.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let inside = 0, outside = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const o = (y * info.width + x) * 4, dark = data[o] < 200 && data[o + 1] < 200;
    if (dark) { if (x >= 100 && x < 300 && y >= 50 && y < 150) inside++; else outside++; }
  }
  assert.ok(inside > 20, 'ink drawn on the visible panel');
  assert.equal(outside, 0);                                   // "hidden" (vis 0.1) and "bare" (no size) are left alone
  const quiet = run(['apply', file, '--check'], env);
  fs.writeFileSync(file, JSON.stringify(mk({ color: '#d0d3d6', opacity: 0.6, density: 0.5 })));
  assert.doesNotMatch(run(['apply', file, '--check'], env).stdout, /warning/);
  assert.ok(quiet.stdout.includes('warning'));
  fs.writeFileSync(file, JSON.stringify(mk({ panels: undefined, panel: 'bare' })));
  const bad = run(['apply', file, '--check'], env);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /panel "bare" has no measured size/);
  fs.writeFileSync(file, JSON.stringify(mk({ image: 'red', at: [0, 0, 1, 1] })));
  assert.match(run(['apply', file, '--check'], env).stderr, /not for patterns/);
});

test('brief: every analysis layer must say how sure it is; doubt becomes a grounded question for the user', async () => {
  const { gaps } = await import('../src/commands/brief.mjs');
  const yes = () => true;
  const mk = (layers) => ({ slug: 's', car: { id: 'x' }, references: [{ file: 'a.jpg', view: 'left' }], baseColour: 'white', elements: [], analysis: { layers } });
  const first = (b) => gaps(b, { packExists: true, fileExists: yes })[0];
  // Missing confidence/evidence: the next step names the layers to review.
  assert.match(first(mk([{ kind: 'logo', what: 'three slanted bars' }])).do, /confidence.*evidence.*0 "three slanted bars"/s);
  assert.match(first(mk([{ kind: 'logo', what: 'bars', confidence: 'high' }])).do, /Missing on: 0/);
  // Low confidence: a question that quotes the evidence, and the follow-up command.
  const low = first(mk([{ kind: 'text', what: 'small script near the roof', confidence: 'low', evidence: 'b.jpg front, top left' }]));
  assert.ok(low.ask.includes('not sure about "small script near the roof" (evidence: b.jpg front, top left)'));
  assert.match(low.then, /analysis.layers.0.confidence high/);
  // A brand read by shape only (medium) is confirmed with the user before anything is downloaded or searched.
  const shape = first(mk([{ kind: 'logo', what: 'three slanted bars', brand: 'Monster Energy', part: 'symbol', confidence: 'medium', evidence: 'a.jpg left, door' }]));
  assert.match(shape.ask, /read "three slanted bars" as Monster Energy symbol.*Is that right/);
  // Sure of everything: no doubt questions.
  assert.ok(!gaps(mk([{ kind: 'logo', what: 'claw', brand: 'Monster Energy', confidence: 'high', evidence: 'a.jpg left' }]), { packExists: true, fileExists: yes }).some((x) => /not sure|Is that right|review your analysis/.test((x.ask ?? '') + (x.do ?? ''))));
});

test('apply: a texture can start from a base picture (stock stickers kept), not both base and fill, and tonal leaves/cracks are checked for discretion', async () => {
  const home = tmp(), dir = tmp(), env = { ACLIVERY_HOME: home };
  const car = path.join(home, 'cars', 'bc'); fs.mkdirSync(car, { recursive: true });
  fs.writeFileSync(path.join(car, 'profile.json'), JSON.stringify({ bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 200 } },
    panels: { ext_main: { a: { rect: [0, 0, 0.5, 1], textRotation: 0, metresPerUv: [2, 1], visible: 0.9 } } } }));
  const base = path.join(dir, 'base.png');   // left half green and opaque, right half transparent
  const raw = Buffer.alloc(400 * 200 * 4);
  for (let y = 0; y < 200; y++) for (let x = 0; x < 200; x++) { const o = (y * 400 + x) * 4; raw[o + 1] = 255; raw[o + 3] = 255; }
  await sharp(raw, { raw: { width: 400, height: 200, channels: 4 } }).png().toFile(base);
  const file = path.join(dir, 'd.json'), out = path.join(dir, 'o');
  const design = (t) => ({ car: 'bc', textures: { ext_main: { ...t, elements: [{ panel: 'a', color: '#ff0000', at: [0, 0, 0.5, 0.5], overlap: true }] } } });
  fs.writeFileSync(file, JSON.stringify(design({ base })));
  const r = run(['apply', file, '--no-render', '--out', out], env);
  assert.equal(r.status, 0, r.stderr);
  const p = await px(path.join(out, 'work', 'EXT_Main.png'));
  assert.deepEqual(p(150, 150), [0, 255, 0, 255]);     // the base is kept
  assert.deepEqual(p(50, 50), [255, 0, 0, 255]);       // our element is drawn on it
  assert.equal(p(300, 100)[3], 0);                     // its transparent half stays transparent
  fs.writeFileSync(file, JSON.stringify(design({ base, fill: '#ffffff' })));
  assert.match(run(['apply', file, '--check'], env).stderr, /"base" or "fill", not both/);
  fs.writeFileSync(file, JSON.stringify({ car: 'bc', textures: { ext_main: { fill: '#f6f6f6', elements: [{ pattern: 'leaves', panel: 'a', color: '#000000', opacity: 1, density: 1 }, { pattern: 'cracks', panel: 'a', color: '#000000', opacity: 1 }] } } }));
  const w = run(['apply', file, '--check'], env).stdout;
  assert.match(w, /elements\[0\] leaves: marks are too strong/);
  assert.match(w, /elements\[1\] cracks: marks are too strong/);
});
