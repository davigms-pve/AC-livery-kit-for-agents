import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { loadPack, root, home } from '../lib/paths.mjs';
import { quiet } from '../lib/quiet.mjs';
import { run as decal } from './decal.mjs';
import { run as text, textImage } from './text.mjs';
import { run as logo } from './logo.mjs';
import { run as car } from './car.mjs';
import { run as render } from './render.mjs';
import { run as compare } from './compare.mjs';
import { run as exportSkin } from './export.mjs';
import { decodeTexture } from '../engine.mjs';
import { PATTERNS, TONAL, DEFAULTS, DEFAULT_DENSITY, DISCREET, makePattern, renderPattern, luma } from '../lib/patterns.mjs';

export const help = `aclivery apply <design.json> [--out dir] [--check] [--no-render] [--export]
  Builds the whole skin from one design file: prepares the assets, draws every element in layer order, renders a
  contact sheet. The file is checked first; every problem is listed before anything is drawn. Same file, same skin.
    --check      only check the file (panels, assets, colours, boxes), print where every element lands and about how big, and stop
    --no-render  skip the contact sheet and the reference comparison
    --export     also write ui_skin.json + preview.jpg and encode DDS + zip for Content Manager
    --out        build folder (default assets/builds/<name>): work/ (PNG textures), sheet.png, dist/
  Design file (JSON). Paths are relative to the repo root. Unknown keys are errors.
    { "car": "<id>", "name": "Skin name", "brief": "<slug, optional: compare with its references>",
      "colors":   { "accent": "#336699" },
      "assets":   { "logo": "assets/logos/logo.png",
                    "mark": { "file": "assets/logos/mark.png", "prep": { "keyBg": true, "tint": "#222222", "trim": true } } },
      "textures": { "<texture role>":  { "fill": "#f6f6f6", "elements": [ ...elements ] },
                    "<cut-out role>":  { "fill": "transparent", "size": "WxH", "elements": [ ...elements ] } },
      "skin":     { "skinname": "...", "drivername": "...", "country": "...", "team": "...", "number": "..." } }
  Element (exactly one of image / color / text; "panel" is a panel name from aclivery panel list):
    { "panel": "<panel>", "image": "<asset name>", "at": [0.1, 0.2, 0.4, 0.5] }    an asset, upright, kept in proportion
    { "panel": "<panel>", "color": "<colour name or #rrggbb>" }                    paint the panel (or the "at" box)
    { "panel": "<panel>", "text": "A. DRIVER", "ink": "#222222", "bold": true, "at": [0.2, 0.7, 0.5, 0.1] }
    { "panel": "whole", "color": "#ffffff", "at": [x, y, w, h],                     a card with text lines; each line's "at" is
      "lines": [ { "text": "7", "at": [0.1, 0.1, 0.8, 0.8] } ] }                    relative to the card
    { "pattern": "ink-lines", "panels": "visible", "density": 0.8, "seed": 1 }       generated art, no file needed (see below)
    optional: "opacity" 0..1, "rotate" 0/90/180/270, "label", "overlap": true (a real exception), "layer".
    text options: ink, font, bold, italic, spacing, outline.
  Layers are drawn in this order whatever the order in the file: "tone" (quiet background art, logos may sit on it),
  "paint" (solid colours, the default for color), "logo" (the default for image), "text" (the default for text).
  Patterns (placeholders when there is no original art): quiet tonal art "ink-lines" (faint vines and feathers), "leaves"
  (soft grey leaf clusters, like the can's scrollwork), "cracks" (fine branching lines); bold colour "splatter", "brush". "panels" is a list of panel names or "visible" (every well-seen panel); optional "color",
  "opacity", "density" 0..1, "seed" (same seed, same art). They never block logos. --check warns if tonal patterns would not be discreet.
  A texture "base" (a .png or .dds, instead of "fill") is the starting picture: use it for textures that already hold stickers the car
  uses (HR_Generic on the P92 holds the N/E/arrow markings next to the windshield banner), so only your parts change.
  A texture "fill" is the starting colour ("transparent" for cut-out textures like door plates, exported as DXT5);
  "size" records the texture's real size in the car pack (same as aclivery car size).`;

const LAYERS = ['tone', 'paint', 'logo', 'text'];
const TOP = ['car', 'name', 'brief', 'colors', 'assets', 'textures', 'skin'];
const ASSET = ['file', 'prep'], PREP = ['crop', 'erase', 'keyBg', 'keyLight', 'tint', 'trim', 'size'];
const TEXTURE = ['fill', 'base', 'size', 'elements'];
const TEXT_OPTS = ['ink', 'font', 'bold', 'italic', 'spacing', 'outline'];
const ELEMENT = ['panel', 'panels', 'pattern', 'density', 'seed', 'image', 'color', 'text', 'at', 'opacity', 'rotate', 'overlap', 'label', 'layer', 'covers', 'lines', ...TEXT_OPTS];
const LINE = ['text', 'at', ...TEXT_OPTS];
const HEX = /^#[0-9a-f]{6}$/i;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const colourOf = (v, colors) => (typeof v === 'string' && (colors?.[v] ?? v));
const validAt = (a) => Array.isArray(a) && a.length === 4 && a.every((n) => typeof n === 'number' && n >= 0 && n <= 1) && a[2] > 0 && a[3] > 0 && a[0] + a[2] <= 1.0001 && a[1] + a[3] <= 1.0001;

