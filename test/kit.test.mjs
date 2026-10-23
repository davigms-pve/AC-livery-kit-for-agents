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

test('decal: a whole-panel colour does not flood another island that sits inside its box', async () => {
  const home = tmp();
  // "big" is an L-shaped island whose box contains the small island "door" (like the P92's rear quarter around the door).
  fakeCar(home, 'nb', undefined, {
    big: { rect: [0.1, 0.1, 0.8, 0.8], textRotation: 0, outline: [[0.1, 0.1], [0.9, 0.1], [0.9, 0.9], [0.6, 0.9], [0.6, 0.4], [0.1, 0.4]] },
    door: { rect: [0.2, 0.5, 0.3, 0.3], textRotation: 0, outline: [[0.2, 0.5], [0.5, 0.5], [0.5, 0.8], [0.2, 0.8]] } });
  const out = path.join(home, 'o.png');
  assert.equal(run(['decal', 'nb', '--panel', 'big', '--color', '#ff0000', '--fill', '#ffffff', '--out', out], { ACLIVERY_HOME: home }).status, 0);
  const { data, info } = await sharp(out).raw().toBuffer({ resolveWithObject: true });
  const px = (x, y) => [...data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3)];
  assert.deepEqual(px(150, 20), [255, 0, 0]);     // on its own island: red
  assert.deepEqual(px(70, 65), [255, 255, 255]);  // inside the door's island: untouched
  assert.deepEqual(px(110, 85), [255, 0, 0]);     // in its box, on no island: still painted (outlines are simplified)
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
    assert.ok(p.coverage / real > 0.4 && p.coverage / real < 3, `${kind}: estimate ${p.coverage.toFixed(4)} vs real ${real.toFixed(4)}`);
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
  assert.match(w, /elements\[0\] leaves: .*Now: colour #000000, opacity 1\. Use a colour/);   // opacity set in the design: no default note
  // opacity left out: the warning says what the default is
  fs.writeFileSync(file, JSON.stringify({ car: 'bc', textures: { ext_main: { fill: '#f6f6f6', elements: [{ pattern: 'cracks', panel: 'a', color: '#000000' }] } } }));
  assert.match(run(['apply', file, '--check'], env).stdout, /Now: colour #000000, opacity 0\.7 \(the default for cracks; the design does not set it\)/);
});

test('render --each: --out must be a folder, said before anything is loaded', () => {
  const r = run(['render', 'nocar', '--skin', 'x', '--each', '--out', 'view.png'], { ACLIVERY_HOME: tmp() });
  assert.notEqual(r.status, 0);
  assert.match(r.stderr, /--each writes one PNG per view.*--out must be a folder, not a file \(view\.png\)/);
});

test('coverage: "rear", "quarter" and "fender" are place words; "rear quarter" is the side, not the back', async () => {
  const { coverage } = await import('../src/commands/apply.mjs');
  const regions = { regions: [{ name: 'hood_and_front_fenders', panels: [{ name: 'hoodp' }] }, { name: 'left_side', panels: [{ name: 'sidep' }] }, { name: 'rear_bumper', panels: [{ name: 'bump' }] }] };
  const brief = (where) => ({ analysis: { layers: [{ kind: 'logo', what: 'Monster claw', where }] } });
  const design = (panel) => ({ textures: { ext_main: { elements: [{ panel, image: 'claw', covers: 'claw' }] } } });
  const miss = (where, panel) => coverage(design(panel), brief(where), regions).filter((m) => /says "/.test(m));
  assert.equal(miss('rear', 'hoodp').length, 1);                // "rear" alone needs something at the back
  assert.equal(miss('rear', 'bump').length, 0);
  assert.equal(miss('rear quarter', 'sidep').length, 0);        // the side answers it; no demand for the rear bumper
  assert.equal(miss('quarter', 'hoodp').length, 1);
  assert.equal(miss('front fender', 'sidep').length, 1);        // the fender is on the hood region
  assert.equal(miss('front fender', 'hoodp').length, 0);
  assert.equal(miss('rear fender', 'sidep').length, 0);         // not the front fender
});

test('decal: a wide image on a 90 or 270 degree panel keeps its proportions (regression: sharp rotated before resizing)', async () => {
  const home = tmp(), dir = tmp(), env = { ACLIVERY_HOME: home };
  const car = path.join(home, 'cars', 'rw'); fs.mkdirSync(car, { recursive: true });
  fs.writeFileSync(path.join(car, 'profile.json'), JSON.stringify({ bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 200 } },
    panels: { ext_main: { r90: { rect: [0.25, 0.25, 0.5, 0.5], textRotation: 90 }, r270: { rect: [0.25, 0.25, 0.5, 0.5], textRotation: 270 } } } }));
  const img = path.join(dir, 'wide.png');   // 40x10, 4:1, red
  await sharp({ create: { width: 40, height: 10, channels: 3, background: '#ff0000' } }).png().toFile(img);
  for (const panel of ['r90', 'r270']) {
    const out = path.join(dir, `${panel}.png`);
    const r = run(['decal', 'rw', '--panel', panel, '--image', img, '--fill', '#ffffff', '--out', out, '--at', '0,0,1,1'], env);
    assert.equal(r.status, 0, r.stderr);
    const { data, info } = await sharp(out).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    let n = 0, x0 = 1e9, x1 = -1, y0 = 1e9, y1 = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) { const o = (y * info.width + x) * 3; if (data[o] > 200 && data[o + 1] < 60) { n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
    // The panel is 200x100 px; seen upright it is 100 wide x 200 tall, so the 4:1 image becomes 100 x 25 upright: on the texture it is 25 wide x 100 tall.
    assert.ok(Math.abs((x1 - x0 + 1) - 25) <= 1 && Math.abs((y1 - y0 + 1) - 100) <= 1, `${panel}: ${x1 - x0 + 1} x ${y1 - y0 + 1}`);
    assert.ok(Math.abs(n - 2500) < 60, `${panel}: ${n} red pixels`);
  }
});

test('logo prep --key-light removes a baked checkerboard but keeps dark and coloured parts', async () => {
  const dir = tmp(), src = path.join(dir, 'in.png'), out = path.join(dir, 'out.png');
  const w = 40, h = 40, raw = Buffer.alloc(w * h * 3);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 3, check = ((x >> 2) + (y >> 2)) % 2 ? 255 : 204;     // white and light-grey squares
    let c = [check, check, check];
    if (x >= 10 && x < 20 && y >= 10 && y < 30) c = [10, 10, 10];                  // dark glyph
    if (x >= 22 && x < 30 && y >= 10 && y < 30) c = [100, 170, 235];               // blue part
    raw[o] = c[0]; raw[o + 1] = c[1]; raw[o + 2] = c[2];
  }
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toFile(src);
  assert.equal(run(['logo', 'prep', src, '--out', out, '--key-light']).status, 0);
  const p = await px(out);
  assert.equal(p(2, 2)[3], 0); assert.equal(p(6, 2)[3], 0);                        // both checker colours gone
  assert.equal(p(15, 20)[3], 255); assert.equal(p(25, 20)[3], 255);                // glyph and blue kept
});

