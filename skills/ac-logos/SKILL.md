---
name: ac-logos
description: Get and prepare logos for a livery (asks first)
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Logos

## How to find a brand's real file (the order to follow; the learning log is `docs/research/brand-marks.md`)

1. **Look locally**: `ls assets/logos`, `aclivery logo inspect <file>`. The mark may sit inside a lockup file and only need cutting.
2. **Search the web** (if you have a search tool) for the mark by name and format, in more than one phrasing; prefer the brand's own press kit, then a logo library (SeekLogo, VectorSeek, CDNLogo).
3. **Propose ONE candidate** to the user: page URL, the direct file URL exactly as it appears in the page (never guess one), host, file type, size, licence note, and what you could NOT confirm.
4. **Wait for the yes**, then `logo fetch <url> --name <name> --yes`.
5. **Look at the picture** before building on it (a title can lie: a result titled with a brand name and "claws" was a green cartoon hand). Wrong picture: delete the file and its `manifest.json` entry, say so, propose the next candidate.
6. **Prepare it** (`logo prep`), set the brief layer's `asset`, and **write the source and its problems** in the livery's `assets.md` and the lesson in `docs/research/brand-marks.md`.
7. No web search, or nothing found: ask the user for the file. Never fill the gap with a redrawn mark unless the user says so.

```
aclivery logo fetch <https url> --name <name>          # prints a plan, exits 2: nothing downloaded yet
aclivery logo fetch <https url> --name <name> --yes    # only after the user said yes
aclivery logo inspect assets/logos/<name>.png          # size, transparency, background, warnings
aclivery logo prep <in> --out assets/logos/prepped/<name>.png --key-bg --tint "#111111" --trim --size 2000
```

0. **A layer marked `source: fetch` in the brief needs a file in `analysis.layers[].asset`; `brief show` keeps asking until it has one.** **A brand mark exists: fetch it, do not redraw it.** A lion between two bars is Peugeot, a prancing horse is a car maker's crest: these files are public. Search for the official press kit or a vector (SVG) first, then well-known logo libraries; propose ONE source to the user (URL, host, file type, size if known) with the licence caveat (logos are trademarks; local, personal use only) and wait for the yes. Redrawing is only a stopgap for art that does not exist as a file (hand-drawn livery art).
   **One mark from a lockup file** (a brand symbol out of a logo that also has a wordmark): `aclivery logo prep <file> --crop x,y,w,h --erase x,y,w,h --key-bg --tint "#7d8085" --trim --out <png>`, or the same keys in a design asset's `prep`. Crop to the mark, erase stray bits of the next word, key the background, tint to the livery colour, look at the result on a light and a dark background. Do not use a `*_placeholder*` stand-in when a real file is in `assets/logos`. When there is no real file and the user allows a stand-in, set the layer's `asset` to it and record who allowed it in `analysis.layers.<i>.placeholder` (plus a decision); `brief show` then moves on and still lists it as PLACEHOLDER.
1. **Always ask before downloading.** Tell the user the URL, host and file name; wait for a clear yes. Then use `--yes`.
2. **Prefer vectors (SVG) or the brand's press kit**, then big transparent PNGs. Check with `inspect`.
   It warns about low resolution (under 800 px), flat backgrounds and missing transparency.
3. **Prepare for the car colour.** On a white car a white logo vanishes: recolour with `--tint`.
   `--key-bg` removes a flat background (white or any flat corner colour); `--trim` crops to the artwork.
4. A multi-colour logo loses its colours with `--tint`. Use `--tint` only for one-colour decals; otherwise just
   `--key-bg --trim`. `--grey` turns the colours to greys and keeps the light and dark (for quiet art); `--flip` mirrors a logo
   left to right (when a reference shows it mirrored on the other side).
5. Files live in `assets/logos/` (gitignored). Logos are trademarks of their owners: do not commit or share them.
6. If `inspect` says the background is not flat, do not give up on the logo yet: run `logo prep ... --key-bg --trim` (flat background) or `--key-light --trim` (a baked-in checkerboard or a light backdrop that is not one colour),
   open the result on a dark background and look. A near-white background on a near-white body often needs no cutting at all. Place the logo if it looks
   clean. Only when it is clearly broken (a fake checkerboard baked in, ragged edges) do you stop; then record the gap in the
   brief, say so in the report, and ask for another source. Never drop a main sponsor silently.
