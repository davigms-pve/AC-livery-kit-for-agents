import fs from 'node:fs';
import path from 'node:path';
import { parseArgs, UsageError } from '../lib/args.mjs';
import { home, packDir } from '../lib/paths.mjs';
import { STYLES } from '../lib/patterns.mjs';

export const help = `aclivery brief init <slug> [--title "..."] [--car <id>] [--mode normal|batch]   start a project (the livery you are making)
aclivery brief show <slug>                              what is decided, what is missing, and THE next step
aclivery brief set <slug> <path> <value>                e.g. driver.name "A. Driver"   car.id <car folder name>
aclivery brief add <slug> <list> '<json>'               lists: elements, references, decisions, openQuestions
aclivery brief list                                     all projects
  The brief is the memory of the conversation: decisions and open questions live here, not in your context.
  Stored in .aclivery/projects/<slug>/brief.json. Paths like elements.0.panel work; values are read as JSON when they parse.
  An element is one thing the livery needs: {"what":"sponsor logo","target":"both rear quarters","panel":"<panel>",
  "asset":"assets/logos/<name>.png","kind":"logo|text|plate|accent|tonal-art|large-graphic","tone":"subtle|bold",
  "status":"idea|asset-ready|placed|checked"}.
  analysis: {"summary":"...","layers":[{"kind":"logo","what":"Acme symbol","brand":"Acme","part":"symbol","where":"doors, hood",
  "tone":"bold","confidence":"high|medium|low","evidence":"which reference photo and view shows it"}],
  "overlapRules":"which things must not cover each other","feel":"what makes it recognisable"} (see skill ac-analyze).
  Every layer needs confidence and evidence; low confidence (or a brand read by shape only) becomes a question for the user.
  Photos: aclivery photos <folder> --brief <slug> adds every photo; give each a view. If the user has no photo of a basic view (side, front, rear, top):
  aclivery brief set <slug> viewsWaived.top '{"asked":"...","answer":"<their words>"}'.
  How involved the user wants to be: "mode": "normal" (check in a few times: ask early, show a plan, show a first draft) or "batch" (do everything, ask at the end).
  aclivery brief set <slug> mode normal|batch. In normal mode brief show asks for planApproved (after the plan) and draftReviewed (after the first draft). These three gates only count as {"asked","answer"}: the user's own words; a bare string does not.
  When the user cannot be asked (a batch run), take the default and write it down: layer "assumed": "default: user not asked, <why>"
  (stops the question, shows in the report and in DONE); an open question stored as {"q":"...","default":"...","by":"..."} does the same.
  Then every layer needs a "source": fetch (a brand mark that exists as a file; set "asset" to the prepared file), generate (livery art with no file: a pattern),
  construct (text, numbers, plates, colours), stock (already on the car) or skip (with "why"). See docs/agent-flow.md.`;

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
  baseColour: null, references: [], analysis: null, elements: [], decisions: [], openQuestions: [], mode: null,
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
export const SOURCES = ['fetch', 'generate', 'construct', 'stock', 'skip'];
export const ROUNDS = 3;
/** A default for the source of a layer, so a model only has to confirm or change it. */
export const suggestSource = (l) => (l.source && SOURCES.includes(l.source) ? l.source
  : l.brand || ((l.kind === 'logo' || l.kind === 'large-graphic') && l.part) ? 'fetch'
    : l.kind === 'tonal-art' ? 'generate'
      : l.kind === 'marking' ? 'stock' : 'construct');

