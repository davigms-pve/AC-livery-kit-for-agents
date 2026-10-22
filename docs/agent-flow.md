# The agent flow: order, memory, and what went wrong before

Written 2026-10-22 after four Haiku runs (`eval/runs/`) and a review of every skill, `brief show` step and note the agent relies on. This is the one page that says
**what happens in what order, where each decision is remembered, and which `if` sends the agent where**. Facts from runs are verified by us (we read the outputs); the
causes below are our reading of those runs, not proven.

## What the audit found (why the agent was inconsistent)

1. **Two memories that drifted apart.** The brief had an `elements` list and the work had a `design.json`. Run 3 ended with 2 elements in the brief and 43 in the design. Neither was the source of truth.
2. **The most important decision was never written down.** Whether a layer is *fetched* (a brand mark that exists as a file), *generated* (livery art with no file), *constructed* (text, plates, colours) or already *stock*
   lived only in the model's head. So the real claw was cut out in one run (3) and a three-scratch placeholder was used in another (4).
3. **The sourcing advice was in a late skill** (`ac-logos`, "step 3: get assets") and in prose; nothing at the moment of deciding said "this is a brand mark: fetch it".
4. **After the analysis the guide went quiet.** `brief show` asked for the base colour and an elements list, then nothing told the agent what came next, so it "kept rolling" and built everything at once.
5. **Rounds were not tracked** (a new `--out` each time reset the counter) and **missing parts were never listed**, so a fix round tuned density instead of adding the roof claw.
6. **Views were not planned.** The top view (roof claw, wing top, rear window) was never looked at in runs 2 to 4.

## The flow now: stages, each with one exit test

The brief (`.aclivery/projects/<slug>/brief.json`) is the **only** memory. `aclivery brief show <slug>` recomputes the next step from it, so a model that lost its thread asks the brief, not its context.

| Stage | What happens | Written where | `brief show` moves on when |
|---|---|---|---|
| 1 Intake | car, references with a **view** each (look for a flat side, a door close-up, the front, the rear and a **top view**) | `references` | references exist |
| 2 Analysis | study the references into layers: kind, what, where (the car's own words: hood, roof, doors, sills, rear, wing, nose, mirrors), tone, **confidence**, **evidence**, brand/part | `analysis.layers[]` | every layer is rated; low or medium-brand layers are confirmed with the user |
| 3 Sourcing plan | give **every layer a `source`**: `fetch` / `generate` / `construct` / `stock` / `skip` (+ `why`). The default is suggested from the kind (brand mark: fetch; tonal art: generate; text: construct; markings: stock) | `analysis.layers[].source` | all layers have a source |
| 4 Assets | for each `fetch` layer follow the search procedure of `ac-logos` (look locally, search, propose ONE candidate with its exact URL, wait for the yes, fetch, look at it, cut it out with `logo prep`, set `layers[].asset`, write the source down). No file: ask the user; never download without a yes; a placeholder only if the user says so | `analysis.layers[].asset` | every `fetch` layer has a real file |
| 5 Build in parts | write `design.json` with `"brief": "<slug>"` and a `covers` word per element; `apply --check`; build **body first** (`--only ext_main`), then the other textures (`door_plates`, `hr_generic`, `glass_2`, `le_god_grille`) | `design.json`, `brief.build` | a build exists |
| 6 Fix rounds (3) | each `apply` prints a review: `missing:` layers, cut-off elements with the nearest box, warnings; fix those, then the 3 to 5 biggest differences seen in `compare.png` | `brief.build.round`, `analysis.layers[].built` | no layer missing and round 3 done |
| 7 Ship | `apply --export`, `validate skin`, then the report (what is placeholder, what was not verified in the game) | `brief.build.exported` | exported |

Rules that cross stages: never redraw a brand mark; never download without a yes; logos do not overlap unless a reference shows it; a `skip` needs a `why` and a decision; say what is not verified in the game.

## Where the agent notes and memorizes things (and what each is for)

- `references`, `analysis.layers[]` (with `source`, `asset`, `why`, `built`): the plan. `brief show` prints it as a table (`L3 [fetch] Monster claw FILE MISSING not built`).
- `decisions`: every default the agent chose in place of asking the user (it cannot ask in a batch run).
- `build`: written by `apply` (round, elements, missing layers, cut-off elements, exported). The design file stays the source of truth for placement.
- `cars/<id>/notes.md` (in the repo): what is known about the car: panels, textures, pitfalls, a "complete skin" checklist. Read first.
- Not memory: the conversation. Anything only in the conversation is lost at the next context reset.

## Open

- A `missing:` line can still be ignored (the agent may record a decision instead). That is allowed on purpose, but the decision must exist.
- Nothing checks an element against the reference *image*: the kit cannot see. A second, stronger reviewer of `compare.png` is an option, not built.
- View labels of references are still taken on trust (B12).
