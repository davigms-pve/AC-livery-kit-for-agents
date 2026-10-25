// Deterministic decorative patterns for livery art when no original file exists: soft plumes, ink line-art (vines, feathers),
// cracks, splatter, brush strokes, stripes, camouflage blotches and halftone dots. Pure geometry in metres on a panel of a given real
// size; same seed, same art. Stand-ins in a named style, never copies of any artwork. Sizes are in metres so motifs look the same size on every panel.
import sharp from 'sharp';

export const PATTERNS = ['ink-lines', 'leaves', 'cracks', 'splatter', 'brush', 'stripes', 'camo', 'dots'];
/** The style a layer of the analysis can name ("style": "plumes") and the pattern that makes it. "none" means no generator fits: ask for an art file or leave it out. */
export const STYLES = { plumes: 'leaves', vines: 'ink-lines', cracks: 'cracks', splatter: 'splatter', brush: 'brush', stripes: 'stripes', camouflage: 'camo', dots: 'dots' };
/** What each pattern looks like, in words, so a plan or a report can say how rough the likeness is. */
export const LIKENESS = {
  'ink-lines': 'thin vines and feathers drawn as line art', leaves: 'soft fanned plumes with feathered edges', cracks: 'fine branching cracks', splatter: 'paint splatter blots',
  brush: 'tapered brush strokes', stripes: 'parallel bands at an angle', camo: 'irregular overlapping blotches', dots: 'a halftone dot gradient',
};
/** Patterns that are quiet background art by default (drawn under everything, checked for discretion). */
export const TONAL = ['ink-lines', 'leaves', 'cracks'];
/** Colour and opacity used when the design does not give them: a slightly darker tint, quiet on a near-white body. */
export const DEFAULTS = {
  'ink-lines': { color: '#55585d', opacity: 0.85 },
  leaves: { color: '#74787e', opacity: 0.9 },
  cracks: { color: '#6f7378', opacity: 0.7 },
  splatter: { color: '#4ec4d6', opacity: 1 },
  brush: { color: '#4ec4d6', opacity: 1 },
  stripes: { color: '#55585d', opacity: 0.85 },
  camo: { color: '#6b7068', opacity: 0.8 },
  dots: { color: '#55585d', opacity: 0.7 },
};
/** What "discreet" means for tonal art, so `apply --check` can warn. Heuristics: the owner's eye is the real test. */
export const DEFAULT_DENSITY = 0.8;
export const DISCREET = {
  'ink-lines': { strokeContrast: 0.55, meanShift: 0.03 },   // thin dark vines read as discreet when they cover little
  leaves: { strokeContrast: 0.45, meanShift: 0.06 },   // big soft shapes: allowed to be bolder and cover more
  cracks: { strokeContrast: 0.35, meanShift: 0.02 },
};

export const hashSeed = (s) => { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const mulberry32 = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

/** Brightness 0..1 of a #rrggbb colour (plain sRGB luma: enough to compare ink with body). */
export const luma = (hex) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex); if (!m) return null; const [r, g, b] = [0, 2, 4].map((k) => parseInt(m[1].slice(k, k + 2), 16) / 255); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };

const f = (n) => +n.toFixed(4);
const len = (pts) => pts.slice(1).reduce((s, p, i) => s + Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]), 0);