test('car stock: explains a missing role or a missing model instead of failing silently', () => {
  const home = tmp(); fakeCar(home, 'cst');
  const env = { ACLIVERY_HOME: home };
  const role = run(['car', 'stock', 'cst', 'nope'], env);
  assert.equal(role.status, 2);
  assert.match(role.stderr, /no texture role "nope"/);
  const model = run(['car', 'stock', 'cst', 'ext_main'], env);
  assert.equal(model.status, 2);
  assert.match(model.stderr, /car model is not at/);
});

test('logo prep --crop keeps the chosen part of the picture and rejects bad boxes', async () => {
  const dir = tmp(), src = path.join(dir, 'in.png'), out = path.join(dir, 'out.png');
  const w = 100, h = 100, raw = Buffer.alloc(w * h * 3, 255);
  for (let y = 0; y < 40; y++) for (let x = 0; x < w; x++) { const o = (y * w + x) * 3; raw[o] = 255; raw[o + 1] = 0; raw[o + 2] = 0; }   // top 40%: red
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toFile(src);
  assert.equal(run(['logo', 'prep', src, '--out', out, '--crop', '0,0,1,0.4']).status, 0);
  const m = await sharp(out).metadata();
  assert.deepEqual([m.width, m.height], [100, 40]);
  const p = await px(out);
  assert.deepEqual(p(50, 20), [255, 0, 0, 255]);
  const bad = run(['logo', 'prep', src, '--out', out, '--crop', '0,0,2,1']);
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /--crop must be/);
});