/** The layer an element is drawn in. */
export const layerOf = (e) => e.layer ?? (e.pattern ? (TONAL.includes(e.pattern) ? 'tone' : 'paint') : e.image ? 'logo' : e.text ? 'text' : 'paint');

/** "visible" patterns cover every panel that is well seen from outside and big enough to matter. */
export const AUTO = { minVisible: 0.4, minAreaM2: 0.03 };
const areaM2 = (pn) => pn.rect[2] * pn.metresPerUv[0] * pn.rect[3] * pn.metresPerUv[1];
/** The panel names an element covers (one panel, a list, or "visible"). */
export function panelsOf(e, profile, role) {
  if (e.panels === 'visible') return Object.entries(profile.panels?.[role] ?? {}).filter(([, p]) => p.metresPerUv && (p.visible ?? 1) >= AUTO.minVisible && areaM2(p) >= AUTO.minAreaM2).map(([n]) => n);
  if (Array.isArray(e.panels)) return e.panels;
  return e.panel ? [e.panel] : [];
}
/** A panel's real size as the viewer sees it upright: [width, height] in metres. */
export const uprightM = (pn, extraRot = 0) => {
  const rot = (((pn.textRotation ?? 0) + extraRot) % 360 + 360) % 360, um = pn.rect[2] * pn.metresPerUv[0], vm = pn.rect[3] * pn.metresPerUv[1];
  return rot % 180 ? [vm, um] : [um, vm];
};
/**
 * How much of a box (fractions of the upright panel: x, y, w, h) lies on painted surface. A panel's rect is only the bounding box of its
 * UV island; the island itself (`outline`) can be a crescent or have notches, and art outside it is cut off or lands on another part.
 * Same mapping as decal's rotation. Returns 0..1, or null when the panel has no outline.
 */
export function insideIsland(pn, rot, [bx, by, bw, bh], n = 12) {
  const poly = pn.outline;
  if (!Array.isArray(poly) || poly.length < 3) return null;
  const [ru, rv, rw, rh] = pn.rect;
  const toUv = (fx, fy) => rot === 90 ? [ru + (1 - fy) * rw, rv + fx * rh] : rot === 180 ? [ru + (1 - fx) * rw, rv + (1 - fy) * rh] : rot === 270 ? [ru + fy * rw, rv + (1 - fx) * rh] : [ru + fx * rw, rv + fy * rh];
  const inPoly = (x, y) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c; } return c; };
  let inside = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const [u, v] = toUv(bx + ((i + 0.5) / n) * bw, by + ((j + 0.5) / n) * bh); if (inPoly(u, v)) inside++; }
  return inside / (n * n);
}
/**
 * The box of the same size, moved the least, that lies fully (97%+) on the panel's painted island, or null if there is none.
 * Used to suggest a fix when an element is cut off. Boxes are [x, y, w, h] fractions of the upright panel.
 */
export function nearestInside(pn, rot, box, step = 0.02) {
  const [bx, by, bw, bh] = box;
  let best = null;
  for (let x = 0; x <= 1 - bw + 1e-9; x += step) for (let y = 0; y <= 1 - bh + 1e-9; y += step) {
    const dist = Math.hypot(x - bx, y - by);
    if (best && dist >= best.dist) continue;
    if (insideIsland(pn, rot, [x, y, bw, bh], 8) >= 0.97) best = { dist, box: [+x.toFixed(2), +y.toFixed(2), bw, bh] };
  }
  return best?.box ?? null;
}
const patternSeed = (e, name) => `${e.seed ?? 1}:${name}`;

/** Elements in draw order: by layer, then as written. Keeps each element's index in the file for messages. */
export function drawOrder(elements) {
  return elements.map((e, i) => ({ e, i })).sort((a, b) => LAYERS.indexOf(layerOf(a.e)) - LAYERS.indexOf(layerOf(b.e)) || a.i - b.i);
}

/**
 * Check a design against a car pack. Returns a list of problems (empty = fine). Pure: no drawing, no files read except
 * through `fileExists`, so a model gets every mistake in one go instead of one per run.
 */
