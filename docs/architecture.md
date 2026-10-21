# Architecture

## The problem this design answers

A small local model failed at livery work using generic GIMP and Blender tools (see
`docs/use-cases/rss-p92-thiele71.md`). The likely reasons, to be confirmed by our own evaluation:

1. Generic tools expose pixels and bpy; the model must chain many exact calls.
2. Nothing in a texture says which part of it lands on the sidepod; that mapping lives in a 300 MB-class model.
3. The model could not see the result, or seeing it cost more than it could afford.

## Design rules

1. **Prepare once, run light.** Heavy work (reading the `.kn5`, measuring panels) happens once in `car prep` and
   produces a small pack. The agent never opens the model or any large binary.
2. **Few commands, short answers.** Each command does one human-level thing ("place this logo on the left door").
   Output is a few lines; lists are capped; `--json` exists for tools. Fewer than ten commands in total.
3. **Name panels, not pixels.** Placement is by named panel with an automatic rotation to read upright. The model
   never computes UV coordinates.
4. **Deterministic core, model on top.** Geometry, rotation, DDS encoding and validation are code. The model
   decides what goes where and judges the result.
5. **One image per look.** `render` returns a contact sheet. A vision model pays per image and per turn.
6. **Say what was not verified.** The kit has not loaded a skin into the game. Commands and skills say so.
7. **Ask before outward actions.** `logo fetch` prints a plan and exits until `--yes` is given. Nothing is
   uploaded anywhere. Third-party artwork and game files are gitignored.
8. **A thin engine boundary.** liverykit is a single-author, young project, pinned to a commit. Only
   `src/engine.mjs` touches its internals, so the engine can be upgraded or replaced.
9. **CLI plus skills first, MCP later.** Hermes' own guidance prefers "CLI command + skill" to new tools. liverykit's
   MCP is deliberately not used: it proposes into a human-run editor, which is the opposite of what we want.

## Layout

```
bin/aclivery.mjs          command dispatcher
src/engine.mjs            the only file that imports liverykit internals
src/commands/             car, panel, render, decal, logo, validate, export
src/lib/                  args, paths (car packs), dds (header validator)
skills/*/SKILL.md         what a model reads; one per task, short
cars/<id>/panel_map.json  committable measurements: human regions for a car (no art, no geometry)
docs/                     research, use cases, this file
test/                     node:test, no fixtures with game data
.aclivery/                derived car packs (gitignored)
assets/                   logos and other third-party art (gitignored)
```

## Data flow for one livery

1. `car prep` (once per car): kn5 -> `.aclivery/cars/<id>/{profile,index,meta,regions}.json`.
2. Agent reads regions and panels, plans placements.
3. `decal` x N writes `work/EXT_Main.png`.
4. `render --skin work` shows the result; the agent compares with the reference and iterates.
5. `export` encodes DDS, validates, zips for Content Manager. The user checks in the game.

## Known limits (honest list)

- Render has no reflections or normal maps, and only the textures you override are replaced; the rest is the car's own art.
- Panel rects are bounding boxes of UV islands, not exact shapes. Mirrored islands are not detected.
- Rotation convention verified on this car's flanks and hood; other cars unverified.
- DDS: non-power-of-two sizes work for the P92's own skin; behaviour on other cars is unverified.
- Matching renders to reference photos from arbitrary camera angles is not built.
- Encrypted (CSP) models cannot be prepared. The kit does not decrypt third-party models.

## Evaluation (planned)

The same tasks, cars and verification renders scored across arms: (A) tool-calling LLM with these commands,
(B) image-edit model working on the texture sheet, (C) hybrid. Also run against Hermes with a local model, to
learn which commands and skill wording a small model can actually follow.
