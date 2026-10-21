# TODO and resume map

The single place to find what is done, what is next, and the context needed to pick the work up cold (by a person,
a fresh agent session, or a local model). Update it when work lands. Last updated 2026-10-21.

Legend: `[x]` done and verified by a run, `[~]` done but only partly verified, `[ ]` not started. IDs are stable;
refer to them in commits and the brief.

## 0. Resume here (read this first)

- **Milestone:** M1 = a small cloud model (Haiku) does the use case well enough from the repo alone (`docs/milestones.md`, run with `eval/haiku-run.md`,
  judged with `eval/rubric.md`). **Hermes trials are parked** until M1 passes (owner's decision, 2026-10-21).
- **Order of things, requirements and tools:** `docs/workflow-map.md`. **Story and reasoning of the first session:** `docs/session-log/2026-10-21.md`.
- **Next session starts with:** the subtle-art decision (B2/B16/B17/B18), then the design spec (C1), then an M1 run.

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
- [x] **A5 Tests and docs for A1-A4** (16 tests). Committed: `b25d634` (baseline), `3ec731d` (this iteration) on branch `feat/baseline-scaffold` (not merged to `main`; merging is the user's call).

## 3. Optimise the Thiele use case (after section 2)

Why the first pass fell short: placement by guess, signature art missing, other textures skipped, no loop against the references.

- [ ] **B1 Multi-texture design flow.** One design drives body, door plates, windshield banner, roof/decal textures together.
- [ ] **B2 Signature art source.** Ink line art, cyan splatter and brush strokes, the big claw. Options: the user's original design files
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
- [ ] **B17 Tonal-art placeholder generator.** A deterministic generator of discreet grey ink motifs (feather/vine/rose-like strokes) scattered per panel with
  density and tint parameters, used when no original art exists. Must look discreet, not loud, and keep away from logos (overlap rules).
- [ ] **B18 Ask for the originals first.** The team that built the livery (GT7 livery editor) may still have the decal files (SVG/PNG): the single best fix.
- [x] **B19 Analysis step in the flow** (`ac-analyze`; `brief show` insists on it and on an element for every subtle layer).
- [x] **B20 Overlap guard** (`decal`/`text` refuse covering placed art unless `--overlap`).
- [ ] **B21 Layer order**: tonal art is the lowest layer, logos above; `apply` (C1) should enforce draw order from the design spec.

Process lessons from pass 2:

- [ ] **B12 Reference view labels are easy to get wrong** (I mislabelled two photos in the first comparison; the side-by-side made
  it obvious). Add a check: for each reference, render the candidate view and show them together before trusting the label; or let
  the model propose the view and the user confirm.
- [ ] **B22 First Haiku run must be valid:** the run prompt (`eval/haiku-run.md`) now allows exactly the docs the skills name; re-check that no skill points at anything the run forbids.
- [ ] **B13 Plate/sticker layout from the modder's PSD** (card positions) should be read automatically into the car pack
  (`car prep --psd Door_Plates.psd`), not typed into the build script as fractions.
- [x] **B14 Size overrides persist across `car prep`** (`car size`).
- [ ] **B15 Sensible default sizes** per element kind (wordmark vs claw vs number) so the first placement is closer.

## 4. Generalise (different liveries, asks, vehicles)

- [ ] **C1 Declarative design spec. (Recommended first optimisation step.)** `examples/.../build.sh` is already a design spec written as ~30 shell calls; a local model editing one JSON and running one command attacks the original failure (long tool chains) and is also the generalisation path. A `design.json` (elements, panels or roles, assets, colours) and `aclivery apply design.json`
  that builds the whole skin deterministically. The single biggest win for small models: one JSON, one command.
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
