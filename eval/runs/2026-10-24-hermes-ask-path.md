# Hermes, ask-path run (normal mode, no photo from above), 2026-10-24

Second simulated-user run (the first is in `2026-10-24-hermes.md`). Kit at `1dae25c` (modes, plan check-in, first-draft gate, `photos`, view check, brand checks) plus nothing else; view-name validation (`d41fee8`) was added during the run and was **not** in this sandbox.
Sandbox `AC-livery-hermes-m2c`: 14 photos (the aerial photo `854338175`, the only one that shows the roof claw, left out), no brief, same start message, no read restrictions, the persona of `eval/hermes/user-persona.md` answered by the tester. Five turns, **228 tool uses, 40 minutes**. Logs: `AC-livery-hermes-m2-logs/sim3/`. Facts below are verified from the transcript, the brief, the design file and the renders.

## The conversation

| Turn | Agent | User (the tester, in persona) | Verdict |
|---|---|---|---|
| 1 (7 min) | Did the intake alone (`brief init`, `photos`, a view per photo), then asked: what word is on the black band along the side skirt? "My vision reads disagree" | "It says POTTSPEED." | A good question: the photos could not settle it, one short answer |
| 2 (12 s) | Recorded it, then: how involved do you want to be, check in a few times or do everything and ask at the end? | "Check in with me, that's fine." | Fine, asked after its own question although `brief show` listed it first |
| 3 (2.5 min) | **The plan, before building, in plain sentences**: what it will build, which marks it has files for, what it only has a stand-in for (the SC disc, "the whole grey vine/rose ink art: generated placeholder, not the real file"), what it will leave out. Ended "Sound good, or do you want anything changed?" | "Mostly good! The claw is big on the roof too, so add that, and leave the SC disc out. I'd like the website line under the door card as well." | The check-in worked as designed. The user noticed what was missing from the plan (no photo of the roof, so no roof claw) |
| 4 (20 min, 120 tool uses) | Recorded each answer as a decision "by user", built and checked on its own for two rounds, then showed a final list and asked "What looks wrong or missing to you?" | "The grey art looks better, that's closer! But the doors are missing the big claw next to the Monster word, and the door card should be a white box with a black border. Otherwise good. Please make me the zip." | A good draft message in plain words, with its own list of what is uncertain |
| 5 (10 min) | Fixed both, ran `apply --export`, `validate skin`, wrote the report into the brief, told the user which zip to drag onto Content Manager and what is unverified | (end) | `brief show` printed **DONE** |

## What worked

- The photo sweep and the plan check-in are used by a model and read well to a person. Honest limits were stated in the plan itself (the grey art is a rough likeness).
- It took the user's words: roof claw (no photo), SC disc left out, website line added, door claw and framed card. The roof claw is on the car in the top view; the grey art is soft grey leaf shapes in a lighter tone, much closer to the references than runs 1 and 2 (still not feathers).
- It found `apply --export` at once (the ship hint in `apply`), validated, wrote the report, and the brief reached DONE with the placeholders and skips listed. The zip has 7 files and validates.

## What went wrong

1. **It waived two views without asking.** `viewsWaived ["rear","top"]` was set by the model; the user was never asked "do you have a photo of the roof?" or of the rear. The rear photos exist: the model had labelled them with invented view names (`rear_close`, `right_rear`, `left_close`), which the sandbox's code accepted, so the kit saw "no rear". DONE then printed "views the user had no photo of: rear, top" as if the user had said so.
2. **It wrote a false review note.** `draftReviewed` was set to "Round 2 shown to user ..." before the user had seen anything (the user first saw the sheet in the turn 4 message). The kit cannot verify what happened in the chat, so any gate that takes a free string can be self-certified.
3. **The draft stop came after two rounds**, not after the first full build.
4. **Eight `"overlap": true` flags** again (the wing) and many hand-written `node -e` edits of `brief.json` and of `coverage()` imported from `src/commands/apply.mjs`, instead of `brief set`/`brief add`.
5. First run in this series where the plan, the draft and the zip all reached the user in the right order, but the order came from the model's own sense of the process; the kit's gates only recorded it (and once recorded it falsely).

## Score (builder's, biased): 34 / 40

Process 16 (views verified 1: invented names; kit commands only 1; overlap 1; brief kept up 1: the false draft note), output 14 (text and secondary logos 1, tonal art 1), honesty 4. The door claw and card were wrong in the first draft and right after one round of the user's feedback. Not comparable with runs 1 to 5.

## Kit changes this leads to

1. **Gates that quote the user.** `viewsWaived`, `planApproved` and `draftReviewed` become `{"asked": "<the question as you put it>", "answer": "<the user's own words>"}`; a bare string is refused. DONE prints the quotes, so a person can see what the user actually said. (A model can still invent a quote; the transcript audit stays the check, but the false note above would have had to be a visible lie.)
2. **Never waive a view for the user.** `viewsWaived` is accepted only with a quoted answer (above); `ac-intake` says "if you have not asked yet, ask and stop".
3. **View names**: done during the run (`d41fee8`): invented names are flagged, `detail` is allowed for close-ups, spelling variants are accepted.
4. **Draft stop earlier**: `brief show` asks for the draft review after the first full build even when other rounds look clean; `apply` round 1 already says so.
5. Generality (O13) is still the main open job: the grey art here is "closer" only because `leaves` at higher density happens to look like soft plumes on this car.
