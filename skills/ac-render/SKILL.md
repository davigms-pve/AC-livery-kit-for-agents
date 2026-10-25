---
name: ac-render
description: See the car wearing a skin (headless, fast)
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Render

```
aclivery render <car> --skin <folder-or-file> [--views left,right,top] [--each] [--probe panelA,panelB]     (with --each, --out is a folder, not a file)
```

Draws the car with your textures, no GPU or game needed, about 2 s per view. Output is **one contact-sheet PNG**
by default (every view in one image); open it once, not six times. The path is printed.

- `--skin` is a folder of PNG or DDS files named like the car's textures (`EXT_Main.png`). A PNG next to a
  DDS of the same name wins, so you can preview work in progress.
- Views: `front-left front-right left right front rear rear-left rear-right top three-quarter`.
  `left` is the car's left. Pick the view that matches your reference photo.
- `--probe <panel>,<panel>` paints those panels magenta first. Use it to learn where a panel is.
- Render shows only what you override; everything else uses the car's own stock art.
- Known limits: no reflections or normal maps; the windshield banner and door plates are other textures, so
  they look grey unless you override them. 8 stock textures cannot be decoded and draw grey (the command says so).
- Default output is `.aclivery/renders/<car>-<time>.png`; the path is printed. Use `--out` to choose.
- If you cannot view images: do not claim a result. Use `--probe` and `panel get` to reason about placement and tell
  the user which image to open.
- This is a check, not proof the skin loads in the game.

## Compare with the references

```
aclivery compare <car> --skin work --brief <slug>
aclivery compare <car> --skin work --ref photo1.jpg,photo2.jpg --views right,front
aclivery compare <car> --skin work --brief <slug> --each --out work/cmp        # one image per reference, in a folder
aclivery compare <car> --skin work --ref photo1.jpg --views right --crop 0.1,0.3,0.4,0.4   # zoom on the door in both
```
`--each` gives one pair per image (easier to read than a tall sheet). `--crop x,y,w,h` (fractions) cuts the same box out of the
reference and our render and shows it larger, to read detail (a font, a logo's shape); use it with one pair.

One image: each reference photo on the left, our render from the same view on the right. Look at it and name the
differences (position, size, colour, missing parts); fix the biggest first. **Check the view for each reference:** a
wrong view makes the comparison meaningless (a reference showing the car's right side with the nose on the right is
`right`; nose on the left is `left`). Record references in the brief with their views:
`aclivery brief add <slug> references '{"file":"photo.jpg","view":"right","notes":"what to copy"}'`.
`aclivery render <car> --regions` shows a coloured map of the car for finding the right panel.
