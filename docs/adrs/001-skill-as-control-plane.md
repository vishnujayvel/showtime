# ADR-001: Skill-as-Control-Plane for Claude Subprocess Identity

**Status:** Accepted
**Date:** 2026-04-01
**Issue:** #156
**LLD:** docs/plans/skill-control-plane-lld.md

## Context

Showtime uses a Claude subprocess (`claude -p`) for the Writer's Room chat. The subprocess was spawned with a generic system prompt (`CLUI_SYSTEM_HINT`) that told Claude it was "a software engineering assistant running inside a GUI chat app." When the UI asked Claude to produce structured `showtime-lineup` JSON, Claude sometimes flagged this as prompt injection because producing lineup JSON wasn't part of its identity.

## Decision

**Replace the generic `CLUI_SYSTEM_HINT` with a unified system prompt that merges UI rendering hints and the full `showtime-director` SKILL.md content.** The subprocess knows from the start: "I am the Showtime Director, a day-planning companion."

Key design choices:
- **Single identity, not dual:** The subprocess is NOT a generic assistant that sometimes produces lineups. It IS the Showtime Director.
- **Skill is the contract:** SKILL.md defines what Claude produces (lineup JSON format, scheduling rules, ADHD guardrails). The UI sends clean user intent only.
- **`--append-system-prompt` injection:** The skill content is appended to Claude's system prompt on every subprocess spawn. Experimentally verified: does not compound on session resume.
- **No Anthropic SDK:** All interaction goes through `claude -p`. Non-negotiable.

## Alternatives Considered

1. **Rephrase the user-side prompt** to avoid injection detection — fragile, still duplicates format instructions in UI code.
2. **Append skill separately** from CLUI_HINT — creates dual identity confusion.
3. **Use Anthropic SDK directly** — rejected. We use `claude -p` for the full Claude Code tool ecosystem.

## Consequences

- Claude subprocess reliably produces `showtime-lineup` JSON without injection warnings
- SKILL.md is the single source of truth — no format duplication in UI code
- ~2,237 tokens added to every subprocess call (~$0.03/session cost)
- `WritersRoomView.tsx` simplified — sends "Plan my day" not 55 lines of format instructions
- Skill changes require app restart in production (cached at module load)
- Future skills can follow the same pattern — inject via `--append-system-prompt`

## Related

- LLD: `docs/plans/skill-control-plane-lld.md` (3 review rounds, approved)
- Skill: `src/skills/showtime/SKILL.md` (rewritten for system prompt context)
- Experiments: `--append-system-prompt` bypass injection (verified), resume compounding (verified: does not compound)