export function validateDesign(d, profile, fileExists = (p) => fs.existsSync(p)) {
  const bad = [];
  const unknown = (where, o, allowed) => { for (const k of Object.keys(o)) if (!allowed.includes(k)) bad.push(`${where}: unknown key "${k}" (allowed: ${allowed.join(', ')})`); };
  if (!isObj(d)) return ['the design must be a JSON object'];
  unknown('design', d, TOP);
  if (typeof d.car !== 'string') bad.push('design.car: the car folder id is required');
  if (d.name !== undefined && !/^[\w .-]+$/.test(String(d.name))) bad.push('design.name: letters, digits, space, . _ - only');
  for (const [k, v] of Object.entries(d.colors ?? {})) if (!HEX.test(v)) bad.push(`colors.${k}: "${v}" is not a hex colour like #4ec4d6`);

  const assets = d.assets ?? {};
  for (const [name, a0] of Object.entries(assets)) {
    const a = typeof a0 === 'string' ? { file: a0 } : a0;
    if (!isObj(a) || typeof a.file !== 'string') { bad.push(`assets.${name}: give a file path, or { "file": ..., "prep": ... }`); continue; }
    unknown(`assets.${name}`, a, ASSET);
    if (!fileExists(path.resolve(root, a.file))) bad.push(`assets.${name}: file not found: ${a.file} (paths are relative to the repo root)`);
    if (a.prep !== undefined) {
      if (!isObj(a.prep)) bad.push(`assets.${name}.prep: must be an object`);
      else {
        unknown(`assets.${name}.prep`, a.prep, PREP);
        if (a.prep.tint !== undefined && !HEX.test(a.prep.tint)) bad.push(`assets.${name}.prep.tint: not a hex colour`);
        if (a.prep.crop !== undefined && !(Array.isArray(a.prep.crop) && a.prep.crop.length === 4 && a.prep.crop.every((n) => typeof n === 'number'))) bad.push(`assets.${name}.prep.crop: [x, y, w, h] as fractions`);
      }
    }
  }

  const textures = d.textures;
  if (!isObj(textures) || !Object.keys(textures).length) { bad.push('design.textures: at least one texture role is required, for example "ext_main"'); return bad; }
  const colourOk = (v) => typeof v === 'string' && (HEX.test(colourOf(v, d.colors) ?? ''));
  const checkText = (where, o) => {
    if (typeof o.text !== 'string' || !o.text || o.text.length > 60) bad.push(`${where}.text: 1 to 60 characters`);
    if (o.ink !== undefined && !colourOk(o.ink)) bad.push(`${where}.ink: "${o.ink}" is neither a hex colour nor a name in "colors"`);
    if (o.outline !== undefined && !colourOk(o.outline)) bad.push(`${where}.outline: not a colour`);
  };
  for (const [role, t] of Object.entries(textures)) {
    const tex = profile.textures?.[role];
    if (!tex) { bad.push(`textures.${role}: the car has no such texture. Known: ${Object.keys(profile.textures ?? {}).slice(0, 12).join(', ')} (aclivery panel textures <car>)`); continue; }
    if (!isObj(t)) { bad.push(`textures.${role}: must be an object`); continue; }
    unknown(`textures.${role}`, t, TEXTURE);
    if (t.fill !== undefined && t.fill !== 'transparent' && !colourOk(t.fill)) bad.push(`textures.${role}.fill: a hex colour, a name in "colors", or "transparent"`);
    if (t.size !== undefined && !/^\d+x\d+$/.test(String(t.size))) bad.push(`textures.${role}.size: like 2048x640`);
    if (t.base !== undefined && (typeof t.base !== 'string' || !/\.(png|dds)$/i.test(t.base) || !fileExists(path.resolve(root, t.base)))) bad.push(`textures.${role}.base: a .png or .dds file that exists (paths are relative to the repo root): ${t.base}`);
    if (t.base !== undefined && t.fill !== undefined) bad.push(`textures.${role}: give "base" or "fill", not both (base is the starting picture)`);
    if (!Array.isArray(t.elements) || !t.elements.length) { bad.push(`textures.${role}.elements: a non-empty list`); continue; }
    t.elements.forEach((e, i) => {
      const where = `${role}.elements[${i}]`;
      if (!isObj(e)) { bad.push(`${where}: must be an object`); return; }
      unknown(where, e, ELEMENT);
      if (e.pattern !== undefined) {
        if (!PATTERNS.includes(e.pattern)) bad.push(`${where}.pattern: one of ${PATTERNS.join(', ')}`);
        for (const k of ['image', 'text', 'lines', 'at', 'rotate', 'overlap', ...TEXT_OPTS]) if (e[k] !== undefined) bad.push(`${where}.${k}: not for patterns (a pattern fills each panel)`);
        if ((e.panel === undefined) === (e.panels === undefined)) bad.push(`${where}: give "panel" or "panels" (a list, or "visible")`);
        const names = panelsOf(e, profile, role);
        if (e.panels !== undefined && e.panels !== 'visible' && (!Array.isArray(e.panels) || !e.panels.length)) bad.push(`${where}.panels: a non-empty list of panel names, or "visible"`);
        else if (!names.length) bad.push(`${where}: no panels selected`);
        for (const n of names) if (!profile.panels?.[role]?.[n]?.metresPerUv) bad.push(`${where}: panel "${n}" has no measured size in ${role}, so a pattern cannot be scaled to it (aclivery panel list <car> --texture ${role})`);
        if (e.color !== undefined && !colourOk(e.color)) bad.push(`${where}.color: not a hex colour or a name in "colors"`);
        if (e.density !== undefined && !(typeof e.density === 'number' && e.density > 0 && e.density <= 1)) bad.push(`${where}.density: above 0, up to 1`);
        if (e.seed !== undefined && !Number.isInteger(e.seed)) bad.push(`${where}.seed: a whole number`);
        if (e.opacity !== undefined && !(typeof e.opacity === 'number' && e.opacity >= 0 && e.opacity <= 1)) bad.push(`${where}.opacity: 0..1`);
        if (e.layer !== undefined && !LAYERS.includes(e.layer)) bad.push(`${where}.layer: one of ${LAYERS.join(', ')}`);
        return;
      }
      for (const k of ['panels', 'density', 'seed']) if (e[k] !== undefined) bad.push(`${where}.${k}: only on pattern elements`);
      const kinds = ['image', 'color', 'text'].filter((k) => e[k] !== undefined);
      if (kinds.length !== 1) bad.push(`${where}: give exactly one of image / color / text (found ${kinds.join(', ') || 'none'})`);
      if (!e.panel || !profile.panels?.[role]?.[e.panel]) bad.push(`${where}.panel: no panel "${e.panel}" in ${role}. Try: aclivery panel list <car> --texture ${role}`);
      if (e.image !== undefined && !(e.image in assets)) bad.push(`${where}.image: "${e.image}" is not in "assets" (have: ${Object.keys(assets).join(', ') || 'none'})`);
      if (e.color !== undefined && !colourOk(e.color)) bad.push(`${where}.color: "${e.color}" is neither a hex colour nor a name in "colors"`);
      if (e.text !== undefined) checkText(where, e);
      if (e.at !== undefined && !validAt(e.at)) bad.push(`${where}.at: four fractions [x, y, w, h], each 0..1, staying inside the panel`);
      if (e.opacity !== undefined && !(typeof e.opacity === 'number' && e.opacity >= 0 && e.opacity <= 1)) bad.push(`${where}.opacity: 0..1`);
      if (e.rotate !== undefined && ![0, 90, 180, 270].includes(e.rotate)) bad.push(`${where}.rotate: 0, 90, 180 or 270`);
      if (e.layer !== undefined && !LAYERS.includes(e.layer)) bad.push(`${where}.layer: one of ${LAYERS.join(', ')}`);
      if (e.covers !== undefined && typeof e.covers !== 'string') bad.push(`${where}.covers: a word or phrase from the analysis layer this element answers`);
      if (e.lines !== undefined) {
        if (e.color === undefined || !Array.isArray(e.lines) || !e.lines.length) bad.push(`${where}.lines: a non-empty list, and only on a color element (a card)`);
        else e.lines.forEach((l, j) => {
          const lw = `${where}.lines[${j}]`;
          if (!isObj(l)) { bad.push(`${lw}: must be an object`); return; }
          unknown(lw, l, LINE); checkText(lw, l);
          if (!validAt(l.at)) bad.push(`${lw}.at: four fractions relative to the card`);
        });
      }
      if (e.text === undefined) for (const k of TEXT_OPTS) if (e[k] !== undefined) bad.push(`${where}.${k}: only on text elements`);
    });
  }
  return bad;
}

