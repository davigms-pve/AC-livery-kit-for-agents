---
name: ac-livery
description: Make or edit an Assetto Corsa car livery (skin)
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Assetto Corsa livery workflow

Use this skill when asked to create, recolour or modify a car skin for Assetto Corsa. You never paint pixels
by hand and you never open the `.kn5`. You name panels and call `aclivery` commands; they do the geometry.

Run `aclivery --help` for the command list. Every command prints short output; read it, do not guess.

**Invocation.** If `aclivery` is not found, run it as `node <path to this repo>/bin/aclivery.mjs` (same arguments).
Commands work from any folder: car packs, logos and defaults are found relative to the repo, not the current folder.
Give `--out` paths you can find again; without `--out`, renders go to `.aclivery/renders/` and exports to `./dist/`.

## Steps

0. **Start with `ac-intake`** if you do not yet know what the user has and wants: `aclivery status`, then
   `aclivery brief show <slug>` tells you the single next question or command. The brief is your memory.
1. **Know the car.** Get the car folder id (e.g. `rss_gtm_protech_p92_f6`). If `aclivery car info <id>` says
   there is no pack, ask for the car's `.kn5` and run `aclivery car prep <kn5> --skins <skins dir>` once.
   Skill: `ac-car-prep`.
2. **Know the design: analyse the references** (skill `ac-analyze`). List the layers: base, large graphics, **subtle tonal art**,
   accents, logos, text, plates, and what must not overlap. Do not drop the quiet details: they often carry the look.
   For each element decide which part of the car it goes on. Run `aclivery car notes <id>` first: it holds what is already known.
3. **Get assets.** Logos: skill `ac-logos`. Ask the user before downloading anything.
4. **Find the panels.** `aclivery panel regions <id>` then `aclivery panel list <id> --region <name>`.
   Skill: `ac-panels`. Prefer panels with high `vis` (visible from outside) and the right `side`.
5. **Place things.** One `aclivery decal` (or `aclivery text` for names and numbers) call per element, each adding to the same texture PNG.
   Skill: `ac-decal`. Once you know the panels, prefer ONE design file and `aclivery apply design.json` (skill `ac-apply`): it checks everything first, orders the layers and rebuilds the skin from scratch.
6. **Look.** `aclivery render <id> --skin <folder>` (one image, several views), and `aclivery compare <id> --skin <folder>
   --brief <slug>` (reference next to render). Name the biggest differences and fix those. Repeat 5-6. Skill: `ac-render`.
7. **Ship.** Always finish with a packaged skin, even a rough one, unless the user said not to: `aclivery apply design.json --export`
   (or `aclivery export`), then `aclivery validate skin <dist folder>/<Name>`. Skill: `ac-skin-export`. A skin that was never packaged is not finished.

## Rules

- left/right are the car's own sides, as in the game. In the texture atlas the car's right side is the TOP strip.
- A skin can override several textures (body `EXT_Main`, door plates, decals ...). The body is the default;
  pass `--texture <role>` for others (`aclivery panel textures <id>` lists them).
- Logos never overlap each other unless a reference or the user shows it. `decal`/`text` refuse to cover placed art;
  `--overlap` is only for a real exception (text on its plate card). The quiet tonal art is the lowest layer; with no original file, use a `pattern` element (skill `ac-apply`) as the placeholder.
- If a result looks wrong, probe before guessing: `aclivery render <id> --skin <dir> --probe <panel>` paints that
  panel magenta so you see where it is.
- If you cannot view images, do not claim a placement is right from command output alone. Probe the panel, check
  `panel get` extents, and tell the user which render to open.
- Say what you could not verify. Nothing here has been loaded into the game by this kit; the user checks
  in Content Manager.
