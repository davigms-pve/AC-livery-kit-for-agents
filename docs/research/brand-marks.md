# Finding the real file for a brand mark (what we learned)

Written 2026-10-22. Rule of the kit: a brand mark (the Monster claw, a Porsche crest, MOTUL, GoPro, a club badge) is **fetched, not redrawn**. This page is the learning log of how that went:
what worked, what went wrong, and the procedure that came out of it. Claims are marked: **verified** = we downloaded or opened it; **unverified** = a search result or listing, not opened.

## The procedure (also in skill `ac-logos`)

1. **Look locally first.** `ls assets/logos`, `aclivery logo inspect <file>`: the file may already be there and only need cutting (`logo prep --crop --erase --key-bg|--key-light --tint --trim`). The Monster claw was inside the Monster lockup file.
2. **Search** for the mark by name and format, in more than one phrasing: `"<brand> <mark> logo svg"`, `"<brand> crest png transparent"`, the brand's own press kit or newsroom, a logo library (SeekLogo, VectorSeek, CDNLogo, LogoWik).
3. **Pick ONE candidate and say exactly what it is**: page URL, the direct file URL as it appears in the page (never guessed), host, type, size if shown, the licence note, and what you could not confirm ("the listing does not say it is the crest").
4. **Ask the user for a yes** (`logo fetch ... ` without `--yes` prints the plan and exits). Never download on your own. Never send user data to a site.
5. **After the yes: fetch, then LOOK at the picture** (`logo inspect`, render it on a light and a dark background). If it is the wrong picture, **delete it and its manifest entry**, say so, and take the next candidate with a new yes if it is a different file or site.
6. **Prepare it** for the livery (cut out, tint, size) and set the layer's `asset` in the brief. **Record** the source, the problems (size, soft, fan-made) in the livery's `assets.md`.
7. If nothing is found, say so and ask the user for the file. A placeholder is allowed only if the user says so, and the review keeps flagging it.

## What we tried

| Mark | Source | Result |
|---|---|---|
| Monster claw | SeekLogo "Monster claws" (`/vector-logo/342781/monster-claws`, EPS, direct PNG preview) | **verified: wrong picture** (a green monster-hand illustration). Deleted. The title was misleading |
| Monster claw + lockup | SeekLogo "Monster Energy Logo" (`/vector-logo/314234/monster-energy`, direct PNG `images.seeklogo.com/logo-png/31/1/monster-energy-logo-png_seeklogo-314234.png`) | **verified: right mark**, 600x600, green claw on a dark rectangle with a white wordmark; the claw is only about 165 x 245 px, so it is soft. Cut out in the design. A sharper SVG would be better |
| Monster lockup (colour wordmark) | pngaaa.com (the owner's URL) | **verified**: a checkerboard is baked into the image; `logo prep --key-light` cuts it out |
| PORSCHE wordmark | SeekLogo "PORSCHE Logo" (`/vector-logo/314112/porsche`) | **verified**: the wordmark only, no crest |
| Porsche crest | SeekLogo `/vector-logo/168544/porsche` (the most downloaded of 11 plain "Porsche Logo" entries), direct PNG `images.seeklogo.com/logo-png/16/2/porsche-logo-png_seeklogo-168544.png` | **verified (2026-10-22, owner's yes): it is the crest**, full colour on a transparent background, 320x320, with the PORSCHE wordmark under it. Soft at large sizes (320 px). Cut the crest with `--crop 0.05,0,0.9,0.82 --trim` |
| Porsche crest | Porsche newsroom "Media Package" zips (for example the 2023 crest release) | **unverified**: official but large, and which zip holds the crest files is not stated |
| VectorSeek, CDNLogo, LogoWik | listings for Monster and Porsche | **unverified**: marked non-commercial; unofficial copies of a registered trademark |

## Cautions

- These are registered trademarks. Files from logo libraries are unofficial copies; the kit keeps them local (`assets/` is gitignored) and for personal use, and never commits them.
- Titles on logo libraries mislead (see "Monster claws"). A listing is not proof: look at the picture before you build on it.
- A local model may have no web search. Then the fallback is the same: ask the user for the file or for a source to fetch from.
