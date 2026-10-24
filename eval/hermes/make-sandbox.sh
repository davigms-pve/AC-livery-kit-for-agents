#!/usr/bin/env bash
# Builds a clean copy of the kit for a Hermes (or any model) run, so the model cannot read an answer key and cannot
# damage the real repo. Usage: eval/hermes/make-sandbox.sh <dest> [slug]     (dest must not exist; nothing is deleted)
# Left out on purpose: .git, eval/, examples/, test/, tools/, dist/, AGENTS.md, docs/TODO.md, docs/session-log/, docs/research/ (except
# brand-marks.md, which skill ac-logos names), every other brief, every earlier run, demo and build output.
# Kept: bin/ src/ skills/, README, package files, node_modules, the committed car map, the P92 car pack, logos, stock textures.
# The user's photos go in <dest>/photos/ (ALL of them, as a real user would hand them over); no brief is made, the agent starts one.
# Set PRE_BRIEF=1 to also pre-make the brief with 3 photos (the old, narrower set-up of runs 2 to 5).
# Set EXCLUDE_PHOTO=<part of a file name> to leave a photo out (to test what the agent does when a view is missing).
# Set NO_PREPPED=1 to leave out assets/logos/prepped (marks cut out by earlier runs), so cutting a mark out is part of the task.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="$(cd "$HERE/../.." && pwd)"
DEST="${1:?usage: make-sandbox.sh <dest> [slug]}"; SLUG="${2:-m2-hermes-1}"
[ -e "$DEST" ] && { echo "refusing: $DEST exists"; exit 2; }
CAR=rss_gtm_protech_p92_f6; PHOTOS="${AC_PHOTOS:-/c/Users/davi_/Downloads/AC AI/fotosamples}"
mkdir -p "$DEST/docs/research" "$DEST/assets" "$DEST/.aclivery/cars" "$DEST/photos" "$DEST/work"
for f in bin src skills cars node_modules; do cp -r "$SRC/$f" "$DEST/"; done
for f in README.md LICENSE NOTICE package.json package-lock.json; do cp "$SRC/$f" "$DEST/"; done
for f in workflow-map user-journey agent-flow; do cp "$SRC/docs/$f.md" "$DEST/docs/"; done
cp "$SRC/docs/research/brand-marks.md" "$DEST/docs/research/"
cp -r "$SRC/assets/logos" "$SRC/assets/stock" "$SRC/assets/cars" "$DEST/assets/"
[ "${NO_PREPPED:-0}" = 1 ] && rm -rf "$DEST/assets/logos/prepped"
cp -r "$SRC/.aclivery/cars/$CAR" "$DEST/.aclivery/cars/"
cp "$PHOTOS"/*.jpg "$DEST/photos/"
[ -n "${EXCLUDE_PHOTO:-}" ] && rm -f "$DEST"/photos/*"$EXCLUDE_PHOTO"*
cd "$DEST"
if [ "${PRE_BRIEF:-0}" = 1 ]; then
  node bin/aclivery.mjs brief init "$SLUG" --title "T. Thiele #71 Monster Energy Ultra" --car "$CAR" >/dev/null
  for p in 855000982_1094238246560196_2757428163464498714_n:right 855000897_1094238043226883_2220851314102465669_n:front 854670056_1094238239893530_7750677950587817858_n:front-left; do
    node bin/aclivery.mjs brief add "$SLUG" references "{\"file\":\"photos/${p%%:*}.jpg\",\"view\":\"${p##*:}\"}" >/dev/null
  done
fi
node bin/aclivery.mjs status | head -5
echo "sandbox ready: $DEST   photos: $(ls "$DEST/photos" | wc -l)   work folder: $DEST/work"
