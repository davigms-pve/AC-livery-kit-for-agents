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

## Design for any livery

- The T. Thiele #71 livery on the RSS P92 is the **test case, not the target**. The kit must adapt to other paint jobs, cars and photo sets.
  No check, default, prompt or skill may depend on its words (Monster, claw, DELS, Thiele, a panel name). Car-specific facts live in `cars/<id>/` and the brief; livery-specific
  facts live in the brief and the design file. Tests and the eval harness (`eval/`) may name the test case; `src/` and `skills/` may not.
- When a gap shows up in the test case (the soft grey feathers), fix it as a general capability (a procedural style, a way to extract or take art from a photo or a file, an honest
  limit the agent must state), then check it on a second, different livery. A fix that only helps the Thiele car is not done.

## Open items

- `docs/TODO.md` section 0 holds the **open items register**. Nothing that is still open may live only in the chat or in a memory note.
- At the start of a session, show the register and the next step. Before ending a session, or whenever the user reports something new
  (a game result, an answer, a decision), update the register in the same turn: close what is closed (say how it was verified),
  add what is new with an owner and a closing condition, and keep the dates.
- Items that wait on the user (a question to ask someone, a download to approve) stay in the register until the user answers. Say so at
  the next start; do not drop them silently and do not act on them without the answer.

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