test('logo prep --erase clears a box so stray bits can be removed', async () => {
  const dir = tmp(), src = path.join(dir, 'in.png'), out = path.join(dir, 'out.png');
  const w = 40, h = 40, raw = Buffer.alloc(w * h * 3, 20);   // all dark and opaque
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toFile(src);
  assert.equal(run(['logo', 'prep', src, '--out', out, '--erase', '0.5,0.5,0.5,0.5']).status, 0);
  const p = await px(out);
  assert.equal(p(5, 5)[3], 255); assert.equal(p(30, 30)[3], 0);
  assert.equal(run(['logo', 'prep', src, '--out', out, '--erase', '1,2']).status, 2);
});

test('logo prep --erase over a stray corner lets --key-bg key the rest', async () => {
  const dir = tmp(), src = path.join(dir, 'in.png'), out = path.join(dir, 'out.png');
  const w = 40, h = 40, raw = Buffer.alloc(w * h * 3, 40);           // dark flat background
  for (let y = 15; y < 25; y++) for (let x = 15; x < 25; x++) raw.fill(200, (y * w + x) * 3, (y * w + x) * 3 + 3);   // the mark
  for (let y = 34; y < 40; y++) for (let x = 34; x < 40; x++) raw.fill(255, (y * w + x) * 3, (y * w + x) * 3 + 3);   // stray letter in a corner
  await sharp(raw, { raw: { width: w, height: h, channels: 3 } }).png().toFile(src);
  assert.equal(run(['logo', 'prep', src, '--out', out, '--key-bg']).status, 2);   // corner not flat
  assert.equal(run(['logo', 'prep', src, '--out', out, '--erase', '0.8,0.8,0.2,0.2', '--key-bg']).status, 0);
  const p = await px(out);
  assert.equal(p(2, 2)[3], 0); assert.equal(p(20, 20)[3], 255); assert.equal(p(37, 37)[3], 0);
});

test('brief: shows the references and takes the base colour from the analysis', async () => {
  const { gaps, baseColourOf } = await import('../src/commands/brief.mjs');
  const yes = () => true;
  const b = { slug: 's', car: { id: 'x' }, references: [{ file: 'a.jpg', view: 'left' }], elements: [{ what: 'x', panel: 'p', asset: 'a.png' }],
    analysis: { layers: [{ kind: 'base', what: 'near-white pearl', confidence: 'high', evidence: 'a.jpg' }] } };
  assert.equal(baseColourOf(b), 'near-white pearl');
  assert.ok(!gaps(b, { packExists: true, fileExists: yes }).some((t) => /base colour/.test(t.ask ?? '')));
  assert.ok(gaps({ ...b, analysis: { layers: [] } }, { packExists: true, fileExists: yes }).some((t) => /base colour/.test(t.ask ?? '')));
  const home = tmp(), env = { ACLIVERY_HOME: home };
  run(['brief', 'init', 'rf', '--title', 'T', '--car', 'c'], env);
  run(['brief', 'add', 'rf', 'references', '{"file":"C:/x/photo_one.jpg","view":"right"}'], env);
  assert.match(run(['brief', 'show', 'rf'], env).stdout, /ref 0\. photo_one\.jpg {2}view: right/);
});

test('apply --check: suggests the nearest box fully on the painted surface when an element is cut off', async () => {
  const { nearestInside, insideIsland } = await import('../src/commands/apply.mjs');
  const pn = { rect: [0, 0, 1, 1], textRotation: 0, outline: [[0, 0], [0.5, 0], [0.5, 1], [0, 1]] };   // only the left half is painted
  assert.ok(insideIsland(pn, 0, [0.6, 0.2, 0.2, 0.2]) < 0.1);
  const box = nearestInside(pn, 0, [0.6, 0.2, 0.2, 0.2]);
  assert.ok(box && box[0] + box[2] <= 0.5 + 1e-6 && Math.abs(box[1] - 0.2) < 0.03, JSON.stringify(box));
  assert.equal(nearestInside(pn, 0, [0.1, 0.1, 0.9, 0.9]), null);   // nothing that big fits
});

