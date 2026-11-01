#!/usr/bin/env bash
# Builds the website into /tmp/e2e/site for the browser test (no Tailwind or Google Fonts, so it works offline).
# Needs esbuild and global react / react-dom. Adjust G if your global npm folder is elsewhere.
set -euo pipefail
G="${G:-/home/claude/.npm-global/lib/node_modules}"
ESBUILD="${ESBUILD:-$G/tsx/node_modules/esbuild/bin/esbuild}"
HERE="$(cd "$(dirname "$0")" && pwd)"
FE="$HERE/../../apps/nitro-frontend"
OUT=/tmp/e2e/site
rm -rf "$OUT"; mkdir -p "$OUT"
cp -r "$FE/public/." "$OUT/"
(cd "$FE" && "$ESBUILD" src/index.tsx --bundle --jsx=automatic --platform=browser --outfile="$OUT/app.js" \
  --alias:react="$G/react" --alias:react-dom="$G/react-dom" \
  --define:import.meta.env='{"VITE_API_URL":"http://127.0.0.1:4777","PROD":false}' --log-level=warning)
# test copy of index.html: no tailwind and no fonts tags, app.js instead of the Vite entry, one rule so .hidden works
sed -e '/cdn.tailwindcss.com/d' -e '/fonts.googleapis.com/d' -e 's#/src/index.tsx#/app.js#' \
    -e 's#</head>#<style>.hidden{display:none}</style></head>#' "$FE/index.html" > "$OUT/index.html"
echo "built $OUT"
