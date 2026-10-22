# Improvement plan from the Opus run (2026-10-22)

Written by the Opus agent of run m1-opus-1 after building the livery, at the owner's request, to improve the repository (instructions, skills, tools, notes). [V] = it saw it in a file, a command output or a render in that run; [O] = its opinion. Sizes: S / M / L. The owner's first-pass reading is in `docs/TODO.md`. Spot-checked by us: the contradiction about the brief's elements list is real (skill `ac-analyze` still tells the agent to add elements; `docs/agent-flow.md` says not to). One error of ours it found: the run prompt said 18 photos; the folder holds 15.

# Improvement plan for the kit (from run m1-opus-1)

Tags: **[V]** = verified (seen in a file, a command output or a render in this run); **[O]** = opinion. Sizes: S / M / L.

## 1. Instructions and flow

1. **Round count disagrees between docs.** [V] `ac-livery` says "Three rounds, then stop", `ac-apply` says "Do 2 to 3 rounds", and the run prompt asked for at least 3. I hesitated over which one applied. *Change:* use one number (3 real rounds, extra rounds allowed) in `docs/agent-flow.md`, `ac-livery`, `ac-apply` and the `apply` review text. **S**
2. **Elements list: contradiction.** [V] `ac-analyze` ends with "turn each layer into one or more brief elements (`brief add ... elements`)". `ac-intake` and `agent-flow.md` say "Do not keep a list of elements in the brief". `workflow-map.md` step 4 still says "every subtle layer has an element". *Change:* delete the elements lines from `ac-analyze` and `workflow-map.md`. **S**
3. **Default output folder collides with forbidden folders.** [V] `apply` writes to `assets/builds/<name>` unless `--out` is given, and a new `--out` resets the round counter (`agent-flow.md`). I had to remember the same `--out` on every call. *Change:* store `build.out` in the brief on the first apply and reuse it; `brief show` prints the exact command. **S**
4. **Part builds count as fix rounds.** [V] The first `--only ext_main` build reported "round 1"; the final reported "round 8" for 4 real rounds. *Change:* count only full builds, and print "part build, round unchanged". **S**
5. **`brief show` dead end on placeholders.** [V] It said "a placeholder only if the user says so" but gave no field to record that. I added `layers[].placeholder` in `brief.mjs`. *Change:* keep it; mention it in `agent-flow.md` stage 4. **S** (done)
6. **No end state.** [V] When finished, `brief show` prints no NEXT line at all. A small model may loop. *Change:* print "done: exported, validated, write the report (list placeholders: ...)". **S**
7. **Skipped layers shown as built.** [V] `L26 [skip] ... built r8`. *Change:* show `skipped (why)`. **S**
8. **Where I guessed.** [V] The reference views were trusted as given. Car notes conflict on the deck panel: `centre_tail_upper_3` is called the "rear deck lid" in one section, `centre_tail_upper_5` in another. "Rotate" direction on mirrored-feeling panels needed trial and error (PAPA'S HOUSE: 180 was wrong). *Change:* a single per-panel orientation table (see 4).

## 2. Skills

1. **Write `ac-verify`** [O]: how to check one element against a reference: render the matching view, crop both to the same part, compare position, size, orientation, colour, and record the result in the brief. I did this by hand with sharp crops 10+ times. **M**
2. **Write `ac-read-photo`** [O]: how to work out the view from a photo (nose direction, which side, camera height), how to tell upside-down from mirrored, and why reflections on the floor are not evidence. My first read of the deck text was wrong. **S**
3. **Fold "cut a mark out of a lockup" into `ac-logos` as a worked example** [V]: the claw from `monster_logo.png` needed crop + erase + key + tint + trim, plus a light/dark check sheet that I scripted myself. **S**
4. **`ac-apply`: add a "probe first" recipe** [V]: the numbered-grid probe design (3x3 numbers per panel) answered the orientation questions in one render. Ship it as `apply --probe-grid <panels>` or as a documented snippet. **S**
5. **`ac-decal` text is wrong** [V]: "--color paints the panel" actually painted the bounding box (fixed in `decal.mjs`; update the skill). **S**
6. **Cut** [O]: the duplicated rules between `ac-livery`, `agent-flow.md` and `workflow-map.md`. Keep the order in one file and link to it from the others.

## 3. Tools

Build first: 1, 2, 3, 4.

1. **Overlap guard uses bounding boxes** [V]: solid fills on neighbouring panels stopped the run ("carbon on centre_nose_upper_2 would cover nose intake frames"). I set `overlap: true` on about 25 fills. *Change:* test overlap on painted pixels or outlines, and never between two `paint` fills. **M**
2. **"Cut off" false alarms** [V]: the cyan intake bars were reported "0% on painted surface" while the probe render showed them exactly there. The outline is a simplified polygon (29 points for `left_rear`). *Change:* store a raster island mask per panel in the car pack and test against it. **M**
3. **Keep-clear mask for patterns** [V]: plumes and blots land under and around logos ("ZERO" vanished on a grey plume; a blot covered PORSCHE). *Change:* patterns skip a margin round every logo/text box. **M**
4. **`compare` sheet unreadable** [V]: 8 rows at 1900x4480 are shown scaled to about 848 px wide. *Change:* `compare --each` (one file per reference) and `--crop part`. **S**
5. **Logo prep: `--flip` and `--grey`** [V]: tinting the Porsche crest and the SC disc gave flat blobs; the rear SC disc needed grey and became faded cyan. **S**
6. **Text inverse styles** [V]: MONSTER in the photos is light grey with a dark edge; the file is black with a white edge. An `--invert` option, or an outline on images, would fix it. **S**
7. **`render --each --out x.png` raw EEXIST** [V]: say "--each needs a folder". **S**
8. **Place words** [V]: "rear" alone does not count, so the missing rear-quarter disc passed the review. Add rear quarter, fender, sills and nose words to `PLACES` in `apply.mjs`. **S**
9. **`--check` opacity semantics** [V]: setting `opacity 0.8` on cracks raised the contrast warning (the default is 0.7). Print the default in the warning. **S**
10. **Probe needs labels** [V]: `--probe` paints magenta but says nothing about orientation; `--probe-grid` (numbers) is what answered my questions. **S**

## 4. Car notes and knowledge

- **Wrong** [V]:
  - the wing underside is white with dark PORSCHE, not carbon;
  - the hood lockup box `[0.30,0.70,0.40,0.26]` hides MONSTER under the dome edge;
  - the deck panel is `_3`, not `_5`.
  - Corrected this run in `cars/.../notes.md`.
- **Missing** [V]:
  - endplate outer face = lower half of the panel;
  - right door x=0 is the rear;
  - intake bars on `centre_nose` at x 0.35–0.40 and 0.60–0.65;
  - the door-plate mesh draws as a grey block until `door_plates` is built;
  - the B-pillar panel is still unknown.
- **Format** [O]: notes are long prose. A machine-readable `cars/<id>/layout.json`, one entry per part, would make the next run faster. Each entry: `{part, panel, texture, rot_extra, x_dir, y_dir, safe_box, verified_by}`. Example: `door_left: left_mid, x 0=front`. A design could reference `"part": "hood"` instead of a panel.
- **New car checklist** [O]:
  - grid probe renders of the 15 biggest panels;
  - a table of orientations;
  - which textures hold stickers (start from stock);
  - cut-out textures and their real sizes;
  - known hidden zones (dome lips, plate meshes);
  - "complete skin" checklist;
  - each line dated and tagged verified/unverified.

## 5. Quality of the result

- **Plumes** [V]: `leaves` makes small leaf clusters. The photos show large painted feather-wing shapes, much denser. A procedural generator will not match hand art [O]. Options:
  - ask the owner for the team's art file (best);
  - a traced plume stamp set placed by seed;
  - an image model generating a tileable plume sheet, which needs a licence and consent check.
- **Claw sharpness** [V]: the claw source is about 180 px wide, so hood and roof claws are stair-stepped. Fix: a vector claw (SVG) from the brand's press kit. That needs a download with the user's yes; the kit cannot invent it.
- **Typed stand-ins** [V]: DELS, POTTSPEED, LIFEPLUS, AM, PAPA'S HOUSE and the GT monogram have no files. Searches found SC Hassel candidates only (logowik, iconape; not opened). Ask the livery team for one asset pack; the kit can only typeset.
- **Cannot be fixed by the kit** [O]: in-game appearance (no reflections, normal maps or game loading); the art files.

## 6. Testing the kit

- **Log automatically** [O]: every command with its exit code, every render path, the build round, wall time, and the brief diff per step. This makes "did they compare after each fix" checkable.
- **Rubric** [O]: score per checklist item (present / right panel / right orientation / right size ±25%) against the reference views. Score placeholders separately. Penalise silent drops, not honest skips.
- **Run prompt** [V]: it said "18 photos"; the folder has 15. It said "use `compare` each round", but the sheet is too small to judge from. Fix both.
- **Keep** [O]: the brief as the only memory, the source-per-layer plan, the no-download rule, the forbidden reading list, and build in parts.

## Top 10 (most impact for a future run)

1. Raster island masks in the car pack; use them for cut-off checks and the overlap guard. [V]
2. A `layout.json` per car with orientation and safe boxes per part. [O]
3. `apply --probe-grid <panels>` (numbered grids). [V]
4. Keep-clear margin round logos for patterns. [V]
5. `compare --each` / `--crop` so the comparison is readable. [V]
6. Persist `--out` in the brief; count only full builds as rounds. [V]
7. One round rule and no elements list across all docs. [V]
8. `logo prep --flip --grey` and an inverse/outline option for image logos. [V]
9. An `ac-verify` skill (element-by-element check against a reference crop). [O]
10. An owner request template for the art pack (plumes, vector claw, team marks). [O]