test('apply: every build prints a review with the round number, and the round counts up', async () => {
  const home = tmp(); applyCar(home, 'rv');
  const dir = tmp(), env = { ACLIVERY_HOME: home }, out = path.join(dir, 'o'), file = path.join(dir, 'd.json');
  fs.writeFileSync(file, JSON.stringify({ car: 'rv', textures: { ext_main: { elements: [{ panel: 'a', color: '#ff0000', at: [0, 0, 0.2, 0.2] }] } } }));
  const one = run(['apply', file, '--no-render', '--out', out], env);
  assert.equal(one.status, 0, one.stderr);
  assert.match(one.stdout, /review, round 1: 1 texture\(s\) \[ext_main\], elements by layer: paint 1; 0 warning\(s\), 0 element\(s\) cut off/);
  assert.match(run(['apply', file, '--no-render', '--out', out], env).stdout, /review, round 2:/);
});

test('apply: the review lists analysis layers nothing answers and places a layer names that have no element', async () => {
  const home = tmp(), dir = tmp(), env = { ACLIVERY_HOME: home };
  const car = path.join(home, 'cars', 'cv'); fs.mkdirSync(car, { recursive: true });
  fs.writeFileSync(path.join(car, 'profile.json'), JSON.stringify({ bind: { body: { roles: ['ext_main'] } },
    textures: { ext_main: { file: 'EXT_Main.dds', width: 400, height: 200 } },
    panels: { ext_main: { hoodp: { rect: [0, 0, 0.4, 0.5], textRotation: 0, metresPerUv: [2, 1] }, roofp: { rect: [0.5, 0, 0.4, 0.5], textRotation: 0, metresPerUv: [2, 1] } } } }));
  fs.writeFileSync(path.join(car, 'regions.json'), JSON.stringify({ regions: [{ name: 'hood_and_front_fenders', panels: [{ name: 'hoodp' }] }, { name: 'roof', panels: [{ name: 'roofp' }] }] }));
  const claw = path.join(dir, 'claw.png');
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#888888' } }).png().toFile(claw);
  const pdir = path.join(home, 'projects', 'cv'); fs.mkdirSync(pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'brief.json'), JSON.stringify({ slug: 'cv', analysis: { layers: [
    { kind: 'base', what: 'white' },
    { kind: 'logo', what: 'Monster claw', where: 'hood, roof' },
    { kind: 'text', what: 'driver name THIELE', where: 'roof' } ] } }));
  const file = path.join(dir, 'd.json');
  const design = (els) => ({ car: 'cv', brief: 'cv', assets: { claw }, textures: { ext_main: { elements: els } } });
  fs.writeFileSync(file, JSON.stringify(design([{ panel: 'hoodp', image: 'claw', at: [0.1, 0.1, 0.3, 0.3] }])));
  const r = run(['apply', file, '--check'], env);
  assert.match(r.stdout, /layer 1 "Monster claw" \(logo\) says "roof" but no matching element sits there/);
  assert.match(r.stdout, /layer 2 "driver name THIELE" \(text\): no element answers it/);
  fs.writeFileSync(file, JSON.stringify(design([{ panel: 'hoodp', image: 'claw', at: [0.1, 0.1, 0.3, 0.3] }, { panel: 'roofp', image: 'claw', at: [0.1, 0.1, 0.3, 0.3] }, { panel: 'roofp', text: 'T. THIELE', at: [0.1, 0.6, 0.5, 0.3] }])));
  assert.doesNotMatch(run(['apply', file, '--check'], env).stdout, /missing:/);
  // a build records itself in the brief and prints the review with the missing count
  fs.writeFileSync(file, JSON.stringify(design([{ panel: 'hoodp', image: 'claw', at: [0.1, 0.1, 0.3, 0.3] }])));
  const b = run(['apply', file, '--no-render', '--out', path.join(dir, 'o')], env);
  assert.match(b.stdout, /review, round 1: .*2 layer\(s\) missing/);
  assert.match(b.stdout, /missing: layer 1 "Monster claw"/);
  const saved = JSON.parse(fs.readFileSync(path.join(pdir, 'brief.json'), 'utf8'));
  assert.equal(saved.build.round, 1); assert.equal(saved.build.missing, 2);
  assert.match(run(['brief', 'show', 'cv'], env).stdout, /built: round 1, 1 element\(s\)/);
});