/**
 * Warnings (not errors): tonal ink that would not be discreet. "Discreet" = strokes only a little darker than the body and
 * little of the body covered; the thresholds are heuristics, the owner's eye is the real test.
 */
export function designWarnings(design, profile) {
  const out = [];
  for (const [name, a] of Object.entries(design.assets ?? {})) {
    const file = typeof a === 'string' ? a : a?.file;
    if (/placeholder/i.test(String(file))) out.push(`asset "${name}" is a generated placeholder (${path.basename(String(file))}). If the real mark exists in assets/logos (aclivery logo inspect), cut it out of that file with logo prep --crop / --erase / --key-bg / --tint (skill ac-logos); if there is no real file, say so in the report.`);
  }
  for (const [role, t] of Object.entries(design.textures)) {
    if (t.fill === 'transparent') continue;
    const fill = luma(colourOf(t.fill ?? '#ffffff', design.colors));
    t.elements.forEach((e, i) => {
      if (!TONAL.includes(e.pattern) || layerOf(e) !== 'tone' || fill == null) return;
      const limit = DISCREET[e.pattern];
      const color = colourOf(e.color ?? DEFAULTS[e.pattern].color, design.colors), opacity = e.opacity ?? DEFAULTS[e.pattern].opacity;
      const contrast = Math.abs(fill - luma(color)) * opacity;
      let covered = 0, area = 0;
      for (const name of panelsOf(e, profile, role)) {
        const [w, h] = uprightM(profile.panels[role][name]);
        covered += makePattern(e.pattern, { widthM: w, heightM: h, pxPerM: 1, seed: patternSeed(e, name), density: e.density ?? DEFAULT_DENSITY, color }).coverage * w * h; area += w * h;
      }
      const shift = area ? (covered / area) * contrast : 0, where = `${role}.elements[${i}] ${e.pattern}`;
      if (contrast > limit.strokeContrast) out.push(`${where}: marks are too strong (contrast ${contrast.toFixed(2)}, discreet is up to ${limit.strokeContrast}). Use a colour closer to the body or lower "opacity".`);
      if (shift > limit.meanShift) out.push(`${where}: covers about ${(100 * covered / area).toFixed(1)}% of the panels and would darken the body by ${(100 * shift).toFixed(1)}% (discreet is up to ${100 * limit.meanShift}%). Lower "density".`);
    });
  }
  return out;
}

/**
 * One line per non-tone element: where it lands on the car and about how big it will be. Lets a model (and a person)
 * catch "name on the roof-edge strip, 5 cm tall" before rendering. Sizes come from the panel's metresPerUv: approximate,
 * not verified against the game.
 */
