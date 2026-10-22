import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { home, packDir } from '../lib/paths.mjs';

export const help = `aclivery brief init <slug> [--title "..."] [--car <id>]   start a project (the livery you are making)
aclivery brief show <slug>                              what is decided, what is missing, and THE next step
aclivery brief set <slug> <path> <value>                e.g. driver.name "T. Thiele"   car.id rss_gtm_protech_p92_f6
aclivery brief add <slug> <list> '<json>'               lists: elements, references, decisions, openQuestions
aclivery brief list                                     all projects
  The brief is the memory of the conversation: decisions and open questions live here, not in your context.
  Stored in .aclivery/projects/<slug>/brief.json. Paths like elements.0.panel work; values are read as JSON when they parse.
  An element is one thing the livery needs: {"what":"Monster logo","target":"both rear quarters","panel":"left_rear",
  "asset":"assets/logos/monster.png","kind":"logo|text|plate|accent|tonal-art|large-graphic","tone":"subtle|bold",
  "status":"idea|asset-ready|placed|checked"}.
  analysis: {"summary":"...","layers":[{"kind":"logo","what":"Monster claw","brand":"Monster Energy","part":"symbol","where":"doors, hood",
  "tone":"bold","confidence":"high|medium|low","evidence":"which reference photo and view shows it"}],
  "overlapRules":"which things must not cover each other","feel":"what makes it recognisable"} (see skill ac-analyze).
  Every layer needs confidence and evidence; low confidence (or a brand read by shape only) becomes a question for the user.`;

/** The body colour: set directly, or read from the analysis's base layer. */
export const baseColourOf = (b) => b.baseColour ?? b.analysis?.layers?.find((l) => l.kind === 'base')?.what ?? null;

const file = (slug) => path.join(home(), 'projects', slug, 'brief.json');
const load = (slug) => {
  if (!fs.existsSync(file(slug))) throw new UsageError(`no project "${slug}". Start one: aclivery brief init ${slug} --title "..."`);
  return JSON.parse(fs.readFileSync(file(slug), 'utf8'));
};
const save = (slug, b) => { fs.mkdirSync(path.dirname(file(slug)), { recursive: true }); fs.writeFileSync(file(slug), JSON.stringify(b, null, 1)); };

const blank = (slug, title, car) => ({
  slug, title: title ?? slug, createdAt: new Date().toISOString(),
  car: { id: car ?? null }, driver: { name: null, number: null, country: null, team: null },
  baseColour: null, references: [], analysis: null, elements: [], decisions: [], openQuestions: [],
});

function setPath(obj, dotted, value) {
  const keys = dotted.split('.');
  let o = obj;
  for (const k of keys.slice(0, -1)) {
    if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(keys[keys.indexOf(k) + 1] ?? '') ? [] : {};
    o = o[k];
  }
  o[keys.at(-1)] = value;
}
const parseValue = (s) => { try { return JSON.parse(s); } catch { return s; } };

/**
 * What is missing, in the order a person should be asked. Pure function of the brief and what exists on disk,
 * so a model that has lost the thread can recompute where it is.
 */
