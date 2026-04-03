## Context

Brownfield bugfix change. Loki Mode v2 completed all 35 implementation tasks in 47 minutes, producing a buildable Electron app with 128 passing unit tests. Manual testing uncovered 9 issues (GitHub #1-#9) — the core AI integration uses mock data, several UX flows are incomplete, and visual polish items were missed.

The codebase is solid: Tailwind v4, shadcn/ui, Zustand stores, all views rendered, all state machine phases working. These are integration and polish gaps, not architectural problems.

**Current state of each gap:**

- **WritersRoomView** (`src/renderer/views/WritersRoomView.tsx`) — `handleBuildLineup()` splits user text on newlines and assigns random categories/durations. The real Claude integration already works in `ChatPanel.tsx` via `sessionStore.sendMessage()` and `showtime-lineup` JSON parsing.
- **BeatCheckModal** (`src/renderer/components/BeatCheckModal.tsx`) — has a `showConfirmation` state and "That moment was real" text, but `lockBeat()` in `showStore.ts` immediately sets `beatCheckPending=false` and calls `startAct()`, so the celebration is never visible.
- **App close/quit** (`src/main/index.ts` lines 144-151) — `before-quit` sets `forceQuit=true`, `close` handler hides window if not force-quitting. No tray menu, no Cmd+Q handler, no close button in expanded view title bar.
- **BrowserWindow config** — missing `vibrancy: 'under-window'` and `visualEffectState: 'active'` (mandatory per CLAUDE.md section 4).
- **PermissionCard** (`src/renderer/components/PermissionCard.tsx`) — uses `useColors()` from `theme.ts` and inline `style={{}}` objects throughout, violating CLAUDE.md rule 1.
- **GoingLiveTransition** (`src/renderer/views/GoingLiveTransition.tsx`) — renders `OnAirIndicator` and date text but has no ON AIR light box ignite animation (the `onairGlow` CSS class exists but is not applied during the transition sequence).
- **WritersRoomView spotlight** — uses inline `style={{ background: 'radial-gradient(...)' }}` instead of a CSS class in `index.css`.
- **E2E tests** (`e2e/showtime.test.ts`) — `afterAll` only calls `app.close()`, does not kill orphaned Electron helper processes (GPU, Renderer, Network, Audio).

## Goals / Non-Goals

**Goals:**

- Fix all 9 GitHub issues (#1-#9) identified during post-Loki manual testing
- Wire real Claude subprocess into WritersRoomView lineup generation
- Add Beat Check celebration delay so the user sees "That moment was real" before advancing
- Add app quit/close behaviors (tray menu, Cmd+Q, close button, traffic light)
- Apply missing visual polish (vibrancy, PermissionCard Tailwind migration, ON AIR animation, spotlight CSS)
- Update E2E tests for Claude integration and process cleanup
- Keep all 128 unit tests passing throughout

**Non-Goals:**

- No new features — only fixes to existing functionality
- No architecture changes — same stores, same IPC bridge, same file structure
- No new dependencies
- No data model changes
- No migration needed

## Decisions

### D1: Wire Claude into WritersRoom via sessionStore.sendMessage()

**Choice:** Reuse the exact same `sessionStore.sendMessage()` + `tryParseLineup()` pattern from ChatPanel.

**Rationale:** ChatPanel already has a working Claude integration that sends messages, waits for `showtime-lineup` JSON blocks in responses, and calls `showStore.setLineup()`. WritersRoomView needs the same flow. Extracting the lineup parsing logic into a shared utility keeps both consumers consistent.

**Alternative considered:** Direct IPC call from WritersRoomView to main process. Rejected because it bypasses the sessionStore's tab management and status tracking, and duplicates logic that already works.

**Implementation:**
1. Extract `tryParseLineup()` from ChatPanel into a shared utility (e.g., `src/renderer/lib/lineup-parser.ts`)
2. In WritersRoomView's `handleBuildLineup()`, replace mock generation with `sendMessage()` call that includes energy level and plan text
3. Subscribe to sessionStore messages and parse lineup from Claude's response
4. Show "Planning..." loading state while Claude is processing, with error/retry on failure

### D2: Beat celebration delay via setTimeout before startAct

**Choice:** In `showStore.lockBeat()`, set a `celebrationActive` flag instead of immediately calling `startAct()`. After 1800ms, clear the flag and advance.

**Rationale:** The BeatCheckModal already renders the "That moment was real" confirmation text when `showConfirmation` is true. The problem is that `lockBeat()` immediately sets `beatCheckPending=false` (which unmounts the modal) and calls `startAct()`. The fix delays the unmount and advancement.

**Alternative considered:** Handle the delay purely in the BeatCheckModal component with local state and setTimeout. Rejected because the store's `lockBeat()` already triggers `startAct()` synchronously — the component would unmount before its timeout fires.

**Implementation:**
1. `lockBeat()` sets `beatCheckPending: 'celebrating'` (or a new `celebrationActive: true` flag)
2. BeatCheckModal checks for this state to show the celebration view
3. After 1800ms, store clears the flag, sets `beatCheckPending: false`, and calls `startAct()`

### D3: Quit behavior — tray menu + Cmd+Q + close button

**Choice:** Add a system tray with context menu ("Quit Showtime"), register `globalShortcut` for Cmd+Q, and add a close button to the expanded view title bar.

**Rationale:** Currently the app hides on close (line 147-150 of main/index.ts) and has no visible quit mechanism. Users must force-quit.

**Implementation:**
1. Create Tray with context menu containing "Quit Showtime" that calls `app.quit()`
2. The existing `before-quit` / `close` handler already supports force quit — Cmd+Q triggers `app.quit()` which fires `before-quit`, setting `forceQuit=true`
3. Add IPC handler for renderer to request quit (for title bar close button)
4. Traffic light close (red dot) already hides to tray via the existing `close` handler — this is correct behavior per spec

### D4: Visual polish — incremental CSS/component fixes

**Choice:** Fix each visual issue in place, no refactoring.

- **Vibrancy:** Add `vibrancy: 'under-window'` and `visualEffectState: 'active'` to BrowserWindow config in `main/index.ts`
- **PermissionCard:** Replace all `style={{}}` with Tailwind classes, remove `useColors()` dependency, define any missing tokens in `index.css` @theme
- **GoingLive ON AIR:** Add the `onair-glow` CSS class to the ON AIR indicator during the Going Live transition sequence, with a spring animation entrance
- **Spotlight CSS:** Move the `radial-gradient(...)` inline style in WritersRoomView to a `.spotlight-warm` class in `index.css`

## Risks / Trade-offs

**[Risk] Claude subprocess may hang or be unavailable in test/CI environments**
Mitigation: WritersRoomView must handle timeout (30s) and show retry option. E2E tests use conditional logic — verify lineup generation only when Claude is available, fall back to mock for CI.

**[Risk] Beat celebration delay could feel sluggish if too long**
Mitigation: Use 1800ms (tested value from product context — "the golden star ignition" should feel like applause, not a loading screen). The animation (beat-ignite) is 600ms, so 1800ms gives comfortable time to read "That moment was real" + see the ignite complete.

**[Risk] PermissionCard Tailwind migration may miss dynamic color states**
Mitigation: The allow/deny/neutral button colors are deterministic based on `opt.kind` — they can be mapped to Tailwind classes with opacity modifiers. No runtime color interpolation needed.

**[Risk] Electron orphan processes in E2E afterAll**
Mitigation: Use `process.kill()` with the app's PID to kill the process tree, or use a shell `pkill` fallback. Playwright's Electron helper provides the PID via `app.process().pid`.
