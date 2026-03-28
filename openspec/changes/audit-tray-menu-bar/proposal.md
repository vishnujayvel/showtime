# Proposal: Tray Menu Bar Design + Implementation Audit

## Work Type: Architecture (design doc output only)

## Goal

Produce a design audit document at `docs/plans/tray-audit-report.md` that compares the tray menu bar implementation against the mockup and identifies all issues. Do NOT fix code — just produce the report.

## Audit Checklist

### Design Audit
Compare each mockup state (in `docs/mockups/tray-menu-bar.html`) against the implementation (in `src/main/tray.ts` and `src/renderer/hooks/useTraySync.ts`):

1. Idle state (no_show) — menu items, icons, shortcuts
2. Live state — ON AIR badge, timer, beats, coming up, act category
3. Amber warning (< 5 min) — timer prefix, icon variant
4. Intermission — badge, act count, next act
5. Writer's Room and Strike phases
6. Document which mockup elements are impossible with native Menu vs which are missing

### Implementation Audit
Read these files and document findings:

1. `src/main/tray.ts` — icon loading, menu builders, IPC listener, timer display
2. `src/renderer/hooks/useTraySync.ts` — store subscription, throttling, cleanup, timer interval
3. `src/shared/types.ts` — TrayShowState type completeness
4. `src/preload/index.ts` — bridge correctness
5. `e2e/app-launch.test.ts` — tray label test coverage

For each file, check:
- Is `currentActIndex` used correctly? (showStore uses `currentActId`, not an index)
- Is there throttling on Menu rebuilds?
- Are icons validated after loading?
- Is the IPC listener cleaned up?
- Are E2E tests covering all states?

## Output

Write the report to `docs/plans/tray-audit-report.md` with:
- Summary table of findings (severity, file, description, suggested fix)
- Design gap analysis (mockup vs native Menu tradeoffs)
- Recommended follow-up issues to file

Then commit the report.
