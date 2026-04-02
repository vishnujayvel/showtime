# Skill-as-Control-Plane Integration (Phase 2)

**Issue:** #156
**Type:** Feature
**Depends on:** Phase 1 (PR #157 — skill rewrite) must be merged first
**LLD:** docs/plans/skill-control-plane-lld.md (approved, 3 review rounds)
**ADR:** docs/adrs/001-skill-as-control-plane.md

## What to implement

Follow the approved LLD exactly. 7 files, ~170 lines.

### 1. `src/main/claude/run-manager.ts`
- Delete `CLUI_SYSTEM_HINT` constant (lines 30-50)
- Add `buildShowtimeSystemPrompt()` function:
  - Read SKILL.md from 3-candidate path resolution (installed → __dirname → cwd)
  - Strip YAML frontmatter and Database Integration section
  - Prepend Showtime identity + UI rendering hints
  - Cache in production, re-read in dev
- Replace `CLUI_SYSTEM_HINT` at BOTH sites: `preWarm()` line 158 and `startRun()` line 332

### 2. `src/renderer/views/WritersRoomView.tsx`
- Simplify `handleBuildLineup()`: remove all format instructions and role-play
- Send clean user intent: "Plan my day. Energy: X. Here's what I want to work on: ..."
- Pass `maxTurns: 1` for lineup generation requests (not refinement)

### 3. `src/renderer/lib/refinement-prompt.ts`
- Remove "You are Showtime" role-play prefix
- Send user intent + current lineup state only

### 4. `src/renderer/stores/sessionStore.ts`
- Change `sendMessage` to accept options bag: `{ displayText?, maxTurns? }`
- Forward `maxTurns` to RunOptions

### 5. `src/main/skills/manifest.ts`
- Add `showtime` as bundled skill entry

### 6. `src/skills/showtime/SKILL.md`
- Annotate Database Integration section as CLI-only

### 7. `src/__tests__/systemPrompt.test.ts` (new)
- Test buildShowtimeSystemPrompt() returns correct markers
- Test fallback when SKILL.md missing
- Test frontmatter stripping

## Testing Strategy

- Unit tests for buildShowtimeSystemPrompt()
- Build the app (`npm run build`)
- Launch dev mode (`npm run dev`)
- Manual test: Writer's Room → Build My Lineup → verify lineup appears without injection
- Verify: refinement also works
- Run full test suite

## Non-Goals
- Eval expansion (iteration 2, separate task)
- Production packaging changes (Vite copy plugin — separate task)
- Hook scoping (guilt-language-guard too aggressive during dev conversations — separate fix)