test('apply: scales a small base picture up to the declared size, flags placeholder assets, and counts rounds per brief', async () => {
  const { scaleToSize } = await import('../src/commands/apply.mjs');
  const small = await scaleToSize(sharp({ create: { width: 20, height: 10, channels: 4, background: '#00ff00' } }), 20, 10, '80x40').toBuffer();
  assert.deepEqual([(await sharp(small).metadata()).width, (await sharp(small).metadata()).height], [80, 40]);
  const same = await scaleToSize(sharp({ create: { width: 20, height: 10, channels: 4, background: '#00ff00' } }), 20, 10, '20x10').toBuffer();
  assert.equal((await sharp(same).metadata()).width, 20);
  const other = await scaleToSize(sharp({ create: { width: 20, height: 10, channels: 4, background: '#00ff00' } }), 20, 10, '40x40').toBuffer();   // aspect differs: left alone
  assert.equal((await sharp(other).metadata()).width, 20);

  const home = tmp(); applyCar(home, 'pl');
  const dir = tmp(), env = { ACLIVERY_HOME: home };
  const ph = path.join(dir, 'claw_placeholder.png');
  await sharp({ create: { width: 20, height: 20, channels: 3, background: '#888888' } }).png().toFile(ph);
  const pdir = path.join(home, 'projects', 'pl'); fs.mkdirSync(pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'brief.json'), JSON.stringify({ slug: 'pl' }));
  const file = path.join(dir, 'd.json');
  fs.writeFileSync(file, JSON.stringify({ car: 'pl', brief: 'pl', assets: { claw: ph }, textures: { ext_main: { elements: [{ panel: 'a', image: 'claw', at: [0.1, 0.1, 0.3, 0.3] }] } } }));
  const r1 = run(['apply', file, '--no-render', '--out', path.join(dir, 'r1')], env);
  assert.match(r1.stdout, /asset "claw" is a generated placeholder \(claw_placeholder\.png\)/);
  assert.match(r1.stdout, /review, round 1:/);
  assert.match(run(['apply', file, '--no-render', '--out', path.join(dir, 'r2')], env).stdout, /review, round 2:/);   // another --out, same brief: still counts up
});

test('car stock never overwrites an existing file without --force', () => {
  const home = tmp(); fakeCar(home, 'cs2');
  const out = path.join(home, 'keep.dds'); fs.writeFileSync(out, 'precious');
  const env = { ACLIVERY_HOME: home };
  const r = run(['car', 'stock', 'cs2', 'ext_main', '--out', out], env);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /kept .*already exists/);
  assert.equal(fs.readFileSync(out, 'utf8'), 'precious');
});

