---
name: ac-skin-export
description: Validate a skin and export a Content Manager zip
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Validate and export

```
aclivery export <workDir> --car <id> --name "T Thiele 71" [--alpha EXT_Main]
aclivery validate skin dist/<Name> --car <id>
aclivery validate dds <file.dds>
```

`workDir` holds the final texture PNGs named like the car's (`EXT_Main.png`), plus `ui_skin.json` and optionally
`preview.jpg`. Typical `ui_skin.json` keys are `skinname`, `drivername`, `country`, `team`, `number`, but community
sources disagree on exact names and this kit has not verified them: copy `ui_skin.json` from a skin that works on
that car and edit the values.

- `export` encodes each PNG to DDS (DXT1, or DXT5 for textures listed in `--alpha`) with a full mip chain,
  validates every DDS, and writes `dist/<Name>/` plus `dist/<Name>.zip`. It fails if a DDS is broken.
- Install: drag the zip onto Content Manager, then fully quit and restart Assetto Corsa (it caches skin names).
- Delete `cm_skin.json` from the skin unless intended: it can tint the body over the livery.
- A non-power-of-two size (such as the P92's 8192x2956) prints a note. The P92's own green skin of that size shows in
  the game's preview; for other cars it is unverified. Prefer a power-of-two size on cars you have not tested.
  Width and height should be multiples of 4 for DXT textures (the validator warns).
- **Not verified:** the kit never loads the skin in the game. Say so, and ask the user to check in Content Manager.
- Never print or paste DDS contents; they are binary. Use `validate`.
