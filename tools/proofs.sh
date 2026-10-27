#!/bin/sh
# Proof screenshots: each outlet's national front page, captured with headless Chrome and stamped with the time.
# Usage: sh tools/proofs.sh <output-folder>     (macOS; needs Google Chrome)
OUT="${1:-proofs}"; mkdir -p "$OUT"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
STAMP=$(date +%Y-%m-%d_%H%M)
grep -o 'O("[a-z0-9]*".*"https://[^"]*"),' "$(dirname "$0")/../scripts/outlets.mjs" | sed -E 's/^O\("([a-z0-9]+)".*"(https:[^"]+)"\),$/\1 \2/' |
while read -r id url; do
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --mute-audio --window-size=1440,2400 \
    --virtual-time-budget=9000 --user-agent="Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36" \
    --screenshot="$OUT/${STAMP}_${id}.png" "$url" </dev/null >/dev/null 2>&1 && echo "✓ $id  $url" || echo "✗ $id  $url"
done
