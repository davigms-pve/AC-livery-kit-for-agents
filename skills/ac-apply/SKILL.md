---
name: ac-apply
description: Build a whole skin from one design file with one command
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Apply a design

The short path: write ONE `design.json`, run ONE command. Use it once you know the panels (skill `ac-panels`) and have the assets.

```
aclivery apply design.json --check        # lists every mistake, draws nothing
aclivery apply design.json                # assets -> textures -> contact sheet (+ comparison if "brief" is set)
aclivery apply design.json --export       # also ui_skin.json, preview.jpg, DDS and the Content Manager zip
```

Output goes to `assets/builds/<name>/` (`work/` PNG textures, `sheet.png`, `compare.png`, `dist/`), or `--out`.
It is rebuilt from scratch every run, so the design file is the single source of truth: change the file, run again.
`aclivery apply --help` has the full format; the example below shows its shape (panel names and numbers are placeholders: take yours from `aclivery panel list`).

```json
{ "car": "<car id>", "name": "Skin name", "brief": "<project slug, optional>",
  "colors": { "accent": "#336699" },
  "assets": { "logo": "assets/logos/logo.png",
              "mark": { "file": "assets/logos/mark.png", "prep": { "keyBg": true, "tint": "#222222", "trim": true } } },
  "textures": {
    "ext_main":    { "fill": "#f6f6f6", "elements": [
        { "panel": "<panel A>", "image": "logo", "at": [0.1, 0.2, 0.4, 0.5] },
        { "panel": "<panel B>", "color": "accent" },
        { "panel": "<panel C>", "text": "A. DRIVER", "ink": "#222222", "bold": true, "at": [0.2, 0.7, 0.5, 0.1] } ] },
    "<cut-out role>": { "fill": "transparent", "size": "WxH", "elements": [
        { "panel": "whole", "color": "#ffffff", "at": [0.05, 0.1, 0.2, 0.6],
          "lines": [ { "text": "7", "ink": "#111111", "bold": true, "at": [0.1, 0.1, 0.8, 0.8] } ] } ] } } }
```

- **Layers.** Order in the file does not matter across layers. Drawn first to last: `tone` (quiet background art: grey ink, textures;
  logos may sit on it), `paint` (solid colours), `logo` (images), `text`. Set `"layer": "tone"` on the quiet art.
  Everything inside one layer is drawn in file order.
- **Overlaps.** Two logos or texts that would cover each other stop the run and name the element (`ext_main.elements[4]`).
  Move it with `at`, or add `"overlap": true` only when the reference shows it. Text lines of a card are allowed on their card.
- **Patterns (no original art needed).** `{ "pattern": "ink-lines", "panels": "visible", "density": 0.8, "seed": 1 }` draws faint vines and
  feathers on every well-seen panel: the placeholder for quiet tonal art. `"splatter"` and `"brush"` give bold strokes (use them for
  accents, with a colour). `panels` is a list of panel names or `"visible"`; same seed gives the same art; patterns never block logos.
  Tonal patterns: `ink-lines` (vines, feathers), `leaves` (soft grey leaf clusters, like the can's scrollwork), `cracks` (fine branching lines); bold ones: `splatter`, `brush`.
  Discreet is the default (a slightly darker tint at 0.7 opacity). `--check` warns if the ink would be too strong or cover too much of the body:
  fix the warning rather than overriding it. It is a placeholder; replace it with the real art when you have it.
- **Textures that already hold stickers** (the P92's `hr_generic`: windshield banner on top, safety markings below): use `"base": "<stock .dds or .png>"` instead of `"fill"`
  so only your parts change; give it the real `size`. A logo can be cut and cleaned in the design: `"prep": { "crop": [x, y, w, h], "keyLight": true, "keyBg": true, "tint": "#222222", "trim": true }` (for example `crop [0,0,1,0.7]` keeps the top rows of a lockup). `aclivery car stock <car> <role>` saves the car's own copy of a texture to `assets/stock/` (local, never committed). Export picks DXT5 on its own when the base has see-through parts.
- **Cut-out textures** (door plates): `"fill": "transparent"`; they are exported as DXT5 automatically.
- **Paths** are relative to the repo root. Colours are `#rrggbb` or a name from `colors`. `at` is `[x, y, w, h]` as fractions
  of the upright panel box; for a card's `lines`, fractions of the card.
- Do not add keys that are not in the help: unknown keys are errors on purpose (a typo would otherwise be ignored).
- Check where things land before building: `apply --check` prints each element's panel, rough size in cm, side and height. A name that
  comes out 5 cm tall, or sits above 0.9 m (roof edge, window strip), is on the wrong panel: probe it (`render --probe`) before building.
- Finish with `apply design.json --export`, then `validate skin` on the folder it prints.
- **Build in parts.** `apply design.json --only ext_main` rebuilds just that texture (the others stay as they were); then `--only door_plates,hr_generic,glass_2,le_god_grille`. A part build does not export or replace the work folder. Finish with a full build, then `--export`.
- **What `--check` cannot see.** "Cut off" uses a simplified outline of the panel: thin parts (bars, strakes) can read 0% while the render shows them right, so probe-render before moving them.
  A panel's box can hold other islands: whole-panel fills of two neighbours may stop the run as an "overlap" (add `"overlap": true` to solid fills), and a later fill whose box covers a thin part paints over it (put that element after the fill).
  Grey text on grey tonal art disappears: give it an `outline` (the references' light-grey letters have a dark edge).
- **Missing layers.** With `"brief": "<slug>"` in the design, the review lists analysis layers that nothing in the design answers, and places a layer names (hood, roof, doors...) where nothing sits. Fix each `missing:` line first: add the element, or record a decision in the brief for leaving it out. Add `"covers": "<word>"` to an element so it counts for a layer.
- **The fix loop.** Every `apply` prints a review line (round number, what was built, elements cut off, warnings) and what to do next. Do at least 3 rounds (more are fine while the differences are big): look at `compare.png`, name the 3 to 5 biggest differences
  (missing part, wrong size, wrong place, too faint), fix those in the design file only, run `apply` again. Probe a panel before moving something onto it (`render --probe`), and use the "nearest box" hint when an element is cut off.
  Do not rewrite the whole file between rounds. Finish with `apply --export` and `validate skin`.
- After a run: look at `sheet.png` / `compare.png` (skill `ac-render`), name the biggest differences, edit the file, run again.
  Not verified in the game: say so (skill `ac-skin-export`).
