#!/usr/bin/env bash
# Hook: beat-threshold-energy-check
# Event: Stop (after assistant response)
# Cross-references beatThreshold with energy level mentioned in conversation.
#
# Energy → Valid beatThreshold ranges:
#   high:     3-5
#   medium:   2-4
#   low:      1-3
#   recovery: 1-2

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

BEAT=$(printf '%s' "$LINEUP_JSON" | jq '.beatThreshold // null')
if [ "$BEAT" = "null" ]; then
  exit 0  # Let validate-lineup.sh handle missing fields
fi

# Detect energy level from the full response text (case-insensitive)
RESPONSE_LOWER=$(printf '%s' "$RESPONSE" | tr '[:upper:]' '[:lower:]')
ENERGY=""

# Check for explicit energy mentions — most specific first
if printf '%s' "$RESPONSE_LOWER" | grep -qE '\brecovery\b.*(energy|day|mode)|\b(energy|day|mode)\b.*\brecovery\b'; then
  ENERGY="recovery"
elif printf '%s' "$RESPONSE_LOWER" | grep -qE '\blow energy\b|\benergy.{0,10}low\b'; then
  ENERGY="low"
elif printf '%s' "$RESPONSE_LOWER" | grep -qE '\bhigh energy\b|\benergy.{0,10}high\b'; then
  ENERGY="high"
elif printf '%s' "$RESPONSE_LOWER" | grep -qE '\bmedium energy\b|\benergy.{0,10}medium\b|\bmoderate energy\b'; then
  ENERGY="medium"
fi

# If we couldn't detect energy, skip the check
if [ -z "$ENERGY" ]; then
  exit 0
fi

# Validate beat threshold against energy level
MISMATCH=""
case "$ENERGY" in
  high)
    IN_RANGE=$(jq -n --argjson b "$BEAT" 'if $b >= 3 and $b <= 5 then "ok" else "bad" end' | tr -d '"')
    if [ "$IN_RANGE" = "bad" ]; then
      MISMATCH="High energy detected but beatThreshold is ${BEAT}. Expected range: 3-5."
    fi
    ;;
  medium)
    IN_RANGE=$(jq -n --argjson b "$BEAT" 'if $b >= 2 and $b <= 4 then "ok" else "bad" end' | tr -d '"')
    if [ "$IN_RANGE" = "bad" ]; then
      MISMATCH="Medium energy detected but beatThreshold is ${BEAT}. Expected range: 2-4."
    fi
    ;;
  low)
    IN_RANGE=$(jq -n --argjson b "$BEAT" 'if $b >= 1 and $b <= 3 then "ok" else "bad" end' | tr -d '"')
    if [ "$IN_RANGE" = "bad" ]; then
      MISMATCH="Low energy detected but beatThreshold is ${BEAT}. Expected range: 1-3."
    fi
    ;;
  recovery)
    IN_RANGE=$(jq -n --argjson b "$BEAT" 'if $b >= 1 and $b <= 2 then "ok" else "bad" end' | tr -d '"')
    if [ "$IN_RANGE" = "bad" ]; then
      MISMATCH="Recovery energy detected but beatThreshold is ${BEAT}. Expected range: 1-2."
    fi
    ;;
esac

if [ -n "$MISMATCH" ]; then
  printf "⚠️ BEAT THRESHOLD MISMATCH: %s\n\nPlease adjust beatThreshold to match the energy level.\n" "$MISMATCH" >&2
  exit 2
fi

exit 0
