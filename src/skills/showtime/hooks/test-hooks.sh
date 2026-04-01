#!/usr/bin/env bash
# Test suite for showtime-director production hooks.
# Run: bash src/skills/showtime/hooks/test-hooks.sh
#
# Tests each hook with valid/invalid inputs and verifies exit codes + stderr output.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
TOTAL=0

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[0;33m'
NC='\033[0m'

run_test() {
  local test_name="$1"
  local hook="$2"
  local input="$3"
  local expected_exit="$4"
  local expected_stderr_pattern="${5:-}"

  TOTAL=$((TOTAL + 1))

  # Run hook, capture stderr and exit code
  local stderr_output
  local actual_exit=0
  stderr_output=$(printf '%s' "$input" | bash "$SCRIPT_DIR/$hook" 2>&1 1>/dev/null) || actual_exit=$?

  if [ "$actual_exit" -ne "$expected_exit" ]; then
    FAIL=$((FAIL + 1))
    printf "${RED}FAIL${NC} %s\n  Expected exit %d, got %d\n  stderr: %s\n" "$test_name" "$expected_exit" "$actual_exit" "$stderr_output"
    return
  fi

  if [ -n "$expected_stderr_pattern" ] && [ "$expected_exit" -ne 0 ]; then
    if ! printf '%s' "$stderr_output" | grep -qi "$expected_stderr_pattern"; then
      FAIL=$((FAIL + 1))
      printf "${RED}FAIL${NC} %s\n  Expected stderr to contain '%s'\n  Got: %s\n" "$test_name" "$expected_stderr_pattern" "$stderr_output"
      return
    fi
  fi

  PASS=$((PASS + 1))
  printf "${GREEN}PASS${NC} %s\n" "$test_name"
}

# ---------------------------------------------------------------------------
# Helper: create hook input JSON
# ---------------------------------------------------------------------------
make_input() {
  local message="$1"
  local stop_active="${2:-false}"
  jq -n --arg msg "$message" --argjson sa "$stop_active" '{
    session_id: "test-session",
    hook_event_name: "Stop",
    stop_hook_active: $sa,
    last_assistant_message: $msg,
    cwd: "/tmp/test"
  }'
}

VALID_LINEUP='Here is your lineup:

```showtime-lineup
{
  "acts": [
    {"name": "Deep Work: API Design", "sketch": "Deep Work", "durationMinutes": 60},
    {"name": "Gym Session", "sketch": "Exercise", "durationMinutes": 45}
  ],
  "beatThreshold": 3,
  "openingNote": "Two-act show today. Let'\''s make it count."
}
```'

# ===========================================================================
printf "${YELLOW}=== validate-lineup.sh ===${NC}\n"
# ===========================================================================

run_test "validate-lineup: valid lineup passes" \
  "validate-lineup.sh" \
  "$(make_input "$VALID_LINEUP")" \
  0

run_test "validate-lineup: no lineup block passes (no-op)" \
  "validate-lineup.sh" \
  "$(make_input "Just a normal response with no code blocks.")" \
  0

run_test "validate-lineup: stop_hook_active bypasses" \
  "validate-lineup.sh" \
  "$(make_input "$VALID_LINEUP" true)" \
  0

run_test "validate-lineup: invalid JSON fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{bad json here}
```')" \
  2 "invalid JSON"

run_test "validate-lineup: empty acts array fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{"acts": [], "beatThreshold": 3, "openingNote": "hi"}
```')" \
  2 "non-empty array"

run_test "validate-lineup: invalid sketch fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{"acts": [{"name": "Test", "sketch": "Napping", "durationMinutes": 30}], "beatThreshold": 3, "openingNote": "hi"}
```')" \
  2 "invalid"

run_test "validate-lineup: negative duration fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{"acts": [{"name": "Test", "sketch": "Admin", "durationMinutes": -5}], "beatThreshold": 3, "openingNote": "hi"}
```')" \
  2 "positive number"

run_test "validate-lineup: beatThreshold 0 fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{"acts": [{"name": "Test", "sketch": "Admin", "durationMinutes": 30}], "beatThreshold": 0, "openingNote": "hi"}
```')" \
  2 "beatThreshold"

run_test "validate-lineup: beatThreshold 6 fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{"acts": [{"name": "Test", "sketch": "Admin", "durationMinutes": 30}], "beatThreshold": 6, "openingNote": "hi"}
```')" \
  2 "beatThreshold"

