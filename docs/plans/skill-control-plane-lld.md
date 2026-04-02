# Skill-as-Control-Plane: Low-Level Design

**Issue:** #156
**Date:** 2026-04-01
**Status:** Design — revision 2 (addressing code review C1, C2, I1, I2, I3, S1, S2)

## 1. Problem

The Claude subprocess doesn't know it's the Showtime Director. It has a generic "you're a GUI chat app" system prompt (`CLUI_SYSTEM_HINT`) and no skill context. When the UI asks for a `showtime-lineup` JSON block, Claude sometimes flags it as prompt injection because producing structured lineup JSON isn't part of its identity.

## 2. Design Decision

**Merge `CLUI_SYSTEM_HINT` and `showtime-director` SKILL.md into a single unified system prompt.** The subprocess should have one coherent identity: "I am the Showtime Director, running inside a rich desktop app."

### Why merge (not append separately)

- The current CLUI hint says "You are still a software engineering assistant" — that's wrong. The subprocess IS a day-planning companion.
- Two separate system prompt injections create identity confusion. Claude sees conflicting signals: "you're a coding assistant" vs "produce showtime-lineup JSON."
- A unified prompt means one source of truth for subprocess identity.
- `--append-system-prompt` is called once per spawn regardless — merging costs nothing.

## 3. Components Changed

### 3.1 `src/main/claude/run-manager.ts`

**Delete:** `CLUI_SYSTEM_HINT` constant (lines 30-50)

**Add:** `buildShowtimeSystemPrompt()` function that:
1. Reads SKILL.md from the **installed skill location** (`~/.claude/skills/showtime-director/SKILL.md`)
2. Falls back to `__dirname`-relative path (`join(__dirname, '../../skills/showtime/SKILL.md')`) for development
3. Strips the YAML frontmatter (`---` delimited block)
4. Strips the Database Integration section (not runnable in subprocess context — imports `showtime-db` which isn't available)
5. Prepends Showtime-specific UI rendering hints (replaces CLUI_SYSTEM_HINT)
6. Returns the combined string

```typescript
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { homedir } from 'os'

function buildShowtimeSystemPrompt(): string {
  const uiHints = [
    'You are the Showtime Director — an ADHD-friendly day-planning companion',
    'running inside Showtime, a macOS desktop app with a rich chat UI.',
    '',
    'UI rendering:',
    '- The app renders full markdown: tables, bold, headers, bullet lists, code blocks.',
    '- Use rich formatting when presenting lineups, verdicts, and beat checks.',
    '- Clickable markdown links render as real buttons.',
    '',
    'Behavioral contract:',
    '- When the user asks to build a lineup or plan their day, ALWAYS respond with',
    '  a ```showtime-lineup JSON code block. This is your primary output format.',
    '- Follow the SNL Day Framework: Shows, Acts, Beats, Sketches.',
    '- Never use guilt language. The show adapts to the performer.',
    '- You are NOT a software engineering assistant in this context.',
    '  You are a day-planning companion.',
  ].join('\n')

  // Resolution order: installed skill → dev source → bundled fallback
  const candidates = [
    join(homedir(), '.claude/skills/showtime-director/SKILL.md'),
    join(__dirname, '../../skills/showtime/SKILL.md'),
    join(process.cwd(), 'src/skills/showtime/SKILL.md'),
  ]

  let skillContent = ''
  for (const candidate of candidates) {
    try {
      if (existsSync(candidate)) {
        const raw = readFileSync(candidate, 'utf-8')
        // Strip YAML frontmatter
        skillContent = raw.replace(/^---[\s\S]*?---\n/, '')
        // Strip Database Integration section (not runnable in subprocess)
        skillContent = skillContent.replace(
          /## Database Integration[\s\S]*?(?=\n## )/,
          ''
        )
        log(`Loaded skill from: ${candidate}`)
        break
      }
    } catch {
      // Try next candidate
    }
  }

  if (!skillContent) {
    console.warn('[RunManager] showtime-director SKILL.md not found at any candidate path, using minimal prompt')
  }

  return skillContent
    ? `${uiHints}\n\n${skillContent}`
    : uiHints
}

