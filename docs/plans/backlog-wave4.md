---
title: "Wave 4: Features — Issues #97, #89"
status: archived
last-verified: 2026-04-06
---
# Wave 4: Features — Issues #97, #89

## Issue #97: test: record Claude API cassettes for deterministic E2E testing
- Create a VCR-style cassette recording system for Claude API calls
- Record real API request/response pairs and save as JSON cassette files in e2e/cassettes/
- Add a SHOWTIME_PLAYBACK=1 environment variable to replay cassettes instead of hitting the real API
- This enables deterministic E2E tests that don't require a Claude API key
- Follow the existing cassette infrastructure if any exists (check e2e/ for prior cassette work)
- Add at least 2 cassette recordings: one for lineup generation, one for refinement

## Issue #89: feat: Claude Code native skill for Showtime lineup generation
- Create a Claude Code skill at src/skills/showtime/SKILL.md
- The skill should allow users to generate a Showtime lineup from within Claude Code
- Input: user's energy level, available time, and task descriptions
- Output: a structured lineup of Acts with durations, categories, and order
- The skill should use the same lineup generation logic as the Writer's Room chat
- Add usage examples in the skill file

## Testing Strategy
- Run `npm test` — all tests must pass
- For #97: verify cassette recording works with `SHOWTIME_RECORD=1 npm run test:e2e -- --project claude-cassette`
- For #97: verify playback works with `SHOWTIME_PLAYBACK=1 npm run test:e2e -- --project claude-cassette`
- For #89: verify the skill file parses correctly and examples are valid
- Close each issue with proper Root cause / Fix / Test evidence format

## Constraints
- Follow CLAUDE.md rules
- Cassettes should not contain API keys or sensitive data (scrub before saving)
- Skill should be self-contained and not require app to be running
