# Workflow map: order of things, requirements, tools

The one page a model (or a person) can use to know what to do next, what must exist first, and which command or skill
does it. It exists so that local models do not have to re-derive the process each time. If a step is not on this page,
it is not part of the kit yet. Last updated 2026-10-21.

Legend: **built** = exists and was run; **partial** = works with limits; **gap** = not built.

The order, the memory and the exit test of each stage are in `docs/agent-flow.md` (the audit that produced it is there too).

## The pipeline

| # | Step | Skill | Needs before it | Command(s) | Produces | Done when |
|---|---|---|---|---|---|---|
| 0 | Orient | `ac-intake` | nothing | `aclivery status` | knows what exists | one next step named |
| 1 | Frame the ask | `ac-intake` | the user's request | `brief init` | a project (brief) | title and car recorded |
| 2 | Know the car | `ac-car-prep` | the car's `.kn5` (not CSP-encrypted); ideally a `skins/` folder | `car prep`, `car info`, `car notes` | a car pack (`.aclivery/cars/<id>/`) | `car info` shows the pack and the body texture |
| 3 | Gather references | `ac-intake` | photos or a description | `brief add references` (with view per photo) | references in the brief | each reference has a verified view |
| 4 | **Analyse** | `ac-analyze` | references | `brief set analysis` | layers (base, large graphics, **subtle tonal art**, accents, logos, text, plates, overlap rules), each with `confidence` and `evidence`; brands read by shape are confirmed with the user | `brief show` stops asking; no low-confidence layer is left; every subtle layer has an element |
| 5 | Get assets | `ac-logos` | the analysis (which assets are needed) | `logo fetch` (asks first), `logo inspect`, `logo prep` | clean logos in `assets/logos` | each logo element has a good file, or is marked "no asset" with a plan |
| 6 | Map the car | `ac-panels` | car pack | `render --regions`, `panel regions/list/get/textures`, `render --probe` | a panel (and texture) for each element | every element has a panel |
| 7 | Build | `ac-apply` (or `ac-decal` by hand) | assets, panels | `apply design.json` (checks, layers, rebuilds); or `decal`, `text` one element per call (`--overlap` only if the design shows it) | texture PNG(s) in a work folder | all elements placed |
| 8 | Look and compare | `ac-render` | a work folder | `render`, `compare` | contact sheet, reference-vs-render sheet | the biggest differences are named |
| 9 | Refine | `ac-livery` | the differences | steps 6-8 again | better textures | the user accepts, or time is up |
| 10 | Ship | `ac-skin-export` | final PNGs, `ui_skin.json` | `export`, `validate skin` | skin folder and zip | validation passes |
| 11 | Verify in the game | (the user) | the zip, Content Manager | none: a human check | confirmation or a screenshot | the user says it loads |

Between steps, `aclivery brief show <slug>` computes what is missing and names the single next step. Use it whenever the
state of the conversation is unclear.

## Order rules (invariants)

1. Analyse the references **before** placing anything. List the quiet layers too; they often carry the identity.
2. A panel is chosen **before** a placement; never compute UV coordinates by hand.
3. Place **one element per call**, then look. Render after every two or three placements, compare after every few.
4. Logos do not overlap each other unless a reference shows it (the `decal` guard enforces this; `--overlap` is the exception).
5. Do not download or send anything without the user's yes.
6. Textures other than the body (door plates, decals, banner) are separate: cut-out textures start transparent.
7. Check the view label of every reference before comparing.
8. Never claim the skin works in the game. Say what was verified.

## Requirements (what must exist, and how to get it if it does not)

| Requirement | Why | How to get it | If unavailable |
|---|---|---|---|
| Car folder id | everything is per car | the folder under `content/cars` | ask the user; screenshot of the car in Content Manager |
| Car `.kn5` | panels, renders | `content/cars/<id>/<id>.kn5` on the user's machine | 2D-only path (gap): template PSD + the user's eyes |
| `skins/` folder of the car | true texture sizes | any skin folder | pack records low-res sizes; fix with `car size` |
| Modder's template (PSD) | UV/AO, sticker layouts | the mod's download page | `render --regions` and `panel list` |
| Reference images with views | the target | the user | a written description; slower |
| Logos | sponsor artwork | `logo fetch` (consent) | skip or placeholder, say so |
| Tonal/ink art | the identity of art-heavy liveries | the team's original files; else placeholder pattern (gap) | state plainly that it is a placeholder |
| Node 20.9+ and `npm install` | the CLI | install | none |
| Content Manager | verification | the user | screenshots from the user |

## Tools (the CLI), at a glance

| Command | Purpose | Input | Output | Limits |
|---|---|---|---|---|
| `status` | where am I | none | machine state and next step | read-only |
| `brief init/show/set/add/list` | project memory and the next step | JSON values | `.aclivery/projects/<slug>/brief.json` | local to the machine |
| `car prep/info/size/notes` | one-time car pack; real sizes; per-car notes | kn5, skins, PSD | pack, notes | encrypted models refused |
| `panel textures/regions/list/get` | find the right panel | car pack | short rows | v-from-top rects; bounding boxes |
| `apply` pattern elements | generated placeholder art: ink-lines (quiet tonal art), splatter, brush; `--check` warns when not discreet | `{"pattern": ...}` in the design | PNG layers under the logos | placeholders, not the real artwork |
| `apply` | a whole skin from one `design.json`: assets, layer order, sheet, comparison, export | design file | work PNGs, sheet, zip | the design must name panels; art quality is up to the design |
| `decal` | image or solid colour on a panel, upright | panel, image/colour | texture PNG, placements sidecar | overlap guard; curvature warps art |
| `text` | names, numbers, lettering | text, panel | texture PNG | installed fonts only |
| `logo fetch/inspect/prep` | get and clean logos | https URL (consent) | `assets/logos` | trademarks stay local |
| `render` | see the car (contact sheet, `--probe`, `--regions`) | skin folder | PNG | no reflections or normal maps |
| `compare` | reference next to render | references + views | PNG | view labels must be right |
| `validate dds/skin` | check files | DDS, folders | issues in words | in-game behaviour unknown |
| `export` | PNG to DDS and a Content Manager zip | work folder | skin folder + zip | not game-verified |

## What is built, partial, gap

- **Built:** everything in the tables above.
- **Partial:** multi-texture designs (`apply` builds several textures from one file; the art for them is still thin), reference comparison (a person or model judges), curved panels (warp).
- **Gap:** tonal-art generation or photo-to-texture projection, a 2D-only path,
  automatic reference-view checking, plate/sticker layouts read from the PSD, in-game verification support.
  See `docs/TODO.md`.

## Per-car knowledge so nothing is re-learned

Each car with notes has `cars/<id>/notes.md` (committed; measurements and facts, no art) and `cars/<id>/panel_map.json`
(human regions). `aclivery car notes <id>` prints the notes. A model starting on that car reads the notes instead of
rediscovering which panel is the door. For a new car, write `notes.md` as you learn it; that is part of "done" for a car.