function inkLines(W, H, density, rnd) {
  const paths = []; let ink = 0;
  const gauss = () => Math.sqrt(-2 * Math.log(1 - rnd())) * Math.cos(2 * Math.PI * rnd());
  const stroke = (pts, w) => {
    if (pts.length < 2) return;
    let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
    for (let i = 1; i < pts.length - 1; i++) d += `Q${f(pts[i][0])} ${f(pts[i][1])} ${f((pts[i][0] + pts[i + 1][0]) / 2)} ${f((pts[i][1] + pts[i + 1][1]) / 2)}`;
    d += `L${f(pts.at(-1)[0])} ${f(pts.at(-1)[1])}`;
    paths.push(`<path d="${d}" stroke-width="${f(w)}"/>`);
    ink += len(pts) * w;
  };
  const leaf = (x, y, a, L, w) => {
    const tx = x + Math.cos(a) * L, ty = y + Math.sin(a) * L, mx = (x + tx) / 2, my = (y + ty) / 2, px = -Math.sin(a) * L * 0.3, py = Math.cos(a) * L * 0.3;
    paths.push(`<path d="M${f(x)} ${f(y)}Q${f(mx + px)} ${f(my + py)} ${f(tx)} ${f(ty)}Q${f(mx - px)} ${f(my - py)} ${f(x)} ${f(y)}Z" stroke-width="${f(w)}"/>`);
    ink += 2.1 * L * w;
  };
  // A small bud: a tight spiral with two leaves, on the vines.
  const rose = (x, y, r, w) => {
    const pts = [];
    for (let i = 0; i <= 14; i++) { const k = i / 14, a = k * 5.2 + rnd() * 0.2, rr = r * (0.15 + 0.85 * k); pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr]); }
    stroke(pts, w * 0.7);
    for (const s of [-1, 1]) leaf(x, y, (s > 0 ? 0.6 : 2.6) + rnd() * 0.6, r * 1.6, w * 0.5);
  };
  const vine = (x, y, a, L, w, depth) => {
    const step = 0.02, n = Math.max(3, Math.round(L / step)), pts = [[x, y]], angs = [a];
    let vel = 0;
    for (let i = 1; i <= n; i++) { vel = vel * 0.85 + gauss() * 0.12; a += vel; x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); angs.push(a); }
    const third = Math.ceil(pts.length / 3);
    stroke(pts.slice(0, third + 1), w); stroke(pts.slice(third, 2 * third + 1), w * 0.75); stroke(pts.slice(2 * third), w * 0.5);
    for (let i = 3; i < n - 1; i++) {
      const side = rnd() < 0.5 ? -1 : 1;
      if (depth < 2 && rnd() < 0.09) vine(pts[i][0], pts[i][1], angs[i] + side * (0.7 + rnd() * 0.5), L * (0.25 + rnd() * 0.2), w * 0.7, depth + 1);
      else if (depth === 0 && rnd() < 0.07) rose(pts[i][0] + Math.cos(angs[i] + side * 1.5) * 0.012, pts[i][1] + Math.sin(angs[i] + side * 1.5) * 0.012, 0.012 + rnd() * 0.01, w);
      else if (rnd() < 0.12) leaf(pts[i][0], pts[i][1], angs[i] + side * (0.9 + rnd() * 0.5), 0.025 + rnd() * 0.025, w * 0.6);
    }
  };
  const feather = (x, y, a, L, w) => {
    const step = 0.01, n = Math.max(4, Math.round(L / step)), bend = gauss() * 0.04, pts = [[x, y]], angs = [a];
    for (let i = 1; i <= n; i++) { a += bend + gauss() * 0.01; x += Math.cos(a) * step; y += Math.sin(a) * step; pts.push([x, y]); angs.push(a); }
    stroke(pts, w);
    for (let i = 2; i < n; i++) {
      const t = i / n, bl = L * 0.22 * Math.pow(Math.sin(Math.PI * (0.1 + 0.85 * t)), 0.8) * (1 - 0.3 * t);
      for (const side of [-1, 1]) {
        const ba = angs[i] + side * (0.6 + rnd() * 0.3), ex = pts[i][0] + Math.cos(ba) * bl, ey = pts[i][1] + Math.sin(ba) * bl;
        const cx = pts[i][0] + Math.cos(ba) * bl * 0.5 - Math.cos(angs[i]) * bl * 0.2, cy = pts[i][1] + Math.sin(ba) * bl * 0.5 - Math.sin(angs[i]) * bl * 0.2;
        paths.push(`<path d="M${f(pts[i][0])} ${f(pts[i][1])}Q${f(cx)} ${f(cy)} ${f(ex)} ${f(ey)}" stroke-width="${f(w * 0.45)}"/>`);
        ink += bl * 1.05 * w * 0.45;
      }
    }
  };
  const area = W * H, motifs = Math.min(400, Math.round(area * density * 8));
  for (let i = 0; i < motifs; i++) {
    const x = (rnd() * 1.1 - 0.05) * W, y = (rnd() * 1.1 - 0.05) * H, a = rnd() * 2 * Math.PI, w = 0.006 * (0.7 + rnd() * 0.6);
    if (rnd() < 0.5) vine(x, y, a, 0.3 + rnd() * 0.6, w, 0); else feather(x, y, a, 0.15 + rnd() * 0.2, w * 0.55);
  }
  return { body: `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${paths.join('')}</g>`, covered: ink };
}

