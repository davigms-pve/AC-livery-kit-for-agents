# Which reference views answered which questions (findings, not rules)

Written 2026-10-21 after a simulated analysis step on the 15 photos the owner's brother supplied (`Downloads/AC AI/fotosamples`, Gran Turismo 7 photo-mode renders of the
Thiele #71 livery). One reader (Claude), no human check yet. The aim is to learn what a standard, minimal way to analyse a livery could be, **after** it gets things right
consistently. Nothing here is a rule. The structured result is in the local brief `fotosamples-sim` (gitignored); this note is the part worth keeping.

## What was done and what came out

- All 15 photos were read and turned into 22 analysis layers with `confidence` and `evidence` (the B23 fields). Confidence: 15 high, 6 medium, 1 low.
- `brief show` then asked the questions a person should answer: is the dotted "III" on the wing endplate the Monster claw (read by shape only), what are the tiny red/blue
  "N E" marks (low), is the Michelin sidewall lettering part of the livery (it is probably the stock tyre).
- **Verified (by us, from the images):** the inventory below. **Unverified:** the view label of every photo (read by eye; the compare sheet has not been used to check them), and every
  reading marked medium or low.

## What the livery turned out to be (beyond the first analysis)

Three different drawing styles of tonal art, not one: (1) large soft filled grey plumes (wings, feathers or leaves; a creature-like head on the wing tips), (2) thin black thorny vines
with small roses, (3) a fine crack/vein network on the roof. Plus cyan brush blots, cyan solid parts, the Monster claw (also as a dotted "III" on the wing endplates), the Monster lockup
in at least four placements and colourways (ENERGY in cyan, a flavour line that changes: ULTRA, ABSOLUTELY ZERO, ZERO ULTRA), the DELS door card, DELS wordmark in four places
(including the rear window and a dot-matrix front splitter), SC Hassel 1919 emblems, rear sponsors, "PAPA'S HOUSE OF GAME", the driver pillar text, and two glass banners.

## Which photo answered what

| Photo type (labels unverified) | What only it, or it best, showed |
|---|---|
| Straight front (`855000897`, cited 11 times) | nose, hood, bumper art, symmetric elements, windshield banner, SC Hassel discs |
| Flat side, right (`855000982`) | door layout, sill lettering, plate card position; the cleanest read of side positions |
| Close-up door (`853483001`, cited 10 times) | fonts and tiny text (the slanted 71, plate strip, vines and roses at line weight), logo colourways |
| Aerial (`854338175`) | roof claw, crack network, wing top lettering, rear window banner: no other photo shows these whole |
| Rear deck close-up from above (`854480141`) | wing underside text, "PAPA'S HOUSE OF GAME", deck-lid blots |
| Rear three-quarters and close rear quarter (`854670081`, `856273836`, `854826855`) | rear bumper sponsors, quarter art, wing endplate |
| Front/left three-quarters (`854670056`, `855602630`) | cited by no layer: they confirmed, but added nothing the other views did not show |

So for this livery: front, both flat sides, a top view and close-ups for small details covered everything except what is partly hidden (rear window, underside). Three-quarter views were the
most efficient for cross-checking placement between views, but they were not where new facts came from. Whether five canonical views plus on-demand close-ups would give the same
inventory consistently is a **test to run**, not a conclusion: do the analysis from the canonical subset only and compare it with the full 15.

## Where a layer goes is not a view, it is a part of the car

Every layer was placed by part (hood, roof, left/right door, rear quarter, rear deck, wing top, endplates, front bumper, sills, mirrors, windshield, rear window), not by photo. The car's own region
names (`aclivery panel regions`: front_bumper, hood_and_front_fenders, left/right_side, roof, rear_glass_deck, rear_bumper, wing, mirrors) already match that vocabulary, and a livery can
mix several textures: the body, `Door_Plates`, and separate glass and decal textures (names in `aclivery panel textures`; which one holds the banners is **not yet verified**).

## What it means for feasibility

- Reading the livery into a layer list: feasible, and most layers could be read with high confidence. The limits are volume (22 layers) and style (three hand-drawn styles).
- Reproducing it: the grey plumes and the logo family (Monster lockup in several colourways, DELS, SC Hassel, Porsche, Motul, GoPro) need original files or good substitutes; the generators
  made so far (ink-lines, splatter, brush) cover about three of the layers as placeholders. Missing generators: filled plumes, crack network, rose buds.
- Glass banners and the wing top need their own texture lookups before they can be built.

## Questions for the owner (from the brief)

Answered: the tiny "N E" marks are Neutral and Extinguisher pull indicators, copies of real race-car scrutineering markings (owner). That makes a recurring category, functional race-car markings (TOW arrows, N/E, battery cut-off), now listed in `ac-analyze`.
Answered by the owner (2026-10-21): the dotted "III" on the wing endplate is the claw; ULTRA belongs to the lockup (the Zero Ultra can reads MONSTER / ENERGY in light blue / ZERO ULTRA, and the flavour line varies by
placement); the grey filled shapes are most likely **leaves**. The owner also supplied the can (kept locally as `assets/refs/monster-zero-ultra-can.png`, not committed): white body, light-blue band, grey claw with a black outline,
and silver **leaf scrollwork** around the claw. That is the likely source of the livery's leaf art, the cyan, and the white base.

Tyres (owner: probably stock, asked us to check the mod files): **probably not part of the livery.** Verified from the files: the modder's template pack (`2D/`: Door_Plates, EXTERIOR_DECALS, EXT_Main, EXT_Main_N24_Spec_AO, EXT_Roof_2,
GT-M_Dashboard_Plate, HR_Generic_2, INTERIOR_DECALS, Le_God_Grille, Sticker_Extra_R) has no tyre PSD, and `RSS_GT_Tire_Diffuse.dds` sits in the car's shared `texture/` folder. The photos are Gran Turismo 7 renders, so their
Michelin lettering is GT7's tyre, not necessarily AC's. Not verified in the game.

## Where the banners and extra stickers live

**Verified 2026-10-21:** the windshield banner is the top band of `HR_Generic.dds` (mesh `GEO_BANNER_EXT`); `EXTERIOR_DECALS` and `EXT_Roof_2` are not used by this model. Details in `cars/rss_gtm_protech_p92_f6/notes.md`.
The rest of this section is the earlier reading of the modder's PSD layer names (superseded where it says otherwise):

- `EXTERIOR_DECALS.psd` (2048x2048): layers DIFF > Ext_decals, NK_Logo, **BANNER** (sub-groups GTWC, IMSA): the likeliest home of the windshield banner. The rear-window banner is unknown.
- `EXT_Roof_2.psd` (2048x2048): LOGOS, STICKER: roof stickers. `Le_God_Grille.psd` (2048x380): grille mask with TEXT/LOGOS: perhaps the dot-matrix DELS on the front splitter.
  `Sticker_Extra_R.psd` (1024x1024) and `HR_Generic_2.psd` (CAMERA, DECALS, PROTECH, TEXT...): unclear.
- The car pack lists `INTERIOR_DECALS`, `HR_Generic_2`, `Le_God_Grille` but not `EXTERIOR_DECALS` or `EXT_Roof_2` (the model does not embed them), so the kit cannot yet map panels on those two; finding which mesh uses them is the next step for banners.
