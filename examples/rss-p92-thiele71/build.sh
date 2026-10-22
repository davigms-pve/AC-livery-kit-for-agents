#!/usr/bin/env bash
# Second pass of "T. Thiele #71 Monster Energy Ultra" on the RSS GT-M Protech P92 F6. The design lives in design.json; this
# only makes sure the placeholder claw exists, then builds, renders, compares with the brief's references and exports.
# A demonstration of the workflow, NOT the finished livery: the silver ink art, cyan splatter and the real Monster claw are
# missing (a crude placeholder claw is used), sponsor positions are approximate, and nothing was loaded in the game.
# Needs: a prepared car pack (aclivery car prep ...) and the logos in assets/logos (see assets.md).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$HERE/../.."
[ -f "$ROOT/assets/logos/claw_placeholder.png" ] || node "$HERE/make_claw.mjs" "$ROOT/assets/logos/claw_placeholder.png"
[ -f "$ROOT/assets/logos/sc_disc_placeholder.png" ] || node "$HERE/make_emblem.mjs" "$ROOT/assets/logos/sc_disc_placeholder.png"
# Stock textures the design starts from come from the car model (local only, never committed):
for role in glass_2; do [ -f "$ROOT/assets/stock/EXTERNAL_glass.dds" ] || node "$ROOT/bin/aclivery.mjs" car stock rss_gtm_protech_p92_f6 $role >/dev/null; done
# HR_Generic.dds is the modder's 512x512 file from the template pack: copy it to assets/stock/ by hand (the model only embeds a 380x380 copy).
node "$ROOT/bin/aclivery.mjs" apply "$HERE/design.json" --export --out "${1:-$ROOT/assets/demo/thiele71}"
