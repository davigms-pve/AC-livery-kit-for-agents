# AGENTS.md

Rules for AI agents working **on this repo** (building the kit). For agents *using* the kit to make liveries, read
`skills/ac-livery/SKILL.md`.

## Ground rules

- Read `docs/TODO.md` (section 0) and `docs/architecture.md` first; `docs/workflow-map.md` has the order of things. Keep commands few, outputs short, and placement by named panel.
- Only `src/engine.mjs` may import from `liverykit`. Everything else calls it.
- Never commit game files or third-party artwork: `*.kn5`, `*.dds`, `*.psd`, `assets/`, `.aclivery/` are gitignored.
  A committed car file must be measurements only (`cars/<id>/panel_map.json`).
- Never download without the user's explicit yes. `logo fetch` already enforces this; keep it that way.
- Do not decrypt third-party models.
- Keep `LICENSE` (PolyForm Noncommercial), `NOTICE` and the README notice intact. New third-party code or dependencies need a licence check and a line in `NOTICE`.
- Mark every claim in docs as verified (by us, from a file or a run) or unverified (a write-up, a forum, memory).
  Do not state a game behaviour as fact unless it was tested in the game.

## Working

```
npm install
npm test                     # fast, no game data needed
node bin/aclivery.mjs --help
```

Smoke test on a real car needs the car's `.kn5` (not in the repo): `aclivery car prep <kn5> --skins <skins dir>`,
then `render` with a skin folder. See `docs/use-cases/rss-p92-thiele71.md`.

## When you add a command

Fewer is better. Before adding one, check whether a flag on an existing command does it. A new command needs: a
`help` string, a short output, tests that do not need game data, and a `skills/` entry if a model should use it.
