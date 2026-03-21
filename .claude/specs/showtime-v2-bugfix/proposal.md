# Showtime v2.1 Bugfix — Post-Loki Integration & Polish

## Why

Loki Mode v2 completed 35/35 tasks but shipped with mock data for the core AI feature and several UX gaps. These are integration and polish issues, not architectural problems. The foundation (Tailwind, shadcn/ui, store, views) is solid — this spec addresses the gaps.

**GitHub issues:** #1-#9 at https://github.com/vishnujayvel/showtime/issues

## Root Cause

The v2 spec scoped tasks as "rewrite view X with Tailwind" — UI-first tasks that correctly built the visual layer but did not include cross-process integration tasks. The Claude subprocess wiring (sessionStore → IPC → main → claude -p → parse response) spans 4+ files across 3 Electron processes and was not captured as a standalone task.

## What Changes

### Critical (Core Value Prop)
- **Wire Claude integration into WritersRoomView** — replace mock lineup generation with real Claude subprocess call via sessionStore.sendMessage(). Parse `showtime-lineup` JSON blocks from Claude's response. (#1)

### UX Bugs
- **Beat Check celebration delay** — add a 1.5s celebration moment ("That moment was real" + beat ignite animation) between locking the Beat and advancing to the next Act. (#2)
- **App close/quit** — add tray context menu with "Quit Showtime", fix Cmd+Q to actually quit, add close option to title bar. (#3)
- **Playwright process cleanup** — ensure afterAll hook kills all Electron helper processes. (#9)

### Visual Polish
- **macOS vibrancy** — add `vibrancy: 'under-window'` and `visualEffectState: 'active'` to BrowserWindow config. 2-line fix. (#4)
- **PermissionCard Tailwind migration** — convert the last inline-styles component to Tailwind classes. (#5)
- **GoingLive ON AIR animation** — add the ON AIR light box igniting with onairGlow animation during the Going Live transition. (#7)
- **Spotlight gradient CSS class** — move the radial gradient from inline style to a Tailwind utility or CSS class. (#8)

### Testing
- **E2E tests with real Claude** — update Playwright tests to verify Claude-generated lineup once integration lands. (#6)

## Impact

- 9 files modified, 0 new files needed
- Core value prop restored (Claude integration)
- All CLAUDE.md rules already in place — no foundation changes
- Build should remain passing throughout
