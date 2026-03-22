# Showtime Consolidation Refactor Plan

**Date:** 2026-03-21
**Scope:** Post-sprint consolidation after 8+ Loki autonomous runs
**Goal:** Code simplification, dead code removal, module extraction, type safety, test quality

---

## Executive Summary

The codebase is in better shape than many post-sprint codebases. The architecture is coherent, the view layer is consistently structured, and the data layer (`src/main/data/`) is cleanly decomposed. However, `src/main/index.ts` at **1,266 lines** is the single biggest liability. The session store carries CLUI-era dead weight. Several `as any` casts bypass type safety. And there are legacy IPC channels defined but never used.

**Total renderer source:** 4,432 lines across 32 files (manageable)
**Total main process:** 1,266 lines in one file + 2,298 lines across 4 Claude subprocess files
**E2E test:** 1,328 lines in one file (needs splitting)

---

## Module 1: Main Process Decomposition

### Current State

`src/main/index.ts` is **1,266 lines** containing:
- Window creation and lifecycle (lines 135-292) — 158 lines
- IPC handler registrations (lines 296-1001) — 706 lines
- Tray menu setup (lines 1216-1234) — 19 lines
- App lifecycle, shortcuts, permissions (lines 1101-1266) — 166 lines
- Debug/spaces snapshot utilities (lines 60-91) — 32 lines
- ControlPlane event wiring (lines 94-107) — 14 lines

### Problems

1. **God file.** Every IPC handler, window operation, and lifecycle hook lives in one file. Adding a new IPC channel means editing a 1,266-line file.

2. **Scattered `require()` calls.** Lines 314, 333, 415, 423, 431, 726-727, 771-774, 818-820, 847-850, 907, 1004, 1030 all use `require()` inside handler bodies instead of top-level imports. This defeats tree-shaking and makes dependency tracing impossible. Examples:
   - `const { execSync } = require('child_process')` at line 314
   - `const { Notification } = require('electron')` repeated three times (lines 415, 423, 431)
   - `const { basename, extname } = require('path')` at line 726 (already imported at top as `{ join }`)

3. **CLUI-inherited IPC handlers with zero Showtime usage.** The following handlers exist solely because the CLUI codebase had them:
   - `ATTACH_FILES` (lines 709-761) — Showtime has no file attachment UI
   - `TAKE_SCREENSHOT` (lines 763-813) — No screenshot flow in Showtime
   - `PASTE_IMAGE` (lines 816-844) — No paste image flow
   - `TRANSCRIBE_AUDIO` (lines 846-1000) — 155 lines of whisper integration with no renderer consumer
   - `OPEN_IN_TERMINAL` (lines 1029-1067) — No "open in terminal" button
   - `MARKETPLACE_*` (lines 1069-1089) — No marketplace UI
   - `LIST_SESSIONS` (lines 547-623) — 77 lines of JSONL parsing, only used by HistoryView (which uses the SQLite `getShowHistory` instead)
   - `LOAD_SESSION` (lines 626-683) — Same JSONL-based session loading, dead path

4. **Duplicate Notification construction.** `new Notification(...)` pattern repeated three times in nearly identical blocks (lines 413-441). Should be a helper.

### Proposed Extraction

```
src/main/
  index.ts              ← App lifecycle only (~100 lines): app.whenReady, will-quit, activate
  window.ts             ← Window creation, showWindow, toggleWindow, applyViewMode, drag tracking
  ipc/
    core.ts             ← Claude subprocess IPC: PROMPT, CANCEL, STOP_TAB, etc.
    showtime.ts         ← Showtime-specific: notifications, view mode, data persistence
    legacy.ts           ← Keep CLUI handlers here with clear "LEGACY" label (or delete)
  tray.ts               ← Tray creation, context menu
  shortcuts.ts          ← Global shortcut registration (Alt+Space, Cmd+Shift+K)
  permissions.ts        ← macOS permission preflight
  day-boundary.ts       ← Day boundary interval check
  debug.ts              ← SPACES_DEBUG snapshot utilities
  window-geometry.ts    ← Already extracted, good
  data/                 ← Already clean, no changes needed
  claude/               ← Already clean, no changes needed
```

### Specific Actions