test('brief plan: NEXT walks sourcing, fetch assets, the design build, the missing layers, the rounds and the export', async () => {
  const { gaps, suggestSource } = await import('../src/commands/brief.mjs');
  const files = new Set(['assets/logos/claw_prepped.png']);
  const fe = (p) => files.has(p);
  const layer = (o) => ({ confidence: 'high', evidence: 'a.jpg left', ...o });
  const base = () => ({ slug: 'pp', car: { id: 'x' }, references: [{ file: 'a.jpg', view: 'left' }], analysis: { layers: [
    layer({ kind: 'base', what: 'white' }),
    layer({ kind: 'logo', what: 'Monster claw', brand: 'Monster Energy', part: 'symbol', where: 'hood' }),
    layer({ kind: 'tonal-art', what: 'grey leaves', tone: 'subtle' }),
    layer({ kind: 'text', what: 'driver name' }) ] } });
  const next = (b) => gaps(b, { packExists: true, fileExists: fe })[0];
  assert.deepEqual(['claw', 'leaves', 'name'].map((_, i) => suggestSource(base().analysis.layers[i + 1])), ['fetch', 'generate', 'construct']);
  // 1. no sources yet: decide them all, with suggestions
  let b = base();
  assert.match(next(b).do, /decide how each layer is produced.*Suggested: 1 fetch, 2 generate, 3 construct/s);
  // 2. sources set, the brand mark has no file: fetch it (no placeholder)
  b.analysis.layers[1].source = 'fetch'; b.analysis.layers[2].source = 'generate'; b.analysis.layers[3].source = 'construct';
  assert.match(next(b).do, /layer 1 "Monster claw" is a brand mark to FETCH, not redraw/);
  b.analysis.layers[1].asset = 'assets/logos/claw_placeholder.png';
  assert.match(next(b).do, /to FETCH/);                     // a placeholder does not count
  b.analysis.layers[1].placeholder = 'user: no real file exists, downloads not allowed';
  assert.match(next(b).do, /build in parts/);               // ... unless the user allowed it (recorded on the layer)
  delete b.analysis.layers[1].placeholder;
  // 3. the real file: now build in parts
  b.analysis.layers[1].asset = 'assets/logos/claw_prepped.png';
  assert.match(next(b).do, /build in parts: write the design file.*--only ext_main/s);
  // 4. a build with missing layers, then rounds, then export, then done
  b.build = { round: 1, missing: 2, elements: 10, cutOff: 0, exported: false };
  assert.match(next(b).do, /left 2 layer\(s\) missing/);
  b.build.part = 'ext_main';   // a part build is not a round: the brief asks for a full build first
  assert.match(next(b).do, /last build was a part \(--only ext_main\).*not a round \(rounds done: 1\).*that full build is round 2/);
  b.build.part = null;
  b.build.missing = 0;
  assert.match(next(b).do, /rounds done: 1 of at least 3/);
  b.build.round = 3;
  assert.match(next(b).do, /export: aclivery apply <design> --export/);
  b.build.exported = true;
  assert.match(next(b).do, /write the report \(what is built; placeholders: L2 "grey leaves" \(generated pattern\); skipped: none;/);
  b.report = 'Built, exported; the leaves are a generated pattern; not loaded in the game.';
  assert.equal(gaps(b, { packExists: true, fileExists: fe }).length, 0);
  // a skipped layer must say why
  b.analysis.layers[3].source = 'skip';
  assert.match(next(b).do, /marked skip: say why/);
});

test('brief: a skipped layer shows its reason and leaves the coverage check; an exported build asks for a report, then shows DONE', async () => {
  const home = tmp(); applyCar(home, 'dn');
  const dir = tmp(), env = { ACLIVERY_HOME: home };
  const layer = (o) => ({ confidence: 'high', evidence: 'a.jpg left', ...o });
  const pdir = path.join(home, 'projects', 'dn'); fs.mkdirSync(pdir, { recursive: true });
  const layers = [layer({ kind: 'base', what: 'white' }), layer({ kind: 'text', what: 'driver name', source: 'construct' }),
    layer({ kind: 'logo', what: 'Porsche crest', source: 'skip', why: 'no file; the owner has not said yes to a download' }), layer({ kind: 'tonal-art', what: 'grey leaves', source: 'generate' })];
  fs.writeFileSync(path.join(pdir, 'brief.json'), JSON.stringify({ slug: 'dn', title: 'Done', car: { id: 'dn' }, references: [{ file: 'a.jpg', view: 'left' }], analysis: { layers },
    build: { round: 3, missing: 0, elements: 1, cutOff: 0, exported: true, design: 'd.json' } }));
  const file = path.join(dir, 'd.json');
  fs.writeFileSync(file, JSON.stringify({ car: 'dn', brief: 'dn', textures: { ext_main: { elements: [{ panel: 'a', text: 'DRIVER NAME', at: [0, 0.5, 0.5, 0.2] }] } } }));
  const check = run(['apply', file, '--check'], env);
  assert.equal(check.status, 0, check.stderr);
  assert.doesNotMatch(check.stdout, /Porsche crest/);   // skipped with a reason: not a gap
  const show = run(['brief', 'show', 'dn'], env).stdout;
  assert.match(show, /L2 \[skip\] Porsche crest\s+skipped: no file; the owner has not said yes/);
  assert.match(show, /write the report \(.*placeholders: L3 "grey leaves" \(generated pattern\); skipped: L2 "Porsche crest": no file/s);
  assert.equal(run(['brief', 'set', 'dn', 'report', 'Built and exported; leaves are generated; crest skipped; not loaded in the game.'], env).status, 0);
  const done = run(['brief', 'show', 'dn'], env).stdout;
  assert.match(done, /DONE: 3 full-build round\(s\), exported, report written\./);
  assert.match(done, /placeholders: L3 "grey leaves"/);
  assert.match(done, /Not verified in the game/);
});

test('apply --only rebuilds the chosen textures and leaves the others as they were; it cannot export', async () => {
  const home = tmp(); applyCar(home, 'on');
  const dir = tmp(), env = { ACLIVERY_HOME: home }, out = path.join(dir, 'o'), file = path.join(dir, 'd.json');
  const design = (c) => ({ car: 'on', textures: { ext_main: { fill: '#ffffff', elements: [{ panel: 'a', color: c, at: [0, 0, 0.5, 0.5] }] }, plates: { fill: '#000000', elements: [{ panel: 'whole', color: '#ff00ff', at: [0, 0, 0.5, 0.5] }] } } });
  fs.writeFileSync(file, JSON.stringify(design('#ff0000')));
  assert.equal(run(['apply', file, '--no-render', '--out', out], env).status, 0);
  fs.writeFileSync(file, JSON.stringify(design('#00ff00')));
  const r = run(['apply', file, '--no-render', '--only', 'ext_main', '--out', out], env);
  assert.equal(r.status, 0, r.stderr);
  const body = await px(path.join(out, 'work', 'EXT_Main.png')), plate = await px(path.join(out, 'work', 'Plates.png'));
  assert.deepEqual(body(10, 10), [0, 255, 0, 255]);        // rebuilt
  assert.deepEqual(plate(10, 10), [255, 0, 255, 255]);      // untouched, still there
  assert.match(run(['apply', file, '--only', 'nope', '--out', out], env).stderr, /no such texture in the design: nope/);
  assert.match(run(['apply', file, '--only', 'ext_main', '--export', '--out', out], env).stderr, /export needs a full build/);
});

test('apply: only full builds count as rounds, and the brief remembers the output folder', async () => {
  const home = tmp(); applyCar(home, 'rd');
  const dir = tmp(), env = { ACLIVERY_HOME: home }, out = path.join(dir, 'o'), file = path.join(dir, 'd.json');
  const pdir = path.join(home, 'projects', 'rd'); fs.mkdirSync(pdir, { recursive: true });
  fs.writeFileSync(path.join(pdir, 'brief.json'), JSON.stringify({ slug: 'rd' }));
  const textures = { ext_main: { fill: '#ffffff', elements: [{ panel: 'a', color: '#ff0000', at: [0, 0, 0.5, 0.5] }] }, plates: { fill: '#000000', elements: [{ panel: 'whole', color: '#ff00ff', at: [0, 0, 0.5, 0.5] }] } };
  fs.writeFileSync(file, JSON.stringify({ car: 'rd', brief: 'rd', textures }));
  const saved = () => JSON.parse(fs.readFileSync(path.join(pdir, 'brief.json'), 'utf8'));
  // a part build first: round stays 0, the folder and the part are written to the brief
  const part = run(['apply', file, '--no-render', '--only', 'ext_main', '--out', out], env);
  assert.equal(part.status, 0, part.stderr);
  assert.match(part.stdout, /review, part build \[ext_main\], not a round \(rounds done: 0\)/);
  assert.match(part.stdout, /next: a part build is not a round.*that full build is round 1/);
  assert.deepEqual([saved().build.round, saved().build.part, saved().build.out], [0, 'ext_main', out]);
  // a full build with no --out goes to the remembered folder and is round 1
  const full = run(['apply', file, '--no-render'], env);
  assert.match(full.stdout, /review, round 1:/);
  assert.ok(fs.existsSync(path.join(out, 'work', 'Plates.png')), 'built into the remembered folder');
  assert.deepEqual([saved().build.round, saved().build.part], [1, null]);
  // another part build leaves the count alone
  assert.match(run(['apply', file, '--no-render', '--only', 'plates'], env).stdout, /not a round \(rounds done: 1\)/);
  assert.equal(saved().build.round, 1);
  // an explicit different --out is allowed, says so, and becomes the remembered one
  const out2 = path.join(dir, 'o2');
  const moved = run(['apply', file, '--no-render', '--out', out2], env);
  assert.match(moved.stdout, /note: the brief remembered .*this build goes to/);
  assert.match(moved.stdout, /review, round 2:/);
  assert.equal(saved().build.out, out2);
  // without a brief the count lives in the output folder and follows the same rule
  const file2 = path.join(dir, 'e.json'), out3 = path.join(dir, 'o3');
  fs.writeFileSync(file2, JSON.stringify({ car: 'rd', textures }));
  assert.match(run(['apply', file2, '--no-render', '--out', out3], env).stdout, /review, round 1:/);
  assert.match(run(['apply', file2, '--no-render', '--only', 'plates', '--out', out3], env).stdout, /not a round \(rounds done: 1\)/);
  assert.match(run(['apply', file2, '--no-render', '--out', out3], env).stdout, /review, round 2:/);
});
