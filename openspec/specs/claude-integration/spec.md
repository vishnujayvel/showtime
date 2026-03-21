# Claude Integration Spec

## Overview

Showtime uses Claude Code subprocess (`claude -p --output-format stream-json`) as the AI engine for structuring day plans. The user dumps free text in the Writer's Room, Claude structures it into a Show Lineup with energy-aware scheduling via the SNL skill.

## Current State

The Claude subprocess infrastructure is inherited from CLUI CC and works:
- `src/main/claude/` — RunManager, ControlPlane, StreamParser, event normalization
- `src/preload/index.ts` — typed IPC bridge (`window.clui.sendMessage()`)
- `src/renderer/stores/sessionStore.ts` — `sendMessage()` action routes to Claude
- `src/renderer/panels/ChatPanel.tsx` — parses `showtime-lineup` JSON from Claude responses

**Gap:** WritersRoomView uses mock lineup generation instead of calling Claude. The ChatPanel integration exists but isn't wired into the WritersRoom flow.

## Requirements

### Writer's Room Claude Integration
- WHEN the user submits plan text THEN Showtime SHALL send to Claude with energy level and SNL skill context
- WHEN Claude responds with `showtime-lineup` JSON THEN Showtime SHALL parse and populate the Show Lineup
- IF Claude is unavailable or times out THEN Showtime SHALL show an error with option to retry or use manual entry
- WHILE Claude is processing THE submit button SHALL show "Planning..." and be disabled

### SNL Skill Context
- The prompt includes: user's text, selected energy level, current date
- Claude returns: ordered Acts with name, sketch category, duration, energy-aware scheduling
- The skill at `src/skills/showtime/SKILL.md` defines the response format

## Files

- `src/renderer/views/WritersRoomView.tsx` — needs Claude integration (currently mock)
- `src/renderer/panels/ChatPanel.tsx` — has working Claude integration
- `src/renderer/stores/sessionStore.ts` — sendMessage() action
- `src/skills/showtime/SKILL.md` — SNL skill for Claude
