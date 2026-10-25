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

## Steps (seven stages: the full table is in `docs/agent-flow.md`)

The brief is your only memory. After EVERY step run `aclivery brief show <slug>`: it prints the next step from what is recorded. If you lose your thread, run it.

1. **Intake** (`ac-intake`): car pack (`ac-car-prep`); look at **all** the user's photos (`aclivery photos <folder> --brief <slug>`) and give each a view (`ac-read-photo`). `brief show` checks a flat side, the front, the rear and a top view are covered, and a missing one is a question for the user. Ask the user whenever a part, a logo or a text is unclear or missing; one question at a time, plain words.
2. **Analysis** (`ac-analyze`): layers with `where` in the car's own words, `confidence` and `evidence`. Run `aclivery car notes <id>` first.
3. **Sourcing plan**: set `source` on every layer: `fetch` (a brand mark that exists as a file: never redraw it), `generate` (livery art with no file: a pattern placeholder), `construct` (text, numbers, plates, colours), `stock` (already on the car), `skip` (with `why`).
4. **Assets** (`ac-logos`): for every `fetch` layer find the brand's file in `assets/logos`, cut the mark out with `logo prep`, set the layer's `asset`. No file: ask the user for a source to download from; wait for the yes.
5. **Build in parts** (`ac-apply`, `ac-panels`): write `design.json` (`"brief": "<slug>"`, a `covers` word per element), `apply --check`, then `apply --only ext_main`, then the other textures.
6. **Fix rounds** (`ac-render`, `ac-verify`): `apply` prints a review. Fix every `missing:` line first, then the 3 to 5 biggest differences in `compare.png`; check each element against a reference crop with `ac-verify`. Do at least three full-build rounds (a part build with `--only` does not count); more are fine while the differences are big, stop when they are small.
7. **Ship** (`ac-skin-export`): `apply --export`, `validate skin`, then the report (`aclivery brief set <slug> report "<text>"`: placeholders, skipped layers and why, what is not verified in the game). `brief show` prints DONE only when both exist. A skin that was never packaged is not finished.

## Rules

- left/right are the car's own sides, as in the game. In the texture atlas the car's right side is the TOP strip.
- A skin can override several textures (the body texture, door plates, decals ...). The body is the default;
  pass `--texture <role>` for others (`aclivery panel textures <id>` lists them).
- Logos never overlap each other unless a reference or the user shows it. `decal`/`text` refuse to cover placed art;
  `--overlap` is only for a real exception (text on its plate card). The quiet tonal art is the lowest layer; with no original file, use a `pattern` element (skill `ac-apply`) as the placeholder.
- If a result looks wrong, probe before guessing: `aclivery render <id> --skin <dir> --probe <panel>` paints that
  panel magenta so you see where it is.
- If you cannot view images, do not claim a placement is right from command output alone. Probe the panel, check
  `panel get` extents, and tell the user which render to open.
- Say what you could not verify. Nothing here has been loaded into the game by this kit; the user checks
  in Content Manager.
