# Use case #1: Thiele #71 "Monster Energy Ultra" on the RSS GT-M Protech P92 F6

The origin of this repo. A Hermes Agent run (local Qwen ~27B, with liverykit, GIMP MCP and Blender MCP) tried to produce this livery and failed. Source material came from the brother's run (`Downloads/AC AI/`); the files themselves are **not** committed here (copyright, size). This document records what we learned from them.

## The task, precisely

- **Car:** `rss_gtm_protech_p92_f6` (Race Sim Studio mod; a Porsche 911 GT3 R, 992-style). Same car for the template and the target.
- **Template skin:** a green "croc" livery already painted by the team on this car (`previewgreen.jpg`). Its `EXT_Main.dds` is the working base.
- **Target design:** a white/cyan Monster Energy livery with grey botanical ink art, sponsors (DELS, LIFEPLUS, POTTSPEED, Papa's House of Game, Motul, GoPro, Michelin, Porsche), driver "T. THIELE", number 71. The only design source is **15 reference photos** (Gran Turismo 7 renders from several angles), not a texture file.
- **So the job is:** *reference photos from many camera angles -> a correctly placed 8192x2956 UV texture on a 69-panel atlas.* This is not recolouring and not cross-car transfer; it is "reconstruct a design from views".

Legend: **[V]** verified by us from a file; **[W]** claimed by the Hermes write-up (model output, unverified); **[H]** our hypothesis.

## What the files show

- **[V]** `EXT_Main.dds` (the file we were given) is the *green template skin*, not Hermes's deliverable: 8192x2956, **DXT5**, written by "GIMP-DDS", 14 mips, 32.3 MB; header has FOURCC flag set and `dwRGBBitCount = 0`. It matches `previewgreen.jpg`, so it very likely loads in AC. Non-power-of-two size is evidently accepted by AC for this car.
- **[V]** The atlas contains non-paintable regions (underbody, engine bay, brake ducts, grey) alongside the painted body panels; left/right sides are separate islands with different orientations visible in the picture (the right-hand mirror/endplate art is flipped).
- **[V]** `livery with cutouts example.png`: a human-made mask of the paintable regions with numbered boxes: 1 front bumper/splitter, 2 hood, 3 left side, 4 right side, 5 roof, 6 rear glass/deck, 7 rear bumper/diffuser, 8 wing (centre + endplates), 9 mirrors. The DDS alone does not say what is paintable.
- **[W]** Hermes's final output was DXT1 (BC1) from liverykit's `encodeDds`. This contradicts the template (DXT5) and is **not** evidence that "AC expects DXT1".
- **[W]** A PIL-style header gave AC's "invalid bpp value ... 0". Since the working template also has `dwRGBBitCount = 0` with the FOURCC flag, the likely cause is a header whose flags disagree (RGB flag set with no bit count), not the bit-count value itself **[H]**. A validator should check flag consistency.
- **[W]** `textRotation` per panel (left door 0, right door 180, hood 90, rear 0); GIMP MCP could read but not write DDS; `cm_skin.json` must be absent or it tints the body; AC caches skin names so restart.
- **[W]** liverykit's engine rejects non-power-of-two DDS; Hermes bypassed the gate with `renderTexture` + `composeLayers`. If true this is an engine gap for RSS-style mods.

## Lessons for the kit

1. **[W]** liverykit was already in the stack and `--from-kn5` produced a profile for this mod car (826 panels, 69 on `EXT_Main`). If so, this RSS mod's kn5 is not CSP-encrypted, and the encrypted-mod blocker did not apply to use case #1 (other mods may differ).
2. **[H]** The failure is probably not "no UV knowledge". More likely candidates: turning 15 photos into placements on named panels, producing fine art (ink line art, cyan splatter, text on curved surfaces), orientation, or verification. We have **not** seen Hermes's output or logs, so the actual failure mode is unknown, and that decides which tool to build first. (liverykit's docs argue placement needs eyes; the brother's model is said to be vision-capable, so whether vision was in the loop is unknown.)
3. **[H]** Likely missing pieces:
   - a **headless "render this skin on this car -> PNG at standard angles"** tool, so photos and render can be compared;
   - a **panel semantic map** ("panel 3 = left door+quarter", orientation, mirror partner) delivered as a compact, model-friendly document, not 826 raw panels;
   - **photo-to-panel evidence**: for each sponsor/art element, which panel, where, how big, which orientation, derived from the reference photos;
   - **asset preparation**: logos/decals as clean cut-outs; ink-art either generated (image model) or vectorised.
4. Verification must be programmatic first (bounds, orientation, DDS validity) and visual second (VLM compares render vs reference photo from the same angle).
5. File-format gotchas to encode as tools, not prose (to be verified against a skin that actually loads): DDS header flag consistency, DXT1 vs DXT5 (the working template is DXT5), mipmaps, non-power-of-two sizes, `ui_skin.json` fields, `cm_skin.json` removal, AC name caching.
6. **[H]** Cross-car transfer may reduce to this same problem: render car A's skin from fixed angles and treat those renders as the "reference photos" for car B. If so, "edit" (MVP) and "transfer" (phase 2) share one pipeline: render from several angles, compare to references, place art at panel level.

## The modder's template pack (`GT-M_Protech_P92-Templates-v2`) **[V]**

Found in `Downloads/AC AI/` (317 MB zip). It is the **official PSD template pack for the mod, not a kn5**: no mesh, no `.kn5`/`.obj`/`.fbx` anywhere in it.

- `2D/EXT_Main.psd` (192 MB, 8192x2956, 36 layers; layer tree read with ag-psd, no pixel data loaded): groups `MULSANNE` (graphics/logos/names), `AO` (ambient occlusion + a `MAP` group), `LOGOS MASKS` (hidden; IMSA and GTWC mandatory-logo masks plus an INFO guide), a hidden `ALPHA` mask and a hidden **`UV` layer (the wireframe)**.
- `2D/EXT_Main_N24_Spec_AO.psd` (spec/AO variant), plus smaller PSDs for door plates, decals, roof, interior, grille.
- `3D/EXT_Main.psd`: 4096x2048, a single raster layer; purpose unknown.
- `texture/`: ~140 stock DDS/PNG textures for the whole car (shared, not livery-specific).

What this gives us without a kn5: a human-authored **2D structure** (UV wireframe, AO, alpha/paintable mask, mandatory-logo masks) of the exact atlas. What it cannot give us: 3D positions, so no rendering of the skin on the car, and no automatic "which panel is the left door".

## Spike results (2026-10-21) **[V]** - all run by us, on this machine

Inputs: `rss_gtm_protech_p92_f6.kn5` (60 MB), the green template `EXT_Main.dds`, liverykit @ `f5c56b8` (cloned to a scratch dir, `npm install`, Node 22).

1. **The kn5 parses and is not encrypted.** Header `sc6969` v6, 159 embedded textures, 407 meshes; parsed in ~0.1 s.
2. **liverykit works on this mod car.** `--explain` ranks `EXT_Main.dds` as the body (confidence 0.92, 69 islands). `--from-kn5` produced a profile in ~11 s: 57 paintable textures, 826 panels, 101 excluded (matches the Hermes write-up, which is now corroborated). The profile is 1.5 MB.
3. **Side and orientation inferences confirmed by the profile**: panels named `right_*` (3D x < 0) are in the *top* strip (our region 3) with `textRotation` 180; `left_*` are in the bottom strip (region 4) with rotation 0; `centre_front` (hood) is 90; `centre_tail` has none. Per-panel `visible` (ray-cast fraction) is available too, e.g. `left_mid`/`right_mid` (the doors) only 43% visible.
4. **A headless render exists and works.** liverykit ships a Node software rasterizer (`src/engine/shot.mjs`, named views). `tools/render-skin/render_skin.mjs` feeds it the green template skin plus the car's own stock textures: **~2 s per view**, no GPU, no browser, no GIMP/Blender. The front-right render (same angle as `previewgreen.jpg`, which is a front-*right* three-quarter) matches it closely: shark teeth, #77 hood panel, red mirror, wing and endplate, right-side croc art. Known differences: the windshield banner and door plates render blank/grey (they come from textures other than `EXT_Main`), no reflections or normal maps. Eight stock textures are undecodable by the renderer (`Cable_Tie_V1.png`, `RSS_Styro_Padding_2.png`, `Seamless_Belt_TX_V3.png`, `pipe.png`, `GEO_Cockpit_LR.png`, `INT_DISPLAY2.png`, `RSS_Lock.png`, `RSS_Safety_Glass.png`), all PNGs.
   - **Not proven:** matching a render against the GT7 reference photos, which come from arbitrary angles; and the skin loading in the game.
5. **Scope is the whole skin texture set, not just `EXT_Main`.** The target's most visible elements (DELS #71 door plates, the Gran Turismo windshield banner, decals) live in other textures (the pack ships `Door_Plates.psd`, `EXT_Roof_2.psd`, `EXTERIOR_DECALS.psd`). The render must apply every DDS override in the skin folder, as AC does, and the panel map must be per texture. This spike's render overrides only `ext_main`.
6. **DDS size (open question, not a requirement).** liverykit's `toDDS` refuses non-power-of-two output (`src/engine/pipeline.mjs`), which Hermes had to bypass for the 8192x2956 template. UVs are normalised, so a power-of-two output (e.g. 8192x4096) maps the art identically, and skins often override at a different resolution from the kn5's embedded copy. Whether AC loads an NPOT skin with a full mip chain is true of the template (it loads in-game) but only an in-game test on the brother's machine settles what our writer should emit. Do not build a custom DDS writer on this until then.
7. **PSD extraction** (`2D/EXT_Main.psd`, 192 MB) takes ~2.5 s with ag-psd and yields the UV wireframe, AO and a layer mask as ~4.5 MB of PNGs. The PSD's `ALPHA` layer is the previous livery's graphics, not a paintable mask; the paintable mask comes from the checkerboard in the cutouts PNG.
8. **The cutouts image is not the full atlas.** It is the atlas rendered at 541 px height with ~92 px cropped off the left (estimated +-3 px: confirmed because the mirror panels' `rect` falls inside the user's region 9 box only with that offset). Boxes and mask are converted accordingly in `cars/rss_gtm_protech_p92_f6/panel_map.json`.
9. **Mirror panels located by probe render**: painting `left_mid_lower_2` and `right_mid_lower_2` magenta lights up exactly the two mirrors. The probe technique (paint one panel a flat colour, render, look) is how a vision model can label unknown panels on any car, and should be a kit tool.

Consequence: the render-and-compare verification loop, the thing we feared we lacked, is viable on this car for the body texture today; extending it to the full skin set is the next step.

**Status of `tools/render-skin/`:** a spike script, not committable as is. It imports liverykit's internal `src/engine/*` modules by path (`LK` env var pointing at a scratch clone). Before it goes into the repo: pin liverykit (git dependency at `f5c56b8`) behind a thin wrapper, and make the agent-facing output one contact sheet (`shootSheet`, six views in one image), because with a vision model every image is a turn and that cost dominates.

## Pass 2 results (2026-10-21) **[V]**

Built only with the kit's commands (`examples/rss-p92-thiele71/build.sh`); compared with three references using `aclivery compare`.

- Door plates are their own texture (`Door_Plates.dds`); each door samples a different half. They are cut-out textures: a transparent canvas with a
  white card per door at the position from the modder's PSD (roughly square, about 20% of the texture width at each end). Done and matching the photos.
- Monster claw + wordmark behind the plate, in the right reading order, a placeholder claw on the hood, cyan mirrors and endplates: present.
- Still far from the references: no silver ink art, no cyan splatter or lower stripe, nose and bumper lettering wrong, name strip misplaced, no windshield
  banner. The detailed gap list and next steps are in `docs/TODO.md` (section 3).
- The comparison tool exposed my own mislabelled reference views immediately; labelling references is a step that needs checking.

## Open questions (blocking the next build step)

1. Does the team still have the **original design assets** (SVG/PNG logos, ink art, from the GT7 livery editor)? If yes, the job becomes placement, not extraction from photos.
2. What did Hermes actually produce? Needs `deliverable/EXT_Main.dds`, an in-game/CM screenshot, and the brother's description of what was wrong.
3. The brother's `lk/` folder (`livery.mjs`, `cars/rss_gtm_protech_p92_f6.json`, `render_ext.mjs`, any Hermes log). The profile is measurements only.
4. For a render spike: the car's `.kn5` (local use only, never committed) or confirmation the brother can run commands on his machine.

## Acceptance criteria for this use case

A tool-using agent (local model first) starting from the 15 photos and the template skin produces a skin folder that:
1. loads in AC / Content Manager without errors;
2. shows the base colour, mirror/endplate cyan, and the main sponsors on the correct panels and the right way up on both sides;
3. passes the programmatic checks (DDS valid, text inside panel bounds, no stock-livery leakage);
4. is judged "recognisably the same livery" by a human against the reference photos.