// Soft filled leaves in fanned clusters (fronds): the plume style. Several overlapping blades at different opacities give a
// feathered edge.
function leaves(W, H, density, rnd) {
  const out = []; let covered = 0;
  const blade = (x, y, a, L, wd, op) => {
    const bend = (rnd() - 0.5) * 0.5, tx = x + Math.cos(a + bend) * L, ty = y + Math.sin(a + bend) * L;
    const mx = x + Math.cos(a) * L * 0.5, my = y + Math.sin(a) * L * 0.5, px = -Math.sin(a) * wd, py = Math.cos(a) * wd;
    out.push(`<path d="M${f(x)} ${f(y)}Q${f(mx + px)} ${f(my + py)} ${f(tx)} ${f(ty)}Q${f(mx - px)} ${f(my - py)} ${f(x)} ${f(y)}Z" fill-opacity="${f(op)}"/>`);
    covered += (2 / 3) * L * wd * op * 0.7;   // area, weighted by opacity, less the overlap between blades
  };
  const clusters = Math.max(1, Math.round(W * H * density * 1.5));
  for (let c = 0; c < clusters; c++) {
    const cx = rnd() * W, cy = rnd() * H, base = rnd() * 2 * Math.PI, S = 0.25 + rnd() * 0.3, k = 10 + Math.floor(rnd() * 10), spread = 1.3 + rnd() * 0.8;
    for (let i = 0; i < k; i++) {
      const t = k > 1 ? i / (k - 1) : 0.5, a = base + (t - 0.5) * spread + (rnd() - 0.5) * 0.15;
      const L = S * (0.45 + 0.55 * Math.sin(Math.PI * (0.1 + 0.8 * t))) * (0.7 + 0.3 * rnd()), wd = L * (0.1 + rnd() * 0.08);
      const ox = Math.cos(base + Math.PI / 2) * (t - 0.5) * S * 0.18, oy = Math.sin(base + Math.PI / 2) * (t - 0.5) * S * 0.18;
      blade(cx + ox, cy + oy, a, L, wd, 0.5 + rnd() * 0.4);
      if (rnd() < 0.5) blade(cx + ox, cy + oy, a + (rnd() - 0.5) * 0.3, L * 0.6, wd * 0.6, 0.35 + rnd() * 0.3);
    }
  }
  return { body: out.join(''), covered, fill: true };
}

// Fine angular crack lines that branch, like cracked paint or leaf veins.
function cracks(W, H, density, rnd) {
  const out = []; let covered = 0;
  const grow = (x, y, a, budget, w, depth) => {
    const pts = [[x, y]]; let used = 0;
    while (used < budget) {
      const step = 0.03 + rnd() * 0.07;
      a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * step; y += Math.sin(a) * step; used += step; pts.push([x, y]);
      const rest = (budget - used) * 0.6;
      if (depth < 3 && rnd() < 0.28 && rest > 0.05) grow(x, y, a + (rnd() < 0.5 ? -1 : 1) * (0.6 + rnd() * 0.7), rest, w * 0.7, depth + 1);
    }
    out.push(`<path d="M${pts.map((p) => `${f(p[0])} ${f(p[1])}`).join('L')}" stroke-width="${f(w)}"/>`);
    covered += used * w;
  };
  const starts = Math.max(1, Math.round(W * H * density * 2));
  for (let s = 0; s < starts; s++) grow(rnd() * W, rnd() * H, rnd() * 2 * Math.PI, 0.4 + rnd() * 0.6, 0.0025 + rnd() * 0.0015, 0);
  return { body: `<g fill="none" stroke-linecap="round" stroke-linejoin="round">${out.join('')}</g>`, covered };
}

