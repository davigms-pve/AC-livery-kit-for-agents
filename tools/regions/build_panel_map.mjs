// One-off helper that produced cars/rss_gtm_protech_p92_f6/panel_map.json from a hand-annotated cutouts image
// and a liverykit profile. Kept as a record of how region boxes were aligned; not part of the aclivery CLI.
// usage: node build_panel_map.mjs <profile.json> <out panel_map.json> <dir holding paintable_mask_1407.png>
import fs from 'node:fs';
import sharp from 'sharp';
const [profPath, outJson, outMaskDir] = process.argv.slice(2);
const profile = JSON.parse(fs.readFileSync(profPath, 'utf8'));
const OFF = 92, FULLW = 1499, H = 541;          // cutouts image = atlas at 541px height, ~92px cropped off the left
const boxes = [
  [1, 'front_bumper', [2, 52, 88, 508]], [2, 'hood_and_front_fenders', [88, 12, 342, 523]],
  [3, 'right_side', [342, 2, 806, 178]], [4, 'left_side', [342, 348, 806, 540]],
  [5, 'roof', [395, 178, 718, 348]], [6, 'rear_glass_deck', [718, 178, 884, 348]],
  [7, 'rear_bumper', [884, 22, 1008, 512]], [8, 'wing', [1015, 2, 1405, 537]], [9, 'mirrors', [342, 178, 395, 348]],
];
const toUv = ([x0, y0, x1, y1]) => [(x0 + OFF) / FULLW, y0 / H, (x1 + OFF) / FULLW, y1 / H].map((v) => +v.toFixed(4));
const ex = profile.panels.ext_main;
const rows = Object.entries(ex).map(([name, q]) => {
  const [u, v, w, h] = q.rect;
  const side = /^left_/.test(name) ? 'left' : /^right_/.test(name) ? 'right' : 'centre';
  return { name, side, rect: q.rect.map((n) => +n.toFixed(4)), rotation: q.textRotation ?? null, visible: q.visible ?? null, cx: u + w / 2, cy: v + h / 2, area: w * h };
});
const MIRRORS = new Set(["left_mid_lower_2", "right_mid_lower_2"]); // verified by magenta probe render
const regions = boxes.map(([id, name, box]) => {
  const uv = toUv(box);
  const panels = rows.filter((r) => (id === 9 ? MIRRORS.has(r.name) : !MIRRORS.has(r.name) && (id !== 3 || r.side !== "left") && (id !== 4 || r.side !== "right") && r.cx >= uv[0] && r.cx <= uv[2] && r.cy >= uv[1] && r.cy <= uv[3])).sort((a, b) => b.area - a.area)
    .map(({ name, side, rect, rotation, visible }) => ({ name, side, rect, rotation, visible }));
  return { id, name, uvBox: uv, panels };
});
const assigned = new Set(regions.flatMap((r) => r.panels.map((p) => p.name)));
const unassigned = rows.filter((r) => !assigned.has(r.name)).map((r) => r.name);
const doc = {
  car: 'rss_gtm_protech_p92_f6', texture: 'EXT_Main', atlas: { width: 8192, height: 2956 },
  provenance: 'Region boxes hand-drawn by the user on the cutouts image; panel names, rotations, visibility from liverykit profile (kn5 geometry) @ f5c56b8. The cutouts image is the atlas at 541px height with ~92px cropped off the left (estimated +-3px), so uvBox = (x+92)/1499.',
  conventions: 'rect = [u, v, w, h] normalised, v from top. rotation = liverykit textRotation (deg) for upright text on that panel. side from the panel name (right = car x<0 = TOP strip of the atlas, left = BOTTOM strip). visible = ray-cast fraction seen from outside.',
  verified: ['right_* panels sit in the top strip with rotation 180, left_* in the bottom strip with rotation 0 (profile data)', 'left_mid_lower_2 / right_mid_lower_2 are the mirrors (magenta probe render)'],
  regions, unassignedPanels: unassigned,
};
fs.writeFileSync(outJson, JSON.stringify(doc, null, 1));
console.log(regions.map((r) => `${r.id} ${r.name}: ${r.panels.length} panels, e.g. ${r.panels.slice(0, 4).map((p) => p.name).join(', ')}`).join('\n'));
console.log('unassigned', unassigned.length);
// paintable mask aligned to the atlas: pad the cropped 92px (assumed unpainted) then scale uniformly
const padded = await sharp(outMaskDir + "/paintable_mask_1407.png").extend({ left: OFF, background: { r: 0, g: 0, b: 0 } }).png().toBuffer();
const m = await sharp(padded).resize(8192, 2956, { kernel: "nearest" }).png().toFile(outMaskDir + "/paintable_mask_full.png");
console.log('mask', m.width, m.height);
