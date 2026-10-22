# Haiku run prompt (milestone M1)

Use this to run a small model (Haiku) end to end and then judge it with `rubric.md`. Run it as a subagent with
model `haiku`. The human prepares the inputs first. Replace the bracketed parts.

## Setup by the human (not the model)

- `npm install`; `aclivery car prep <kn5> --skins <skins>` done (the car pack exists); logos in `assets/logos/`.
- A fresh project: `aclivery brief init thiele71 --title "T. Thiele #71 Monster Energy Ultra" --car rss_gtm_protech_p92_f6`.
- Reference photos and their views registered, or left for the model to register (variant B, harder).
- Delete earlier outputs in the work folder you give the model.
- **Hide every other project's brief** (`.aclivery/projects/`): move them out for the run and back after. `brief list` shows them, and a finished brief is the answer key (run 1 leaked this way).

## Prompt

> You are a careful assistant making an Assetto Corsa car livery with a command-line kit. Working directory:
> `[repo path]`. Run commands as `node bin/aclivery.mjs <command>`. Use only the Bash tool and Read.
> **You may read only** `README.md`, `skills/*/SKILL.md` and `skills/README.md`, the docs those skills name (`docs/workflow-map.md`, `docs/user-journey.md`),
> the output of `--help`, and what `aclivery car notes <car>` prints. Do **not** read `src/`, `test/`, `eval/`, `examples/`, `docs/TODO.md`,
> `docs/session-log/`, or git history. Do not download anything. Write your files under `[work folder]`.
>
> The user's request: "Make the T. Thiele #71 Monster Energy Ultra livery for the car rss_gtm_protech_p92_f6. The reference
> photos are listed in the project brief `thiele71`. Logos are in assets/logos. Show me the result and tell me what is
> missing or uncertain."
>
> Follow the `ac-intake` and `ac-livery` skills. Keep the project brief up to date: record your analysis of the references, the elements and
> their panels, and each decision. You cannot ask the user questions in this run: when a skill says to ask, write the
> question and the default you chose into the brief's `decisions`.
>
> Finish with a short report (under 300 words): what you built, the commands you ran in order, what you could not do and
> why, what is approximate, and what you did not verify. Do not claim the skin works in the game.

## After the run

1. Open the render and compare sheet it made. 2. Score with `rubric.md`. 3. Write `eval/runs/<date>-haiku.md`. 4. Fix the
kit where the model stumbled (wording of a skill, an unclear message, a missing command), then re-run. Do not fix by
giving the model more instructions in the prompt: the point is that the repo alone is enough.