const text = (v) => String(v ?? '').trim();
/** The names a photo's view may have (the cameras `render` and `compare` know, plus "detail" for a close-up of one part: say which part in the notes). */
export const VIEWS = ['left', 'right', 'front', 'rear', 'top', 'front-left', 'front-right', 'rear-left', 'rear-right', 'three-quarter', 'detail'];
const viewOf = (r) => text(r.view).toLowerCase().replace(/_/g, '-');
/** The basic views a livery is read from. A slot is covered by any photo with one of its views, or waived by the user ("viewsWaived": ["top"]). */
export const VIEW_SLOTS = [
  { id: 'side', label: 'a flat side of the car (straight from the left or the right)', views: ['left', 'right'], consequence: 'the doors and sides will be copied from the three-quarter photos only' },
  { id: 'front', label: 'the front', views: ['front', 'front-left', 'front-right'], consequence: 'the hood and nose cannot be copied from a photo' },
  { id: 'rear', label: 'the rear', views: ['rear', 'rear-left', 'rear-right'], consequence: 'the rear bumper, the deck and the back of the wing cannot be copied from a photo' },
  { id: 'top', label: 'the car from above', views: ['top'], consequence: 'the roof and the top of the wing cannot be copied from a photo' },
];
/** A layer the user could not be asked about (a batch run): "assumed": "default: user not asked, <why>". Not a gap; listed in the report and in DONE. */
const assumedOf = (l) => text(l.assumed);
/** An open question that already carries the default taken and who took it: {"q","default","by"}. */
const answeredByDefault = (q) => !!q && typeof q === 'object' && !!text(q.default) && !!text(q.by);
/** A decision about a layer that closes its "missing" line: {"layer": 11, "q": "...", "a": "...", "by": "..."}. Returns the layer number, or null. */
export const decidedLayer = (d) => (d && typeof d === 'object' && d.layer !== undefined && /^\d+$/.test(String(d.layer)) && text(d.a ?? d.answer ?? d.why) ? Number(d.layer) : null);
const questionText = (q) => (q && typeof q === 'object' ? text(q.q) || JSON.stringify(q) : String(q));
const short = (s, n = 40) => { const t = text(s); return t.length > n ? t.slice(0, n - 1) + '...' : t; };
const listOf = (items, max = 8) => (items.length ? items.slice(0, max).join('; ') + (items.length > max ? `; and ${items.length - max} more` : '') : 'none');
/** The plan, in plain words, for the check-in before building: what has a file, what is drawn by the kit, what is only a rough likeness, what is left out. */
export function planAsk(b) {
  const live = (b.analysis?.layers ?? []).filter((l) => l.kind !== 'base');
  const has = (l) => l.source === 'fetch' && text(l.asset) && !/placeholder/i.test(String(l.asset));
  const made = live.filter((l) => ['construct', 'stock'].includes(l.source)).map((l) => short(l.what));
  const rough = live.filter((l) => l.source === 'generate').map((l) => `${short(l.what)}${l.style === 'none' ? ' (no style fits: I need your art file, or I leave it out)' : l.style ? ` (${l.style})` : ''}`);
  const stand = live.filter((l) => l.source === 'fetch' && !has(l)).map((l) => short(l.what));
  const left = live.filter((l) => l.source === 'skip').map((l) => `${short(l.what, 32)} (${short(l.why, 40)})`);
  return `Before I start building, here is my plan, for you to check in your own words. Marks and logos I have files for: ${listOf(live.filter(has).map((l) => short(l.what)))}. Text, numbers, plates and colours I will draw myself: ${listOf(made)}. Art I can only make a rough likeness of (the kit makes procedural patterns such as plumes, vines, cracks, camouflage, stripes and dots, never a copy of hand-drawn art; your own art file replaces them): ${listOf(rough)}. Stand-ins or missing files: ${listOf(stand)}. Left out: ${listOf(left)}. Is that OK, or do you want to change something? Tell the user this in a few plain sentences, not as a list of layer numbers.`;
}

/** A gate answer must quote the user: {"asked": "<what you asked, as you put it>", "answer": "<their own words>"}. A bare string, an array or a flag does not count. */
export const quoted = (v) => !!v && typeof v === 'object' && !Array.isArray(v) && text(v.asked).length >= 5 && text(v.answer).length >= 2;
const quote = (v) => `asked "${short(v.asked, 110)}" -> "${short(v.answer, 110)}"`;
const QUOTE_FORM = '{"asked":"<the question as you put it to the user>","answer":"<their own words>"}';
const hasReport = (b) => typeof b.report === 'string' ? b.report.trim() !== '' : !!b.report && Object.keys(b.report).length > 0;

/** The waivers that quote the user (viewsWaived.<slot>: {asked, answer}); anything else is not a waiver. */
const waivedOf = (b) => Object.fromEntries(Object.entries(b.viewsWaived && typeof b.viewsWaived === 'object' && !Array.isArray(b.viewsWaived) ? b.viewsWaived : {}).filter(([, q]) => quoted(q)));

