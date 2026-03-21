# Showtime Retrospective — March 20, 2026

## Context

Showtime is an ADHD-friendly macOS day planner using the SNL (Saturday Night Live) framework. Built as a fork of CLUI CC (Electron + React Claude Code wrapper). The entire codebase was generated in a single Loki Mode session on March 20, 2026.

**Repo:** `/Users/vishnu/workplace/showtime`
**Origin:** `https://github.com/vishnujayvel/showtime.git`

---

## What Was Built

- **Tech:** Electron 35.7.5 + React 19 + Tailwind CSS 4 + Zustand
- **Source:** 55 TypeScript files, ~12,700 lines
- **Spec completion:** 22/26 tasks (85%)
- **Git commits:** ZERO — all code is uncommitted working directory changes
- **Build:** TypeScript compiles, electron-vite builds successfully

### Files Created (All Uncommitted)

**Views:** PillView, ExpandedView, WritersRoomView, StrikeView
**Panels:** ChatPanel, LineupPanel, TimerPanel, CalendarPanel
**Components:** ActCard, BeatCheckModal, BeatCounter, DirectorMode, EnergySelector, RestAffirmation, ShowVerdict
**State:** showStore.ts (Zustand, 405 lines), shared/types.ts
**Hooks:** useTimer.ts
**Skill:** src/skills/showtime/SKILL.md (208 lines)
**Tests:** E2E (Playwright), unit (Vitest) — written but never run

### Tasks Still Pending

- Task 4: Simplify sessionStore to single-session (deferred)
- Task 24: Remove CLUI-only components (dead weight)
- Task 25: Update package.json & build config
- Task 26: End-to-end smoke test

---

## What Actually Works (Verified)

| Layer | Status |
|-------|--------|
| TypeScript compilation | Clean (zero Showtime-specific errors) |
| electron-vite build | Compiles (main: 128KB, preload: 7KB, renderer: 1.4MB) |
| showStore state machine | Written, has tests |
| SNL skill | Written, JSON schema defined |

## What Was Never Verified

| Layer | Status |
|-------|--------|
| App actually launches | Never tried |
| UI components render | Never seen |
| Claude subprocess connects | Never tested |
| Timer ticks | Never observed |
| Beat check flow | Never exercised |
| Pill ↔ Expanded transition | Never animated |
| End-to-end user flow | Never run |

---

## 5 Wrong Assumptions

### 1. "Fork CLUI CC" Created More Debt Than Savings

**The assumption:** Forking CLUI CC saves 5-7 days by inheriting Claude subprocess management, IPC bridge, window management, and build pipeline.

**The reality:** The fork DOES save real time on infrastructure (~5 days). But it carries 2,917 lines of CLUI code (sessionStore multi-tab logic, ConversationView, InputBar, HistoryPicker, MarketplacePanel, etc.) that Showtime doesn't need. Showtime-specific code is only 1,936 lines — the app is 60% inherited baggage.

**The nuance:** The fork decision was defensible. The execution was wrong. Should have immediately gutted CLUI down to just `src/main/claude/*` and the IPC bridge, then built Showtime fresh on that clean substrate. Instead, Loki Mode built around CLUI, creating a hybrid.

### 2. MLP Scoped Out The Core Value Proposition

Requirements explicitly excluded:
- Calendar integration (C-3: "user manually inputs schedule")
- Mem0 / cross-session memory (FR-11.3, C-5: "independent of daily-copilot")
- Cross-day persistence
- Interview awareness (48h lookahead)
- Gamification (XP, momentum)

Without these, Showtime is a fancy Pomodoro timer with SNL language. The integrations are what make the daily-copilot SNL framework actually valuable.

### 3. "File Created" ≠ "Feature Works"

Loki Mode's task completion criteria: file exists + TypeScript compiles.
Loki Mode did NOT verify: rendering, state transitions, subprocess connection, timer behavior, animation, user flows.

22/26 tasks "completed" but zero features verified end-to-end.

### 4. Two Tools, Neither Finished

- **OpenSpec:** Generated comprehensive PRD (670 lines), requirements (12 FRs), design, 26 tasks. Never validated the design was achievable in one session.
- **Loki Mode:** Executed 22/26 tasks, generated all files. Never ran the app, never committed, never tested integration.