| Action | Files Touched | Risk |
|--------|--------------|------|
| Extract window management to `src/main/window.ts` | index.ts (remove), window.ts (create) | Low |
| Extract IPC handlers to `src/main/ipc/` directory | index.ts (remove), ipc/*.ts (create) | Medium |
| Delete CLUI-only handlers (ATTACH_FILES, TAKE_SCREENSHOT, PASTE_IMAGE, TRANSCRIBE_AUDIO, OPEN_IN_TERMINAL, MARKETPLACE_*, LIST_SESSIONS, LOAD_SESSION) | index.ts, preload/index.ts, shared/types.ts | Medium — must verify no renderer imports |
| Replace `require()` with top-level imports | All extracted files | Low |
| Extract notification helper | ipc/showtime.ts | Low |

**Estimated scope:** ~800 lines moved, ~300 lines deleted, 6-8 new files created

---

## Module 2: Store Simplification

### Current State

- `showStore.ts`: 695 lines, well-structured with clear action groups
- `sessionStore.ts`: 517 lines, carries heavy CLUI session management

### Problems

1. **sessionStore carries dead CLUI weight.** The `TabState` interface has 25 fields, most of which Showtime never reads from a view:
   - `attachments` — no attachment UI
   - `sessionModel`, `sessionTools`, `sessionMcpServers`, `sessionSkills`, `sessionVersion` — no session info display
   - `queuedPrompts` — no prompt queue UI
   - `additionalDirs`, `hasChosenDirectory` — no directory picker
   - `permissionDenied` — no permission denial card
   - `hasUnread` — no unread indicator
   The entire `handleNormalizedEvent` switch (lines 236-473) processes 11 event types, but Showtime only uses `session_init` (for sessionId), `text_chunk` + `task_complete` (for lineup parsing in WritersRoomView), and `error`/`session_dead` (for error display). The rest (`tool_call`, `tool_call_update`, `tool_call_complete`, `task_update`, `rate_limit`, `permission_request`) build up a `messages` array that nothing renders.

2. **Duplicate `isExpanded` state.** Both `sessionStore` (line 29: `isExpanded: boolean`) and `showStore` (via `selectIsExpanded` selector) track expansion state. `sessionStore.isExpanded` is never read by any component — it's dead state. `sessionStore.toggleExpanded` (line 149) is never called.

3. **Duplicate `toggleExpanded`/`setExpanded` in showStore.** Lines 609-610 define backward-compat methods that map to `viewTier`. These are only defined, never imported by any component. They should be removed.

4. **`celebrationActive` is not in `ShowState` type.** The `ShowState` interface in `shared/types.ts` (line 351) doesn't include `celebrationActive`, but `ShowStoreState` in `showStore.ts` (line 101) does. The types have drifted.

5. **Redundant `as ViewTier` casts.** Lines 237, 488, 594, 609, 610, 619, 679 all cast string literals `as ViewTier`. Since `ViewTier` is a union of string literals, these casts are unnecessary when the literal matches.

### Proposed Changes

1. **Slim down sessionStore to only what Showtime needs.** Create a `ShowtimeSessionStore` that tracks:
   - `tabId: string`
   - `claudeSessionId: string | null`
   - `status: TabStatus`
   - `lastAssistantMessage: string | null` (the only thing WritersRoomView reads)
   - `error: string | null`
   - `initStaticInfo()`, `sendMessage()`, `createTab()`

   The full `TabState` / `Message[]` / `handleNormalizedEvent` machinery can be deleted or moved to a `claudeStore.ts` that only exists if you re-enable the chat UI.

2. **Delete dead state/actions from showStore:**
   - Remove `toggleExpanded` and `setExpanded` (lines 609-610, 73-74) — no consumers
   - Remove redundant `as ViewTier` casts

3. **Sync `ShowState` type in shared/types.ts with actual store shape.**

### Specific Actions

| Action | Files Touched | Risk |
|--------|--------------|------|
| Rewrite sessionStore to minimal Showtime needs | sessionStore.ts, WritersRoomView.tsx, App.tsx, hooks/ | High — touches active data flow |
| Remove dead `toggleExpanded`/`setExpanded` from showStore | showStore.ts | Low |
| Remove `isExpanded`/`toggleExpanded` from sessionStore | sessionStore.ts | Low |
| Remove unnecessary `as ViewTier` casts | showStore.ts | Low |
| Sync `ShowState` type to include `celebrationActive` | shared/types.ts | Low |

**Estimated scope:** ~200 lines deleted from sessionStore, ~10 lines from showStore, 1 type update

---

## Module 3: View Consistency

### Current State

11 view files with consistent patterns. All use `w-full h-full`, Tailwind classes, and spring physics for Framer Motion.

### Problems

1. **Inline `style={{}}` violations (CLAUDE.md Rule #1).** Found 8 occurrences:
   - `StrikeView.tsx:177` — confetti particles use `style={{ left, backgroundColor, animationDelay }}`. This is **acceptable** because the values are dynamic/random per element and cannot be expressed as Tailwind classes. However, the `backgroundColor` array could be extracted to CSS custom properties with Tailwind arbitrary values.
   - `DashboardView.tsx:126` — progress bar width `style={{ width: \`${Math.round(progress * 100)}%\` }}`. Acceptable — dynamic percentage.
   - `MiniRundownStrip.tsx:52,60` — segment widths and position marker. Acceptable — computed layout.
   - `RundownBar.tsx:111,132,146` — same pattern as MiniRundownStrip. Acceptable.
   - `progress.tsx:20` — shadcn/ui progress transform. Framework pattern.

   **Verdict:** All inline styles are for dynamic computed values that genuinely cannot use Tailwind. No violations of the spirit of the rule.

2. **`formatDuration` duplicated in StrikeView.tsx (line 11).** Should be in `src/renderer/lib/utils.ts` alongside `formatDateLabel` and `cn`. `formatTime` in `LineupPanel.tsx` (line 11) is another local utility that should be centralized.

3. **Title bar pattern is consistent but not extracted.** Every full-screen view (DarkStudioView, WritersRoomView, ExpandedView, StrikeView, HistoryView, OnboardingView) has a similar title bar with `drag-region`, close button, and SHOWTIME label. This could be a `<TitleBar>` component.

4. **Close button inconsistency.** WritersRoomView uses `window.clui.quit()`, other views have different close patterns. Some views have close buttons, some don't (PillView, CompactView rely on the pill tap area).

### Proposed Changes

| Action | Files Touched | Risk |
|--------|--------------|------|
| Extract `formatDuration`, `formatTime` to `lib/utils.ts` | StrikeView.tsx, LineupPanel.tsx, lib/utils.ts | Low |
| Extract `<TitleBar>` component | All full-screen views, new TitleBar.tsx | Low |
| Audit close button behavior for consistency | All views | Low |

**Estimated scope:** ~20 lines moved to utils, 1 new component (~30 lines), 6 views updated

---

## Module 4: Dead Code & Dependency Cleanup

### Current State

The CLAUDE.md lists files to delete (ConversationView, InputBar, PermissionCard, AttachmentChips, SlashCommandMenu, PopoverLayer). **These have already been deleted** — no imports found.

### Dead Code Found

1. **Legacy IPC channels in `shared/types.ts` (lines 462-465):**
   ```typescript
   STREAM_EVENT: 'clui:stream-event',
   RUN_COMPLETE: 'clui:run-complete',
   RUN_ERROR: 'clui:run-error',
   ```
   These are commented as "Legacy (kept for backward compat during migration)" but are never referenced in `src/main/` — the migration is complete. Delete them.

2. **`process-manager.ts` (193 lines):** `src/main/process-manager.ts` exists but is never imported by anything. It appears to be an older version of `claude/run-manager.ts`. Delete it.

3. **CLUI preload API methods with no Showtime consumer.** These methods exist in `preload/index.ts` but nothing in the renderer calls them:
   - `cancel(requestId)` — no cancel button
   - `stopTab(tabId)` — no stop button
   - `retry(tabId, requestId, options)` — no retry button
   - `closeTab(tabId)` — no close-tab button
   - `selectDirectory()` — no directory picker
   - `openExternal(url)` — no link rendering
   - `openInTerminal(sessionId, projectPath)` — no terminal button
   - `attachFiles()` — no attachment UI
   - `takeScreenshot()` — no screenshot UI
   - `pasteImage(dataUrl)` — no paste image UI
   - `transcribeAudio(audioBase64)` — no voice input (the useAudio hook handles local audio cues only)
   - `getDiagnostics()` — no diagnostics panel
   - `initSession(tabId)` — never called from renderer
   - `resetTabSession(tabId)` — never called from renderer
   - `listSessions(projectPath)` — never called (HistoryView uses `getShowHistory`)
   - `loadSession(sessionId, projectPath)` — never called
   - `fetchMarketplace()` — no marketplace UI
   - `listInstalledPlugins()` — no marketplace UI
   - `installPlugin(...)` — no marketplace UI
   - `uninstallPlugin(...)` — no marketplace UI
   - `setPermissionMode(mode)` — called only from sessionStore but the store method is never called from any component
   - `onSkillStatus(callback)` — never consumed in any hook or component

4. **Unused dependencies in `package.json`:**
   - `autoprefixer` — No `postcss.config.js` exists. Tailwind v4 with `@tailwindcss/vite` doesn't need autoprefixer. Dev dependency, safe to remove.
   - `postcss` — Same reason. Not referenced in any config file.
   - `node-pty` — Only used in `pty-run-manager.ts` behind the `CLUI_INTERACTIVE_PERMISSIONS_PTY` flag (default off). This is a large native dependency that causes `electron-rebuild` pain. Consider making it an optional dependency or removing if the PTY path is unused.

5. **Unused IPC channel constants in `shared/types.ts`:** The entire `TEXT_CHUNK`, `TOOL_CALL`, `TOOL_CALL_UPDATE`, `TOOL_CALL_COMPLETE`, `TASK_UPDATE`, `TASK_COMPLETE`, `SESSION_DEAD`, `SESSION_INIT`, `ERROR`, `RATE_LIMIT` block (lines 400-410) is referenced in `preload/index.ts` line 128 as a comment (`const channels = [...]`) but the actual listener uses the string `'clui:normalized-event'` directly. The individual channel constants are never used as IPC channel names.

### Proposed Changes

| Action | Files Touched | Risk |
|--------|--------------|------|
| Delete `process-manager.ts` | 1 file | Low |
| Delete legacy IPC constants (STREAM_EVENT, RUN_COMPLETE, RUN_ERROR) | shared/types.ts | Low |
| Delete unused preload API methods + their main-process handlers | preload/index.ts, main/index.ts (or extracted ipc files) | Medium |
| Remove `autoprefixer` and `postcss` from devDependencies | package.json | Low |
| Evaluate `node-pty` — keep or make optional | package.json, pty-run-manager.ts | Low (config only) |
| Delete dead IPC channel comment in preload `onEvent` | preload/index.ts | Low |

**Estimated scope:** ~500 lines of main-process handler code deleted, ~30 preload methods removed, 1 file deleted, 2 dependencies removed

---

## Module 5: Type Safety

### Current State

The codebase uses TypeScript throughout with generally good type coverage. The shared types file is well-structured.

### Problems

1. **`as any` casts (15 total):**
   - `src/main/index.ts:1250-1251` — Test-only global assignment. Acceptable in test scope.
   - `src/main/claude/event-normalizer.ts:128-129` — `(event as any).permission_denials`. The `ResultEvent` type should include `permission_denials`.
   - `src/main/claude/run-manager.ts:227,231,238` — Raw event parsing needs type narrowing instead of `as any`.
   - `src/renderer/App.tsx:112` — `mode as any` when calling `setViewMode`. The type should accept all view mode strings.
   - `src/renderer/hooks/useClaudeEvents.ts:39` — `(event as any).text`. The `NormalizedEvent` type should be narrowed by discriminant.
   - `src/__tests__/*.tsx` — Test files. Acceptable.

2. **Data persistence IPC uses `any` for all payloads.** In `src/main/index.ts`:
   - `DATA_SYNC` handler (line 459): `snapshot: any`
   - `DATA_FLUSH` handler (line 467): `snapshot?: any`
   - `TIMELINE_RECORD` handler (line 475): `event: any`
   - `CLAUDE_CONTEXT_SAVE` handler (line 513): `ctx: any`
   These should use the proper types from `src/main/data/types.ts` (`ShowStateSnapshot`, `TimelineEventInput`, `ClaudeContextPayload`).

3. **Preload API return types.** The `CluiAPI` interface in `preload/index.ts` is well-typed, but `getDiagnostics()` returns `Promise<any>` (line 24). Should have a proper return type.

4. **Missing discriminated union narrowing.** The `handleNormalizedEvent` handler in sessionStore uses a switch on `event.type` but TypeScript doesn't always narrow correctly because the event parameter comes through IPC (untyped channel). The preload bridge should ensure type-safe event delivery.

### Proposed Changes

| Action | Files Touched | Risk |
|--------|--------------|------|
| Replace `any` in data IPC handlers with proper types | main/index.ts (or extracted ipc/) | Low |
| Fix `as any` casts in event-normalizer.ts and run-manager.ts | 2 files | Low |
| Fix `mode as any` in App.tsx | App.tsx | Low |
| Type `getDiagnostics()` return | preload/index.ts | Low |
| Add proper type narrowing for NormalizedEvent in useClaudeEvents | useClaudeEvents.ts | Low |

**Estimated scope:** ~15 type fixes across 6 files

---

## Module 6: Test Health

### Current State

- **Unit tests:** 11 files in `src/__tests__/`
- **E2E test:** 1 file, 1,328 lines (`e2e/showtime.test.ts`)

### Problems

1. **E2E test is a monolith.** 1,328 lines in a single test file covering: launch, dark studio, writers room, energy selection, lineup, going live, timers, beat checks, intermission, director mode, strike, history, onboarding, pill sizes, rundown bar, encore. This should be split by feature area for:
   - Faster parallel execution
   - Easier debugging when one area fails
   - Better test isolation

2. **No integration test for store-to-SQLite data flow.** `dataLayer.test.ts` tests the SQLite layer directly, and `showStore.test.ts` tests the store logic, but there's no test that verifies the full cycle: store action -> `syncToSQLite()` -> `hydrateFromSQLite()` -> state restored.

3. **`audioAndPolish.test.tsx` uses `as any` for store state (lines 171, 187, 203).** These should use proper type construction.

4. **Component tests (`components.test.tsx`) test rendering but not interaction.** E.g., "BeatCheckModal renders when pending" but no test that clicking "That moment was real" actually calls `lockBeat()`.

### Proposed Changes

| Action | Files Touched | Risk |
|--------|--------------|------|
| Split E2E test into feature files | e2e/showtime.test.ts -> e2e/launch.test.ts, e2e/writers-room.test.ts, e2e/live-show.test.ts, e2e/strike.test.ts, e2e/onboarding.test.ts, e2e/history.test.ts | Medium |
| Add store-SQLite integration test | New test file | Low |
| Fix `as any` casts in test files | audioAndPolish.test.tsx | Low |
| Add interaction tests for BeatCheckModal, DirectorMode | components.test.tsx or new files | Low |

**Estimated scope:** E2E split is the biggest task (~1,328 lines reorganized). Other tasks are ~50-100 new test lines.

---

## Module 7: CSS Hygiene (Minor)

### Current State

`src/renderer/index.css` is 302 lines, well-organized with clear section headers.

### Observations

1. **Duplicate animation definitions.** The `@theme` block defines `--animate-*` tokens (lines 47-53) AND there are manual `.tally-live`, `.onair-glow`, etc. classes (lines 101-140) with the same keyframes. The `@theme` tokens exist for Tailwind's `animate-*` utility, but the manual classes are what's actually used. The `@theme` animation tokens may be dead — verify if `animate-tally-pulse`, `animate-onair-glow`, etc. are used as Tailwind classes anywhere.

2. **No unused CSS classes detected** beyond the potential animation token duplication above.

### Proposed Changes

| Action | Files Touched | Risk |
|--------|--------------|------|
| Verify `--animate-*` tokens are used or remove them | index.css, grep across .tsx files | Low |

---

## Priority Order

| Priority | Module | Rationale |
|----------|--------|-----------|
| **P0** | Module 4: Dead Code Cleanup | Easiest wins. Delete `process-manager.ts`, legacy IPC constants, unused preload methods. Reduces surface area before other refactors. |
| **P1** | Module 1: Main Process Decomposition | Biggest single improvement. Makes all future changes easier. |
| **P2** | Module 2: Store Simplification | Removing sessionStore dead weight simplifies the most complex data flow. |
| **P3** | Module 5: Type Safety | Quick fixes that prevent future regressions. Do alongside P1/P2. |
| **P4** | Module 3: View Consistency | Utils extraction and TitleBar component. Low urgency, high polish. |
| **P5** | Module 6: Test Health | E2E split improves DX. Do after code changes stabilize. |
| **P6** | Module 7: CSS Hygiene | Lowest priority. Cosmetic. |

---

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Breaking IPC by deleting handlers that ARE used | Grep for every IPC channel constant before deleting. Run full E2E suite after each deletion batch. |
| SessionStore rewrite breaks WritersRoom Claude flow | WritersRoomView is the only consumer of Claude responses. Test this flow end-to-end after every sessionStore change. |
| Main process split introduces import cycle | Keep shared state (mainWindow, controlPlane, syncEngine) in a `src/main/state.ts` module that all extracted files import from. |
| E2E test split breaks test isolation | Ensure each split file can run independently. Use `test.describe` for grouping within files. |

---

## Loki PRD (Feed Directly to Autonomous Agent)

### Title
Showtime Consolidation: Main Process Decomposition + Dead Code Removal

### Objective
Split `src/main/index.ts` (1,266 lines) into focused modules and delete ~500 lines of CLUI-inherited dead code that Showtime never uses.

### Success Criteria
1. `src/main/index.ts` is under 150 lines (app lifecycle only)
2. All CLUI-only IPC handlers removed (ATTACH_FILES, TAKE_SCREENSHOT, PASTE_IMAGE, TRANSCRIBE_AUDIO, OPEN_IN_TERMINAL, MARKETPLACE_*, LIST_SESSIONS, LOAD_SESSION)
3. `process-manager.ts` deleted
4. Legacy IPC constants (STREAM_EVENT, RUN_COMPLETE, RUN_ERROR) deleted
5. All `require()` calls replaced with top-level ESM imports
6. Zero `as any` in production code (test files exempted)
7. `npm run test && npm run test:e2e` pass with no regressions
8. Preload API surface reduced to only methods Showtime actually calls

### Constraints
- Do NOT change any user-visible behavior
- Do NOT modify the Claude subprocess management (`src/main/claude/`)
- Do NOT modify the data layer (`src/main/data/`)
- Do NOT modify view components or store logic (that's a separate task)
- Maintain all existing E2E test assertions
- Every extracted module must have the same IPC channel registrations as before (verified by E2E)

### Task Breakdown

**Phase 1: Delete Dead Code (P0)**
1. Delete `src/main/process-manager.ts`
2. Remove STREAM_EVENT, RUN_COMPLETE, RUN_ERROR from `src/shared/types.ts`
3. Remove unused preload API methods and their main-process handlers (see Module 4 list)
4. Remove `autoprefixer` and `postcss` from devDependencies
5. Run tests

**Phase 2: Extract Main Process Modules (P1)**
1. Create `src/main/state.ts` — export shared refs (mainWindow, controlPlane, syncEngine, etc.)
2. Create `src/main/window.ts` — extract createWindow, showWindow, toggleWindow, applyViewMode, drag tracking
3. Create `src/main/ipc/core.ts` — Claude subprocess IPC handlers
4. Create `src/main/ipc/showtime.ts` — Showtime notifications, view mode, data persistence
5. Create `src/main/tray.ts` — Tray creation and context menu
6. Create `src/main/shortcuts.ts` — Global shortcut registration
7. Create `src/main/permissions.ts` — macOS permission preflight
8. Reduce `src/main/index.ts` to app lifecycle orchestration only
9. Replace all `require()` with top-level imports
10. Run tests

**Phase 3: Type Safety (P3)**
1. Replace `any` in IPC handlers with proper types from `src/main/data/types.ts`
2. Fix `as any` casts in event-normalizer.ts, run-manager.ts, App.tsx, useClaudeEvents.ts
3. Type `getDiagnostics()` return value
4. Run tests

### Verification
- `npm run test` — all unit tests pass
- `npm run test:e2e` — all E2E tests pass
- `wc -l src/main/index.ts` — under 150 lines
- `grep -r "as any" src/main/ src/renderer/ --include="*.ts" --include="*.tsx" | grep -v test | grep -v node_modules` — zero results
- `grep -r "require(" src/main/ --include="*.ts" | grep -v node_modules` — zero results
