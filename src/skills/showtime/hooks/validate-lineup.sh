#!/usr/bin/env bash
# Hook: lineup-schema-validator
# Event: Stop (after assistant response)
# Validates ```showtime-lineup code blocks for JSON schema correctness.
#
# Checks: JSON parses, acts is non-empty array, each act has name/sketch/durationMinutes,
#          beatThreshold is 1-5, openingNote is non-empty, sketch is a valid category.

set -euo pipefail

INPUT=$(cat)

# Prevent infinite loops — if Claude is already continuing from a hook, let it stop
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

RESPONSE=$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // ""')

# No lineup block? Nothing to validate.
if ! printf '%s' "$RESPONSE" | grep -q '```showtime-lineup'; then
  exit 0
fi

# Extract JSON between ```showtime-lineup and the next ```
LINEUP_JSON=$(printf '%s' "$RESPONSE" | sed -n '/```showtime-lineup/,/```/p' | sed '1d;$d')

if [ -z "$LINEUP_JSON" ]; then
  printf '⚠️ LINEUP VALIDATION: Empty showtime-lineup block found. Please provide valid JSON.\n' >&2
  exit 2
fi

# Must be valid JSON
if ! printf '%s' "$LINEUP_JSON" | jq empty 2>/dev/null; then
  printf '⚠️ LINEUP VALIDATION: showtime-lineup block contains invalid JSON. Please fix syntax errors.\n' >&2
  exit 2
fi

ERRORS=""

# acts must be a non-empty array
ACTS_COUNT=$(printf '%s' "$LINEUP_JSON" | jq 'if .acts | type == "array" then .acts | length else 0 end')
if [ "$ACTS_COUNT" -eq 0 ]; then
  ERRORS="${ERRORS}\n  - 'acts' must be a non-empty array"
fi

# Validate each act
VALID_SKETCHES='["Deep Work","Exercise","Admin","Creative","Social","Personal"]'

for i in $(seq 0 $((ACTS_COUNT - 1))); do
  ACT=$(printf '%s' "$LINEUP_JSON" | jq ".acts[$i]")

  # name: non-empty string
  NAME=$(printf '%s' "$ACT" | jq -r 'if .name and (.name | type == "string") and (.name | length > 0) then "ok" else "bad" end')
  if [ "$NAME" = "bad" ]; then
    ERRORS="${ERRORS}\n  - acts[$i]: 'name' must be a non-empty string"
  fi

  # sketch: valid category
  SKETCH=$(printf '%s' "$ACT" | jq -r '.sketch // ""')
  IS_VALID=$(printf '%s' "$VALID_SKETCHES" | jq --arg s "$SKETCH" '[.[] | select(. == $s)] | length > 0')
  if [ "$IS_VALID" = "false" ]; then
    ERRORS="${ERRORS}\n  - acts[$i]: sketch '${SKETCH}' is invalid. Must be: Deep Work, Exercise, Admin, Creative, Social, Personal"
  fi

  # durationMinutes: positive number
  DUR_OK=$(printf '%s' "$ACT" | jq -r 'if .durationMinutes and (.durationMinutes | type == "number") and .durationMinutes > 0 then "ok" else "bad" end')
  if [ "$DUR_OK" = "bad" ]; then
    DUR_VAL=$(printf '%s' "$ACT" | jq '.durationMinutes // "missing"')
    ERRORS="${ERRORS}\n  - acts[$i]: 'durationMinutes' must be a positive number (got ${DUR_VAL})"
  fi
done

# beatThreshold: number between 1 and 5
BEAT_OK=$(printf '%s' "$LINEUP_JSON" | jq -r 'if .beatThreshold and (.beatThreshold | type == "number") and .beatThreshold >= 1 and .beatThreshold <= 5 then "ok" else "bad" end')
if [ "$BEAT_OK" = "bad" ]; then
  BEAT_VAL=$(printf '%s' "$LINEUP_JSON" | jq '.beatThreshold // "missing"')
  ERRORS="${ERRORS}\n  - 'beatThreshold' must be a number between 1 and 5 (got ${BEAT_VAL})"
fi

# openingNote: non-empty string
NOTE_OK=$(printf '%s' "$LINEUP_JSON" | jq -r 'if .openingNote and (.openingNote | type == "string") and (.openingNote | length > 0) then "ok" else "bad" end')
if [ "$NOTE_OK" = "bad" ]; then
  ERRORS="${ERRORS}\n  - 'openingNote' must be a non-empty string"
fi

if [ -n "$ERRORS" ]; then
  printf "⚠️ LINEUP VALIDATION FAILED:${ERRORS}\n\nPlease fix the showtime-lineup block above.\n" >&2
  exit 2
fi

exit 0
