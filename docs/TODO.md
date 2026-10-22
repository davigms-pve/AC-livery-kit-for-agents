# TODO and resume map

The single place to find what is done, what is next, and the context needed to pick the work up cold (by a person,
a fresh agent session, or a local model). Update it when work lands. Last updated 2026-10-21 (C1 built).

Legend: `[x]` done and verified by a run, `[~]` done but only partly verified, `[ ]` not started. IDs are stable;
refer to them in commits and the brief.

## 0. Resume here (read this first)

- **Milestone:** M1 = a small cloud model (Haiku) does the use case well enough from the repo alone (`docs/milestones.md`, run with `eval/haiku-run.md`,
  judged with `eval/rubric.md`). **Hermes trials are parked** until M1 passes (owner's decision, 2026-10-21).
- **Order of things, requirements and tools:** `docs/workflow-map.md`. **Story and reasoning of the first session:** `docs/session-log/2026-10-21.md`.
- **Next session starts with:** the owner reviews the B17 placeholder art and the analysis-confidence step, then an M1 rerun (hide other briefs first; see `eval/runs/2026-10-21-haiku-1.md`). Send the B18 ask (original art) in parallel; B12/B15 still open. The design spec (C1, `aclivery apply`) is built.

- **What this is:** an agent layer for Assetto Corsa livery work. A few `aclivery` commands (deterministic code) plus
  skills (what a model reads). Engine: liverykit pinned at `f5c56b8`, only touched in `src/engine.mjs`.
- **Origin use case:** put the "T. Thiele #71 Monster Energy Ultra" livery on the mod car `rss_gtm_protech_p92_f6`
  (RSS GT-M Protech P92 F6), from reference photos. A local-model Hermes attempt failed. See
  `docs/use-cases/rss-p92-thiele71.md` (what is verified) and `docs/user-journey.md`.
- **Where state lives:** `.aclivery/cars/<id>/` (car pack, gitignored), `.aclivery/projects/<slug>/brief.json` (project
  memory), `assets/` (logos, demo outputs, gitignored), `cars/<id>/panel_map.json` (committed region map).
- **Files the user supplied (outside the repo):** `Downloads/AC AI/` holds the kn5, the modder's PSD template pack,
  the green template `EXT_Main.dds`, `previewgreen.jpg`, the hand-annotated cutouts image and `fotosamples/` (15
  reference photos).
- **Run it:** `npm install`, `node bin/aclivery.mjs status`, `npm test`, `bash examples/rss-p92-thiele71/build.sh`.
- **Rules:** `AGENTS.md` and `docs/architecture.md`. Mark claims verified or unverified. Ask before downloads. Never
  commit game files or third-party art.

## 1. Done

- [x] Research landscape (`docs/research/landscape.md`): tools, formats, gaps. Mostly Haiku sweeps; liverykit verified by us.
- [x] Spike on the real car: kn5 parses, liverykit profile (826 panels), headless render ~2 s/view, probe technique.
- [x] CLI: `car prep`, `panel`, `decal`, `render` (+ `--probe`, `--regions`), `logo`, `validate`, `export`, `brief`, `status`.
- [x] Skills: `ac-intake`, `ac-livery`, `ac-car-prep`, `ac-panels`, `ac-decal`, `ac-render`, `ac-logos`, `ac-skin-export`.
- [x] Tests (12, no game data): args, DDS validator, logo prep, decal rotation (0/90/180/270) and aspect guard, brief.
- [x] Baseline commit on `feat/baseline-scaffold`.
- [x] Analysis step (`ac-analyze`, brief `analysis` + the rule that subtle layers need an element), overlap guard in `decal`/`text` (`--overlap` to allow).
- [x] Workflow map, per-car notes (`car notes`), milestones, Haiku run prompt and rubric, session log.
- [~] Rough first-pass Thiele skin (`examples/rss-p92-thiele71/build.sh`): runs end to end; the result is a weak match
  (see section 3). Not loaded in the game.

## 2. Now (this iteration)

- [x] **A1 First-class small textures.** Door plates (`Door_Plates.dds`), interior decals and similar have 0 panels in the
  liverykit profile, so `decal` cannot place on them. Synthesize a `whole` panel with the measured usable UV region.
- [x] **A2 Text command.** `aclivery text`: driver names, number, plate lettering (SVG text rendered, then placed like a decal).
- [x] **A3 Reference compare.** `aclivery compare`: each reference photo next to a render from the matching view; references
  and their views recorded in the brief.
- [~] **A4 Redo the Thiele pass** on doors, hood and plates using A1-A3, and compare against the references.
- [x] **A5 Tests and docs for A1-A4** (16 tests). Committed as one squashed commit `45fffd1` on `main` and pushed (2026-10-21, owner-approved, marked work in progress). The detailed local history stays on the local-only branch `feat/baseline-scaffold` (never push it: its commits still carry the old MIT stub licence).

## 3. Optimise the Thiele use case (after section 2)

Why the first pass fell short: placement by guess, signature art missing, other textures skipped, no loop against the references.

- [~] **B1 Multi-texture design flow.** One design drives body, door plates and the windshield banner (`HR_Generic`, with `"base"`): done in draft 3 (`examples/rss-p92-thiele71/design.json`). Not yet: rear window banner (texture unknown), roof/decal textures, the pillar name (panel unknown).
- [~] **B2 Signature art source.** Claw: fetched from SeekLogo with the owner's yes (2026-10-22), cut out in the design (`prep`: crop, erase, key-bg, tint); draft 3 now uses it on the hood, roof, doors and wing. It is a 600px fan-made copy, so soft: an SVG would be better (VectorSeek and CDNLogo list SVG/EPS, not downloaded). Still no source for the grey leaf art, vines and cyan splatter (generated placeholders). Ink line art, cyan splatter and brush strokes, the big claw. Options: the user's original design files
  (ask), vectorising from photos, an image-generation arm. Decision needed (see section 5).
- [ ] **B3 Better logos.** SVG or press-kit sources; the claw as a separate asset; correct colour variants. Reference-quality checks.
- [ ] **B4 Reference-driven placement.** For each element: which view shows it, target panel, size, orientation; recorded in the brief.
  Optionally a vision model proposes, the user confirms.
- [ ] **B5 Curvature and warping.** Art on curved panels (hood, fenders) distorts; add per-panel strength hints or a warning.
- [ ] **B6 Render fidelity.** 8 stock textures cannot be decoded (all PNG); no reflections. Fix PNG stock textures; consider env lighting.
- [ ] **B7 In-game verification** (user's machine): does the exported 8192x2956 DXT1 skin load; do other sizes. Screenshot back.
  Also: the exported `Door_Plates.dds` is 2048x640 (set from the modder's PSD) while the stock texture is 256x64 (aspect 4 vs 3.2): confirm the game accepts it and the plates look right.
- [ ] **B8 Mirrored-panel text check**: detect reversed text risk per panel, or verify with a probe sheet.
- [ ] **B9 `ui_skin.json` keys**: verify against a working skin and the game; stop calling them "typical".
- [ ] **B10 Hermes trial** with a local model. **PARKED until M1 (Haiku) passes** (owner's decision). Narrow tasks first; needs the owner's explicit go-ahead.
- [ ] **B11 Performance**: car prep ~12 s, render ~2 s/view, export ~10 s; fine, keep an eye on larger cars.

### Gap list against the references (after pass 2, 2026-10-21)

Method: `aclivery compare rss_gtm_protech_p92_f6 --skin assets/demo/thiele71/work --brief thiele71` (right, front, front-left views).

| Element in the reference | Pass 2 | Next |
|---|---|---|
| DELS #71 door plate cards | **Good**: position, size, both doors | Add the small lines under the number (sc-hassel1919.de, sponsor strip); verify in game |
| Monster claw + wordmark behind the plate | Right order and side; wordmark too small; claw is a crude placeholder | Real claw asset (B2/B3); scale up the wordmark |
| Claw on the hood and roof | Present on the hood (grey slashes); roof not checked | Real claw; check roof view; reference shows it larger and lighter |
| "MONSTER ENERGY ABSOLUTELY ZERO" on the nose, PORSCHE on the bumper | Wordmark clipped ("ONST"); PORSCHE missing | Find the right nose/bumper panels with `render --regions` and probes; size to the panel |
| Driver name strip ("T. THIELE" + flag) on the rear-window pillar | Placed on the lower quarter, too big | Find the pillar panel; add the flag as an asset |
| Silver ink art (feathers, vines) across all panels | **Missing** | B2: needs the art (user's files, vectorising, or an image-generation arm) |
| Cyan splatter and brush strokes, cyan lower stripe, POTTSPEED skirt lettering | **Missing** | B2 + side-skirt panels |
| Cyan mirrors and wing endplates | **Good** | none |
| GRAN TURISMO windshield banner | Missing (other texture) | B1 multi-texture flow; find the glass/banner texture |
| Rear: MONSTER, MOTUL, pink 71, GoPro | Roughly placed in v1; not compared in v2 (no valid rear reference chosen) | Pick a rear reference, label its view correctly |

**Added after the owner's review of pass 2:** the discreet grey ink art on the almost white body is the identity of this livery (it mimics the Monster can
artwork). Treat it as a required layer, not a missing asset. Logos must not overlap unless shown.

- [ ] **B16 Photo-to-texture projection.** Our renderer knows the camera and the UVs. Project a reference photo (a known view) back onto the UV atlas to recover
  *visible* regions of the art (luminance/colour deltas against the white body) as a texture layer. Hard parts: camera registration (the photos are arbitrary
  angles, lit renders, perspective), occlusion, lighting removal. Promising for tonal art. Research spike first.
- [x] **B17 Tonal-art placeholder generator.** `pattern` elements in `apply` (`src/lib/patterns.mjs`): ink-lines (vines, feathers), splatter, brush; deterministic by seed,
  scaled in metres so motifs match across panels, always under the logos, `--check` warns when ink-lines would not be discreet (stroke contrast, body coverage).
  Verified: unit tests (determinism, coverage estimate vs pixels, panels only, logos on top) and a render on the real P92 (faint ink on the doors and body, logo over it). Not verified: that it
  reads as "the" livery's art to the owner (it is a generic placeholder) or that the discreet thresholds (`DISCREET` in patterns.mjs) match the owner's eye.
- [x] **B23 Analysis confidence.** Each analysis layer carries `confidence` and `evidence` (and `brand`/`part` for marks); `brief show` makes the agent rate them, asks the user about `low`
  layers and confirms `medium` brand reads. Nothing here can see images: it only forces the structure and turns doubt into a grounded question.
- [~] **Staged draft 3 (2026-10-21).** `examples/rss-p92-thiele71/design.json`; build `bash examples/rss-p92-thiele71/build.sh` (output in `assets/demo/thiele71/`) or `aclivery apply ... --export` (`assets/builds/thiele71-draft-3/`). Has: leaves, vines, cracks, cyan blots,
  cyan solids incl. splitter/diffuser edges, claw and lockup on doors/hood/roof (placeholder claw), DELS cards, lower-door DELS, POTTSPEED on the sills, windshield banner with the stock markings kept. Verified: builds, validates, DDS OK. Not verified in the game.
  Added after the probes: Monster lockup on the hood nose, PORSCHE on the bumper cover, MOTUL / lockup / pink 71 / GoPro on the rear bumper, "PAPA'S HOUSE OF GAME" on the deck (see the car notes for the layouts).
  Added: driver name + flag on the roof-edge strips, black rear-quarter windows (shared glass texture, `car stock` to get the stock base), the lockup and claws along the wing top.
  (Rescan 2026-10-22: see the gap map below; the open list here is superseded.)
  Older open list: rear window banner, black sill band, SC Hassel discs, DELS dot-matrix splitter, the real claw and lockup colourways (B2/B18), roses, creature art on wing tips, AM tag, TOW arrows.
- [x] **Decal rotation bug** (non-square images on 90/270 panels were squashed/cropped; fixed with a test), **`apply --check` island coverage** ("cut off" warnings), **`logo prep --key-light`** (baked checkerboards).
- [x] **`aclivery car stock`**: saves the car's own copy of a texture (e.g. the glass) to use as a design's `"base"`.
- [~] **Gap map after the rescan (2026-10-22)**, against the 22 layers of the 15-photo analysis (`docs/research/reference-views.md`). Done = in draft 3 and seen in a render; none checked in the game.

  | Layer | Status | What is left |
  |---|---|---|
  | Base near-white | done | |
  | Leaves (grey plumes) | partial | generated leaf clusters are paler and more regular than the originals; real art needed for the look (B2/B18) |
  | Thorny vines with roses | partial | generated, thin, with rose buds; the originals are bolder |
  | Crack network (roof) | partial | generated, faint |
  | Cyan blots / brush strokes | done (generated) | positions are random, not copied |
  | Cyan solids (mirrors, endplates, splitter and diffuser edges, sill underline) | done | |
  | Claw (hood, roof, doors, wing ends) | placeholder | real claw art; the roof claw should be much larger |
  | Claw as dots on the endplate | not done | a perforation-dot version |
  | Monster lockup (ULTRA / ABSOLUTELY ZERO / ZERO ULTRA colourways) | done (cut from the one logo file) | the originals are grey-filled on the rear and nose |
  | DELS card, lower-door DELS, small print | done | exact font of the 71 |
  | DELS rear window banner | done | glass texture, translucent white |
  | DELS front grille | done (plain text) | dot-matrix look |
  | POTTSPEED sills, black band, cyan underline | done | |
  | PORSCHE bumper, crests | partial | the small crests on the nose and fender are not placed |
  | Rear sponsors (MOTUL, GoPro, AM tag, pink 71, TOW) | done | AM tag and TOW are drawn, not the real stickers |
  | Papa's House of Game | done | mostly hidden behind the wing |
  | Driver name + flag | done (roof-edge strips) | the references put it in the black quarter window; shared mirrored texels prevent that |
  | Windshield banner | done | the cyan pixel-digit box and the GT logos |
  | SC Hassel 1919 discs | placeholder | real emblem |
  | Neutral/Extinguisher markings | done (stock sticker sheet kept) | |
  | Vertical MONSTER on the pillar | not done | |
  | Wing underside lettering, creature art on the tips | guess / not done | |
  | Tyre lettering | out of scope (stock tyre) | |

- [x] **Run 2 fixes (2026-10-22):** `brief show` lists the references; the base colour is read from the analysis; bolder default `leaves`/`ink-lines`; `apply --check` suggests the nearest box fully on the surface; the P92 notes open with a "complete skin" checklist.
- [x] **Agent flow audit (2026-10-22)** -> `docs/agent-flow.md`: seven stages, a `source` per layer (fetch / generate / construct / stock / skip) so a brand mark is not redrawn, `brief show` walks the stages, `apply --only` builds in parts, layer `built` status written back. Not yet re-tested with a model.
- [ ] **Porsche crest** (owner, 2026-10-22): the small crest on the front fender next to the wheel (and on the nose) is not placed; it needs a real crest file (fetch, the owner's yes): `assets/logos/porsche.png` is the wordmark only.
- [x] **German flag** is now in the quarter window (shared glass texture; stripes stacked along the texture's x so they read horizontal; symmetric, so mirroring is harmless), not on the roof strip.
- [ ] **Iteration gap.** The hand-built draft 3 is much better than the Haiku run because it went through about 15 compare-and-fix cycles with probe renders; Haiku does one pass. Next kit work: make the loop cheap and short (a summary after `apply` that names the biggest differences from the references, a fix list the model works through) and let a model do two or three rounds; then rerun M1.
- [ ] **B24 Number and lettering styles.** Made-up number styles: match from a short list of free fonts tagged by style (italic, condensed, brush, stencil) via `text --font`, rather than freehand redrawing.
  Unverified first: whether the renderer on Windows can use a font file that is not installed (else convert text to paths). Bundling fonts needs the owner's yes, a licence check and a NOTICE line.
- [ ] **B25 Free art sources.** Optional later: CC0 motif/shape libraries (consent per download, licence note per file). Logos stay local, personal use, consent only. Procedural patterns (B17) cover tonal art without downloads.
- [ ] **B26 Zoom on a reference.** A crop/zoom for `compare` so small models can read detail (font of the number, claw shape). Only if run 2 shows details being misread.
- [ ] **B18 Ask for the originals first.** The team that built the livery (GT7 livery editor) may still have the decal files (SVG/PNG): the single best fix.
- [x] **B19 Analysis step in the flow** (`ac-analyze`; `brief show` insists on it and on an element for every subtle layer).
- [x] **B20 Overlap guard** (`decal`/`text` refuse covering placed art unless `--overlap`).
- [x] **B21 Layer order**: `apply` draws `tone` (quiet art, `decal --under`), `paint`, `logo`, `text` in that order whatever the file order. Tested with synthetic cars.

Process lessons from pass 2:

- [ ] **B12 Reference view labels are easy to get wrong** (I mislabelled two photos in the first comparison; the side-by-side made
  it obvious). Add a check: for each reference, render the candidate view and show them together before trusting the label; or let
  the model propose the view and the user confirm.
- [ ] **B22 First Haiku run must be valid** (`examples/` and `eval/` are forbidden to the model, so `skills/ac-apply` and `apply --help` carry generic placeholder examples only: keep the Thiele solution out of anything the model may read. Open: `skills/ac-decal` still shows a "T. THIELE" `--at` line from before C1; it is a placement hint, not a panel, but review it before the run): the run prompt (`eval/haiku-run.md`) now allows exactly the docs the skills name; re-check that no skill points at anything the run forbids.
- [ ] **B13 Plate/sticker layout from the modder's PSD** (card positions) should be read automatically into the car pack
  (`car prep --psd Door_Plates.psd`), not typed into the build script as fractions.
- [x] **B14 Size overrides persist across `car prep`** (`car size`).
- [ ] **B15 Sensible default sizes** per element kind (wordmark vs claw vs number) so the first placement is closer.

## 4. Generalise (different liveries, asks, vehicles)

- [x] **C1 Declarative design spec.** `aclivery apply design.json [--check] [--no-render] [--export]` (`src/commands/apply.mjs`, skill `ac-apply`): assets prepared, every element drawn in layer order, contact sheet, optional comparison and export. The file is validated first and every problem listed at once; unknown keys are errors. Verified: `examples/rss-p92-thiele71/design.json` rebuilds the pass-2 skin byte-identical to the old `build.sh` (both textures), and 3 new tests cover validation, layers, cards and overlap errors. Not yet tried by a model: that is the M1 run. Still open under it: panels by role (C3), reading card positions from the PSD (B13).
- [ ] **C2 Car adapters.** Any car via `car prep`; auto-generate the region map (cluster by 3D position and UV: front, hood, doors,
  roof, rear, wing, mirrors) instead of hand-drawing it; label unknown panels by probe renders (VLM or human).
- [ ] **C3 Reusable designs across cars.** Panels addressed by role (`hood`, `left_door`) so one design maps onto another car;
  per-car fit files for what does not map (liverykit's "portable design + fit" idea).
- [ ] **C4 Cross-car transfer.** Render the source skin from fixed angles; treat the renders as references for the target car.
  Shares the pipeline with A3/B4. Phase 2 of the original ask.
- [ ] **C5 Other vehicles.** Kunos originals, GT3 cars, open-wheel; cars with several body textures; CSP-encrypted mods (policy:
  the kit does not decrypt; ask the author; 2D-only fallback, see `docs/user-journey.md`).
- [ ] **C6 2D-only path** for users without the kn5 (template UV/AO and region boxes; the human verifies in Content Manager).
- [ ] **C7 Evaluation harness.** Same tasks scored across arms: tool-calling LLM + these commands, image-edit model on the texture
  sheet, hybrid; local Qwen via Hermes vs cloud models. Answers "Qwen or an image model?" with data.
- [ ] **C8 Packaging for other agents.** Hermes skills folder, Claude Code plugin/skills, `AGENTS.md`; `npm link` or publish `aclivery`.
- [ ] **C9 MCP wrapper** (later). Hermes prefers "CLI + skill"; add only if a client needs it.
- [ ] **C10 Find the car on the user's machine** (locate `content/cars`), with consent.
- [ ] **C11 Contribute upstream to liverykit** (non-power-of-two DDS, `door_plates` panels). The user decides whether to contact the author.
- [x] **C13 Per-car notes and the workflow map** so models do not relearn (`cars/<id>/notes.md`, `docs/workflow-map.md`). Keep notes current for every car.
- [ ] **C12 Contributor docs** and a gallery of examples (without third-party art).

## 5. Decisions and questions for the user

Note on state: the `thiele71` brief (in `.aclivery/projects/`, not in git) was repopulated on 2026-10-21 with the elements `build.sh` places and their status; it is local to this machine.


- Where do the ink art, claw and splatter come from: original files, vectorising, or an image-generation arm? (B2)
- Is the target "recognisably the same" or pixel-faithful? (sets effort for B4/B5)
- OK to contact liverykit's author about collaboration? (C11) Not done; the user's call.
- Hermes trial: parked until the Haiku milestone M1 passes. (B10, `docs/milestones.md`)
- Can the user (or the brother) load a skin and send a screenshot? (B7)
- From the 15-photo analysis simulation (`docs/research/reference-views.md`): is "ULTRA" part of the can lockup? is the dotted "III" on the wing endplate the claw? all answered 2026-10-21 (see the doc; tyres are probably stock, not verified in the game). Still to run: the canonical-views-only test (does a subset of views give the same inventory?).

## 6. Decisions made so far

- **Licence (2026-10-21, owner):** PolyForm Noncommercial 1.0.0 (source-available; free for noncommercial use, no selling, keep the notice); commercial licences on request. Code is
  `private: true` in package.json (no accidental npm publish). Third-party notices in `NOTICE`; contributions come with a relicensing grant (`CONTRIBUTING.md`).
  The first public code commit already carries this licence (the earlier public commit held only a stub MIT LICENSE). Not legal advice; revisit if commercial plans appear.

- Local models first, cloud models as a complementary goal; model choice (LLM vs image model) is to be benchmarked, not assumed.
- MVP is editing a livery on the same car; cross-car transfer is the second goal.
- liverykit is the engine (pinned); this repo is the agent layer; liverykit's MCP is not used.
- GIMP/Blender MCPs are not part of the core (optional, and a possible benchmark arm).
- Prepare once (car pack), run light; few commands; name panels, not pixels; one image per look; ask before outward actions.
- Logos are downloaded only with explicit consent and stay in gitignored `assets/`.
- `ALPHA` in the modder's PSD is the previous livery's graphics, not a paintable mask. The cutouts image is the atlas at 541 px
  height with ~92 px cropped off the left.

## 7. Ground truths (verified here) and pitfalls

- kn5 of the P92 parses (not encrypted); liverykit profile: 57 textures, 826 panels; body `EXT_Main.dds` is 8192x2956, 69 panels.
- `right_*` panels are the atlas top strip (rotation 180); `left_*` the bottom (rotation 0); mirrors are `left_mid_lower_2` and
  `right_mid_lower_2`; `left_mid`/`right_mid` are the doors (vis 0.43, partly shielded).
- Texels are physically square at the real aspect ratio; the decal command refuses a wrong-aspect base.
- Unpainted surfaces render dark grey: door plates need their own texture override.
- Not verified: anything about loading in the game; `ui_skin.json` key names; sizes other than the P92 body.
