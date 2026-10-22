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

## Windshield banner, stock markings, and more panels (verified 2026-10-21 unless marked)

- **The windshield banner is the top band of `HR_Generic.dds`** (role `hr_generic`, panel `whole`). Found by listing the model's materials: `EXT_Banner` (mesh `GEO_BANNER_EXT`, 1.27 x about 0.33 m)
  uses `HR_Generic.dds`; confirmed by painting five colour bands on the texture and rendering (the top band showed on the windshield). Its UV area is u 0.007-0.993, v 0.018-0.226 from the
  top: in a `whole`-panel box that is `at [0, 0, 1, 0.212]`. The modder's template is **512x512** (the model embeds 380x380): `aclivery car size rss_gtm_protech_p92_f6 hr_generic 512x512`.
- The rest of `HR_Generic` is the stock sticker sheet used by body meshes (`GEO_EXT_HR`, arrows): an up arrow, orange arrows, a blue electrical-hazard triangle, a red-ringed "E"
  (extinguisher) and a yellow band along the bottom. Start that texture from the stock file (`"base": ...` in a design) so these stay. The yellow bottom band (v 0.655-1) colours the splitter and diffuser edges:
  painting it cyan gave the cyan splitter and diffuser edges seen in the references.
- `EXTERIOR_DECALS` and `EXT_Roof_2` (in the modder's PSD pack) are **not referenced by any material of this kn5** (all 126 materials checked), so they cannot be used here.
- `Door_Plates` aside, other textures with stickers: `HR_Generic_2` (also used by rear-camera parts), `Le_God_Grille` (128x32 grille), `INTERIOR_DECALS`. Not yet explored.
- Left side as seen in a labelled render: `left_front` = front fender; `left_mid` = the door; `left_rear` = the sill AND the whole rear quarter (one long panel; the sill is its lower strip, about the
  front 55% of its width); `left_mid_upper_2` = the strip along the roof edge over the side windows; `left_tail_upper_3` = the wing uprights; `centre_mid` = roof. The black C-pillar patch where the references
  show "T. THIELE" is **not** on any of these panels (the window frame is open): where it lives is still unknown.
- Rear: `centre_tail_upper` is the whole rear bumper strip, rotation 270 and wrapping the corners (upright about 3.1 x 0.6 m, so `at` x runs across the whole bumper and its ends curve round the sides):
  a first placement of the sponsors there came out bunched up and clipped. `centre_tail_upper_3` is the rear deck lid (about 1.9 x 0.6 m).
- Not verified: how any of this looks in the game.

## Hood, nose and rear bumper layout (verified 2026-10-21 with labelled-grid renders)

- **Hood `centre_front`** (rotation 90, upright about 1.6 x 1.65 m, read from the FRONT of the car): x runs from the car's RIGHT (0) to its LEFT (1); y runs from the windshield (0) to the nose (1).
  The island is a half-disc, wide at the windshield and rounded at the nose, so keep nose-end art narrow (the lockup fits at `[0.30, 0.70, 0.40, 0.26]`; the claw at `[0.32, 0.22, 0.36, 0.46]`).
  The rest of the panel's bounding box belongs to the fenders' islands: art there lands on the fenders.
- **Nose / front bumper cover `centre_nose`** (rotation 90, upright about 2.7 x 0.5 m, read from the front, 0.5 = the car's centre): the upper half is the band under the headlights where PORSCHE sits
  (`[0.33, 0.12, 0.31, 0.30]` with the prepared 14:1 wordmark gives about 85 x 6 cm). The lower half wraps the intake frame and the corners (where the SC Hassel discs are in the references).
- **Rear bumper `centre_tail_upper`** (rotation 270, upright about 3.1 x 0.62 m, read from behind, x runs from the car's left to its right, 0.5 = centre): the flat face is about x 0.12-0.88; the ends wrap round the corners.
  Upper half = the sponsor band under the tail-light bar (MOTUL left and right, the lockup in the middle, a pink 71), lower half = the dark bumper below (GoPro, left). `centre_tail_upper_3` = the rear deck lid (about 1.8 x 0.56 m).
- Use `aclivery apply --check`: it now says when part of an element's box is outside the panel's own painted island ("cut off").

## Pitfalls found on the way

- **Bug fixed:** `decal`/`text` squashed or cropped any non-square image on a 90 or 270 degree panel (hood, nose, rear bumper), because sharp rotates before it resizes. Earlier renders of wide logos there were wrong
  for that reason, not because of the layout. A regression test covers it.
- `assets/logos/monster.png` has a checkerboard baked into its background (no transparency). `aclivery logo prep --key-light --trim` cuts it out cleanly (black MONSTER, light-blue ENERGY, black ULTRA).
