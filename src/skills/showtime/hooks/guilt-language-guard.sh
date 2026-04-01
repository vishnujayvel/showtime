#!/usr/bin/env bash
# Hook: guilt-language-guard
# Event: Stop (after assistant response)
# Scans assistant response for forbidden ADHD guilt/shame language
# and suggests SNL framework reframes.
#
# Forbidden words: failed, failure, falling behind, overdue, late, behind schedule,
#   should have, could have, wasted time, unproductive, lazy, procrastinating,
#   disappointed, concerning

set -euo pipefail

INPUT=$(cat)

# Prevent infinite loops
STOP_ACTIVE=$(printf '%s' "$INPUT" | jq -r '.stop_hook_active // false')
if [ "$STOP_ACTIVE" = "true" ]; then
  exit 0
fi

RESPONSE=$(printf '%s' "$INPUT" | jq -r '.last_assistant_message // ""')
if [ -z "$RESPONSE" ]; then
  exit 0
fi

RESPONSE_LOWER=$(printf '%s' "$RESPONSE" | tr '[:upper:]' '[:lower:]')

# Strip technical compound terms that contain forbidden words but aren't guilt language
# e.g., "lazy-load", "lazy loading", "lazy evaluation", "late binding", "failure mode"
RESPONSE_SANITIZED=$(printf '%s' "$RESPONSE_LOWER" \
  | sed -E 's/lazy[- ](load|loading|evaluation|initialization|init)/__TECH__/g' \
  | sed -E 's/late[- ](binding|bound)/__TECH__/g' \
  | sed -E 's/failure[- ](mode|handling|recovery|injection)/__TECH__/g')

WARNINGS=""

# check_phrase <pattern> <display_name> <reframe>
# Uses grep -i for case-insensitive matching
check_phrase() {
  local pattern="$1"
  local display="$2"
  local reframe="$3"
  if printf '%s' "$RESPONSE_SANITIZED" | grep -qE "$pattern"; then
    WARNINGS="${WARNINGS}\n  - \"${display}\" -> Reframe: ${reframe}"
  fi
}

# Multi-word phrases (order matters — check longer phrases first)
check_phrase '\bfalling behind\b'  'falling behind'  "The lineup shifted"
check_phrase '\bbehind schedule\b' 'behind schedule'  "The lineup shifted"
check_phrase '\bshould have\b'     'should have'      "The show adapts to the performer"
check_phrase '\bcould have\b'      'could have'       "The show adapts to the performer"
check_phrase '\bwasted time\b'     'wasted time'      "Intermission ran long — no cost"

# Single-word phrases (word-boundary matched)
check_phrase '\bfailed\b'         'failed'         "That act got cut from tonight's show"
check_phrase '\bfailure\b'        'failure'        "That act got cut from tonight's show"
check_phrase '\boverdue\b'        'overdue'        "The lineup shifted"
check_phrase '\blate\b'           'late'           "The lineup shifted"
check_phrase '\bunproductive\b'   'unproductive'   "What would make the next act feel good?"
# "lazy" but not technical terms: lazy-load, lazy-loading, lazy evaluation, lazy initialization
check_phrase '\blazy\b' 'lazy' "The show adapts to the performer"
check_phrase '\bprocrastinating\b' 'procrastinating' "The show adapts to the performer"
check_phrase '\bdisappointed\b'   'disappointed'   "The show adapts to the performer"
check_phrase '\bconcerning\b'     'concerning'     "The show adapts to the performer"

if [ -n "$WARNINGS" ]; then
  printf "⚠️ GUILT LANGUAGE DETECTED:${WARNINGS}\n\nThe Showtime framework never guilt-trips. Please rephrase using SNL reframes.\n" >&2
  exit 2
fi

exit 0