export async function placementTable(design, profile, assetFile = {}) {
  const rows = [];
  for (const [role, t] of Object.entries(design.textures)) {
    for (const [i, e] of t.elements.entries()) {
      if (layerOf(e) === 'tone') continue;
      if (e.pattern) { rows.push(`${role}[${i}] pattern ${e.pattern} on ${panelsOf(e, profile, role).length} panel(s), ${e.color ?? DEFAULTS[e.pattern].color}`); continue; }
      const pn = profile.panels?.[role]?.[e.panel];
      const what = e.image ?? e.text ?? e.color;
      let row = `${role}[${i}] ${String(what).slice(0, 22).padEnd(22)} on ${e.panel}`;
      if (pn?.metresPerUv) {
        const rot = (((pn.textRotation ?? 0) + (e.rotate ?? 0)) % 360 + 360) % 360;
        const um = pn.rect[2] * pn.metresPerUv[0], vm = pn.rect[3] * pn.metresPerUv[1];
        const upright = rot % 180 ? [vm, um] : [um, vm];
        const at = e.at ?? (e.color && e.image === undefined ? [0, 0, 1, 1] : [0.05, 0.05, 0.9, 0.9]);
        const slot = [at[2] * upright[0], at[3] * upright[1]];
        let size = slot;
        if (e.image && assetFile[e.image] && fs.existsSync(assetFile[e.image])) {
          const m = await sharp(assetFile[e.image]).metadata(), s = Math.min(slot[0] / m.width, slot[1] / m.height);
          size = [m.width * s, m.height * s];
        } else if (e.text) {
          const m = await sharp(await textImage(e.text, { bold: !!e.bold, italic: !!e.italic })).metadata(), s = Math.min(slot[0] / m.width, slot[1] / m.height);
          size = [m.width * s, m.height * s];
        }
        const cm = (v) => Math.round(v * 100);
        row += `  about ${cm(size[0])} x ${cm(size[1])} cm`;
        const dw = size[0] / upright[0], dh = size[1] / upright[1], within = insideIsland(pn, rot, [at[0] + (at[2] - dw) / 2, at[1] + (at[3] - dh) / 2, dw, dh]);
        if (within !== null && within < 0.85 && !(e.color !== undefined && !e.at)) {
          const box = [at[0] + (at[2] - dw) / 2, at[1] + (at[3] - dh) / 2, dw, dh], near = nearestInside(pn, rot, box);
          row += `  <-- only ${Math.round(within * 100)}% is on painted surface: the rest is cut off` + (near ? `. Nearest box fully on it, same size: "at": [${near.map((n) => +n.toFixed(3)).join(', ')}] (the element is centred in "at": use a box of this size if it is not square)` : '. No place of this size fits: make it smaller');
        }
        if (pn.centroid3d) row += `, ${pn.centroid3d[0] > 0.05 ? 'left' : pn.centroid3d[0] < -0.05 ? 'right' : 'centre'}, ${pn.centroid3d[1].toFixed(2)} m high`;
        if (pn.visible != null) row += `, vis ${pn.visible.toFixed(2)}`;
      }
      rows.push(row);
    }
  }
  return rows;
}

/** Prepared copies of the design's assets go to `dir`; assets without "prep" are used where they are. Returns { name: file }. */
async function prepareAssets(design, dir) {
  const assetFile = {};
  fs.mkdirSync(dir, { recursive: true });
  for (const [aName, a0] of Object.entries(design.assets ?? {})) {
    const a = typeof a0 === 'string' ? { file: a0 } : a0, src = path.resolve(root, a.file);
    if (!a.prep) { assetFile[aName] = src; continue; }
    const dst = path.join(dir, `${aName}.png`), args = ['prep', src, '--out', dst];
    if (a.prep.crop) args.push('--crop', a.prep.crop.join(','));
    if (a.prep.erase) args.push('--erase', a.prep.erase.join(','));
    if (a.prep.keyBg) args.push('--key-bg');
    if (a.prep.keyLight) args.push('--key-light');
    if (a.prep.tint) args.push('--tint', a.prep.tint);
    if (a.prep.trim) args.push('--trim');
    if (a.prep.size) args.push('--size', String(a.prep.size));
    await quiet(() => logo(args));
    assetFile[aName] = dst;
  }
  return assetFile;
}

// ---- coverage: does the design answer every layer of the analysis? ---------------------------------------------------------------
const STOP = new Set(['the', 'and', 'with', 'from', 'that', 'this', 'both', 'all', 'on', 'of', 'in', 'to', 'for', 'a', 'an', 'big', 'small', 'large', 'grey', 'gray', 'white', 'black', 'placeholder', 'generated', 'pattern']);
const words = (s) => String(s ?? '').toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length >= 4 && !STOP.has(w));
/** Location words in an analysis layer's "where", with a test for the car's region names. A region the car does not have is ignored. */
const PLACES = [
  ['hood', /\b(hood|bonnet)\b/i, /hood|bonnet/i], ['roof', /\broof\b/i, /roof/i], ['doors', /\b(doors?|sides?|sills?)\b/i, /side|door/i],
  ['wing', /\b(wing|endplates?|spoiler)\b/i, /wing/i], ['rear', /\b(rear (bumper|deck|window)|tail|deck|diffuser)\b/i, /rear|tail/i],
  ['nose', /\b(nose|front bumper|splitter|grille)\b/i, /front_bumper|nose|front/i], ['mirrors', /\bmirrors?\b/i, /mirror/i],
];
const places = (where) => PLACES.filter(([, inWhere, inRegion]) => inRegion && inWhere.test(String(where ?? ''))).map(([name, , inRegion]) => ({ name, inRegion }));
const KIND_OK = {
  logo: (e) => e.image !== undefined || e.text !== undefined, 'large-graphic': (e) => e.image !== undefined, text: (e) => e.text !== undefined,
  accent: (e) => (e.color !== undefined && e.lines === undefined) || ['splatter', 'brush'].includes(e.pattern), 'tonal-art': (e) => ['ink-lines', 'leaves', 'cracks'].includes(e.pattern), marking: () => true, plate: () => true,
};

/**
 * Compare the brief's analysis layers with the design. Returns a list of problems: a layer nothing answers, or a place named in a
 * layer's "where" (hood, roof, doors, wing, rear, nose, mirrors) that has no matching element. Heuristic: matches words from the layer
 * against the element's text, image and asset name, label and "covers"; and the panel of each element against the car's regions.
 */
