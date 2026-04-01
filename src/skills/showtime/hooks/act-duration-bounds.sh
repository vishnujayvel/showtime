#!/usr/bin/env bash
# Hook: act-duration-bounds
# Event: Stop (after assistant response)
# Validates each act's durationMinutes is between 10 and 120 (inclusive).

set -euo pipefail

INPUT=$(cat)

# Prevent infinite loops
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

RESPONSE=$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // ""')

# Only check if there's a showtime-lineup block
if ! printf '%s' "$RESPONSE" | grep -q '```showtime-lineup'; then
  exit 0
fi

# Extract lineup JSON
LINEUP_JSON=$(printf '%s' "$RESPONSE" | sed -n '/```showtime-lineup/,/```/p' | sed '1d;$d')
if [ -z "$LINEUP_JSON" ] || ! printf '%s' "$LINEUP_JSON" | jq empty 2>/dev/null; then
  exit 0  # Let validate-lineup.sh handle parse errors
fi

ACTS_COUNT=$(printf '%s' "$LINEUP_JSON" | jq 'if .acts | type == "array" then .acts | length else 0 end')
if [ "$ACTS_COUNT" -eq 0 ]; then
  exit 0  # Let validate-lineup.sh handle missing acts
fi

WARNINGS=""

for i in $(seq 0 $((ACTS_COUNT - 1))); do
  ACT_NAME=$(printf '%s' "$LINEUP_JSON" | jq -r ".acts[$i].name // \"Act $i\"")
  DURATION=$(printf '%s' "$LINEUP_JSON" | jq ".acts[$i].durationMinutes // null")

  if [ "$DURATION" = "null" ]; then
    continue  # Let validate-lineup.sh handle missing fields
  fi

  OUT_OF_BOUNDS=$(jq -n --argjson d "$DURATION" 'if $d < 10 or $d > 120 then "yes" else "no" end' | tr -d '"')
  if [ "$OUT_OF_BOUNDS" = "yes" ]; then
    WARNINGS="${WARNINGS}\n  - \"${ACT_NAME}\": ${DURATION} min (must be 10-120)"
  fi
done

if [ -n "$WARNINGS" ]; then
  printf "⚠️ ACT DURATION OUT OF BOUNDS:${WARNINGS}\n\nEach act should be between 10 and 120 minutes. Please adjust.\n" >&2
  exit 2
fi

exit 0
