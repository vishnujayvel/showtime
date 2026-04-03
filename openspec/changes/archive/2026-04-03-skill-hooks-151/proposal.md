# Showtime Director — Production Hooks

**Issue:** #151 (hooks portion only — evals are interactive, handled separately)
**Type:** Feature

## Production Hooks for showtime-director Skill

Create Claude Code hooks that validate the showtime-director skill's output at runtime. These hooks enforce the skill's contract automatically.

### Hook 1: lineup-schema-validator
**Trigger:** After assistant response
**Check:** Scan response for ```showtime-lineup code blocks. If found, validate:
- JSON parses without error
- `acts` is a non-empty array
- Each act has `name` (string), `sketch` (valid category), `durationMinutes` (positive number)
- `beatThreshold` is a number between 1 and 5
- `openingNote` is a non-empty string
- Valid sketch values: "Deep Work", "Exercise", "Admin", "Creative", "Social", "Personal"
**Action:** If validation fails, print a warning with the specific field that failed

### Hook 2: guilt-language-guard
**Trigger:** After assistant response
**Check:** Scan response text for forbidden ADHD guilt words:
- failed, failure, falling behind, overdue, late, behind schedule
- should have, could have, wasted time, unproductive
- lazy, procrastinating, disappointed, concerning
**Action:** If found, print a warning identifying the forbidden word and suggest the SNL reframe

### Hook 3: beat-threshold-energy-check
**Trigger:** After assistant response (only if showtime-lineup block found)
**Check:** Cross-reference beatThreshold with energy level in the conversation:
- High energy: beatThreshold should be 3-5
- Medium: 2-4
- Low: 1-3
- Recovery: 1-2
**Action:** Warn if threshold seems mismatched for the energy level

### Hook 4: act-duration-bounds
**Trigger:** After assistant response (only if showtime-lineup block found)
**Check:** Each act's durationMinutes is between 10 and 120
**Action:** Warn if any act is outside bounds

## Implementation

Hooks go in `.claude/settings.json` under the `hooks` key. Each hook is a shell script in `src/skills/showtime/hooks/`:
- `src/skills/showtime/hooks/validate-lineup.sh`
- `src/skills/showtime/hooks/guilt-language-guard.sh`
- `src/skills/showtime/hooks/beat-threshold-check.sh`
- `src/skills/showtime/hooks/act-duration-bounds.sh`

Register them in settings.json:
```json
{
  "hooks": {
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "command": "bash src/skills/showtime/hooks/validate-lineup.sh"
      }
    ]
  }
}
```

Actually — hooks should fire on assistant response, not tool use. Check the Claude Code hooks API for the correct event type.

## Testing Strategy
- Create test inputs (valid lineup, invalid lineup, guilt language, edge cases)
- Run each hook script against test inputs and verify output
- Ensure hooks don't interfere with normal Claude Code operation

## Non-Goals
- Skill evals (interactive, separate session)
- Modifying the SKILL.md itself
- Changes to the Electron app