export function coverage(design, brief, regions) {
  const layers = (brief?.analysis?.layers ?? []).map((l, i) => ({ l, i })).filter(({ l }) => l.kind && l.kind !== 'base');
  if (!layers.length) return [];
  const items = [];
  for (const [role, t] of Object.entries(design.textures ?? {})) for (const [i, e] of (t.elements ?? []).entries()) {
    const panels = e.panel ? [e.panel] : Array.isArray(e.panels) ? e.panels : (e.panels === 'visible' ? ['*'] : []);
    const hay = [e.text, e.label, e.covers, e.pattern, typeof e.image === 'string' ? e.image : '', typeof e.image === 'string' ? (design.assets?.[e.image]?.file ?? design.assets?.[e.image] ?? '') : '', typeof e.color === 'string' ? e.color : '', ...(e.lines ?? []).map((x) => x.text)].map(String).join(' ').toLowerCase();
    items.push({ e, role, i, panels, hay });
  }
  const regionOf = (name) => (regions?.regions ?? []).filter((r) => (r.panels ?? []).some((p) => p.name === name)).map((r) => r.name);
  const out = [];
  const answered = [];
  for (const { l, i } of layers) {
    const before = out.length;
    const ok = KIND_OK[l.kind] ?? (() => true);
    const keys = new Set([...words(l.what), ...words(l.brand)]);
    const explicit = items.filter((it) => it.e.covers && (String(it.e.covers) === String(i) || [...words(it.e.covers)].some((w) => keys.has(w))));
    const named = items.filter((it) => ok(it.e) && [...keys].some((k) => it.hay.includes(k)));
    const mine = explicit.length ? explicit : named.length ? named : items.filter((it) => ok(it.e));
    const label = `layer ${i} "${String(l.what ?? l.kind).slice(0, 60)}" (${l.kind})`;
    if (!explicit.length && !named.length && !['tonal-art', 'accent', 'plate', 'marking'].includes(l.kind)) { out.push(`${label}: no element answers it (no text, image name or "covers" matches). Add one, or record a decision in the brief for leaving it out.`); continue; }
    if (!mine.length) { out.push(`${label}: the design has no element of this kind. Add one, or record a decision for leaving it out.`); continue; }
    if (l.source === 'fetch' && l.asset) {
      const want = path.basename(String(l.asset)).toLowerCase(), used = Object.values(design.assets ?? {}).map((a) => path.basename(String(typeof a === 'string' ? a : a?.file ?? '')).toLowerCase());
      if (!used.includes(want)) { out.push(`${label} is a brand mark to fetch (${path.basename(String(l.asset))}) but no asset of the design uses that file. Use it (cut with prep), or change the layer's source and say why.`); continue; }
    }
    if (l.kind === 'plate') { answered.push(i); continue; }
    for (const p of places(l.where)) {
      const here = mine.some((it) => it.panels.includes('*') || it.panels.some((pn) => regionOf(pn).some((r) => p.inRegion.test(r))) || it.role !== 'ext_main');
      const known = (regions?.regions ?? []).some((r) => p.inRegion.test(r.name));
      if (known && !here) out.push(`${label} says "${p.name}" but no matching element sits there. Add it, or record a decision.`);
    }
    if (out.length === before) answered.push(i);
  }
  out.answered = answered;
  return out;
}

/** A base picture at the declared size (`size`): the model embeds small copies of some textures, the design draws at the real size. Same aspect only. */
export function scaleToSize(img, w, h, size) {
  const m = /^(\d+)x(\d+)$/.exec(String(size ?? ''));
  if (!m || (Number(m[1]) === w && Number(m[2]) === h) || Math.abs(Number(m[1]) / Number(m[2]) / (w / h) - 1) > 0.02) return img.png();
  return img.resize(Number(m[1]), Number(m[2]), { kernel: 'lanczos3' }).png();
}