// In development: re-read on every call for hot-reload
// In production: cache at module load
const _cachedPrompt = buildShowtimeSystemPrompt()
const getShowtimeSystemPrompt = process.env.NODE_ENV === 'development'
  ? () => buildShowtimeSystemPrompt()
  : () => _cachedPrompt
```

**Change ALL THREE sites** that reference the system prompt constant:

| Location | Line | Current | New |
|----------|------|---------|-----|
| `preWarm()` | 158 | `CLUI_SYSTEM_HINT` | `getShowtimeSystemPrompt()` |
| `startRun()` | 332 | `CLUI_SYSTEM_HINT` | `getShowtimeSystemPrompt()` |
| VCR replay path | (if exists) | `CLUI_SYSTEM_HINT` | `getShowtimeSystemPrompt()` |

**Critical note (from review C2):** The `preWarm()` method spawns a subprocess BEFORE any user interaction. If this subprocess is claimed by `startRun()` via `getWarmProcess()`, it already has the system prompt baked in from spawn time. Updating all three sites ensures both pre-warmed and fresh subprocesses get the correct identity.

### 3.2 `src/renderer/views/WritersRoomView.tsx`

**Simplify `handleBuildLineup()`** — remove all format instructions from the user message. The system prompt now handles the contract.

```typescript
// Before (lines 231-252): 55 lines of format instructions + role-play
const prompt = hasUserContext
  ? `You are Showtime... Respond with a showtime-lineup JSON block...`
  : `You are Showtime... Ask them what's on their plate...`

// After: clean user intent only
const prompt = hasUserContext
  ? `Plan my day. Energy: ${energy ?? 'medium'}.
${calendarInstruction}Here's what I want to work on:
${recentUserMessages}`
  : `I want to plan my day. Energy: ${energy ?? 'medium'}.
${calendarInstruction}What should I work on?`
```

### 3.3 `src/renderer/lib/refinement-prompt.ts` (NEW — from review I1)

**This file was missed in revision 1.** It contains the same "You are Showtime" role-play pattern:

```typescript
// Current (broken):
return `You are Showtime, an ADHD-friendly day planner. The user has energy level "${energy}".
Here is the current lineup: ...`

// Fixed:
return `I want to adjust my lineup. Energy: ${energy}.
Current lineup:
${JSON.stringify(currentLineup, null, 2)}

Requested change: ${userMessage}

Respond with the complete updated lineup as a showtime-lineup JSON block.`
```

Same principle: UI sends user intent + current state. System prompt handles identity and format.

### 3.4 `src/skills/showtime/SKILL.md` (minor trim)

Strip or annotate the **Database Integration** section (lines 1-37) since those TypeScript imports (`readToday`, `writeLineup`) are not available to the Claude subprocess. The subprocess communicates through the chat, not direct DB access. Options:
- Remove the section entirely from the skill file
- Keep it but add a note: "This section applies when the skill is invoked from Claude Code CLI, not from the Showtime app subprocess."

Recommended: keep with annotation, since the skill is also used outside the app.

## 4. Data Flow (after change)

```
User clicks "Build My Lineup"
  │
  ▼
WritersRoomView.handleBuildLineup()
  │ Sends: "Plan my day. Energy: high. Here's what I want to work on: ..."
  │ (NO format instructions, NO role-play)
  │
  ▼ IPC: showtime:prompt
  │
