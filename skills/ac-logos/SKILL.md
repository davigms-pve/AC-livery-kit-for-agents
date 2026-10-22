---
name: ac-logos
description: Get and prepare logos for a livery (asks first)
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Logos

```
aclivery logo fetch <https url> --name monster          # prints a plan, exits 2: nothing downloaded yet
aclivery logo fetch <https url> --name monster --yes    # only after the user said yes
aclivery logo inspect assets/logos/monster.png          # size, transparency, background, warnings
aclivery logo prep <in> --out assets/logos/prepped/monster.png --key-bg --tint "#111111" --trim --size 2000
```

1. **Always ask before downloading.** Tell the user the URL, host and file name; wait for a clear yes. Then use `--yes`.
2. **Prefer vectors (SVG) or the brand's press kit**, then big transparent PNGs. Check with `inspect`.
   It warns about low resolution (under 800 px), flat backgrounds and missing transparency.
3. **Prepare for the car colour.** On a white car a white logo vanishes: recolour with `--tint`.
   `--key-bg` removes a flat background (white or any flat corner colour); `--trim` crops to the artwork.
4. A multi-colour logo loses its colours with `--tint`. Use `--tint` only for one-colour decals; otherwise just
   `--key-bg --trim`.
5. Files live in `assets/logos/` (gitignored). Logos are trademarks of their owners: do not commit or share them.
6. If `inspect` says the background is not flat, do not give up on the logo yet: run `logo prep ... --key-bg --trim` (flat background) or `--key-light --trim` (a baked-in checkerboard or a light backdrop that is not one colour),
   open the result on a dark background and look. A near-white background on a near-white body often needs no cutting at all. Place the logo if it looks
   clean. Only when it is clearly broken (a fake checkerboard baked in, ragged edges) do you stop; then record the gap in the
   brief, say so in the report, and ask for another source. Never drop a main sponsor silently.
