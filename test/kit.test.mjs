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
  b.analysis = { layers: [{ kind: 'tonal-art', what: 'grey ink feathers', tone: 'subtle' }] };
  assert.match(gaps(b, { packExists: true, fileExists: yes })[0].ask, /subtle tonal art/);
  b.elements.push({ what: 'grey ink feathers', tone: 'subtle', target: 'body', panel: 'q', asset: 'ink.png' });
  assert.ok(!gaps(b, { packExists: true, fileExists: yes }).some((t) => /subtle tonal art/.test(t.ask ?? '')));
});