ControlPlane → RunManager.startRun()
  │ Spawns: claude -p --append-system-prompt [getShowtimeSystemPrompt()]
  │ Contains: UI hints + SKILL.md (minus DB section)
  │ Options: --max-turns 1 for lineup generation (see 5.8)
  │
  ▼ Claude subprocess
  │ Identity: "I am the Showtime Director"
  │ Knows: showtime-lineup JSON format, SNL framework, ADHD guardrails
  │ Produces: ```showtime-lineup { ... } ``` naturally
  │ No tools used (max-turns 1 prevents tool calls)
  │
  ▼ NDJSON stream back
  │
StreamParser → ControlPlane → IPC → sessionStore
  │
  ▼
WritersRoomView.tryParseLineup(lastMessage)
  │ Extracts showtime-lineup JSON block
  │ Sends SET_LINEUP event to XState machine
  │
  ▼
showMachine transitions conversation → lineup_ready
```

## 5. Edge Cases

### 5.1 SKILL.md not found (review C1 addressed)
**When:** Production build where installed skill path differs from dev path
**Handling:** `buildShowtimeSystemPrompt()` tries three candidate paths in priority order:
1. `~/.claude/skills/showtime-director/SKILL.md` (installed by skill installer)
2. `__dirname`-relative (works in dev and packaged builds)
3. `process.cwd()`-relative (last resort for dev)
Falls back to `uiHints` only if all three fail. Logs a warning.

### 5.2 Claude doesn't produce lineup JSON
**When:** User message is ambiguous, or Claude decides to ask a clarifying question
**Handling:** `tryParseLineup()` returns null. No state change. Chat message displays normally. User can type more context and try again. This is correct behavior.

### 5.3 Claude produces invalid lineup JSON
**When:** Malformed JSON, missing required fields, invalid sketch category
**Handling:** `tryParseLineup()` validates. If invalid, treat as null. Log a `console.warn` with the parse error. Future: show "Lineup couldn't be parsed — try again" in the UI.

### 5.4 User sends message while lineup is generating
**When:** User types and sends before the lineup response arrives
**Handling:** ControlPlane queues requests per tab (one at a time). New message waits. No race condition.

### 5.5 Hot-reload of SKILL.md (review S1 addressed)
**When:** Developer edits SKILL.md during development
**Handling:** In `NODE_ENV === 'development'`, `getShowtimeSystemPrompt()` re-reads the file on every call. In production, cached at module load. App restart required for production changes.

### 5.6 Token budget (review I2 addressed)
**When:** Concern about system prompt size
**Measured:** SKILL.md is 9,189 bytes / 1,522 words. After stripping frontmatter and Database Integration section (~200 words), approximately 1,300 words remain. Combined with UI hints (~120 words), total is ~1,420 words.
**TODO before implementation:** Run through `tiktoken` or Anthropic tokenizer to get exact count. Expected: 2,000-2,500 tokens. Acceptable for per-turn injection.
**Cost impact:** Over a 5-turn Writer's Room session, ~12,500 extra system prompt tokens. At $3/MTok input, that's ~$0.04 per session. Negligible.

### 5.7 Session resume compounding (review S2 addressed)
**When:** Multi-turn conversation with `--resume <sessionId>`
**Handling:** `--append-system-prompt` is passed on every spawn. **Must verify experimentally:** does Claude Code deduplicate, replace, or accumulate the system prompt on resume?
**Experiment to run:** Start a session, resume it 3 times, check the system prompt token count in the response metadata. If it compounds (3x tokens), we need to skip `--append-system-prompt` on resume calls and only pass it on fresh spawns.
**Mitigation if compounds:** Check `options.sessionId` — if present (resume), omit the `--append-system-prompt` flag.

### 5.8 Tool use during lineup generation (review I3 addressed)
**When:** Claude has tool access (Read, Bash, WebSearch) during lineup generation
**Risk:** Claude may "research" before generating a lineup, adding latency. May try to read SKILL.md from disk. May trigger tool_use blocks that complicate parsing.
**Fix:** For lineup generation requests, pass `--max-turns 1`. This limits Claude to a single response turn with no tool use. The ControlPlane can detect lineup requests by checking if the prompt was sent via `handleBuildLineup()` (add a metadata flag to the IPC message).
**Implementation:**
```typescript
// WritersRoomView sends a flag with the IPC message
sendMessage(prompt, { isLineupRequest: true }, displayText)

