# Milestones

Decided 2026-10-21 by the project owner. Hermes with a local model is **parked** (a first impression was sub-par and
trials now would mostly measure the kit's gaps). The bar to reach before returning to it:

## M1: a small cloud model does it well enough from the repo alone

**Haiku**, given only the repo (README, `AGENTS.md`, skills, `--help` output) and the use-case inputs, produces a
recognisable Thiele #71 livery on the P92 without hand-holding. If a small, well-behaved model can follow the kit, a
local model has a fair chance; if it cannot, the kit (not the model) is what needs work.

How M1 is run and judged:

- Run: `eval/haiku-run.md` (the prompt) with a Haiku subagent. It gets the references, logos and the car pack (prepared by the human); it may
  not read `src/`, `docs/` other than the ones the skills name, or this repo's history.
- Judge: `eval/rubric.md`. A person (or a stronger model) scores the transcript and the output.
- **Pass:** at least 80% of the rubric points, no critical failure, and the result is judged "recognisably the same livery" by the owner.
- Record each run in `eval/runs/<date>-<model>.md` (scores, where it got stuck, what was changed in the kit as a result).

What has to exist before a meaningful M1 run (from `docs/TODO.md`):

1. The tonal/ink art problem has an answer (an asset source or a placeholder generator), otherwise the result cannot resemble the target.
2. ~~A single design spec and `aclivery apply` (C1)~~ built 2026-10-21 (`skills/ac-apply`); whether Haiku completes it reliably is what the run tests.
3. Reference-view checking (B12) and sensible default sizes (B15).
4. The analysis step and overlap guard (built).

**Status 2026-10-22:** by the builder's own scoring Haiku reached 29, 33, 34 and 35 of 40 across four runs (runs 3 and 4 above the 32 pass line) and Opus 37; the Opus build was loaded in the game and looks right apart from the door plate card (`docs/TODO.md`, B7). The owner has not yet judged "recognisably the same" for a Haiku skin; the next Haiku runs use the staged flow, which has not been tried with a model.

## M2: Hermes with the local model

**Status 2026-10-25:** run twice on 2026-10-23 and 2026-10-24 at the owner's request, with Hermes on `role-pool`, which the owner says is Qwen 3.8 27B (not verified by us). Builder's scores: 32 (restricted set-up), 33 (all photos, a simulated user) and 34 (normal mode, one photo missing) of 40, against Haiku's 35 on the same kit (`eval/runs/2026-10-24-hermes.md`, `...-hermes-ask-path.md`). The set-ups differ, so these are not a controlled comparison. Effort: the restricted run took 75 tool calls in 13 minutes (Haiku run 5: 62 in 14); the two conversation runs took 322 calls over about 54 minutes and 228 over 40, which include a real conversation and more photos. In those it worked around the kit more often than Haiku did (hand-written `node -e` probes, reading `src/`).

Original plan, kept for reference:

Narrow tasks first ("put DELS 71 on both plates", "what is on the left door?"), then the full flow. Needs the owner's explicit go-ahead
to interact with Hermes on this machine. Measure where it breaks; fix the kit, not the prompt.

## M3: adapt to other liveries, asks and vehicles

Design spec reuse across cars, auto region maps, other cars, cross-car transfer, benchmark of approaches. See `docs/TODO.md` section 4.