/** What the final report must name: layers drawn from placeholder art, and layers left out (with the reason given). */
export function openNotes(b) {
  const live = (b.analysis?.layers ?? []).map((l, i) => ({ l, i })).filter(({ l }) => l.kind !== 'base');
  const name = ({ l, i }) => `L${i} "${String(l.what ?? l.kind).slice(0, 40)}"`;
  return {
    placeholders: live.filter(({ l }) => l.source === 'generate' || /placeholder/i.test(String(l.asset ?? ''))).map((x) => `${name(x)} (${x.l.source === 'generate' ? 'generated pattern' : 'placeholder file'})`),
    skipped: live.filter(({ l }) => l.source === 'skip').map((x) => `${name(x)}: ${String(x.l.why ?? '').trim() || 'no reason given'}`),
    decided: (b.decisions ?? []).filter((d) => decidedLayer(d) !== null).map((d) => `L${decidedLayer(d)}: ${text(d.a ?? d.answer ?? d.why)}${text(d.by) ? ` (${text(d.by)})` : ''}`),
    waived: Object.entries(waivedOf(b)).map(([id, q]) => `${id} (${quote(q)})`),
    plan: quoted(b.planApproved) ? quote(b.planApproved) : null,
    draft: quoted(b.draftReviewed) ? quote(b.draftReviewed) : null,
    assumed: [...live.filter(({ l }) => assumedOf(l)).map((x) => `${name(x)}: ${assumedOf(x.l)}`),
      ...(b.openQuestions ?? []).filter(answeredByDefault).map((q) => `question "${text(q.q).slice(0, 60)}": ${text(q.default)} (${text(q.by)})`)],
  };
}

