#!/usr/bin/env bash
# Builds a clean copy of the kit for a Hermes (or any model) run, so the model cannot read an answer key and cannot
# damage the real repo. Usage: eval/hermes/make-sandbox.sh <dest> [slug]     (dest must not exist; nothing is deleted)
# Left out on purpose: .git, eval/, examples/, test/, tools/, dist/, AGENTS.md, docs/TODO.md, docs/session-log/, docs/research/ (except
# brand-marks.md, which skill ac-logos names), every other brief, every earlier run, demo and build output.
# Kept: bin/ src/ skills/, README, package files, node_modules, the committed car map, the P92 car pack, logos, stock textures.
# Set NO_PREPPED=1 to leave out assets/logos/prepped (marks cut out by earlier runs), so cutting a mark out is part of the task.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"; SRC="$(cd "$HERE/../.." && pwd)"
DEST="${1:?usage: make-sandbox.sh <dest> [slug]}"; SLUG="${2:-m2-hermes-1}"
[ -e "$DEST" ] && { echo "refusing: $DEST exists"; exit 2; }
CAR=rss_gtm_protech_p92_f6; PHOTOS="${AC_PHOTOS:-/c/Users/davi_/Downloads/AC AI/fotosamples}"
mkdir -p "$DEST/docs/research" "$DEST/assets" "$DEST/.aclivery/cars" "$DEST/refs" "$DEST/work"
for f in bin src skills cars node_modules; do cp -r "$SRC/$f" "$DEST/"; done
for f in README.md LICENSE NOTICE package.json package-lock.json; do cp "$SRC/$f" "$DEST/"; done
for f in workflow-map user-journey agent-flow; do cp "$SRC/docs/$f.md" "$DEST/docs/"; done
cp "$SRC/docs/research/brand-marks.md" "$DEST/docs/research/"
cp -r "$SRC/assets/logos" "$SRC/assets/stock" "$SRC/assets/cars" "$DEST/assets/"
[ "${NO_PREPPED:-0}" = 1 ] && rm -rf "$DEST/assets/logos/prepped"
cp -r "$SRC/.aclivery/cars/$CAR" "$DEST/.aclivery/cars/"
for p in 855000982_1094238246560196_2757428163464498714_n 855000897_1094238043226883_2220851314102465669_n 854670056_1094238239893530_7750677950587817858_n; do cp "$PHOTOS/$p.jpg" "$DEST/refs/"; done
cd "$DEST"
node bin/aclivery.mjs brief init "$SLUG" --title "T. Thiele #71 Monster Energy Ultra" --car "$CAR" >/dev/null
node bin/aclivery.mjs brief add "$SLUG" references '{"file":"refs/855000982_1094238246560196_2757428163464498714_n.jpg","view":"right"}' >/dev/null
node bin/aclivery.mjs brief add "$SLUG" references '{"file":"refs/855000897_1094238043226883_2220851314102465669_n.jpg","view":"front"}' >/dev/null
node bin/aclivery.mjs brief add "$SLUG" references '{"file":"refs/854670056_1094238239893530_7750677950587817858_n.jpg","view":"front-left"}' >/dev/null
node bin/aclivery.mjs status | head -5
echo "sandbox ready: $DEST   brief: $SLUG   work folder: $DEST/work"
