---
title: "Wave 5: Test Performance — Issue #109"
status: archived
last-verified: 2026-04-06
---
# Wave 5: Test Performance — Issue #109

## Issue #109: perf: investigate and optimize E2E test execution time

### Phase 1: Profile
- Run `npm run test:e2e` with timing and identify the top 5 slowest tests
- Check Allure report history for duration trends if available
- Profile Electron app startup time per test file (each file launches a new Electron instance)
- Check progress-reporter output for SLOW-flagged tests (>5s threshold)

### Phase 2: Analyze
- Identify overlapping tests across projects that could be merged
- Check if `workers: 2` is optimal for the machine (try 3 or 4)
- Identify tests that could share Electron instances (within same project)
- Check if screenshot capture is slowing tests unnecessarily
- Look for unnecessary waits or sleep calls in test code

### Phase 3: Optimize (quick wins only)
- Increase worker count if safe (test for flakiness)
- Remove redundant screenshots that aren't used for visual regression
- Use `vitest --changed` in pre-commit hook instead of full suite
- Add `test:e2e:smoke` script that runs only the smoke project for fast feedback
- Document findings in a brief report at docs/plans/test-perf-report.md

### Testing Strategy
- Run full E2E suite before and after optimizations
- Compare total duration
- Ensure no tests become flaky from the changes
- All 521+ unit tests must still pass

### Constraints
- Do not delete any tests
- Do not reduce test coverage
- Quick wins only — no major refactoring of test infrastructure