export function gaps(b, { packExists = false, fileExists = (p) => fs.existsSync(p) } = {}) {
  const todo = [];
  if (!b.car?.id) todo.push({ ask: 'Which car is this for? (the car folder name in the kit, as `aclivery status` lists it)', set: `car.id` });
  else if (!packExists) todo.push({ ask: `No car pack for ${b.car.id}. Do you have the car's .kn5 file?`, do: `aclivery car prep <path to ${b.car.id}.kn5> --skins <its skins folder>`, blocked: 'everything about panels and renders' });
  if (!['normal', 'batch'].includes(b.mode)) todo.push({ ask: 'How involved do you want to be? I can check in with you a few times (a plan before I build, a first draft to look at), or do everything and ask you at the end. Which do you prefer? (If you do not mind, I will check in.)', set: 'mode', then: `answer normal or batch. If nobody can be asked (an automatic run): aclivery brief set ${b.slug ?? '<slug>'} mode batch` });
  if (!b.references?.length && !b.elements?.length) todo.push({ ask: 'What should it look like? Share reference images, or describe the design in a sentence.', add: 'references' });
  // Every photo the user gave gets looked at and given a view; then the basic views are checked, and a missing one is a question for the user
  // (a photo of the roof is often the only place a big graphic shows), not something to skip quietly.
  const refs = b.references ?? [];
  const unviewed = refs.map((r, i) => ({ r, i })).filter(({ r }) => r.file && !VIEWS.includes(viewOf(r)));
  if (unviewed.length) {
    todo.push({ ask: null, do: `look at every photo and give each a view: one of ${VIEWS.join(', ')} (detail = a close-up of one part: say which in the notes), and a note of what it shows. If you have not made the contact sheets yet: aclivery photos <the user's photo folder> --brief ${b.slug ?? '<slug>'}. Photos without a valid view: ${unviewed.map(({ r, i }) => (text(r.view) ? `${i} ("${text(r.view)}" is not a view name)` : i)).join(', ')}`, set: `references.${unviewed[0].i}.view` });
  } else if (refs.length) {
    const have = new Set(refs.map(viewOf)), waived = new Set(Object.keys(waivedOf(b)));
    const slot = VIEW_SLOTS.find((s) => !waived.has(s.id) && !s.views.some((v) => have.has(v)));
    if (slot) {
      todo.push({ ask: `I do not see a photo of ${slot.label} among the ones you gave me. Do you have one? If you add it to the folder I will look at it. If not, I will say so in the report and ${slot.consequence}.`,
        then: `a new photo: aclivery photos <folder> --brief ${b.slug ?? '<slug>'}  |  they have none: aclivery brief set ${b.slug ?? '<slug>'} viewsWaived.${slot.id} '${QUOTE_FORM}' (their words; a waiver you decide yourself is not accepted)` });
    }
  }
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
      if (assumedOf(l)) return;   // a batch run could not ask: the default was taken and written down; it is listed in the report instead
      if (l.confidence === 'low' && !(l.source === 'skip' && text(l.why))) {   // a layer left out with a reason builds no guess
        todo.push({ ask: `I am not sure about "${l.what}" (evidence: ${l.evidence}). What is it, and how would you describe it?`, set: `analysis.layers.${i}.what`, then: `aclivery brief set ${b.slug ?? '<slug>'} analysis.layers.${i}.confidence high` });
      } else if (l.confidence === 'medium' && l.brand && /logo|large-graphic/.test(l.kind ?? '')) {
        todo.push({ ask: `I read "${l.what}" as ${l.brand}${l.part ? ' ' + l.part : ''} (evidence: ${l.evidence}). Is that right?`, do: 'if yes, set confidence high; if not, correct "brand" and "what" first', set: `analysis.layers.${i}.confidence` });
      }
    });
  }
  const live = layers.map((l, i) => ({ l, i })).filter(({ l }) => l.kind !== 'base');
  // The plan flow (sources per layer, the design file) replaces the old elements list; an old brief that already has elements and no sources keeps the old questions.
  const planned = live.some(({ l }) => l.source) || !!b.build || (live.length > 0 && !b.elements?.length);
  if (!planned && b.analysis?.layers?.some((l) => l.tone === 'subtle') && !(b.elements ?? []).some((e) => e.tone === 'subtle' || /tonal|ink|pattern|texture|art/i.test(e.what ?? ''))) {
    todo.push({ ask: 'The references show subtle tonal art but no element covers it. Add one (a placeholder asset is fine), do not drop it. Is there an original file for it?', add: 'elements' });
  }
  if (!baseColourOf(b)) todo.push({ ask: 'What is the base colour of the car?', set: 'baseColour' });
  if (!planned && !b.elements?.length) todo.push({ ask: 'List what the livery needs: sponsors, text, number, art. One line each.', add: 'elements' });
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
  // THE PLAN (stages 3 to 6): how each layer is produced, then the assets it needs, then the design file, then the fix rounds, then the export.
  // The decision per layer lives in the brief, so it is not lost halfway: fetch = a brand mark that exists as a file; generate = livery art with no
  // file (a placeholder pattern); construct = text, numbers, plates, solid colours the kit draws; stock = already on the car's own texture; skip = left out, with a reason.
  if (!unrated.length && live.length) {
    const nosrc = live.filter(({ l }) => !SOURCES.includes(l.source));
    if (nosrc.length) {
      todo.push({ ask: null, do: `decide how each layer is produced (set "source" on every layer): fetch = a brand mark or logo that exists as a file (never redraw it); generate = hand-drawn livery art with no file (a pattern placeholder); construct = text, numbers, plates, solid colours; stock = already on the car's own texture; skip = leave out, with "why". Suggested: ${nosrc.map(({ l, i }) => `${i} ${suggestSource(l)}`).join(', ')}. Missing on: ${nosrc.map(({ l, i }) => `${i} "${String(l.what ?? l.kind).slice(0, 40)}"`).join(', ')}`, set: `analysis.layers.${nosrc[0].i}.source` });
    } else {
      for (const { l, i } of live) {
        if (l.source === 'skip' && !String(l.why ?? '').trim()) todo.push({ ask: null, do: `layer ${i} "${l.what}" is marked skip: say why (analysis.layers.${i}.why) and add it to decisions`, set: `analysis.layers.${i}.why` });
        // A placeholder counts only when the layer records who allowed it and why ("placeholder": "user: ...").
        const allowedStandIn = /placeholder/i.test(String(l.asset ?? '')) && String(l.placeholder ?? '').trim();
        if (l.source === 'fetch' && !allowedStandIn && (!l.asset || /placeholder/i.test(String(l.asset)) || !fileExists(l.asset))) {
          todo.push({ ask: null, do: `layer ${i} "${l.what}" is a brand mark to FETCH, not redraw. 1) look in assets/logos (aclivery logo inspect <file>) for the brand's file; 2) cut the mark out of it (logo prep --crop --erase --key-bg or --key-light --tint --trim, skill ac-logos); 3) set analysis.layers.${i}.asset to the prepared file. If no file exists, ask the user which source to download from (name URL, host, type) and wait for the yes. A placeholder is only allowed when the user says so: then record it as analysis.layers.${i}.placeholder "<who allowed it and why>" and add a decision. The search procedure is at the top of skill ac-logos.`, set: `analysis.layers.${i}.asset` });
        }
      }
      for (const { l, i } of live) {
        if (l.source === 'generate' && !text(l.style)) todo.push({ ask: null, do: `layer ${i} "${short(l.what)}" is generated art: set its style to what it looks like in the photos, one of ${Object.keys(STYLES).join(', ')}, or none when no style fits (then the plan tells the user and asks for an art file or to leave it out)`, set: `analysis.layers.${i}.style` });
        else if (l.source === 'generate' && text(l.style) !== 'none' && !STYLES[text(l.style)]) todo.push({ ask: null, do: `layer ${i} has style "${l.style}", which is not one of ${Object.keys(STYLES).join(', ')}, none`, set: `analysis.layers.${i}.style` });
      }
      const pending = todo.some((t) => /to FETCH|marked skip|is generated art: set its style|has style/.test(t.do ?? ''));
      if (!pending && !b.build && b.mode !== 'batch' && !quoted(b.planApproved)) todo.push({ ask: planAsk(b), then: `ask the user, then stop and wait. Only after they answer: aclivery brief set ${b.slug ?? '<slug>'} planApproved '${QUOTE_FORM}'. ${text(b.planApproved) ? 'What is recorded now is not a quote of the user, so it does not count. ' : ''}If they want something changed, change the layers or sources first` });
      else if (!pending && !b.build) todo.push({ ask: null, do: `build in parts: write the design file (one element per layer; set "brief": "${b.slug ?? '<slug>'}"; give each element "covers": "<layer word>"), then aclivery apply <design.json> --check, then apply. Part 1: the body texture (aclivery apply ... --only ext_main), then the other textures (plates, banner, glass, grille).` });
      else if (!pending && b.build) {
        if (b.build.part) todo.push({ ask: null, do: `the last build was a part (--only ${b.build.part}), which is not a round (rounds done: ${b.build.round ?? 0}). Build the other textures the same way, then run aclivery apply <design> without --only: that full build is round ${(b.build.round ?? 0) + 1}` });
        else if (b.build.missing > 0) todo.push({ ask: null, do: `the last build left ${b.build.missing} layer(s) missing: run aclivery apply <design> --check, fix every "missing:" line (add the element, or record a decision), then build again` });
        else if (b.mode !== 'batch' && (b.build.round ?? 0) >= 1 && !quoted(b.draftReviewed)) todo.push({ ask: `Here is a first draft. Please open ${b.build.out ? path.join(b.build.out, 'compare.png') : 'compare.png'} (the photo on the left, ours on the right) and ${b.build.out ? path.join(b.build.out, 'sheet.png') : 'sheet.png'}, and tell me what looks wrong or missing, in your own words. I will fix what you point at before I polish it. (Show the user the images, do not just give a path.)`, then: `ask the user, then stop and wait. Only after they answer: aclivery brief set ${b.slug ?? '<slug>'} draftReviewed '${QUOTE_FORM}'. ${text(b.draftReviewed) ? 'What is recorded now is not a quote of the user, so it does not count. ' : ''}Then turn each point into a change in the design file` });
        else if ((b.build.round ?? 0) < ROUNDS) todo.push({ ask: null, do: `rounds done: ${b.build.round} of at least ${ROUNDS} (more are fine while the differences are big). Skills: ac-render and ac-verify. Look at compare.png, name the 3 to 5 biggest differences from the references, fix those in the design, apply again` });
        else if (!b.build.exported) todo.push({ ask: null, do: 'export: aclivery apply <design> --export, then aclivery validate skin <dist folder>/<Name>' });
        else if (!hasReport(b)) {
          const { placeholders, skipped, assumed, decided, waived } = openNotes(b);
          todo.push({ ask: null, do: `write the report (what is built; placeholders: ${placeholders.join('; ') || 'none'}; skipped: ${skipped.join('; ') || 'none'}; left out by a decision: ${decided.join('; ') || 'none'}; views the user had no photo of: ${waived.join(', ') || 'none'}; assumed, not confirmed by the user: ${assumed.join('; ') || 'none'};${b.mode === 'batch' ? ' the short list of questions you would have asked the user, each with the default you took;' : ''} and that none of it was verified in the game until the user loads it in Content Manager and says so)`, set: 'report' });
        }
      }
    }
  }
  const openQs = (b.openQuestions ?? []).filter((q) => !answeredByDefault(q));
  if (openQs.length) todo.push({ ask: `Open question: ${questionText(openQs[0])}`, note: 'decide with the user, then add a decision and remove it from openQuestions. In a run where the user cannot be asked, store it as {"q","default","by"} (the default taken and who took it): it then stops blocking and is listed in the report' });
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
    { const nb = blank(slug, flags.title, flags.car); if (['normal', 'batch'].includes(flags.mode)) nb.mode = flags.mode; save(slug, nb); }
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
    if (b.build) console.log(`  built: ${b.build.part ? `part [${b.build.part}] after ` : ''}round ${b.build.round}, ${b.build.elements} element(s) in ${b.build.design}, ${b.build.missing} layer(s) missing, ${b.build.cutOff} cut off  (the design file, not this list, is the source of truth)`);
    const planRows = (b.analysis?.layers ?? []).map((l, i) => [i, l]).filter(([, l]) => l.kind !== 'base' && l.source);
    for (const [i, l] of planRows) {
      const as = assumedOf(l) ? `  [assumed: ${assumedOf(l)}]` : '';
      if (l.source === 'skip') { console.log(`    L${i} [skip] ${String(l.what).slice(0, 48)}  skipped: ${String(l.why ?? '').trim() || 'NO REASON GIVEN'}${as}`); continue; }
      const state = l.source === 'fetch' ? (l.asset ? (/placeholder/i.test(l.asset) ? 'PLACEHOLDER' : fs.existsSync(l.asset) ? 'file ok' : 'FILE MISSING') : 'NO FILE YET') : '';
      console.log(`    L${i} [${l.source}] ${String(l.what).slice(0, 48)}${state ? '  ' + state : ''}${l.built ? (l.built.part ? '  built (part build)' : '  built r' + l.built.round) : '  not built'}${as}`);
    }
    for (const [i, r] of (b.references ?? []).entries()) console.log(`    ref ${i}. ${r.file ?? '?'}  view: ${r.view ?? '?'}${r.notes ? '  ' + r.notes : ''}`);
    for (const [i, e] of (b.elements ?? []).entries()) console.log(`    ${i}. ${e.what}  ->  ${e.panel ?? e.target ?? '?'}  [${e.status ?? 'idea'}]${e.asset ? '  ' + path.basename(e.asset) : ''}`);
    if (!todo.length && b.build?.exported && hasReport(b)) {
      const { placeholders, skipped, assumed, decided, waived, plan, draft } = openNotes(b);
      console.log(`\nDONE: ${b.build.round} full-build round(s), exported, report written.`);
      console.log(`  placeholders: ${placeholders.join('; ') || 'none'}`);
      console.log(`  skipped: ${skipped.join('; ') || 'none'}`);
      console.log(`  left out by a decision: ${decided.join('; ') || 'none'}`);
      console.log(`  views the user had no photo of: ${waived.join('; ') || 'none'}`);
      if (plan) console.log(`  plan check-in: ${plan}`);
      if (draft) console.log(`  first draft review: ${draft}`);
      console.log(`  assumed, not confirmed by the user: ${assumed.join('; ') || 'none'}`);
      console.log(`  mode: ${b.mode ?? 'normal'}${b.mode === 'batch' ? ' (no check-ins: the questions are in the report)' : ''}`);
      console.log(`  report: ${typeof b.report === 'string' ? b.report : JSON.stringify(b.report)}`);
      console.log('  Not verified in the game until the user loads the zip in Content Manager and says so.');
      return 0;
    }
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
