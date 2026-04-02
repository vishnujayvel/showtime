#!/usr/bin/env bash
# Eval runner for showtime-director SKILL.md
# Runs each eval test case via `claude -p --append-system-prompt` and validates output.
#
# Usage: ./run-evals.sh [test-id]
#   No args: runs all 5 tests
#   With arg: runs only the named test (e.g., ./run-evals.sh high-energy-lineup)

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SKILL_PATH="$SCRIPT_DIR/../SKILL.md"
EVALS_PATH="$SCRIPT_DIR/evals.json"
RESULTS_DIR="$SCRIPT_DIR/results"

mkdir -p "$RESULTS_DIR"

PASS=0
FAIL=0
SKIP=0
TOTAL=0

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log_pass() { echo -e "  ${GREEN}PASS${NC}: $1"; }
log_fail() { echo -e "  ${RED}FAIL${NC}: $1"; FAIL=$((FAIL + 1)); }
log_info() { echo -e "${CYAN}[$1]${NC} $2"; }

# Get test count
TEST_COUNT=$(jq '.test_cases | length' "$EVALS_PATH")
FILTER="${1:-}"

echo "======================================"
echo " Showtime Director — Eval Suite"
echo " SKILL: $SKILL_PATH"
echo " Tests: $TEST_COUNT"
echo "======================================"
echo ""