run_test "validate-lineup: missing openingNote fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{"acts": [{"name": "Test", "sketch": "Admin", "durationMinutes": 30}], "beatThreshold": 3}
```')" \
  2 "openingNote"

run_test "validate-lineup: missing name fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
{"acts": [{"sketch": "Admin", "durationMinutes": 30}], "beatThreshold": 3, "openingNote": "hi"}
```')" \
  2 "name"

run_test "validate-lineup: empty lineup block fails" \
  "validate-lineup.sh" \
  "$(make_input '```showtime-lineup
```')" \
  2 "Empty"

# ===========================================================================
printf "\n${YELLOW}=== guilt-language-guard.sh ===${NC}\n"
# ===========================================================================

run_test "guilt-guard: clean response passes" \
  "guilt-language-guard.sh" \
  "$(make_input "Great work today! The show was a hit.")" \
  0

run_test "guilt-guard: stop_hook_active bypasses" \
  "guilt-language-guard.sh" \
  "$(make_input "You failed to complete the task." true)" \
  0

run_test "guilt-guard: detects 'failed'" \
  "guilt-language-guard.sh" \
  "$(make_input "You failed to finish that act.")" \
  2 "failed"

run_test "guilt-guard: detects 'failure'" \
  "guilt-language-guard.sh" \
  "$(make_input "That was a failure on your part.")" \
  2 "failure"

run_test "guilt-guard: detects 'falling behind'" \
  "guilt-language-guard.sh" \
  "$(make_input "You seem to be falling behind today.")" \
  2 "falling behind"

run_test "guilt-guard: detects 'lazy'" \
  "guilt-language-guard.sh" \
  "$(make_input "Don't be lazy about this.")" \
  2 "lazy"

run_test "guilt-guard: detects 'procrastinating'" \
  "guilt-language-guard.sh" \
  "$(make_input "It seems like you're procrastinating.")" \
  2 "procrastinating"

run_test "guilt-guard: detects 'wasted time'" \
  "guilt-language-guard.sh" \
  "$(make_input "You wasted time on that task.")" \
  2 "wasted time"

run_test "guilt-guard: detects 'unproductive'" \
  "guilt-language-guard.sh" \
  "$(make_input "That was an unproductive session.")" \
  2 "unproductive"

run_test "guilt-guard: detects 'should have'" \
  "guilt-language-guard.sh" \
  "$(make_input "You should have started earlier.")" \
  2 "should have"

run_test "guilt-guard: detects 'disappointed'" \
  "guilt-language-guard.sh" \
  "$(make_input "I'm disappointed in the progress.")" \
  2 "disappointed"

run_test "guilt-guard: detects 'overdue'" \
  "guilt-language-guard.sh" \
  "$(make_input "This task is overdue.")" \
  2 "overdue"

run_test "guilt-guard: detects 'behind schedule'" \
  "guilt-language-guard.sh" \
  "$(make_input "You're behind schedule on this.")" \
  2 "behind schedule"

run_test "guilt-guard: empty response passes" \
  "guilt-language-guard.sh" \
  "$(make_input "")" \
  0

# ===========================================================================
printf "\n${YELLOW}=== beat-threshold-check.sh ===${NC}\n"
# ===========================================================================

HIGH_ENERGY_VALID='High energy today! Here is your lineup:

```showtime-lineup
{"acts": [{"name": "Deep Work", "sketch": "Deep Work", "durationMinutes": 60}], "beatThreshold": 4, "openingNote": "Great day ahead."}
```'

HIGH_ENERGY_INVALID='High energy today! Here is your lineup:

```showtime-lineup
{"acts": [{"name": "Deep Work", "sketch": "Deep Work", "durationMinutes": 60}], "beatThreshold": 1, "openingNote": "Great day ahead."}
```'

LOW_ENERGY_VALID='Low energy today. Here is your lineup:

```showtime-lineup
{"acts": [{"name": "Light Admin", "sketch": "Admin", "durationMinutes": 30}], "beatThreshold": 2, "openingNote": "Easy day."}
```'

LOW_ENERGY_INVALID='Low energy day. Here is your lineup:

```showtime-lineup
{"acts": [{"name": "Light Admin", "sketch": "Admin", "durationMinutes": 30}], "beatThreshold": 5, "openingNote": "Easy day."}
```'

RECOVERY_VALID='Recovery mode today. Here is your lineup:

```showtime-lineup
{"acts": [{"name": "Rest", "sketch": "Personal", "durationMinutes": 30}], "beatThreshold": 1, "openingNote": "Gentle day."}
```'

RECOVERY_INVALID='Recovery energy today. Here is your lineup:

```showtime-lineup
{"acts": [{"name": "Rest", "sketch": "Personal", "durationMinutes": 30}], "beatThreshold": 4, "openingNote": "Gentle day."}
```'

MEDIUM_ENERGY_VALID='Medium energy today. Here is your lineup:

```showtime-lineup
{"acts": [{"name": "Mixed Work", "sketch": "Creative", "durationMinutes": 45}], "beatThreshold": 3, "openingNote": "Solid day."}
```'

run_test "beat-threshold: high energy + threshold 4 passes" \
  "beat-threshold-check.sh" \
  "$(make_input "$HIGH_ENERGY_VALID")" \
  0

run_test "beat-threshold: high energy + threshold 1 fails" \
  "beat-threshold-check.sh" \
  "$(make_input "$HIGH_ENERGY_INVALID")" \
  2 "MISMATCH"

run_test "beat-threshold: low energy + threshold 2 passes" \
  "beat-threshold-check.sh" \
  "$(make_input "$LOW_ENERGY_VALID")" \
  0

run_test "beat-threshold: low energy + threshold 5 fails" \
  "beat-threshold-check.sh" \
  "$(make_input "$LOW_ENERGY_INVALID")" \
  2 "MISMATCH"

run_test "beat-threshold: recovery + threshold 1 passes" \
  "beat-threshold-check.sh" \
  "$(make_input "$RECOVERY_VALID")" \
  0

run_test "beat-threshold: recovery + threshold 4 fails" \
  "beat-threshold-check.sh" \
  "$(make_input "$RECOVERY_INVALID")" \
  2 "MISMATCH"

run_test "beat-threshold: medium energy + threshold 3 passes" \
  "beat-threshold-check.sh" \
  "$(make_input "$MEDIUM_ENERGY_VALID")" \
  0

run_test "beat-threshold: no lineup block passes (no-op)" \
  "beat-threshold-check.sh" \
  "$(make_input "Just chatting, no lineup here.")" \
  0

run_test "beat-threshold: no energy mentioned passes (no-op)" \
  "beat-threshold-check.sh" \
  "$(make_input "$VALID_LINEUP")" \
  0

# ===========================================================================
printf "\n${YELLOW}=== act-duration-bounds.sh ===${NC}\n"
# ===========================================================================

run_test "act-duration: valid durations pass" \
  "act-duration-bounds.sh" \
  "$(make_input "$VALID_LINEUP")" \
  0

run_test "act-duration: no lineup block passes (no-op)" \
  "act-duration-bounds.sh" \
  "$(make_input "No lineup here.")" \
  0

run_test "act-duration: stop_hook_active bypasses" \
  "act-duration-bounds.sh" \
  "$(make_input '```showtime-lineup
{"acts": [{"name": "Too Short", "sketch": "Admin", "durationMinutes": 5}], "beatThreshold": 3, "openingNote": "hi"}
```' true)" \
  0

DURATION_TOO_SHORT='```showtime-lineup
{"acts": [{"name": "Quick Task", "sketch": "Admin", "durationMinutes": 5}], "beatThreshold": 3, "openingNote": "hi"}
```'

DURATION_TOO_LONG='```showtime-lineup
{"acts": [{"name": "Marathon", "sketch": "Deep Work", "durationMinutes": 180}], "beatThreshold": 3, "openingNote": "hi"}
```'

DURATION_AT_BOUNDS='```showtime-lineup
{"acts": [{"name": "Min Act", "sketch": "Admin", "durationMinutes": 10}, {"name": "Max Act", "sketch": "Deep Work", "durationMinutes": 120}], "beatThreshold": 3, "openingNote": "Boundary test."}
```'

run_test "act-duration: 5 min act fails (too short)" \
  "act-duration-bounds.sh" \
  "$(make_input "$DURATION_TOO_SHORT")" \
  2 "OUT OF BOUNDS"

run_test "act-duration: 180 min act fails (too long)" \
  "act-duration-bounds.sh" \
  "$(make_input "$DURATION_TOO_LONG")" \
  2 "OUT OF BOUNDS"

run_test "act-duration: 10 and 120 min pass (boundary values)" \
  "act-duration-bounds.sh" \
  "$(make_input "$DURATION_AT_BOUNDS")" \
  0

# ===========================================================================
# Summary
# ===========================================================================
printf "\n${YELLOW}=== RESULTS ===${NC}\n"
printf "Total: %d  ${GREEN}Passed: %d${NC}  ${RED}Failed: %d${NC}\n" "$TOTAL" "$PASS" "$FAIL"

if [ "$FAIL" -gt 0 ]; then
  exit 1
fi

printf "\n${GREEN}All tests passed!${NC}\n"
exit 0