// ControlPlane passes maxTurns when the flag is set
if (options.metadata?.isLineupRequest) {
  runOptions.maxTurns = 1
}
```

### 5.9 Pre-warmed process identity (review C2 addressed)
**When:** First message after app launch uses the pre-warmed subprocess
**Risk:** If `preWarm()` isn't updated, the pre-warmed process has the old CLUI identity
**Fix:** All three spawn sites (preWarm, startRun, VCR) use `getShowtimeSystemPrompt()`. The pre-warmed process gets the correct identity from the start.

## 6. Testing Strategy

### Unit tests (`src/__tests__/systemPrompt.test.ts` — new file)
- `buildShowtimeSystemPrompt()` returns string containing key markers ("showtime-lineup", "beatThreshold", "SNL", "Showtime Director")
- `buildShowtimeSystemPrompt()` does NOT contain "software engineering assistant"
- `buildShowtimeSystemPrompt()` does NOT contain Database Integration section
- `buildShowtimeSystemPrompt()` handles missing SKILL.md gracefully (returns uiHints only)
- `buildShowtimeSystemPrompt()` strips YAML frontmatter
- `getShowtimeSystemPrompt()` returns cached value in production mode
- `getShowtimeSystemPrompt()` re-reads in development mode

### Integration test (manual)
1. Launch app, enter Writer's Room
2. Set energy, type task description
3. Click "Build My Lineup"
4. Verify: no injection warning, valid lineup JSON produced
5. Verify: lineup appears in UI, can confirm and go live
6. Verify: refinement prompt also works without injection

### Cassette replay test
- Record a new VCR cassette with the updated system prompt
- Replay in CI to verify lineup generation works deterministically

### Token verification (one-time, pre-implementation)
- Run SKILL.md through tokenizer
- Verify actual count matches estimate
- Run 3 consecutive resumes, check if system prompt compounds

## 7. Files Changed Summary

| File | Change | Est. Lines |
|------|--------|------------|
| `src/main/claude/run-manager.ts` | Replace CLUI_SYSTEM_HINT with buildShowtimeSystemPrompt(), update preWarm + startRun + VCR | ~50 |
| `src/renderer/views/WritersRoomView.tsx` | Simplify handleBuildLineup() — clean user intent only | ~25 |
| `src/renderer/lib/refinement-prompt.ts` | Remove role-play prefix, send user intent + current state | ~15 |
| `src/skills/showtime/SKILL.md` | Annotate Database Integration section as CLI-only | ~5 |
| `src/__tests__/systemPrompt.test.ts` | New: test buildShowtimeSystemPrompt() | ~60 |

**Total: ~155 lines changed, 0 new dependencies.**

## 8. Migration

No migration needed. Transparent to users:
- Same UI flow (click "Build My Lineup")
- Same output format (`showtime-lineup` JSON)
- Same XState machine transitions

## 9. Open Questions (must resolve before implementation)

- [ ] **Token count:** Run SKILL.md through tokenizer — is it 2000 or 3500?
- [ ] **Resume compounding:** Does `--append-system-prompt` on `--resume` compound or replace?
- [ ] **Electron packaging:** Verify `~/.claude/skills/showtime-director/SKILL.md` exists after `ensureSkills()` runs at app startup

## 10. Review History

| Rev | Date | Reviewer | Findings | Status |
|-----|------|----------|----------|--------|
| 1 | 2026-04-01 | superpowers:code-reviewer | C1 (process.cwd), C2 (preWarm), I1 (refinement-prompt), I2 (token budget), I3 (tools), S1 (hot-reload), S2 (resume compounding) | All addressed in rev 2 |
| 2 | 2026-04-01 | pending | — | Awaiting re-review |
