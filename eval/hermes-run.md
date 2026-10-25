# Hermes run (milestone M2): protocol

Set up 2026-10-23 at the owner's request ("set up a Hermes run"), which is the explicit go-ahead `docs/milestones.md` asks for. **Nothing has been launched yet.**
Purpose: find where a local model driving Hermes breaks on the kit, in small steps first, then the full flow. Fix the kit, not the prompt (same rule as `eval/haiku-run.md`).

Status of each fact: **[V]** verified by us on this machine today; **[R]** read from `hermes --help`, not run; **[?]** unknown, needs the owner.

## What is on this machine

- **[V]** Hermes Agent v0.21.5 at `C:\Users\davi_\AppData\Local\hermes\` (`hermes` is on the PATH); its config is `config.yaml` there. LM Studio's `lms` is installed but its server is off.
- **[V]** Hermes is configured with a LiteLLM proxy on the LAN (`http://192.168.100.116:4000`) and model aliases `role-pool`, `role-pool-home`, `role-pool-trial`, `role-pool-moises-trial`; the default model is `role-pool`. The providers listed are `GitHub Copilot`, `Anthropic`, `davipve-local` and `role-pool`.
- **Which model:** the owner says (2026-10-25) that `role-pool` runs **Qwen 3.8 27B**; we have not verified that (the session store records only the alias). The runs used the default alias, no provider or model flags. Not known: which model answers Hermes's `vision_analyze` calls.
- **[?]** Whether that model sees images. Reading the reference photos and the render needs vision (`--image` for one attachment, or the `vision` toolset, which may call a different model).

## Isolation (so the model cannot read an answer key or damage the repo)

`eval/hermes/make-sandbox.sh <dest> [slug]` builds a clean copy of the kit **[V: built at `C:\Users\davi_\GitHub\AC-livery-hermes-m2`, `status`, `brief show`, `car notes` and a render run in it]**:

- Left out: `.git`, `eval/`, `examples/`, `test/`, `tools/`, `AGENTS.md`, `docs/TODO.md`, `docs/session-log/`, `docs/research/` (except `brand-marks.md`, which `ac-logos` names), every other brief, every earlier run, demo and build output, the real `.aclivery/projects`.
- Kept: `bin/ src/ skills/`, README, the three docs the skills name, `node_modules`, the committed car map, the P92 car pack, `assets/logos` (with `prepped/`, see below), `assets/stock`, a fresh brief `m2-hermes-1` with the same 3 references and views as runs 2 to 5, and the 3 reference photos copied into `refs/`.
- The kn5 stays where the car pack says (`Downloads\AC AI\`), read-only at render time. `src/` is still readable (the kit needs it to run); the prompts forbid reading it, as in the Haiku runs.
- **Confound to know about:** `assets/logos/prepped/` holds marks cut out by earlier runs (the claw, the wordmark, GoPro, MOTUL, PORSCHE). Haiku run 5 used them, so its "real claw" was a file it found, not one it cut. The sandbox keeps them for parity with run 5; `NO_PREPPED=1 eval/hermes/make-sandbox.sh ...` leaves them out so cutting a mark out becomes part of the task.
- Hermes side effects to avoid: its `memory`, `skills`, `delegation` and `cronjob` toolsets write into the owner's Hermes home. The commands below enable only the toolsets the run needs and pass `--ignore-rules` (no `AGENTS.md`, `SOUL.md`, memory or preloaded skills injected) **[R]**. In one-shot mode "approvals are auto-bypassed" **[R]**, so the sandbox, not an approval prompt, is the protection.

## Order of runs

| Step | Prompt | What it tests | Pass looks like |
|---|---|---|---|
| T1 | `eval/hermes/t1.txt` + the right-side photo attached | can it read a reference at all (vision) | names the DELS 71 white card on the front of the door (with its frame, a sponsor strip and the web address under the number), the big grey Monster claw and the MONSTER ENERGY wordmark behind it, the cyan blot, the grey ink vines; separates sure from unsure. (Ground truth: our own reading of that photo, checked in a crop on 2026-10-23.) |
| T2 | `eval/hermes/t2.txt` | follow a skill to a small texture with kit commands | a `Door_Plates` PNG in `work/` with the white card, DELS and 71, on both plates, made with `apply` or `decal`/`text`, then a render |
| T3 | `eval/hermes/t3.txt` | one logo on one panel, then look and fix | the wordmark on the right door, upright, not covering anything, found through the notes/regions/probe tools, a render looked at |
| F | `eval/hermes/full.txt` | the whole staged flow | scored with `eval/rubric.md` (max 40), plus the list of skills opened, in order |

Run T1 to T3 first, one at a time; go on to F only if T2 and T3 get somewhere. Stop a run that loops (`--max-turns`, `--run-budget`).

## Launch (commands **[R]**, not yet run; fill `<PROVIDER>` and `<MODEL>` once the owner has said)

```
SB=/c/Users/davi_/GitHub/AC-livery-hermes-m2
P=/c/Users/davi_/GitHub/AC-livery-kit-for-agents/eval/hermes
# T1 (read the photo; no tools needed)
hermes chat --in "$SB" --query-file "$P/t1.txt" --image "$SB/refs/855000982_1094238246560196_2757428163464498714_n.jpg" --oneshot -Q --ignore-rules -t file --provider <PROVIDER> -m <MODEL> --max-turns 10 > "$SB/work/t1.txt"
# T2, T3 and F (kit commands and files; add vision to T3 and F if the model cannot see images itself)
hermes chat --in "$SB" --query-file "$P/t2.txt" --oneshot -Q --format stream-json --ignore-rules -t terminal,file --provider <PROVIDER> -m <MODEL> --max-turns 60 --run-budget 900 --checkpoints > "$SB/work/t2.jsonl"
```

`--format stream-json` writes every step as a line of JSON, so the transcript can be audited (the Haiku runs' transcript file was empty). Re-run `make-sandbox.sh` into a new folder for each run (it refuses to reuse one).

## Record per run

Provider and model, date, wall time, the `--max-turns` or budget hit, the first command that failed and its message, which skill wording it misread, the skills it opened in order, the output files, and the score. Write it as `eval/runs/<date>-hermes-<n>.md`.
