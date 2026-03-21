#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
CFG_FILE="$ROOT_DIR/site-config.json"

if ! command -v jq >/dev/null 2>&1; then
  echo "[error] jq is required"
  exit 1
fi
if ! command -v sips >/dev/null 2>&1; then
  echo "[error] sips is required (macOS built-in)"
  exit 1
fi

SIZES=(360 760 1280)
TMP_LIST="$(mktemp)"
trap 'rm -f "$TMP_LIST"' EXIT

jq -r '
  [
    (.routes[]?.cover),
    (.routes[]?.photos[]?),
    (.hero.slides[]?.src)
  ]
  | .[]
  | select(type == "string" and length > 0)
' "$CFG_FILE" | sort -u > "$TMP_LIST"

count=0
while IFS= read -r raw; do
  rel="${raw#./}"
  src="$ROOT_DIR/$rel"
  if [[ ! -f "$src" ]]; then
    continue
  fi

  base="${rel%.*}"
  for size in "${SIZES[@]}"; do
    out="$ROOT_DIR/thumbs/${base}-w${size}.jpg"
    mkdir -p "$(dirname "$out")"
    if [[ -f "$out" ]]; then
      continue
    fi
    sips -s format jpeg -s formatOptions 68 -Z "$size" "$src" --out "$out" >/dev/null 2>&1 || true
    count=$((count + 1))
  done
done < "$TMP_LIST"

echo "[done] generated $count thumbnail files"
