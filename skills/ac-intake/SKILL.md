---
name: ac-intake
description: Start here: take the user's photos, find out what they want, ask when unsure
version: 0.2.0
license: PolyForm-Noncommercial-1.0.0
---

# Intake: start here

Use this first when someone asks for a livery. You are talking to a person, not filling a form: they know the livery and
the car, you know the tools. Your job is to look at **everything they gave you**, work out what is on the car, and ask them
about whatever the photos cannot tell you, one question at a time, until the next step is a command instead of a question.

```
aclivery status                                   what the machine has, and the usual next step
aclivery brief init <slug> --title "..." --car <id>
aclivery photos <folder> --brief <slug>           ALL the user's photos as numbered contact sheets, added to the brief
aclivery brief set <slug> references.N.view right    a view per photo, and what it shows:  references.N.notes "..."
aclivery brief show <slug>                        prints THE next step: a question to ask, or a command to run
aclivery brief add <slug> decisions '{"q":"Exact logo or simplified?","a":"exact","by":"user"}'
aclivery render <car> --regions                   coloured map of the car so the user can point at parts
aclivery car notes <car>                          what is already known about this car
```

## How to run it

1. `aclivery status`, then `brief init` (a short slug) once you know the goal in a sentence. Say it back to the user.
2. **Look at every photo.** Run `aclivery photos <the photo folder> --brief <slug>` and open every sheet it makes. Do not pick a few
   and skip the rest: one photo (often a view from above or a close-up) can be the only one that shows a part of the livery. For each
   number decide the view and write a one-line note of what it shows. Then tell the user in a few lines what you found
   ("15 photos: both sides, the front, the rear, one from above, some close-ups. I can see ...").
3. Loop: `aclivery brief show <slug>`. If it says **NEXT (ask the user)**, ask exactly that. If it says **do:**, run that command.
   `brief show` checks the basics for you: every photo has a view, and there is a flat side, the front, the rear and a view from above.
   A missing one is a question for the user ("I do not see the car from above. Do you have a photo?"), not something to skip.
4. **Ask the user when**: a part of the car or a logo you cannot find in any photo, or can find but are not sure what it is;
   text you cannot read; two photos disagree; a logo has no file in `assets/logos` (ask if they have it, or whether you may look for
   it; name the exact page and wait for the yes, see `ac-logos`); you would otherwise guess. Do not ask what the photos already show.
5. **How to ask (the human part).** One question per message. Plain words: "the left door", "the roof", "the little crest on the
   hood", never panel names or file extensions. Say what you saw and why you are asking, offer a default ("I think it is the Porsche
   crest; shall I use that?"), and make "I don't know, skip it" a fine answer. Point at the photo ("photo 3, near the top") or show a
   crop instead of describing it. If they cannot picture where something goes, show `render --regions` and let them pick by colour.
   Never ask them to run commands or choose technical settings.
6. Record every answer with the `set` or `add` line `brief show` prints, and every real decision with `brief add ... decisions`.
   The brief is your memory; you can lose your context and `brief show` restores it.
7. **If you truly cannot ask** (an automatic run with nobody to answer): take the default, add it to `decisions`, mark the layer
   `"assumed": "default: user not asked, <why>"` (see `ac-analyze`), and tell the user at the end what you assumed. If a view
   is missing and nobody can say, record it: `aclivery brief set <slug> viewsWaived '["top"]'`.
8. If something is missing on the machine (no car model file, for example), offer the fallback from `docs/user-journey.md`
   ("when something is missing") and say plainly what degrades.
9. Ask before any download or anything that leaves the machine (`ac-logos` has the rule).
10. **When you finish, tell the user in plain words**: what you built, what is a guess or a placeholder, what you left out and why,
    which images to open, and that nothing was tried in the game yet.

Do not keep a list of elements in the brief: the analysis layers (with their `source`) are the plan and `design.json` is the work (see `docs/agent-flow.md`).

When the photos all have views and the basic views are covered, `brief show` will ask for the analysis: use `ac-analyze` (study the
photos into layers, including the subtle ones). When it says nothing is missing, continue with `ac-livery` (place, render, ship).
