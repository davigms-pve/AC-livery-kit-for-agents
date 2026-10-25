---
name: ac-read-photo
description: Work out which view a reference photo shows, and what in it can be trusted
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Read a reference photo

Every reference needs a `view` (`aclivery brief add <slug> references '{"file":"...","view":"right"}'`). A wrong view makes every
later comparison meaningless (this happened in an early run: two photos were mislabelled). Do this before you record a view.
You must be able to look at the image; if not, ask the user for the view and do not guess.

## Which view

1. **Find the nose.** Windshield and hood slope down to the nose; the wing and the rear deck are at the other end. Headlights and the
   splitter are at the nose, tail lights and the diffuser at the back.
2. **Which side faces the camera?** In a side-on photo the nose direction gives the side, by the kit's rule:
   the car's `right` shows its right side with the nose on the RIGHT of the picture; `left` shows its left side with the nose on the LEFT.
   (The kit's own rule, from the `render` views; check with step 5.)
3. **Three-quarter views** use the side facing the camera plus the end facing the camera: `front-left` (nose and left side),
   `front-right`, `rear-left`, `rear-right`. Straight on: `front`, `rear`. From above: `top` (the roof strip; the wing is at one end).
4. **Camera height** decides what is visible: a low camera hides the roof and shows the doors tall; a high one shows the roof, hood and deck
   and shrinks the sides. A photo that is neither flat side nor top is the nearest named view; expect the framing to differ.
5. **Check the label, do not trust it:** render that view next to the photo (`aclivery compare <car> --skin <dir> --ref <photo> --views <view>`)
   and look: nose on the same side, same end facing you. If not, change the view and compare again.

## What in the photo can be trusted

- **Lettering and art on the car body**, read on the body panel itself.
- **Not the floor.** A glossy floor (a pit lane, a studio, our own render's floor) shows a copy of the car flipped top to bottom:
  text read there comes out upside-down and cannot be used. Our render's floor does it too (verified in the probe-grid render: the digits under the car are flipped).
  Read lettering from the body only.
- **Not the light.** A photo taken in strong sun, flash or HDR makes grey art look pale or white; in a dull light it looks darker.
  Do not make tonal art stronger because it looks faint in one photo (verified once: the owner's first in-game shot looked almost blank
  with HDR on and clear with HDR off).
- **Not the size of small things at the edge** of a wide photo (lens distortion and angle stretch them).

## Upside-down or mirrored?

- **Upside-down** text is rotated 180 degrees: it reads backwards and flipped top to bottom. Fix with `--rotate 180` on the element.
- **Mirrored** text reads backwards only left to right (like a reflection). `--rotate` does not fix it. For an image use `logo prep --flip`;
  for text, tell the user and record it as an open question. The kit does not detect mirrored islands (`decal --help`), so look at both sides.
- Always check with the numbered probe grid in `ac-apply` if unsure: digits that read 1 to 9 left to right, top to bottom, are upright.

## Write it down

Record the view in the reference, and in `notes` what is worth copying (`"notes":"flat side, a door sponsor and the number, nose on the right"`).
Say in the layer's `evidence` which photo and view you read the layer from (`ac-analyze`).
