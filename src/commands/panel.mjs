import { parseArgs, UsageError } from '../lib/args.mjs';
import { loadPack } from '../lib/paths.mjs';

export const help = `aclivery panel textures <car>                      the textures a skin can override, with panel counts
aclivery panel list <car> [--texture role] [--side left|right|centre] [--region id|name]
                          [--min-visible 0.5 (a filter, off by default)]
                          [--sort area|visible] [--limit 25 (default)]
aclivery panel get <car> <panel> [--texture role]   one panel in full
aclivery panel regions <car>                        the human-named regions and the panels inside them
  Short answers on purpose. rect = [u v w h], fractions of the texture, v from the top.
  rot = degrees the image is turned so it reads upright (- means none). vis = share seen from outside, 0..1.
  A panel with vis under about 0.3 is mostly hidden: put nothing important there.`;

const fmt = (n) => (typeof n === 'number' ? n.toFixed(3) : String(n ?? '-'));

function table(pack, role) {
  const panels = pack.profile.panels?.[role];
  if (!panels) throw new UsageError(`no texture role "${role}". Try: aclivery panel textures <car>`);
  const regionOf = new Map();
  for (const r of pack.regions?.regions ?? []) for (const p of r.panels ?? []) regionOf.set(`${role}:${p.name}`, `${r.id}:${r.name}`);
  return Object.entries(panels).map(([name, q]) => ({
    name, role, rect: q.rect, area: q.rect[2] * q.rect[3], rot: q.textRotation ?? null, visible: q.visible ?? null,
    side: /^left(_|$)/.test(name) ? 'left' : /^right(_|$)/.test(name) ? 'right' : 'centre',
    region: regionOf.get(`${role}:${name}`) ?? null, hidden: !!q.hidden, tags: q.tags ?? [],
  }));
}

export async function run(argv) {
  const { flags, positional } = parseArgs(argv, { bools: ['json'] });
  const [sub, carId, name] = positional;
  if (!sub || !carId) throw new UsageError(help);
  const pack = loadPack(carId);
  const role = flags.texture ?? pack.profile.bind?.body?.roles?.[0] ?? 'ext_main';

  if (sub === 'textures') {
    const idx = Object.entries(pack.profile.textures ?? {}).map(([r, t]) => ({ role: r, file: t.file, size: `${t.width}x${t.height}`, panels: Object.keys(pack.profile.panels?.[r] ?? {}).length }));
    if (flags.json) console.log(JSON.stringify(idx)); else for (const t of idx) console.log(`${t.role.padEnd(16)} ${t.file.padEnd(30)} ${t.size.padEnd(10)} ${t.panels} panels`);
    return 0;
  }

  if (sub === 'regions') {
    if (!pack.regions) throw new UsageError('this car pack has no region map (pass --regions to car prep)');
    for (const r of pack.regions.regions) {
      console.log(`${r.id} ${r.name}  uvBox=[${r.uvBox.join(', ')}]  ${r.panels.length} panels`);
      const lim = Number(flags.limit ?? 6);
      for (const p of r.panels.slice(0, lim)) console.log(`    ${p.name.padEnd(22)} ${p.side.padEnd(6)} rot=${p.rotation ?? '-'} vis=${fmt(p.visible)}`);
      if (r.panels.length > lim) console.log(`    ... ${r.panels.length - lim} more: aclivery panel list ${carId} --region ${r.name}`);
    }
    return 0;
  }

  if (sub === 'get') {
    if (!name) throw new UsageError(help);
    const row = table(pack, role).find((p) => p.name === name);
    if (!row) throw new UsageError(`no panel "${name}" in ${role}. Try: aclivery panel list ${carId} --texture ${role}`);
    const q = pack.profile.panels[role][name];
    const out = { ...row, centroid3d: q.centroid3d, extent3d: q.extent3d, uAxis: q.uAxis, vAxis: q.vAxis, adjacent: q.adjacent, metresPerUv: q.metresPerUv };
    console.log(JSON.stringify(out, null, flags.json ? 0 : 1));
    return 0;
  }

  if (sub === 'list') {
    let rows = table(pack, role);
    if (flags.side) rows = rows.filter((p) => p.side === flags.side);
    if (flags.region) rows = rows.filter((p) => p.region && (p.region.startsWith(`${flags.region}:`) || p.region.endsWith(`:${flags.region}`)));
    if (flags['min-visible']) rows = rows.filter((p) => (p.visible ?? 0) >= Number(flags['min-visible']));
    rows.sort(flags.sort === 'visible' ? (a, b) => (b.visible ?? 0) - (a.visible ?? 0) : (a, b) => b.area - a.area);
    const total = rows.length;
    rows = rows.slice(0, Number(flags.limit ?? 25));
    if (flags.json) { console.log(JSON.stringify(rows)); return 0; }
    for (const p of rows) console.log(`${p.name.padEnd(24)} ${p.side.padEnd(6)} rot=${String(p.rot ?? '-').padEnd(4)} vis=${fmt(p.visible)} rect=[${p.rect.map(fmt).join(' ')}] ${p.region ?? ''}`);
    if (total > rows.length) console.log(`... ${total - rows.length} more (raise --limit or narrow with --side/--region/--min-visible)`);
    return 0;
  }
  throw new UsageError(help);
}
