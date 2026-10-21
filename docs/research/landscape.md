# Landscape: agent-assisted livery creation for Assetto Corsa

Researched 2026-10-21 by four parallel Haiku sweeps; the liverykit claims were re-verified directly against the GitHub API and its README. Repo metadata (stars, licence, last push) comes from the GitHub API. Everything in the "Unverified" column or section is a lead, not a fact.

## TL;DR

1. **There is an existing project very close to our goal: [mishan/liverykit](https://github.com/mishan/liverykit)** (MIT, JS/Node, created 2026-08-06, last push 2026-10-19, 1 star, 30 commits, one author). It generates AC1 liveries from code, using named UV "panels" measured from the car's own `.kn5`, ships an editor, an `AGENTS.md`, and an MCP server design. Its core insight matches ours: *an LLM cannot guess UV coordinates; give it named panels*. Decide build-on vs. build-beside before writing any code (see Open decisions).
2. **Why the brother's attempt failed (hypothesis, not measured):** GIMP MCP and Blender MCP expose low-level operations (`execute_blender_code` = arbitrary bpy; 56 GIMP tools). A mid-size local model has to chain many correct calls with no UV knowledge. The fix pattern is few high-level deterministic tools plus a JSON spec rendered by plain code.
3. **No prior art found** for: LLM/diffusion-driven AC liveries, cross-car livery transfer tools, VLM-based panel matching, or an AC-specific `SKILL.md`. The space is open but the pieces exist.
4. **Hard gates:** (a) CSP-encrypted `.kn5` files (common in mods) block mesh/UV extraction; (b) cross-car transfer is a 3D problem; (c) the AC skin file spec is only documented by community folklore.

## 1. Closest existing project: liverykit

| | |
|---|---|
| URL | https://github.com/mishan/liverykit (companion: `mishan/liverykit-profiles`) |
| State | MIT, Node >= 20.9, `sharp` + `colord` + `ac-cardata`, DDS encoded in JS, CI on Linux + Windows, 1 star |
| Model | 4 layers: **car profile** (`cars/*.json`, UV islands named and measured from kn5) / **livery** (palette + treatments on named panels) / **fit** (per car+design placement) / **pack** (treatments) |
| Agent story | `AGENTS.md`, `docs/mcp.md`. Philosophy: *"Don't give the agent eyes. Give its output to the person who has them"* - the MCP **proposes** into a running editor, a human accepts. |
| Scope limits | AC1 only. Ships profiles for base-game cars. Mod cars need `--from-kn5` (needs the car's `.kn5`). Placement is judged by a human. |
| Risk | Single author, 10 weeks old, 1 star. Could be great or abandoned. |

How we differ: our users have **vision-capable** models (so a render-and-look loop is possible, which liverykit explicitly rules out), our primary cars are **community mods**, and we want **cross-car transfer** and a **model-evaluation** angle. liverykit is the strongest candidate for the deterministic engine; our value is the agent layer, mod-car handling, evaluation, and transfer.

## 2. AC skin format and file tooling

Verified (GitHub API): 

| Tool | URL | Notes |
|---|---|---|
| assetto-corsa-gltf | https://github.com/semiloker/assetto-corsa-gltf | MIT, pushed 2026-09-20. kn5 -> glTF/GLB, reads `skins/<name>/` overrides, `--list-skins`. `pip install`, headless. **Refuses CSP-encrypted kn5.** |
| kn5-blender-tools | https://github.com/nazariyKul/kn5-blender-tools | GPL-3.0, pushed 2026-10-03. Blender 5.0+ importer (UVs, textures, skins). |
| blender-kn5-addon | https://github.com/LKOLA/blender-kn5-addon | pushed 2026-06-05, Blender 5.1.2+, import+export. Licence ambiguous (README says MIT, API none). |
| moppius/blender-assetto-corsa-tools | https://github.com/moppius/blender-assetto-corsa-tools | GPL-3.0, kn5 exporter, Blender 3.x era. |
| Kn5Decrypt | https://github.com/SeizureSaladd/Kn5Decrypt | GPL-3.0, .NET 9. Decrypts CSP-protected kn5. **Legal/ethical decision needed** - author says only for content you own/have permission for. |
| Ortho | https://github.com/6wheel/Ortho | 213 stars, pushed 2026-07-05. Orthographic line-art sheets from AC models. Licence "Other". |
| Content Manager (actools) | https://github.com/gro-ove/actools | MS-PL, 794 stars, pushed 2026-10-01. Has a custom showroom/preview renderer; **no documented CLI for headless preview found**. |
| texconv | https://github.com/microsoft/DirectXTex/wiki/texconv | `winget install Microsoft.DirectXTex.Texconv`. `-f DXT1|DXT5|BC7_UNORM -m N -y -o`. |
| Pillow DDS | pillow docs | Reads DXT1/DXT5; writes DXT1/3/5 and BC2/3/5 (11.2.1+); no BC7. |

Skin structure (community-level, not an official spec): `content/cars/<car>/skins/<skin>/` with DDS overrides of the kn5's textures, `ui_skin.json` (skinname, drivername, team, number, country), `preview.jpg`, optionally `livery.png`. DXT5 w/ alpha for carbon (alpha channel drives it; RGB must stay white), DXT1 for opaque, max 4096 body / 2048 decals, kn5-internal textures are often 512^2 while skins ship 2048^2. Kunos templates live in `assettocorsa/sdk/dev/skin_templates` (Kunos cars only). Texture names vary per car (`SkinBase_DEFAULT.dds`, `Skin_00.dds`, `paint.dds`, ...).

CSP (Custom Shaders Patch) offers a real programmatic lever: per-skin `ext_config.ini` with `[SHADER_REPLACEMENT_...]` / `[MATERIAL_ADJUSTMENT_...]`, and the Custom Paint Shop that infers roles from texture filenames (https://github.com/ac-custom-shaders-patch/acc-extension-config/wiki). No JSON schema for colourable zones was found.

## 3. Agent tooling

| Tool | URL | Level | Notes |
|---|---|---|---|
| Blender MCP | https://github.com/ahujasid/mcp-for-blender | low | MIT, 31.8k stars, active. Core tool `execute_blender_code`. Open security issues #405/#406. |
| GIMP MCP (maorcc) | https://github.com/maorcc/gimp-mcp | mid | GPL-3.0, 274 stars, 56 tools, seeking maintainers, GIMP 3.2 regressions, `rgb()` string bug. |
| GIMP MCP (constant-itis) | https://github.com/constant-itis/gimp-mcp | mid | AGPL-3.0, 6 stars, sized for small local models, GIMP 2.10, Windows untested. |
| mcp_images | https://github.com/timaliev/mcp_images | high | MIT, 0 stars, Pillow+OpenCV, 25 tools. Unproven. |
| inkscape_mcp | https://github.com/aravindev/inkscape_mcp | high | MIT, 79 stars, SVG. |
| Others | opencv-mcp-server (stale), mcp-imagemagick (stale), photopea-mcp-server, krita-mcp | | lower priority |
| Hermes Agent | https://github.com/NousResearch/hermes-agent | - | MIT. Skills = dir with `SKILL.md` + YAML frontmatter (description <= 60 chars), progressive disclosure via `skills_list`/`skill_view`, MCP via `~/.hermes/config.yaml` `mcp_servers`. Its own AGENTS.md prefers "CLI command + skill" over new core tools. Claims agentskills.io compatibility (https://github.com/agentskills/agentskills). |

Small-model evidence is thin and mostly unverified (TinyLLM arXiv 2511.22138: Qwen3 small models score poorly on multi-turn tool-calling; snippets only). Treat "small models fail long tool chains" as well-motivated but not measured *for this task* - which is exactly why we should build an evaluation harness.

## 4. Cross-car livery transfer

Nothing ready-made. Options ranked by the cross-mesh sweep (feasibility, honest):

1. **Per-panel manual/semi-manual re-skin with orthographic guides** (Ortho + 2D editor). Most reliable; no 3D transfer.
2. **Orthographic projection of source livery then UV->UV bake on the target** via headless `bpy`. Best automation if both meshes extract and align. Mostly unverified.
3. **Blender Bake "Selected to Active"** (+ cage). Works when shapes are close; fragile otherwise. Paid addons (UVR Baker $5, Texture Transfer $14) add little.
4. **Layered vector spec re-applied per car via panel anchors** - this is the liverykit "portable design + fit" idea, effectively. Needs per-car panel profiles.
5. **VLM panel matching** - no prior art; research-grade.

A forum claim (unverified) says skins only convert cleanly when both models share UV mapping.

## 5. Gaps no one has filled

- AC skin spec (`ui_skin.json`, required files, naming) in a primary, authoritative form.
- Headless "render this skin on this car" for verification.
- CSP-encrypted mod cars: extraction story + legal stance.
- Any benchmark of local models on texture/livery tasks.
- Agent skills (`SKILL.md`) for AC modding.

## 6. Open decisions (need the user / advisor)

1. **Build on liverykit vs. independent engine vs. contribute upstream.**
2. **Primary spec representation:** panel-named JSON design (liverykit style) vs. raw texture editing vs. SVG layers.
3. **Verification:** human-in-the-loop (liverykit) vs. VLM render-and-check. Requires a headless renderer we do not have yet.
4. **CSP-encrypted mods:** support, refuse, or require user-provided unencrypted files?
5. **Model question (user's):** which model class is best suited? This is a hypothesis to benchmark, not a settled answer. Candidate arms: (A) tool-calling LLM + deterministic spec engine, (B) image-*edit* model working directly on the UV texture sheet, checked by render + VLM, (C) hybrid (image model makes decal/pattern assets, LLM places them via the engine). Each arm is scored on the same tasks, same cars, same verification render. Building that benchmark is a core deliverable of this repo.
6. **Spike before committing:** confirm on Windows that the target mod car's kn5 is readable (not CSP-encrypted), that liverykit builds/installs a skin, and that we have a headless "render skin on car -> PNG" command (kn5 -> GLB via assetto-corsa-gltf, then Blender `-b`, or screenshot liverykit's viewer). Without that render, vision verification, evals and transfer checking are all blocked.

## 7. Update after use case #1 (see `docs/use-cases/rss-p92-thiele71.md`)

- The brother's Hermes run **already used liverykit** on the RSS `rss_gtm_protech_p92_f6` mod (per the write-up, unverified): `--from-kn5` produced a profile, so that mod's kn5 was not encrypted. The encrypted-kn5 blocker did not hit use case #1; it may hit other mods.
- Reported liverykit gap: its engine rejects non-power-of-two DDS (the car's skin is 8192x2956 and works in AC). Hermes bypassed it by composing layers manually.
- The design source was **15 reference photos**, not a texture, so the core problem is photo -> panel placement + art production + verification, not UV discovery.
- Everything about *why* it failed is still hypothesis until we see Hermes's actual output.

## Unverified / caveats

Overtake.gg (the best AC modding source) returned 403 to every fetch, so forum-level knowledge of AC skin quirks is missing. Haiku reports mixed API-verified and snippet-only facts; snippet-only items are flagged above as unverified. Nothing in this document was executed.
