#!/usr/bin/env bash
# Second pass of "T. Thiele #71 Monster Energy Ultra" on the RSS GT-M Protech P92 F6, built only with aclivery
# commands. A demonstration of the workflow, NOT the finished livery: the silver ink art, cyan splatter and the real
# Monster claw are missing (a crude placeholder claw is used), sponsor positions are approximate, the windshield banner
# and side-skirt lettering are not done, and nothing was loaded in the game.
# Needs: a prepared car pack (aclivery car prep ...), logos in assets/logos, assets/logos/claw_placeholder.png,
# and optionally the project brief with references (aclivery brief ...) for the comparison at the end.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && (pwd -W 2>/dev/null || pwd))"
A="node $HERE/../../bin/aclivery.mjs"
CAR=rss_gtm_protech_p92_f6
LOGOS="$HERE/../../assets/logos"
OUT="${1:-$HERE/../../assets/demo/thiele71}"
WORK="$OUT/work"; rm -rf "$WORK"; mkdir -p "$WORK/prep"
CYAN="#4ec4d6"; BODY="$WORK/EXT_Main.png"; PLATE="$WORK/Door_Plates.png"
quiet() { "$@" >/dev/null; }

# --- logo prep: dark ink wordmarks read on a white car
quiet $A logo prep "$LOGOS/porsche.png" --out "$WORK/prep/porsche.png" --key-bg --tint "#222222" --trim --size 2000
quiet $A logo prep "$LOGOS/gopro.png"   --out "$WORK/prep/gopro.png"   --tint "#222222" --trim
quiet $A logo prep "$LOGOS/motul.png"   --out "$WORK/prep/motul.png"   --tint "#2a2a2a" --trim
MONSTER="$LOGOS/monster.png"; CLAW="$LOGOS/claw_placeholder.png"
[ -f "$CLAW" ] || (cd "$HERE/../.." && node examples/rss-p92-thiele71/make_claw.mjs "$CLAW")

# --- body texture (EXT_Main): white base, then one element per call
body() { # panel image at
  if [ -f "$BODY" ]; then quiet $A decal $CAR --panel "$1" --image "$2" --base "$BODY" --out "$BODY" --at "$3"
  else quiet $A decal $CAR --panel "$1" --image "$2" --fill "#f6f6f6" --out "$BODY" --at "$3"; fi; }
paint() { quiet $A decal $CAR --panel "$1" --color "$2" --base "$BODY" --out "$BODY"; }
words() { quiet $A text $CAR --panel "$1" --text "$2" --ink "$3" --bold --base "$BODY" --out "$BODY" --at "$4"; }

# Doors: Monster claw then wordmark (reading direction), plate sits ahead of it
body right_mid "$CLAW"    0.02,0.20,0.14,0.60
body right_mid "$MONSTER" 0.18,0.25,0.36,0.50
body left_mid  "$CLAW"    0.50,0.20,0.14,0.60
body left_mid  "$MONSTER" 0.66,0.25,0.32,0.50
# Hood, roof, nose
body centre_front "$CLAW"    0.25,0.08,0.50,0.62
body centre_nose  "$MONSTER" 0.05,0.10,0.90,0.70
body centre_mid   "$CLAW"    0.30,0.15,0.40,0.70
# Rear: Monster across the deck, Motul and GoPro on the lower bumper pieces
body centre_tail_upper   "$MONSTER" 0.10,0.25,0.80,0.40
body centre_tail_upper_3 "$WORK/prep/motul.png" 0.10,0.20,0.80,0.60
body centre_tail_upper_4 "$WORK/prep/gopro.png" 0.10,0.20,0.80,0.60
# Wing: Porsche lettering on the main plane
body centre_tail "$WORK/prep/porsche.png" 0.05,0.40,0.90,0.20
# Driver name on the quarters
words right_rear "T. THIELE" "#222222" 0.25,0.78,0.50,0.06
words left_rear  "T. THIELE" "#222222" 0.25,0.78,0.50,0.06
# Cyan accents: mirrors and wing endplates
paint left_mid_lower_2 "$CYAN"; paint right_mid_lower_2 "$CYAN"
paint left_tail "$CYAN";         paint right_tail "$CYAN"

# --- door plates (their own texture, 2048x640 per the modder's template): a white card per door, number on it.
# The card is a roughly square sticker at each end of the texture; the rest stays transparent so the door shows through.
$A car size $CAR door_plates 2048x640 >/dev/null
card() { # x y w h  (fractions of the whole texture)
  local x=$1 y=$2 w=$3 h=$4 base=(--base "$PLATE"); [ -f "$PLATE" ] || base=(--fill transparent)
  quiet $A decal $CAR --texture door_plates --panel whole --color "#ffffff" "${base[@]}" --out "$PLATE" --at $x,$y,$w,$h
  local at1 at2
  at1=$(awk -v x=$x -v y=$y -v w=$w -v h=$h 'BEGIN{printf "%.4f,%.4f,%.4f,%.4f", x+0.12*w, y+0.06*h, 0.76*w, 0.26*h}')
  at2=$(awk -v x=$x -v y=$y -v w=$w -v h=$h 'BEGIN{printf "%.4f,%.4f,%.4f,%.4f", x+0.12*w, y+0.36*h, 0.76*w, 0.58*h}')
  quiet $A text $CAR --texture door_plates --panel whole --text "DELS" --ink "#111111" --bold --overlap --base "$PLATE" --out "$PLATE" --at $at1
  quiet $A text $CAR --texture door_plates --panel whole --text "71"   --ink "#111111" --bold --overlap --base "$PLATE" --out "$PLATE" --at $at2; }
card 0.015 0.105 0.203 0.682   # left door's card (u 0.02-0.22)
card 0.783 0.105 0.202 0.682   # right door's card (u 0.78-0.98)

# --- look, and compare with the references recorded in the brief (if any)
$A render $CAR --skin "$WORK" --out "$OUT/sheet.png"
if $A brief show thiele71 --json >/dev/null 2>&1; then $A compare $CAR --skin "$WORK" --brief thiele71 --out "$OUT/compare.png"; fi

# --- package: ui_skin.json + preview.jpg + DDS, zipped for Content Manager
$A render $CAR --skin "$WORK" --views front-right --each --size 1022x575 --out "$OUT/preview_src" >/dev/null
rm -rf "$OUT/pkg"; mkdir -p "$OUT/pkg"; cp "$BODY" "$OUT/pkg/EXT_Main.png"; cp "$PLATE" "$OUT/pkg/Door_Plates.png"
echo '{"skinname":"T. THIELE 71 (second pass)","drivername":"T. Thiele","country":"DEU","team":"GT-M Protech","number":"71"}' > "$OUT/pkg/ui_skin.json"
(cd "$HERE/../.." && node -e "require('sharp')('$OUT/preview_src/front-right.png').jpeg({quality:92}).toFile('$OUT/pkg/preview.jpg')")
$A export "$OUT/pkg" --car $CAR --name "Thiele71 second pass" --alpha Door_Plates --out "$OUT/dist"