for i in $(seq 0 $((TEST_COUNT - 1))); do
  TEST_ID=$(jq -r ".test_cases[$i].id" "$EVALS_PATH")
  TEST_NAME=$(jq -r ".test_cases[$i].name" "$EVALS_PATH")
  PROMPT=$(jq -r ".test_cases[$i].prompt" "$EVALS_PATH")

  # Filter if specific test requested
  if [ -n "$FILTER" ] && [ "$TEST_ID" != "$FILTER" ]; then
    continue
  fi

  TOTAL=$((TOTAL + 1))
  log_info "$TEST_ID" "$TEST_NAME"

  # Run claude with the skill as the full system prompt (no hooks, no skills, no tools)
  OUTFILE="$RESULTS_DIR/${TEST_ID}.txt"
  SKILL_CONTENT=$(cat "$SKILL_PATH")
  if ! claude -p --system-prompt "$SKILL_CONTENT" --disable-slash-commands --model sonnet --max-turns 1 "$PROMPT" > "$OUTFILE" 2>/dev/null; then
    echo -e "  ${RED}ERROR${NC}: claude command failed"
    FAIL=$((FAIL + 1))
    echo ""
    continue
  fi

  RESPONSE=$(cat "$OUTFILE")
  RESPONSE_LOWER=$(echo "$RESPONSE" | tr '[:upper:]' '[:lower:]')
  TEST_PASS=true

  # --- Assertion checks ---

  # has_showtime_lineup_block
  HAS_BLOCK=$(jq -r ".test_cases[$i].assertions.has_showtime_lineup_block // empty" "$EVALS_PATH")
  if [ "$HAS_BLOCK" = "true" ]; then
    if echo "$RESPONSE" | grep -q '```showtime-lineup'; then
      log_pass "has showtime-lineup block"
    else
      log_fail "missing showtime-lineup block"
      TEST_PASS=false
    fi
  fi

  # json_parses
  JSON_PARSES=$(jq -r ".test_cases[$i].assertions.json_parses // empty" "$EVALS_PATH")
  if [ "$JSON_PARSES" = "true" ]; then
    LINEUP_JSON=$(echo "$RESPONSE" | sed -n '/```showtime-lineup/,/```/p' | sed '1d;$d')
    if echo "$LINEUP_JSON" | jq empty 2>/dev/null; then
      log_pass "JSON parses"
    else
      log_fail "JSON does not parse"
      TEST_PASS=false
    fi
  fi

  # Extract lineup for further checks
  LINEUP_JSON=$(echo "$RESPONSE" | sed -n '/```showtime-lineup/,/```/p' | sed '1d;$d' 2>/dev/null || echo "{}")

  # acts_count (exact)
  ACTS_COUNT_EXPECTED=$(jq -r ".test_cases[$i].assertions.acts_count // empty" "$EVALS_PATH")
  if [ -n "$ACTS_COUNT_EXPECTED" ]; then
    ACTUAL=$(echo "$LINEUP_JSON" | jq '.acts | length' 2>/dev/null || echo "0")
    if [ "$ACTUAL" -eq "$ACTS_COUNT_EXPECTED" ]; then
      log_pass "acts count = $ACTUAL"
    else
      log_fail "acts count = $ACTUAL (expected $ACTS_COUNT_EXPECTED)"
      TEST_PASS=false
    fi
  fi

  # acts_count_max
  ACTS_MAX=$(jq -r ".test_cases[$i].assertions.acts_count_max // empty" "$EVALS_PATH")
  if [ -n "$ACTS_MAX" ]; then
    ACTUAL=$(echo "$LINEUP_JSON" | jq '.acts | length' 2>/dev/null || echo "0")
    if [ "$ACTUAL" -le "$ACTS_MAX" ]; then
      log_pass "acts count $ACTUAL <= max $ACTS_MAX"
    else
      log_fail "acts count $ACTUAL > max $ACTS_MAX"
      TEST_PASS=false
    fi
  fi

  # first_act_sketch
  FIRST_SKETCH=$(jq -r ".test_cases[$i].assertions.first_act_sketch // empty" "$EVALS_PATH")
  if [ -n "$FIRST_SKETCH" ]; then
    ACTUAL=$(echo "$LINEUP_JSON" | jq -r '.acts[0].sketch // ""' 2>/dev/null || echo "")
    if [ "$ACTUAL" = "$FIRST_SKETCH" ]; then
      log_pass "first act sketch = $ACTUAL"
    else
      log_fail "first act sketch = '$ACTUAL' (expected '$FIRST_SKETCH')"
      TEST_PASS=false
    fi
  fi

  # first_act_sketch_not
  FIRST_NOT=$(jq -r ".test_cases[$i].assertions.first_act_sketch_not // empty" "$EVALS_PATH")
  if [ -n "$FIRST_NOT" ]; then
    ACTUAL=$(echo "$LINEUP_JSON" | jq -r '.acts[0].sketch // ""' 2>/dev/null || echo "")
    if [ "$ACTUAL" != "$FIRST_NOT" ]; then
      log_pass "first act sketch != $FIRST_NOT (is '$ACTUAL')"
    else
      log_fail "first act sketch should not be '$FIRST_NOT'"
      TEST_PASS=false
    fi
  fi

  # has_exercise_act
  HAS_EX=$(jq -r ".test_cases[$i].assertions.has_exercise_act // empty" "$EVALS_PATH")
  if [ "$HAS_EX" = "true" ]; then
    EX_COUNT=$(echo "$LINEUP_JSON" | jq '[.acts[] | select(.sketch == "Exercise")] | length' 2>/dev/null || echo "0")
    if [ "$EX_COUNT" -gt 0 ]; then
      log_pass "has Exercise act"
    else
      log_fail "no Exercise act found"
      TEST_PASS=false
    fi
  fi

  # beat_threshold_min / beat_threshold_max
  BT_MIN=$(jq -r ".test_cases[$i].assertions.beat_threshold_min // empty" "$EVALS_PATH")
  BT_MAX=$(jq -r ".test_cases[$i].assertions.beat_threshold_max // empty" "$EVALS_PATH")
  if [ -n "$BT_MIN" ] || [ -n "$BT_MAX" ]; then
    BT_ACTUAL=$(echo "$LINEUP_JSON" | jq '.beatThreshold // 0' 2>/dev/null || echo "0")
    if [ -n "$BT_MIN" ] && [ "$BT_ACTUAL" -lt "$BT_MIN" ]; then
      log_fail "beatThreshold $BT_ACTUAL < min $BT_MIN"
      TEST_PASS=false
    elif [ -n "$BT_MAX" ] && [ "$BT_ACTUAL" -gt "$BT_MAX" ]; then
      log_fail "beatThreshold $BT_ACTUAL > max $BT_MAX"
      TEST_PASS=false
    else
      log_pass "beatThreshold = $BT_ACTUAL (range: ${BT_MIN:-*}-${BT_MAX:-*})"
    fi
  fi

  # has_opening_note
  HAS_NOTE=$(jq -r ".test_cases[$i].assertions.has_opening_note // empty" "$EVALS_PATH")
  if [ "$HAS_NOTE" = "true" ]; then
    NOTE=$(echo "$LINEUP_JSON" | jq -r '.openingNote // ""' 2>/dev/null || echo "")
    if [ -n "$NOTE" ] && [ "$NOTE" != "null" ]; then
      log_pass "has openingNote"
    else
      log_fail "missing openingNote"
      TEST_PASS=false
    fi
  fi

  # all_sketches_valid
  ALL_SKETCHES=$(jq -r ".test_cases[$i].assertions.all_sketches_valid // empty" "$EVALS_PATH")
  if [ "$ALL_SKETCHES" = "true" ]; then
    INVALID=$(echo "$LINEUP_JSON" | jq '[.acts[].sketch] | map(select(. != "Deep Work" and . != "Exercise" and . != "Admin" and . != "Creative" and . != "Social" and . != "Personal")) | length' 2>/dev/null || echo "1")
    if [ "$INVALID" -eq 0 ]; then
      log_pass "all sketches valid"
    else
      log_fail "invalid sketch categories found"
      TEST_PASS=false
    fi
  fi

  # all_durations_in_range
  ALL_DUR=$(jq -r ".test_cases[$i].assertions.all_durations_in_range // empty" "$EVALS_PATH")
  if [ "$ALL_DUR" = "true" ]; then
    OOB=$(echo "$LINEUP_JSON" | jq '[.acts[].durationMinutes] | map(select(. < 15 or . > 120)) | length' 2>/dev/null || echo "1")
    if [ "$OOB" -eq 0 ]; then
      log_pass "all durations in range (15-120)"
    else
      log_fail "durations out of range found"
      TEST_PASS=false
    fi
  fi

  # forbidden_words_absent
  FORBIDDEN=$(jq -r ".test_cases[$i].assertions.forbidden_words_absent // empty" "$EVALS_PATH")
  if [ "$FORBIDDEN" != "" ] && [ "$FORBIDDEN" != "null" ]; then
    FORBIDDEN_LIST=$(jq -r ".test_cases[$i].assertions.forbidden_words_absent[]" "$EVALS_PATH")
    FOUND_FORBIDDEN=""
    while IFS= read -r word; do
      if echo "$RESPONSE_LOWER" | grep -qi "$word"; then
        FOUND_FORBIDDEN="$FOUND_FORBIDDEN '$word'"
      fi
    done <<< "$FORBIDDEN_LIST"
    if [ -z "$FOUND_FORBIDDEN" ]; then
      log_pass "no forbidden words found"
    else
      log_fail "forbidden words found:$FOUND_FORBIDDEN"
      TEST_PASS=false
    fi
  fi

  # has_reframe
  HAS_REFRAME=$(jq -r ".test_cases[$i].assertions.has_reframe // empty" "$EVALS_PATH")
  if [ "$HAS_REFRAME" = "true" ]; then
    # Check for any known reframe phrases
    if echo "$RESPONSE_LOWER" | grep -qiE "(act got cut|lineup shifted|show called|show adapts|intermission ran long|next act feel good|stage will be here|next show)"; then
      log_pass "has reframe language"
    else
      log_fail "no reframe language detected"
      TEST_PASS=false
    fi
  fi

  # has_director_mode
  HAS_DIR=$(jq -r ".test_cases[$i].assertions.has_director_mode // empty" "$EVALS_PATH")
  if [ "$HAS_DIR" = "true" ]; then
    if echo "$RESPONSE_LOWER" | grep -qiE "(show adapts|what do you need)"; then
      log_pass "director mode detected"
    else
      log_fail "director mode not detected"
      TEST_PASS=false
    fi
  fi

  # offers_4_options / has_*_option
  OFFERS_4=$(jq -r ".test_cases[$i].assertions.offers_4_options // empty" "$EVALS_PATH")
  if [ "$OFFERS_4" = "true" ]; then
    OPT_COUNT=0
    echo "$RESPONSE_LOWER" | grep -qiE "(cut|remove|drop).*(act|remaining)" && OPT_COUNT=$((OPT_COUNT + 1))
    echo "$RESPONSE_LOWER" | grep -qiE "(reorder|shuffle|rearrange)" && OPT_COUNT=$((OPT_COUNT + 1))
    echo "$RESPONSE_LOWER" | grep -qiE "(intermission|break|pause|rest)" && OPT_COUNT=$((OPT_COUNT + 1))
    echo "$RESPONSE_LOWER" | grep -qiE "(call.*(show|it).*early|wrap|end.*show)" && OPT_COUNT=$((OPT_COUNT + 1))
    if [ "$OPT_COUNT" -ge 4 ]; then
      log_pass "offers 4 director options"
    else
      log_fail "only $OPT_COUNT of 4 director options found"
      TEST_PASS=false
    fi
  fi

  # has_beat_check_prompt
  HAS_BEAT=$(jq -r ".test_cases[$i].assertions.has_beat_check_prompt // empty" "$EVALS_PATH")
  if [ "$HAS_BEAT" = "true" ]; then
    if echo "$RESPONSE_LOWER" | grep -qiE "(moment.*forgot|fully in it|flash of flow|time disappear|doing the thing|genuine immersion|in the zone|felt effortless|noise went quiet|feel present)"; then
      log_pass "has beat check prompt"
    else
      log_fail "no beat check prompt detected"
      TEST_PASS=false
    fi
  fi

  # has_verdict
  HAS_VERDICT=$(jq -r ".test_cases[$i].assertions.has_verdict // empty" "$EVALS_PATH")
  if [ "$HAS_VERDICT" = "true" ]; then
    if echo "$RESPONSE_LOWER" | grep -qiE "(day won|solid show|good effort|show called early|standing ovation)"; then
      log_pass "has verdict"
    else
      log_fail "no verdict detected"
      TEST_PASS=false
    fi
  fi

  # verdict_category
  VERDICT_CAT=$(jq -r ".test_cases[$i].assertions.verdict_category // empty" "$EVALS_PATH")
  if [ -n "$VERDICT_CAT" ]; then
    VERDICT_LOWER=$(echo "$VERDICT_CAT" | tr '[:upper:]' '[:lower:]')
    if echo "$RESPONSE_LOWER" | grep -qi "$VERDICT_LOWER"; then
      log_pass "verdict category = $VERDICT_CAT"
    else
      log_fail "expected verdict '$VERDICT_CAT' not found"
      TEST_PASS=false
    fi
  fi

  # has_validation_phrase
  HAS_VAL=$(jq -r ".test_cases[$i].assertions.has_validation_phrase // empty" "$EVALS_PATH")
  if [ "$HAS_VAL" = "true" ]; then
    if echo "$RESPONSE_LOWER" | grep -qiE "(showed up|hardest part|rest is part|what feels right|you come first)"; then
      log_pass "has validation phrase"
    else
      log_fail "no validation phrase detected"
      TEST_PASS=false
    fi
  fi

  if [ "$TEST_PASS" = true ]; then
    PASS=$((PASS + 1))
    echo -e "  ${GREEN}RESULT: ALL ASSERTIONS PASSED${NC}"
  else
    echo -e "  ${RED}RESULT: SOME ASSERTIONS FAILED${NC}"
  fi
  echo ""
done

echo "======================================"
echo -e " Results: ${GREEN}$PASS passed${NC}, ${RED}$FAIL failed${NC} / $TOTAL total"
echo " Raw outputs: $RESULTS_DIR/"
echo "======================================"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi
exit 0
