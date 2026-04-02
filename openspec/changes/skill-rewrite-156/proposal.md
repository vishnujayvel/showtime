# Rewrite showtime-director SKILL.md for System Prompt Injection

**Issue:** #156 (Phase 1 — skill only, no UI changes)
**Type:** Refactor

## Problem

The current SKILL.md is written as human-readable documentation. When injected via `--append-system-prompt` into a `claude -p` subprocess, it works (experiment verified) but has issues:
1. The Database Integration section references TypeScript imports that don't exist in the subprocess context
2. The structured output format is buried mid-document — Claude sometimes misses it
3. The energy scheduling rules could be more deterministic (less "may" and "consider", more "ALWAYS" and "NEVER")
4. The skill is ~2,237 tokens — we have budget for up to 20K, so we can be more thorough

## Goals

Rewrite SKILL.md so that when Claude reads it as a system prompt, it:
1. **Always** produces valid `showtime-lineup` JSON when asked to plan a day
2. **Always** follows energy-based scheduling rules (Deep Work first for high, easy first for low)
3. **Never** uses guilt language (the ADHD guardrails)
4. **Always** uses SNL show language (not corporate productivity language)
5. **Correctly** enters Director mode when the user is overwhelmed
6. **Correctly** selects the right verdict category based on beat count

## Changes to SKILL.md

1. **Remove Database Integration section** — not available in subprocess context. Add note that this applies to CLI usage only.
2. **Move Structured Output section to the TOP** — Claude prioritizes early content in system prompts. The JSON format spec should be the first thing it sees after the identity statement.
3. **Make scheduling rules deterministic** — replace "consider" with "ALWAYS". Add explicit ordering rules per energy level.
4. **Add explicit examples** for each energy level showing the expected act order.
5. **Strengthen ADHD guardrails** — the forbidden language list is good, but add the "if in doubt, use the reframe" instruction.
6. **Keep beat check prompts, verdict messages, rest affirmations** — these work well as-is.

## Testing Strategy

Run all 5 eval test cases from `src/skills/showtime/evals/evals.json`:
1. High energy lineup — 4 acts, Deep Work first, Exercise mid, beatThreshold 3
2. Low energy + ADHD guardrails — max 3 acts, no guilt language, reframes self-criticism
3. Director mode — 4 compassionate options, no pressure language
4. Beat check — creative prompt, warm tone
5. Verdict (SOLID SHOW) — correct category for 2/3 beats

Each test: `claude -p --append-system-prompt SKILL.md --max-turns 1 "<prompt>"` 
Verify output against assertions programmatically where possible (JSON parsing, word matching).

## Non-Goals

- No changes to Electron app code (run-manager.ts, WritersRoomView.tsx)
- No changes to evals.json (already drafted)
- No new features in the skill — just optimization for system prompt context
