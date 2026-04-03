# Showtime v2.1 Bugfix — Post-Loki Integration & Polish

## Why

Loki Mode v2 completed 35/35 implementation tasks in 47 minutes, producing a fully buildable app with 128 passing unit tests. However, 9 issues emerged during manual testing — the core AI integration uses mock data, several UX flows are incomplete, and visual polish items were missed. These are integration and polish gaps, not architectural problems. The foundation (Tailwind v4, shadcn/ui, Zustand store, all views) is solid.

GitHub issues: #1-#9 at https://github.com/vishnujayvel/showtime/issues

## What Changes

### Critical
- **Wire Claude subprocess into WritersRoomView** — replace mock lineup generation (random categories/durations) with real Claude Code subprocess call via sessionStore.sendMessage(). Parse `showtime-lineup` JSON blocks from Claude's response. The ChatPanel already has this integration — it needs to be connected to the WritersRoom flow. (#1)

### UX Bugs
- **Beat Check celebration delay** — add a 1.5-2s celebration moment ("That moment was real" + beat ignite animation) between locking the Beat and advancing to the next Act. Currently dismisses instantly. (#2)
- **App close/quit** — add tray context menu with "Quit Showtime", fix Cmd+Q to actually quit on first press, add close/minimize to expanded view title bar. (#3)
- **Playwright process cleanup** — ensure E2E test afterAll hook kills all Electron helper processes (GPU, Renderer, Network, Audio). Currently leaves orphan processes. (#9)

### Visual Polish
- **macOS vibrancy** — add `vibrancy: 'under-window'` and `visualEffectState: 'active'` to BrowserWindow config. (#4)
- **PermissionCard Tailwind migration** — convert the last inline-styles component to Tailwind classes, eliminate useColors() dependency. (#5)
- **GoingLive ON AIR animation** — add the ON AIR light box igniting with onairGlow animation during the Going Live transition. (#7)
- **Spotlight gradient CSS class** — move the radial gradient in WritersRoomView from inline style to a CSS class in index.css. (#8)

### Testing
- **E2E tests with real Claude** — update Playwright tests to handle Claude subprocess timeouts gracefully and verify lineup generation when Claude is available. (#6)

## Capabilities

### New Capabilities
None — all changes modify existing capabilities.

### Modified Capabilities
- **claude-integration** — WritersRoomView now calls Claude subprocess instead of mock
- **show-lifecycle** — Beat Check adds celebration delay; app adds quit/close
- **ui-views** — Visual polish across GoingLive, WritersRoom, PermissionCard, BrowserWindow

## Impact

- **Code:** ~9 files modified (WritersRoomView, BeatCheckModal, showStore, main/index.ts, GoingLiveTransition, PermissionCard, theme.ts, index.css, e2e/showtime.test.ts)
- **Dependencies:** No new dependencies
- **Build:** Should remain passing throughout — all changes are incremental
- **Tests:** 128 unit tests must continue passing; E2E tests updated for Claude integration

## Context Documents

All context from the v2 build is preserved:
- Product context: `docs/plans/product-context.md`
- Design system: `docs/plans/design-system.md`
- UI mockup: `docs/mockups/direction-4-the-show.html`
- Technical design: `.claude/specs/showtime-v2/design.md`
- CLAUDE.md: mandatory rules (no inline styles, shadcn/ui, Tailwind, Playwright)
- Loki context: `.loki/` directory with all 12 reference documents