export function gaps(b, { packExists = false, fileExists = (p) => fs.existsSync(p) } = {}) {
  const todo = [];
  if (!b.car?.id) todo.push({ ask: 'Which car is this for? (the car folder name, e.g. rss_gtm_protech_p92_f6)', set: `car.id` });
  else if (!packExists) todo.push({ ask: `No car pack for ${b.car.id}. Do you have the car's .kn5 file?`, do: `aclivery car prep <path to ${b.car.id}.kn5> --skins <its skins folder>`, blocked: 'everything about panels and renders' });
  if (!b.references?.length && !b.elements?.length) todo.push({ ask: 'What should it look like? Share reference images, or describe the design in a sentence.', add: 'references' });
  // Study the references into layers BEFORE planning elements. Subtle tonal art (faint grey detail on a light body) is
  // often what makes a livery recognisable; it must be listed and planned, not skipped for lack of an asset.
  if (b.references?.length && !b.analysis) {
    todo.push({ ask: null, do: 'study the references (skill ac-analyze): list the base, big graphics, SUBTLE tonal art, accents, logos, text, plates, and what must not overlap', set: 'analysis' });
  }
  // Self-critique of the analysis: every layer says how sure it is and which photo shows it. Doubt becomes a question for the
  // user (grounded in the evidence), not a guess built into the livery.
  const layers = b.analysis?.layers ?? [];
  const CONF = ['high', 'medium', 'low'];
  const unrated = layers.map((l, i) => ({ l, i })).filter(({ l }) => !CONF.includes(l.confidence) || !String(l.evidence ?? '').trim());
  if (unrated.length) {
    todo.push({ ask: null, do: `review your analysis: for each layer add "confidence" (high = clearly seen and identified in a photo; medium = seen but small, or identified by shape or context only; low = a guess) and "evidence" (which reference photo and view shows it). Missing on: ${unrated.map(({ l, i }) => `${i} "${l.what ?? l.kind}"`).join(', ')}`, set: `analysis.layers.${unrated[0].i}.confidence` });
  } else {
    layers.forEach((l, i) => {
      if (l.confidence === 'low') {
        todo.push({ ask: `I am not sure about "${l.what}" (evidence: ${l.evidence}). What is it, and how would you describe it?`, set: `analysis.layers.${i}.what`, then: `aclivery brief set ${b.slug ?? '<slug>'} analysis.layers.${i}.confidence high` });
      } else if (l.confidence === 'medium' && l.brand && /logo|large-graphic/.test(l.kind ?? '')) {
        todo.push({ ask: `I read "${l.what}" as ${l.brand}${l.part ? ' ' + l.part : ''} (evidence: ${l.evidence}). Is that right?`, do: 'if yes, set confidence high; if not, correct "brand" and "what" first', set: `analysis.layers.${i}.confidence` });
      }
    });
  }
  if (b.analysis?.layers?.some((l) => l.tone === 'subtle') && !(b.elements ?? []).some((e) => e.tone === 'subtle' || /tonal|ink|pattern|texture|art/i.test(e.what ?? ''))) {
    todo.push({ ask: 'The references show subtle tonal art but no element covers it. Add one (a placeholder asset is fine), do not drop it. Is there an original file for it?', add: 'elements' });
  }
  if (!baseColourOf(b)) todo.push({ ask: 'What is the base colour of the car?', set: 'baseColour' });
  if (!b.elements?.length) todo.push({ ask: 'List what the livery needs: sponsors, text, number, art. One line each.', add: 'elements' });
  b.elements?.forEach((e, i) => {
    if (!e.target && !e.panel) todo.push({ ask: `Where does "${e.what}" go on the car?`, set: `elements.${i}.target` });
    else if (!e.panel) todo.push({ ask: `Which panel is "${e.what}" (${e.target})?`, do: `aclivery panel regions ${b.car?.id ?? '<car>'}`, set: `elements.${i}.panel` });
    if (e.asset && !/^pattern/i.test(e.asset) && !fileExists(e.asset)) todo.push({ ask: `The asset for "${e.what}" is missing (${e.asset}). Provide the file or pick another source.`, do: 'skills/ac-logos' });
    else if (!e.asset && e.needsAsset !== false && /logo|wordmark|sponsor|art|decal/i.test(e.what)) todo.push({ ask: `"${e.what}" needs an image file. Do you have one, or may I search for the brand's official or vector file and propose a download for you to approve?`, set: `elements.${i}.asset` });
  });
  if (b.elements?.length && /number/i.test(JSON.stringify(b.elements)) && !b.driver?.number) todo.push({ ask: 'What is the car number?', set: 'driver.number' });
  if (b.elements?.length && todo.length === 0 && !b.elements.every((e) => e.status === 'checked')) {
    const n = b.elements.find((e) => e.status !== 'placed' && e.status !== 'checked');
    todo.push(n ? { ask: null, do: `place "${n.what}": aclivery decal ${b.car.id} --panel ${n.panel} --image ${n.asset ?? '<image>'} ...`, then: 'aclivery render, look, set status' }
      : { ask: null, do: `aclivery render ${b.car.id} --skin <work folder>, compare with the references, then set status to checked` });
  }
  if (b.openQuestions?.length) todo.push({ ask: `Open question: ${b.openQuestions[0]}`, note: 'decide with the user, then add a decision and remove it from openQuestions' });
  return todo;
}

