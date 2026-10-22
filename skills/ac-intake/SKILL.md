---
name: ac-intake
description: Start here: find out what the user has and wants
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Intake: start here

Use this first when someone asks for a livery and you do not know what they have. Goal: one question at a time,
recording each answer, until the next step is a command instead of a question.

```
aclivery status                                   what the machine has, and the usual next step
aclivery brief init <slug> --title "..." --car <id>
aclivery brief show <slug>                        prints THE next step: a question to ask, or a command to run
aclivery brief set <slug> baseColour white
aclivery brief add <slug> references '{"file":"photo.jpg","view":"top"}'   a view per photo (flat side, door close-up, front, rear, top)
aclivery brief add <slug> decisions '{"q":"Exact logo or simplified?","a":"exact","by":"user"}'
aclivery render <car> --regions                   coloured map of the car so the user can point at parts
aclivery car notes <car>                          what is already known about this car
```

## How to run it

1. `aclivery status`, then `brief init` (pick a short slug) once you know the goal in a sentence. Confirm it with the user.
2. Loop: `aclivery brief show <slug>`. If it says **NEXT (ask the user)**, ask exactly that, in plain words, with a
   suggested default. Record the answer with the `set` or `add` line it prints. If it says **do:**, run that command.
3. Ask ONE question per message. Never list the whole checklist at once.
4. Do not use jargon. Say "the left door", not "left_mid". Say "the car's model file", not ".kn5", unless the user does.
5. If the user does not know where something goes, show them the map: `aclivery render <car> --regions`, then name the
   coloured parts. Let them pick by colour.
6. If something is missing, offer the fallback from `docs/user-journey.md` ("when something is missing"). The common
   one is no `.kn5`: ask who owns the mod; if it is unavailable, say plainly what degrades (no renders, no panel names).
7. Make "I don't know" a fine answer. Offer to explore: a quick flat-colour render, one element at a time.
8. Record every real decision with `brief add ... decisions`. The brief is your memory; you can lose your context and
   `brief show` restores it.
9. Ask before any download or anything that leaves the machine (`ac-logos` has the rule). Say what is approximate and
   not verified in the game.

Do not keep a list of elements in the brief: the analysis layers (with their `source`) are the plan and `design.json` is the work (see `docs/agent-flow.md`).

When the brief has references, `brief show` will ask for the analysis: use `ac-analyze` (study the references into layers,
including the subtle ones). When it says nothing is missing, continue with `ac-livery` (place, render, ship).
