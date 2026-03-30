# Wave 2: Testing — Issues #96, #99, #101

## Issue #96: test: add unit tests for useClaudeEvents, useHealthReconciliation, useTraySync
- Add Vitest unit tests for these three hooks in src/renderer/hooks/
- Test edge cases: connection failures, reconnection, health check timeouts
- Mock IPC calls via window.clui
- Target: 90%+ branch coverage for each hook

## Issue #99: feat: add test duration budgets with slow test warnings
- The progress-reporter.ts already flags tests >5s as SLOW
- Add configurable duration budgets per project in playwright.config.ts
- Emit warnings when tests exceed their budget
- Add a summary section showing budget violations

## Issue #101: test: add E2E tests for ColdOpenTransition and SettingsView
- Add Playwright E2E tests for:
  - ColdOpenTransition: verify animation renders, day name appears, transitions to WritersRoom
  - SettingsView: open settings, toggle theme, verify persistence, close and verify return
- Follow existing E2E patterns in e2e/ directory
- Take screenshots for visual evidence

## Testing Strategy
- Run `npm test` (vitest) — all tests must pass including new ones
- Run `npx tsc --noEmit` — no type errors
- For #101: run `npx playwright test --project smoke` to verify E2E tests
- Close each issue with proper Root cause / Fix / Test evidence format

## Constraints
- Follow CLAUDE.md rules: no inline styles, Tailwind only, spring physics animations
- Use Vitest for unit tests, Playwright for E2E
- Do not modify existing test logic unless fixing flaky behavior