export async function run(argv) {
  const { positional, flags } = parseArgs(argv, { bools: ['json'] });
  const [sub, slug, a, ...rest] = positional;
  if (sub === 'list') {
    const dir = path.join(home(), 'projects');
    const names = fs.existsSync(dir) ? fs.readdirSync(dir).filter((n) => fs.existsSync(file(n))) : [];
    console.log(names.length ? names.map((n) => `${n}  ${load(n).title}`).join('\n') : 'no projects yet. Start one: aclivery brief init <slug> --title "..."');
    return 0;
  }
  if (!sub || !slug) throw new UsageError(help);
  if (sub === 'init') {
    if (!/^[\w-]+$/.test(slug)) throw new UsageError('slug: letters, digits, - or _');
    if (fs.existsSync(file(slug))) throw new UsageError(`project "${slug}" already exists: aclivery brief show ${slug}`);
    save(slug, blank(slug, flags.title, flags.car));
    console.log(`started ${slug}. Next: aclivery brief show ${slug}`);
    return 0;
  }
  const b = load(slug);
  if (sub === 'set') {
    if (!a || rest.length === 0) throw new UsageError(help);
    setPath(b, a, parseValue(rest.join(' ')));
    save(slug, b); console.log(`set ${a}`); return 0;
  }
  if (sub === 'add') {
    if (!a || !['elements', 'references', 'decisions', 'openQuestions'].includes(a) || !rest.length) throw new UsageError(help);
    const v = parseValue(rest.join(' '));
    (b[a] ??= []).push(...(Array.isArray(v) ? v : [v]));
    save(slug, b); console.log(`added to ${a} (${b[a].length})`); return 0;
  }
  if (sub === 'show') {
    const packExists = !!b.car?.id && fs.existsSync(path.join(packDir(b.car.id), 'profile.json'));
    const todo = gaps(b, { packExists });
    if (flags.json) { console.log(JSON.stringify({ brief: b, todo })); return 0; }
    console.log(`${b.title}  [${slug}]`);
    console.log(`  car: ${b.car?.id ?? '?'}${b.car?.id ? (packExists ? '  (car pack ready)' : '  (no car pack yet)') : ''}   base: ${baseColourOf(b) ?? '?'}   driver: ${b.driver?.name ?? '?'} #${b.driver?.number ?? '?'}`);
    console.log(`  references: ${b.references?.length ?? 0}   analysis: ${b.analysis ? (b.analysis.layers?.length ?? 0) + ' layers' : 'not done'}   elements: ${b.elements?.length ?? 0}   decisions: ${b.decisions?.length ?? 0}`);
    if (b.build) console.log(`  built: round ${b.build.round}, ${b.build.elements} element(s) in ${b.build.design}, ${b.build.missing} layer(s) missing, ${b.build.cutOff} cut off  (the design file, not this list, is the source of truth)`);
    for (const [i, r] of (b.references ?? []).entries()) console.log(`    ref ${i}. ${path.basename(r.file ?? '?')}  view: ${r.view ?? '?'}${r.notes ? '  ' + r.notes : ''}`);
    for (const [i, e] of (b.elements ?? []).entries()) console.log(`    ${i}. ${e.what}  ->  ${e.panel ?? e.target ?? '?'}  [${e.status ?? 'idea'}]${e.asset ? '  ' + path.basename(e.asset) : ''}`);
    if (!todo.length) { console.log('\nNothing missing. Ship it: aclivery export, then check in Content Manager.'); return 0; }
    const [next, ...later] = todo;
    console.log('\nNEXT' + (next.ask ? ` (ask the user): ${next.ask}` : ':'));
    if (next.do) console.log(`  do: ${next.do}`);
    if (next.set) console.log(`  record the answer: aclivery brief set ${slug} ${next.set} "<answer>"`);
    if (next.then) console.log(`  then: ${next.then}`);
    if (next.add) console.log(`  record the answer: aclivery brief add ${slug} ${next.add} '<json>'`);
    if (next.blocked) console.log(`  blocks: ${next.blocked}. If the user has no .kn5, see docs/user-journey.md "when something is missing".`);
    if (later.length) console.log(`  (${later.length} more after this)`);
    return 0;
  }
  throw new UsageError(help);
}