function splatter(W, H, density, rnd) {
  const out = []; let covered = 0;
  const centres = Math.max(1, Math.round(W * H * density * 0.6));
  for (let c = 0; c < centres; c++) {
    const cx = rnd() * W, cy = rnd() * H, r0 = 0.05 + rnd() * 0.1, k = 14;
    const blob = Array.from({ length: k }, (_, i) => { const r = r0 * (0.7 + rnd() * 0.6), a = (i / k) * 2 * Math.PI; return `${f(cx + Math.cos(a) * r)} ${f(cy + Math.sin(a) * r)}`; });
    out.push(`<path d="M${blob.join('L')}Z"/>`);
    covered += Math.PI * r0 * r0;
    const drops = 8 + Math.floor(rnd() * 18);
    for (let i = 0; i < drops; i++) {
      const a = rnd() * 2 * Math.PI, d = r0 * (1.2 - Math.log(1 - rnd()) * 3), r = 0.004 + rnd() * rnd() * 0.02, x = cx + Math.cos(a) * d, y = cy + Math.sin(a) * d;
      if (rnd() < 0.3) { const sx = r * (1.5 + rnd() * 1.5); out.push(`<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(sx)}" ry="${f(r)}" transform="rotate(${f((a * 180) / Math.PI)} ${f(x)} ${f(y)})"/>`); covered += Math.PI * sx * r; }
      else { out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`); covered += Math.PI * r * r; }
    }
  }
  return { body: out.join(''), covered, fill: true };
}

function brush(W, H, density, rnd) {
  const out = []; let covered = 0;
  const n = Math.max(1, Math.round(W * H * density * 0.8));
  for (let s = 0; s < n; s++) {
    let x = rnd() * W, y = rnd() * H, a = rnd() * 2 * Math.PI, vel = 0;
    const L = 0.3 + rnd() * 0.6, wmax = 0.03 + rnd() * 0.04, steps = 24, left = [], right = [];
    for (let i = 0; i <= steps; i++) {
      const t = i / steps, w = (wmax / 2) * Math.pow(Math.sin(Math.PI * Math.min(0.97, Math.max(0.03, t))), 0.5);
      left.push(`${f(x - Math.sin(a) * w)} ${f(y + Math.cos(a) * w)}`); right.push(`${f(x + Math.sin(a) * w)} ${f(y - Math.cos(a) * w)}`);
      vel = vel * 0.8 + (rnd() - 0.5) * 0.08; a += vel; x += Math.cos(a) * (L / steps); y += Math.sin(a) * (L / steps);
    }
    out.push(`<path d="M${left.join('L')}L${right.reverse().join('L')}Z"/>`);
    covered += L * wmax * 0.7;
  }
  return { body: out.join(''), covered, fill: true };
}

// Parallel bands at an angle (racing stripes, speed lines): the pitch follows the density, a few gaps keep it from reading as a grid.
function stripes(W, H, density, rnd, angle) {
  const deg = angle ?? 20, D = Math.hypot(W, H), cx = W / 2, cy = H / 2, pitch = 0.32 - 0.26 * Math.min(1, density), half = Math.ceil(D / pitch / 2);
  const out = []; let share = 0, n = 0;
  for (let k = -half; k <= half; k++) {
    n++;
    if (rnd() < 0.12) continue;
    const wd = pitch * (0.25 + rnd() * 0.3);
    out.push(`<rect x="${f(cx - D)}" y="${f(cy + k * pitch - wd / 2)}" width="${f(2 * D)}" height="${f(wd)}" transform="rotate(${f(deg)} ${f(cx)} ${f(cy)})"/>`);
    share += wd / pitch;
  }
  return { body: out.join(''), covered: W * H * (n ? share / n : 0), fill: true };
}

// Irregular overlapping blotches with smooth edges (camouflage).
function camo(W, H, density, rnd) {
  const out = []; let covered = 0;
  const count = Math.max(1, Math.round(W * H * density * 5));
  for (let c = 0; c < count; c++) {
    const cx = rnd() * W, cy = rnd() * H, r0 = 0.08 + rnd() * 0.2, k = 10, op = 0.55 + rnd() * 0.4;
    const p = Array.from({ length: k }, (_, i) => { const r = r0 * (0.6 + rnd() * 0.7), a = (i / k) * 2 * Math.PI; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });
    const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    let d = `M${f(mid(p[k - 1], p[0])[0])} ${f(mid(p[k - 1], p[0])[1])}`;
    for (let i = 0; i < k; i++) { const m = mid(p[i], p[(i + 1) % k]); d += `Q${f(p[i][0])} ${f(p[i][1])} ${f(m[0])} ${f(m[1])}`; }
    out.push(`<path d="${d}Z" fill-opacity="${f(op)}"/>`);
    covered += Math.PI * r0 * r0 * 0.8 * op;
  }
  return { body: out.join(''), covered, fill: true };
}

// A halftone: rows of dots whose size grows along the angle (a fade from nothing to dense).
function dots(W, H, density, rnd, angle) {
  const a = ((angle ?? 0) * Math.PI) / 180, ux = Math.cos(a), uy = Math.sin(a);
  let pitch = 0.06 - 0.03 * Math.min(1, density);
  while ((W / pitch) * (H / pitch) > 30000) pitch *= 1.3;
  const proj = (x, y) => x * ux + y * uy, lo = Math.min(0, W * ux, H * uy, W * ux + H * uy), hi = Math.max(0, W * ux, H * uy, W * ux + H * uy);
  const out = []; let covered = 0;
  for (let row = 0, y = 0; y <= H + pitch; row++, y += pitch * 0.866) {
    for (let x = (row % 2) * pitch / 2; x <= W + pitch; x += pitch) {
      const t = hi > lo ? (proj(x, y) - lo) / (hi - lo) : 0.5, r = pitch * 0.5 * (0.1 + 0.8 * t) * (0.9 + 0.2 * rnd());
      out.push(`<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"/>`); covered += Math.PI * r * r;
    }
  }
  return { body: out.join(''), covered, fill: true };
}

/**
 * Build one pattern for a panel of widthM x heightM metres (as the viewer sees it, upright).
 * Returns the SVG text, its pixel size and `coverage`, the share of the panel the ink covers (an estimate).
 */
export function makePattern(kind, { widthM, heightM, pxPerM, seed = 1, density = 0.3, color, angle }) {
  if (!PATTERNS.includes(kind)) throw new Error(`unknown pattern "${kind}" (known: ${PATTERNS.join(', ')})`);
  const rnd = mulberry32(hashSeed(seed));
  const g = { 'ink-lines': inkLines, leaves, cracks, splatter, brush, stripes, camo, dots }[kind](widthM, heightM, density, rnd, angle);
  const w = Math.max(1, Math.ceil(widthM * pxPerM)), h = Math.max(1, Math.ceil(heightM * pxPerM));
  const c = color ?? DEFAULTS[kind].color;
  const body = g.fill ? `<g fill="${c}">${g.body}</g>` : g.body.replace('<g ', `<g stroke="${c}" `);
  return { svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${f(widthM)} ${f(heightM)}" width="${w}" height="${h}">${body}</svg>`, width: w, height: h, coverage: Math.min(1, g.covered / (widthM * heightM)) };
}

/** The pattern as a transparent PNG. */
export async function renderPattern(kind, opts) {
  const p = makePattern(kind, opts);
  return { ...p, png: await sharp(Buffer.from(p.svg)).png().toBuffer() };
}