OpenSpec optimized for spec completeness. Loki optimized for task throughput. Neither optimized for working software.

### 5. No Incremental Verification Loop

Flow was: Design → Generate all files → Mark tasks done → Stop.
Should have been: Design → Build foundation → RUN IT → Fix → Commit → Add next feature → RUN IT → Fix → Commit → Repeat.

Zero feedback loops. No human ever saw this app running.

---

## CLUI Fork: Detailed Cost/Benefit

### What The Fork Saves (Real Value)

| Infrastructure | Effort Saved |
|----------------|-------------|
| Claude subprocess (`claude -p --output-format stream-json`) | 2-3 days |
| NDJSON stream parsing + event normalization | 1 day |
| IPC bridge (preload → main → renderer) | 1 day |
| Permission server (tool approval UI) | 1-2 days |
| Window management (NSPanel, always-on-top) | 1 day |
| electron-vite build pipeline | 0.5 day |
| **Total** | **~5-7 days** |

### What The Fork Costs (Debt Carried)

| CLUI Baggage | Size | Impact |
|-------------|------|--------|
| sessionStore.ts (multi-tab) | 25,538 bytes (784 lines) | Showtime needs single-session; deferred as "too risky" |
| ConversationView.tsx | 27,707 bytes (847 lines) | General chat rendering Showtime doesn't use |
| InputBar.tsx | 27,285 bytes (705 lines) | Rich input Showtime partially needs |
| HistoryPicker, MarketplacePanel, SettingsPopover, StatusBar, TabStrip | ~15K bytes | All dead weight, deletion still pending |
| 43 pre-existing TypeScript errors | In files slated for deletion | Noise in the codebase |
| 858MB node_modules | Includes unused CLUI deps | Bloated dependency tree |

---

## Strategic Options (Discussed, Not Yet Decided)

### Option 1: Clean The Fork (Recommended)
- Delete CLUI dead weight (Tasks 24-25)
- Simplify sessionStore to single-session
- Commit what works
- Run it, iterate
- **Timeline:** ~2-3 days to running app
- **Risk:** CLUI coupling remains in sessionStore

### Option 2: Fresh Shell + Cherry-Pick
- New Electron + React project from scratch
- Copy ONLY src/main/claude/* and IPC bridge (4 files)
- Reuse types, showStore, skill logic
- Rebuild UI layer clean
- **Timeline:** ~5-7 days
- **Risk:** More upfront work, but zero debt

### Option 3: Skip Electron Entirely
- Tauri 2.0 (Rust + WebView, ~10MB binary) or SwiftUI native
- Best long-term product
- **Timeline:** 1-2 weeks
- **Risk:** Platform learning curve, full rewrite

---

## Key Files

| File | Purpose |
|------|---------|
| `docs/plans/2026-03-20-showtime-design.md` | Original design document (494 lines) |
| `.claude/specs/showtime-snl-planner/requirements.md` | Functional requirements (12 FRs) |
| `.claude/specs/showtime-snl-planner/tasks.md` | Implementation tasks (26 tasks, 22 done) |
| `.claude/specs/showtime-snl-planner/design.md` | Technical design |
| `.loki/openspec-prd-normalized.md` | OpenSpec PRD (670 lines) |
| `src/renderer/stores/showStore.ts` | Core state machine (409 lines) |
| `src/shared/types.ts` | Show types (ShowPhase, Act, ShowLineup, etc.) |
| `src/skills/showtime/SKILL.md` | SNL skill for Claude (208 lines) |

---

## Daily-Copilot SNL Framework Gaps (Pre-Showtime)

Separate from the app, the daily-copilot SNL framework itself has gaps:

| Feature | Config Exists? | Actually Tracked? |
|---------|---------------|-------------------|
| SNL Day Acts/Beats | Yes | Yes (Mem0 + Obsidian) |
| XP System | Yes (defaults.json) | **No — never written** |
| Momentum Scores | Yes (momentum.md) | **No — never persisted** |
| `~/.local/share/daily-copilot/` | Referenced | **Directory doesn't exist** |
| `snl-state.json` | Referenced | **Never created** |
| `momentum.json` | Referenced | **Never created** |
| Urgency Tags | Yes | **No — never computed** |

---

*Written: March 20, 2026. Session retrospective covering the Loki Mode build and daily-copilot audit.*
