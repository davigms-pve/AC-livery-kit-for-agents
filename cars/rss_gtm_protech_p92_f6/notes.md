# RSS GT-M Protech P92 F6 (`rss_gtm_protech_p92_f6`): what we know

Race Sim Studio mod of a Porsche 911 GT3 R (992 era). Facts below were verified on this car on 2026-10-21 unless marked.
Measurements only; no art. Re-run `aclivery car prep <kn5> --skins <skins dir> [--psd EXT_Main.psd]` to build the pack.

## Textures a skin can override

- **Body `EXT_Main.dds`**: 8192x2956 (role `ext_main`), 69 panels. The unmodified green skin of this size shows in the game's preview. Atlas: the car's
  **right** side is the TOP strip (rotation 180), the **left** side the BOTTOM strip (rotation 0). Texels are square at the real aspect ratio.
- **`Door_Plates.dds`** (role `door_plates`): 2048x640 per the modder's PSD (the model embeds 256x64: run `aclivery car size rss_gtm_protech_p92_f6 door_plates 2048x640`).
  Cut-out texture: transparent except a roughly square card per door at each end (left card x 0.021-0.221, right x 0.78-0.98, y 0.12-0.78 of the texture). Left door uses the
  left half, right door the right half. Panels: `whole`, `left`, `right`. Alpha is tested (DXT5).
- **Ready-to-use card boxes** for `decal/text --texture door_plates --panel whole --at x,y,w,h` (fractions of the `whole` panel, texture 2048x640):
  left door card `0.015,0.105,0.203,0.682`, right door card `0.783,0.105,0.202,0.682`. Put a white `--color` card there first (`--fill transparent`), then the
  text inside it with `--overlap`: "DELS" at the top (about the top 26% of the card) and the number below (about the lower 58%).
- Not yet handled: windshield banner, `EXT_Roof_2`, `EXTERIOR_DECALS`, `INTERIOR_DECALS`, side-skirt lettering textures (names and layouts in the template pack).

## Panels (role `ext_main`)

| Part | Panel(s) | Notes |
|---|---|---|
| Doors | `left_mid`, `right_mid` | visible 0.43 (mirror and wheel shield part of them); big, door-sized (~1.3 m); the plate card sits toward the front |
| Mirrors | `left_mid_lower_2`, `right_mid_lower_2` | verified by probe (rotation 90) |
| Rear quarters | `left_rear`, `right_rear` | large (11% of the atlas), vis ~0.97; wraps the rear wheel arch, so art warps |
| Hood | `centre_front` | rotation 90, vis 0.99; strongly curved; reads upright from the front |
| Nose | `centre_nose`, `centre_nose_upper_2` | rotation 90; wordmark was clipped here: check size and the exact panel |
| Roof | `centre_mid` | no rotation; arrow-up reads toward the rear |
| Rear deck / bumper | `centre_tail_upper`, `centre_tail_upper_3`, `_4`, `_5` | rotation 270 |
| Wing | `centre_tail` (main plane), `left_tail`, `right_tail` (endplates, rotation 0 / 180) | `centre_tail` is the biggest panel (16%) |

Regions (hand-drawn boxes by the user, aligned with the profile): 1 front_bumper, 2 hood_and_front_fenders, 3 right_side, 4 left_side, 5 roof,
6 rear_glass_deck, 7 rear_bumper, 8 wing, 9 mirrors. `aclivery render rss_gtm_protech_p92_f6 --regions` shows them in colour.

## Conventions and pitfalls

- `left`/`right` are the car's own sides. The `left` view has the nose to the left of the picture.
- Text and logos are upright with the panel's rotation applied by `decal`/`text`; verified on rotations 0, 90, 180, 270.
- Unpainted surfaces render dark grey in `aclivery render` (the renderer has no texture): the door-plate surface was dark until `Door_Plates` was overridden.
- 8 stock PNG textures cannot be decoded by the renderer and draw grey.
- `ALPHA` in the modder's `EXT_Main.psd` is the previous livery's graphics, not a paintable mask.

## Unverified

- Loading any exported skin in the game (the exported `Door_Plates.dds` at 2048x640 in particular).
- `ui_skin.json` key names; sizes other than the body texture.
- Panel for the rear-window pillar name strip; the side skirts; the windshield banner texture.
