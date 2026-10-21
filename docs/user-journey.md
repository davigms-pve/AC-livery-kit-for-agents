# User journey: from "I want a livery" to a skin in the game

Written 2026-10-21. This maps what a person experiences when they load this repo into an agent, including the common
case where they arrive without everything in hand and need to explore and decide together with the agent.
Items marked **(built)** exist today; **(gap)** are not built; **(unverified)** depend on testing with real users or
the game.

## Who arrives, and what they bring

| Persona | Typical opening | Usually has | Usually lacks |
|---|---|---|---|
| **The driver with a design** (our origin case) | "Put this livery on my car" + photos | car installed, reference photos, a rough idea of sponsors | the car's model file, clean logos, any idea what a UV is |
| **The team painter** | "Convert our design to this mod" | the modder's PSD template, vector logos, Photoshop skills | time; wants the agent to do the repetitive placement |
| **The newcomer** | "Make me a cool livery" | a car name, maybe a favourite team | everything else, including what they want |

Design for the newcomer; the other two simply skip questions. The agent must never need the user to understand
UV maps, DDS, or the kn5 format.

## How they arrive (entry points)

1. **An agent loads the repo** (Claude Code, Hermes with local models, etc.). The agent reads `README.md`, then
   `AGENTS.md`, then `skills/ac-livery`. The first command it runs is `aclivery status` **(built)**.
2. **A human reads the README** and wants to try it by hand. The README's quick start and command list serve them.
3. **A skill index is loaded** (Hermes `skills_list`). Descriptions are short enough to select the right skill.
   `ac-intake` is the "start here" skill.

## The journey, stage by stage

| # | Stage | The user is thinking | The agent does | Commands / files | Exit condition |
|---|---|---|---|---|---|
| 0 | **Orient** | "Where do I begin?" | Checks what the machine has, names the one next step | `aclivery status` **(built)** | Knows car packs, projects, logos present |
| 1 | **Frame the ask** | "I want X on my car" | Starts a project, restates the ask in one sentence, asks for confirmation | `aclivery brief init` **(built)** | A titled project exists |
| 2 | **Inventory** | "I'm not sure what I have" | Walks the checklist below, one question at a time, recording answers | `aclivery brief show` gives THE next question **(built)** | Each needed item is: have / get / skip |
| 3b | **Analyse the references** | "What makes it look like that?" | Lists layers: base, large graphics, **subtle tonal art**, accents, logos, text, plates, overlap rules | `ac-analyze`, `brief set analysis` **(built)** | Every layer, including the quiet ones, has a plan |
| 3 | **Fill gaps** | "I don't have the model file" | Offers the fallback for that gap (see matrix), says what it costs | `docs` matrix, skills | The blocker is resolved or the user chooses a degraded path knowingly |
| 4 | **Explore and decide** | "I don't know where things go" | Shows the car's layout, proposes placements with defaults, asks for a decision on each | `aclivery render --regions` **(built)**, `panel regions` | Each element has a target panel and a decision recorded |
| 5 | **Build** | "Show me" | Places one element, renders, compares to the references, adjusts | `decal`, `render` | A render the user recognises as the design |
| 6 | **Review** | "Is it right?" | Presents the contact sheet, lists what is approximate, asks accept / change | `render` sheet | User accepts, or lists changes (back to 5) |
| 7 | **Ship** | "How do I get it in the game?" | Exports, validates, gives the install steps, asks the user to check in Content Manager | `export`, `validate` | User confirms it loads, or reports what they see |
| 8 | **Afterwards** | "Can I tweak it later?" | Keeps the brief and work folder; can resume or fork for the next car | brief, work folder | Project is resumable |

Rhythm: the first render should appear within the first few minutes (flat base colour, one logo). Seeing the car early
turns an abstract request into a concrete conversation.

## Stage 2: the inventory, in the order it is asked

Ask one question at a time. Each has a default so "I don't know" is always an acceptable answer.

| # | Question | Why it matters | If "I don't know" |
|---|---|---|---|
| 1 | Which car? (name, or the folder under `content/cars`) | Everything is per car | Help find it: list `content/cars` on their machine; if no game, ask for a screenshot of the car in Content Manager |
| 2 | Do you have the car's model file (`<car>.kn5`)? | Panels and renders come from it | See "missing .kn5" below |
| 3 | What should it look like? Reference images, a description, a team? | The target | Ask for any one photo; offer to describe in words and iterate |
| 4 | Which parts of the design matter most? | Sets the order of work; avoids perfecting the wrong thing | Default: base colour, main sponsor, number, accents |
| 5 | Base colour? | Needed before anything | Read it off the reference; confirm |
| 6 | Number, driver name, team (for `ui_skin.json`)? | Shown in the car list | Leave blank; flag it as unfinished |
| 7 | Do you have logo files? | Sponsors need artwork | Offer to look for them (always asks before downloading) |
| 8 | Do you have a template or an existing skin for this car? | Gives true texture sizes, panel map, a working `ui_skin.json` | Not needed; skip |
| 9 | Can you open the result in Content Manager yourself? | The only real verification | Plan for them to send screenshots |

## When something is missing: the matrix