const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'skin';
const fmt = (n) => Number(n.toFixed(4));

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['check', 'export', 'no-render'] });
  const only = flags.only ? String(flags.only).split(',').map((s) => s.trim()).filter(Boolean) : null;
  const [file] = positional;
  if (!file) throw new UsageError(help);
  let design;
  try { design = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8')); }
  catch (e) { throw new UsageError(`cannot read ${file} as JSON: ${e.message}`); }
  if (typeof design?.car !== 'string') throw new UsageError('design.car: the car folder id is required');
  const pack = loadPack(design.car);
  const problems = validateDesign(design, pack.profile);
  if (problems.length) throw new UsageError(`${file}: ${problems.length} problem(s), nothing drawn:\n  - ${problems.join('\n  - ')}`);
  const warnings = designWarnings(design, pack.profile);
  let brief = null;
  if (design.brief) { try { brief = JSON.parse(fs.readFileSync(path.join(home(), 'projects', String(design.brief), 'brief.json'), 'utf8')); } catch { /* no such brief: coverage is skipped */ } }
  const missing = coverage(design, brief, pack.regions);
  const answered = missing.answered ?? [];
  const count = Object.values(design.textures).reduce((n, t) => n + t.elements.length, 0);
  if (flags.check) {
    console.log(`design ok: ${Object.keys(design.textures).length} texture(s), ${count} element(s)`);
    for (const w of warnings) console.log(`warning: ${w}`);
    for (const m of missing) console.log(`missing: ${m}`);
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'aclivery-check-'));
    const files = await prepareAssets(design, tmpDir);
    console.log('where each non-tone element lands (size is approximate; "cut off" = part of the box is outside the panel\'s painted island; a door is about 0.5-0.8 m high, a roof edge or window strip is above 0.9 m):');
    for (const row of await placementTable(design, pack.profile, files)) console.log('  ' + row);
    fs.rmSync(tmpDir, { recursive: true, force: true });
    return 0;
  }

  if (only) {
    const bad = only.filter((r) => !design.textures[r]);
    if (bad.length) throw new UsageError(`--only: no such texture in the design: ${bad.join(', ')} (have: ${Object.keys(design.textures).join(', ')})`);
    if (flags.export) throw new UsageError('--only builds part of the skin; export needs a full build: run apply without --only, then with --export');
  }
  const name = design.name ?? path.parse(file).name;
  const out = path.resolve(flags.out ?? path.join(root, 'assets', 'builds', slug(name)));
  const work = path.join(out, 'work'), marker = path.join(work, '.aclivery-work');
  if (fs.existsSync(work) && !fs.existsSync(marker) && fs.readdirSync(work).length) {
    throw new UsageError(`${work} exists and was not made by apply. Pass another --out (output of an old build script can simply be deleted).`);
  }
  if (!only) fs.rmSync(work, { recursive: true, force: true });
  fs.mkdirSync(path.join(work, 'prep'), { recursive: true });
  fs.writeFileSync(marker, 'made by aclivery apply; rebuilt on every run\n');
  for (const w of warnings) console.log(`warning: ${w}`);

  const assetFile = await prepareAssets(design, path.join(work, 'prep'));
  const colour = (v) => colourOf(v, design.colors);
  const transparent = [];

  for (const [role, t] of Object.entries(design.textures)) {
    if (only && !only.includes(role)) continue;
    if (t.size && (`${pack.profile.textures[role].width}x${pack.profile.textures[role].height}` !== t.size)) await quiet(() => car(['size', design.car, role, t.size]));
    const tex = loadPack(design.car).profile.textures[role];
    const target = path.join(work, `${path.parse(tex.file).name}.png`);
    if (t.fill === 'transparent') transparent.push(path.parse(tex.file).name);
    let started = false;
    if (t.base) {
      // Start from an existing texture (for example the stock one, to keep the stickers the model already uses).
      const src = path.resolve(root, t.base);
      if (/\.dds$/i.test(src)) {
        const s = await decodeTexture(fs.readFileSync(src), 4096);
        if (!s) throw new UsageError(`could not decode ${t.base} (try: aclivery validate dds ${t.base})`);
        await scaleToSize(sharp(s.data, { raw: { width: s.w, height: s.h, channels: 4 } }), s.w, s.h, t.size).toFile(target);
      } else await scaleToSize(sharp(src), (await sharp(src).metadata()).width, (await sharp(src).metadata()).height, t.size).toFile(target);
      started = true;
    }
    const canvas = () => { const a = started ? ['--base', target] : ['--fill', t.fill === 'transparent' ? 'transparent' : colour(t.fill ?? '#ffffff')]; started = true; return a; };
    const place = async (where, fn, args) => {
      try { await quiet(() => fn(args)); } catch (e) { throw e instanceof UsageError ? new UsageError(`${where}: ${e.message}`) : e; }
    };
    const textArgs = (o) => {
      const a = ['--text', o.text];
      if (o.ink) a.push('--ink', colour(o.ink));
      if (o.outline) a.push('--outline', colour(o.outline));
      if (o.font) a.push('--font', o.font);
      if (o.spacing !== undefined) a.push('--spacing', String(o.spacing));
      if (o.bold) a.push('--bold');
      if (o.italic) a.push('--italic');
      return a;
    };
    for (const { e, i } of drawOrder(t.elements)) {
      if (e.pattern) {
        const color = colour(e.color ?? DEFAULTS[e.pattern].color), opacity = e.opacity ?? DEFAULTS[e.pattern].opacity;
        fs.mkdirSync(path.join(work, 'pattern'), { recursive: true });
        for (const name of panelsOf(e, pack.profile, role)) {
          const pn = pack.profile.panels[role][name], [wm, hm] = uprightM(pn);
          const pxPerM = Math.min(tex.width / pn.metresPerUv[0], 4096 / Math.max(wm, hm));
          const img = await renderPattern(e.pattern, { widthM: wm, heightM: hm, pxPerM, seed: patternSeed(e, name), density: e.density ?? DEFAULT_DENSITY, color });
          const png = path.join(work, 'pattern', `${role}-${i}-${name}.png`);
          fs.writeFileSync(png, img.png);
          // Always --under: decoration fills the whole panel box and must not stop logos from being placed on it.
          await place(`${role}.elements[${i}] (${e.pattern} on ${name})`, decal, [design.car, '--texture', role, '--panel', name, '--out', target, ...canvas(), '--image', png, '--at', '0,0,1,1', '--under', '--opacity', String(opacity), '--label', `${e.pattern} ${name}`]);
        }
        continue;
      }
      const where = `${role}.elements[${i}] (${e.panel} ${e.image ?? e.text ?? e.color})`;
      const common = ['--texture', role, '--panel', e.panel, '--out', target];
      const extra = [];
      if (e.at) extra.push('--at', e.at.join(','));
      if (e.opacity !== undefined) extra.push('--opacity', String(e.opacity));
      if (e.rotate) extra.push('--rotate', String(e.rotate));
      if (e.label) extra.push('--label', e.label);
      if (e.overlap) extra.push('--overlap');
      if (layerOf(e) === 'tone') extra.push('--under');
      if (e.text !== undefined) await place(where, text, [design.car, ...common, ...canvas(), ...extra, ...textArgs(e)]);
      else if (e.image !== undefined) await place(where, decal, [design.car, ...common, ...canvas(), ...extra, '--image', assetFile[e.image], '--label', e.label ?? e.image]);
      else await place(where, decal, [design.car, ...common, ...canvas(), ...extra, '--color', colour(e.color)]);
      for (const [j, l] of (e.lines ?? []).entries()) {
        const [x, y, w, h] = e.at ?? [0, 0, 1, 1];
        const at = [x + l.at[0] * w, y + l.at[1] * h, l.at[2] * w, l.at[3] * h].map(fmt).join(',');
        await place(`${where} line ${j}`, text, [design.car, ...common, '--base', target, '--at', at, '--overlap', ...textArgs(l)]);
      }
    }
    // A starting picture with see-through parts (stickers on a cut-out sheet) must export with alpha (DXT5).
    if (t.base && (await sharp(target).stats()).channels[3]?.min < 255) transparent.push(path.parse(tex.file).name);
    const meta = await sharp(target).metadata();
    console.log(`${role}: ${t.elements.length} element(s) -> ${target} (${meta.width}x${meta.height})`);
  }

  if (!flags['no-render']) {
    const sheet = path.join(out, 'sheet.png');
    await quiet(() => render([design.car, '--skin', work, '--out', sheet]));
    console.log(`sheet: ${sheet}`);
    if (design.brief) {
      try {
        const cmp = path.join(out, 'compare.png');
        await quiet(() => compare([design.car, '--skin', work, '--brief', design.brief, '--out', cmp]));
        console.log(`compare: ${cmp} (left = reference, right = ours)`);
      } catch (e) { console.log(`compare skipped: ${e.message.split('\n')[0]}`); }
    }
  }

  // The fix loop: a build is one round. The review names what to look at and what to fix next, so a model repeats look-fix-build a few times.
  {
    const roundFile = path.join(out, '.rounds.json');
    let round = (brief?.build?.round ?? 0) + 1;
    if (!brief) { try { round = (JSON.parse(fs.readFileSync(roundFile, 'utf8')).round ?? 0) + 1; } catch { round = 1; } }
    fs.writeFileSync(roundFile, JSON.stringify({ round }));
    const byLayer = {};
    for (const t of Object.values(design.textures)) for (const e of t.elements) byLayer[layerOf(e)] = (byLayer[layerOf(e)] ?? 0) + 1;
    const rows = await placementTable(design, pack.profile, assetFile);
    const cut = rows.filter((r) => r.includes('cut off')), layers = Object.entries(byLayer).map(([k, n]) => `${k} ${n}`).join(', ');
    console.log(`review, round ${round}: ${Object.keys(design.textures).length} texture(s) [${Object.keys(design.textures).join(', ')}], elements by layer: ${layers}; ${warnings.length} warning(s), ${cut.length} element(s) cut off, ${missing.length} layer(s) missing`);
    for (const r of cut) console.log('  fix: ' + r.trim().slice(0, 230));
    for (const w of warnings) console.log('  fix: ' + w.slice(0, 230));
    for (const m of missing) console.log('  missing: ' + m.slice(0, 260));
    if (brief) {
      try {   // keep the brief in step with the build
        const bf = path.join(home(), 'projects', String(design.brief), 'brief.json'), bj = JSON.parse(fs.readFileSync(bf, 'utf8'));
        const prevBuild = bj.build ?? {};
        for (const [i, l] of (bj.analysis?.layers ?? []).entries()) { if (answered.includes(i)) l.built = { round }; else delete l.built; }
        bj.build = { design: path.relative(root, path.resolve(file)).replace(/\\\\/g, '/'), round, textures: Object.keys(design.textures), elements: count, missing: missing.length, cutOff: cut.length, exported: !!flags.export || !!prevBuild.exported, part: only ? only.join(',') : null, at: new Date().toISOString() };
        fs.writeFileSync(bf, JSON.stringify(bj, null, 1));
      } catch { /* the brief is optional */ }
    }
    if (!flags['no-render']) console.log('  next: open ' + (design.brief ? 'compare.png' : 'sheet.png') + ', first fix every "missing" line (add the element, or record a decision in the brief for leaving it out), then name the 3 to 5 biggest differences from the references (the wrong size, the wrong place, too faint), change those in the design file, run apply again. Do at least 3 rounds; more are fine while the differences are big, stop when they are small.');
  }

  if (flags.export) {
    const pkg = path.join(out, 'pkg');
    fs.rmSync(pkg, { recursive: true, force: true });
    fs.mkdirSync(pkg, { recursive: true });
    for (const f of fs.readdirSync(work)) if (/\.png$/i.test(f)) fs.copyFileSync(path.join(work, f), path.join(pkg, f));
    const previewDir = path.join(out, 'preview_src');
    await quiet(() => render([design.car, '--skin', work, '--views', 'front-right', '--each', '--size', '1022x575', '--out', previewDir]));
    await sharp(path.join(previewDir, 'front-right.png')).jpeg({ quality: 92 }).toFile(path.join(pkg, 'preview.jpg'));
    fs.writeFileSync(path.join(pkg, 'ui_skin.json'), JSON.stringify(design.skin ?? { skinname: name }, null, 1));
    const args = [pkg, '--car', design.car, '--name', name, '--out', path.join(out, 'dist')];
    if (transparent.length) args.push('--alpha', transparent.join(','));
    return exportSkin(args);
  }
  return 0;
}
