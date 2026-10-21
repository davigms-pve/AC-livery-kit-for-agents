---
name: ac-car-prep
description: Prepare a car pack from its .kn5 (one time)
version: 0.1.0
license: PolyForm-Noncommercial-1.0.0
---

# Car prep

```
aclivery car prep <path/to/car.kn5> --skins <path/to/car/skins> [--psd <modder EXT_Main.psd>]
aclivery car info <car-id>
```

Reads the 3D model once and writes a small pack to `.aclivery/cars/<id>/` (a few MB): measured panels,
a compact index, and optional UV/AO template PNGs from the modder's PSD. All other commands use the pack.

- Pass `--skins` (the car's `skins/` folder, containing any skin) so texture sizes are real. Without it the
  pack records the model's tiny embedded copies, and `EXT_Main` can show the wrong aspect ratio.
- The `.kn5` can be 60 MB or more. Do not open or print it; run the command and read its summary.
- If it says the model is CSP-encrypted, stop: panels cannot be measured. This kit does not decrypt
  third-party models. Tell the user to ask the car's author for an unencrypted copy.
- `car info` shows which texture is the body (`[body]`) and how many panels each texture has.