| Missing | Blocks | Ways to get it (ask the user which) | Fallback if truly unavailable | What degrades |
|---|---|---|---|---|
| **The car's `.kn5`** | Panel measurement, headless renders | In their game: `content/cars/<car>/<car>.kn5`. Ask the brother/teammate who owns the mod. Re-download the mod | **2D-only path:** the modder's PSD template (UV/AO) plus the user's own eyes in Content Manager; agent writes textures by region boxes **(gap: only partly built)** | No panel names, no rotation help, no render: every check becomes a human screenshot |
| **Model is CSP-encrypted** | Same as above | Ask the author for an unencrypted copy or a template pack. The kit does not decrypt third-party models | Same 2D-only path | Same |
| **Skins folder** | True texture sizes | Any skin folder of that car | Pack records the model's low-res sizes with a warning; sizes can be fixed later by re-running `car prep --skins` | Wrong aspect ratio risk (the decal command refuses a wrong-aspect base) |
| **Modder's template (PSD)** | Hand-labelled regions | Download from the mod's page | `render --regions` and `panel list` give the structure without it | Less human-readable region names |
| **Reference images** | The target | Ask for photos; web search **only with the user's yes** | Build from a written description | Slower convergence, more review rounds |
| **Logos** | Sponsor artwork | `logo fetch` (asks first), prefer SVG or press kit | Skip the element, or use plain text **(gap: no text-drawing command yet)** | Fidelity |
| **Text (names, number)** | Driver name strip, number | None built | The game draws the number from `ui_skin.json` on many cars; painted names need a text tool **(gap)** | Names/number are missing from the texture |
| **Other textures** (door plates, windshield banner, decals) | Parts that are not on the body texture | The template pack names them | `decal --texture <role>` works per texture, but the render only shows textures you override and no multi-texture design flow exists **(gap)** | Door plates and banners stay stock/grey in renders |
| **Game / Content Manager** | Real verification | Install, or ask someone who has it | Renders only; mark the skin "not verified in game" | Cannot confirm it loads |
| **A vision-capable model** | The agent looking at renders | Switch model, or let the user be the eyes | Text-only mode: probe, `panel get`, ask the user to open the render **(built: skills describe it)** | The agent cannot self-correct visually |

## Decisions the agent should put to the user (with a recommendation each)

| Decision | Recommendation | Why |
|---|---|---|
| Which textures are in scope | Body first; door plates and banner second | The body is most of the livery and the only fully supported texture today |
| Texture size | Keep the car's real size | Matches the original skin; any change is untested in-game on other cars |
| Faithful to the reference vs inspired by it | Ask early; default "recognisably the same" | Sets how much time goes into small details |
| Logos: exact brand art vs simplified | Exact if a good file exists, otherwise skip | Low-resolution or wrong-variant logos look worse than none |
| Number and names | Use `ui_skin.json` for the number unless the reference paints it | Fewer pixels to get wrong |
| Who verifies | The user, in Content Manager | The kit has not loaded a skin in the game |

Every decision is recorded: `aclivery brief add <slug> decisions '{"q":"...","a":"...","by":"user"}'`.

## Engagement principles (what makes it feel good, and work with small models)

1. **One question at a time**, always with a default and a recommendation. `aclivery brief show` names the single next
   step so a small model never has to remember the state of the conversation.
2. **Show before asking.** A render beats a paragraph. `render --regions` is the "map of the car" for users who do not
   know where the parts are; the user can say "the green bit" instead of knowing panel names.
3. **State lives in the brief, not in the model's context.** Decisions and open questions persist across sessions and
   across models (handy when a local model's context runs out).
4. **Say what is approximate and unverified**, every time, in plain words. Never claim the skin works in the game.
5. **Ask before outward actions** (downloads, anything that leaves the machine). Third-party artwork stays local.
6. **No jargon unless the user uses it.** "The left door" not "left_mid".
7. **Make "I don't know" cheap.** Each question has a fallback path; exploring is part of the flow.
8. **Short outputs.** Commands print a few lines; the agent summarises in a sentence or two.

## Exploring together (the "I don't know what I want" path)

1. Run `aclivery render <car> --regions` and show the coloured map; name the regions in plain words.
2. Ask what the user likes: a real car, a team, colours. Record it as a reference or a note.
3. Make a quick flat-colour version (base + one accent) and render it. Ask: closer or further?
4. Add one element at a time. After each render, ask one question: keep / move / remove.
5. When the user says "that's it", write the brief's remaining gaps as open questions, export, and hand over.

## Failure and recovery

| Moment | What the user sees | Recovery |
|---|---|---|
| `car prep` says encrypted | A clear refusal and the author-copy advice | Take the 2D-only path or get another file |
| A render looks wrong | A placement on the wrong part, or text reversed | `--probe <panel>` to locate it, adjust `--panel`/`--at`, re-render |
| Export validation fails | The exact header or size problem in words | Fix the named issue; never hand over a broken DDS |
| The skin does not show in the game | Stock livery or no skin | Checklist in `ac-skin-export`: folder path, restart AC, delete `cm_skin.json`, names |
| The local model loops or forgets | Repeated questions | `aclivery brief show` restores the state; `AGENTS.md` and skills are short on purpose |
| The user changes the goal midway | New design | `brief init` a second project on the same car pack |

## What we should measure (to improve the journey; unverified until real use)

- Time and turns to the first render; number of questions before it.
- How often the user answers "I don't know" and which fallback they take.
- Where a small local model leaves the happy path (which command, which message).
- Whether the user accepts the first render, and how many review rounds follow.

## Gaps this journey exposes (not built yet)

1. ~~A text command for driver names and numbers.~~ Built (`aclivery text`).
2. A **multi-texture design flow** so door plates, windshield banner and decals are handled with the body.
3. The **2D-only path** for users without the `.kn5` (use the template UV/AO and region boxes, human verification).
4. **Matching a render against a reference photo** from an arbitrary angle.
5. A way to **find the car** on the user's machine (locate `content/cars`), with consent.
6. A tested **install check** inside the game, which only the user can do today.
