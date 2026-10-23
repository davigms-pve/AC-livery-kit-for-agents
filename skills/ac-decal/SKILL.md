---
name: ac-decal
description: Place a logo or art on a named panel, upright
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Decal

```
aclivery decal <car> --panel left_mid --image logo.png --fill "#ffffff" --out work/EXT_Main.png --at 0.1,0.3,0.8,0.4
aclivery decal <car> --panel right_mid --image logo.png --base work/EXT_Main.png --out work/EXT_Main.png
```

First call starts the texture from a flat colour (`--fill`) at the texture's real size (8192x2956 for the P92 body;
`--size 2048` makes a fast small test). Every later call adds to it (`--base` = the same file). The base must keep
the real aspect ratio or art would stretch; the command refuses a wrong-aspect base.
One decal per call. You name the panel; the command applies the panel's rotation so the image reads upright.

- `--at x,y,w,h`: where inside the panel, as fractions of the upright panel (default fills 90%). The image
  keeps its aspect ratio and is centred in that box.
- Logos need to be prepared first: transparent background, right colour. Skill `ac-logos`.
- Do the same element on both sides with two calls (`left_*` and `right_*` panels); they are separate islands.
- Text on a panel tagged `mirrored` may come out reversed on one side. The render is the only check: look at both
  sides (`--views left,right`) and read the text.
- The panel `rect` is a bounding box, so art can land on empty atlas space (harmless) or touch a neighbour.
- Never edit the texture by hand with a pixel library. If a placement is wrong, change `--panel` or `--at` and re-run
  from `--fill`, or fix with a new decal; then `aclivery render` to look.
- The texture is the body texture by default; use `--texture <role>` for another (`aclivery panel textures <car>`).

## Text, cut-out textures and small textures

```
aclivery text <car> --panel right_rear --text "T. THIELE" --ink "#222222" --bold --base work/EXT_Main.png --out work/EXT_Main.png --at 0.25,0.78,0.5,0.06
aclivery decal <car> --texture door_plates --panel whole --color "#ffffff" --fill transparent --out work/Door_Plates.png --at <x,y,w,h of the card>
aclivery car size <car> door_plates 2048x640
```

- `text` draws the words, then places them like a decal (upright, aspect kept). Use `--ink` for the colour.
- Door plates and other small textures have a `whole` panel (and `left`/`right` when each side uses a different part).
  They are cut-out textures: start with `--fill transparent` and paint only the card or sticker, otherwise you cover the
  whole door. Take the card's position from the car's notes (`aclivery car notes <car>`) or the modder's template; do not
  reuse another car's numbers.
- A small texture's real size can differ from what the model embeds. Record it once with `car size` (from the template
  or a working skin); the decal command refuses a base with the wrong aspect ratio.
- `--under` marks quiet background art (tonal ink): logos may sit on it, so the overlap guard ignores it. `aclivery apply` does this for `"layer": "tone"`.
- The overlap guard compares art on the SAME panel only, and a solid `--color` is background: a logo may sit on a colour and a colour on a colour, but a colour placed over a logo is refused.
- `--color` paints a solid block: with no `--at` it fills the panel's island (it clears the pixels that belong to another panel's island inside the same bounding box, so it does not flood a neighbour), with `--at` it paints exactly that box (mirrors, wing endplates, a stripe). Paint the colour first, then the art on it.
