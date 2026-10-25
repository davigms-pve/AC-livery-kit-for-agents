---
name: ac-verify
description: Check one placed element against a reference photo, then record the verdict
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Verify an element against a reference

Use it in the fix rounds (stage 6), after `apply` and before you change anything: one element, one reference, one verdict.
It replaces the habit of looking at the whole `compare.png` and "feeling" that it is close. You need to be able to look at images;
if you cannot, say so and do not claim a verdict (skill `ac-livery`, rules).

## Steps

1. **Pick the element and the reference that shows it best.** The layer's `evidence` in the brief names the photo and view
   (`aclivery brief show <slug>`). Read the photo's view first if unsure (skill `ac-read-photo`).
2. **Zoom on the same part of both.** Cut the same box from the reference and our render:
   `aclivery compare <car> --skin <build>/work --ref <photo> --views <view> --crop x,y,w,h --out <folder>/<name>.png`
   Fractions of the picture; for the door side view `0.1,0.3,0.4,0.4` is a start. The framing of a photo and of our fixed camera
   differ, so widen the box until the same landmarks (wheel arch, mirror, door cut line) sit in both, then judge the element.
3. **Check five things, in this order, and write one word for each** (`ok`, `off` or `wrong`):
   - **present**: is it there at all? (layer missing: add it)
   - **place**: which landmarks is it between? compare distances to the wheel arch, door line, roof edge, not pixels
   - **size**: its height against the door height or the wheel; the review prints about how many centimetres it is
   - **orientation**: upright, not upside-down, not mirrored (text reads left to right). `--rotate 180` fixes upside-down, not mirrored; to tell which, see the probe grid in `ac-apply`
   - **colour and tone**: same hue and about the same light or dark; quiet art should stay quiet. Judge tone with the lighting in mind: art can look pale in a bright render or photo and clear in a dull one
4. **One fix per `off` or `wrong`, in the design file only** (`at`, `rotate`, `opacity`, `color`). Do not change what is `ok`.
5. **Record the verdict** so the next round does not redo it:
   `aclivery brief add <slug> decisions '{"layer":3,"element":"logo on the hood","verdict":"fix","place":"ok","size":"off: too small","note":"raise to 0.3 wide"}'`
   When it is `ok` on all five, say `"verdict":"ok"` and the round it was checked in.
6. After the fixes run a full `apply` (that is a round), then check only what you changed.

## Do not

- Do not call an element verified from the command output alone ("cut off 0%" can be a false alarm on thin parts; a render shows it).
- Do not trust the photo's label for its view without the check in `ac-read-photo`.
- Do not verify in the game: nothing here has been loaded in the game by this kit. Say what was checked in the render only.
