# Loki Mode Continuity — Showtime v2

## Session Handoff

Previous session completed Groups 1-2 manually. This Loki session should pick up from Group 3.

## What's Done

### Commits
- `886ce53` — Foundation: product context, design system, CLAUDE.md, specs, mockups
- `364ceac` — Groups 1-2: Tailwind v4 config, shadcn/ui (Button/Dialog/Card/Progress), Google Fonts, category colors, showStore v2 state machine, IPC bridge updates

### Completed Tasks (8/35)
- 1.1 Tailwind CSS v4 Configuration & Design Tokens ✅
- 1.2 shadcn/ui Setup & Custom Button Variants ✅
- 1.3 Google Fonts Import ✅
- 1.4 Category Color Utility ✅
- 2.1 Update showStore with v2 State Machine ✅
- 2.2 Update IPC Bridge Types ✅
- 2.3 showStore Unit Tests — NOT DONE (skipped, do in Group 7)
- 2.4 Timer Hook Tests — NOT DONE (skipped, do in Group 7)

### Build Status
`npm run build` passes. TypeScript clean. No test suite run yet.

## What's Next

### Group 3: Atomic Components (5 tasks, all parallelizable)
- 3.1 TallyLight component
- 3.2 OnAirIndicator component
- 3.3 ClapperboardBadge component
- 3.4 BeatCounter (rewrite with Tailwind)
- 3.5 EnergySelector (rewrite with Tailwind)

### Group 4: Core Views (12 tasks, mostly parallelizable)
- 4.1-4.12: DarkStudio, GoingLive, Intermission, ShowVerdict, DirectorMode, BeatCheck, Timer, Lineup+ActCard, Pill, Expanded, WritersRoom, Strike

### Group 5: App Shell (2 tasks, sequential)
### Group 6: CLUI Cleanup (3 tasks)
### Group 7: Testing (5 tasks)

## Key Rules (from CLAUDE.md)
- **NO inline styles** — Tailwind utility classes only
- **shadcn/ui** for interactive components (Button, Dialog, Card, Progress already set up in src/renderer/ui/)
- **Framer Motion spring physics** — never linear transitions
- **Match mockup**: docs/mockups/direction-4-the-show.html
- **Follow design system**: docs/plans/design-system.md
- **Playwright E2E** for every feature

## Queue State
`.loki/queue/pending.json` has all 35 tasks. Update task status as you complete them.
`.loki/state/orchestrator.json` needs tasksCompleted updated as groups finish.
