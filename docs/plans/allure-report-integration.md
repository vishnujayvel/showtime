---
title: "Proposal: Allure Report 3 Integration"
status: current
last-verified: 2026-04-06
---
# Proposal: Allure Report 3 Integration

## Problem

When E2E tests run (often kicked off by a Claude Code session that gets closed), there's no structured way to:
1. See what happened after the session ends — only raw `tail -f` of a plain-text log
2. Compare results across multiple test runs — each run overwrites previous HTML/JSON reports
3. Debug failures with expected vs actual diffs, screenshots, and step-level detail
4. Track test stability trends — which tests are flaky, which are slow, which regressed

## Goals

- Integrate **Allure Report 3** (free, open-source, Apache 2.0) as a Playwright reporter
- Accumulate **run history** via Allure's JSONL history file so trends persist across runs
- Provide rich HTML reports with: step-level execution, screenshots, error diffs, run comparison
- Add convenient npm scripts to generate and view reports
- **Preserve** the existing `progress-reporter.ts` (tail-friendly log) and JSON reporter — Allure is additive

## Developer Use Cases

### UC1: "What happened while I was away?"
Developer kicks off `npm run test:e2e`, closes the session, comes back later.
→ Run `npm run test:e2e:report` to generate the Allure report from saved results
→ Run `npm run test:e2e:report:open` to view in browser with full detail

### UC2: "Is this test flaky?"
A test passes sometimes and fails other times.
→ Allure's history view shows pass/fail trend for each test across the last N runs
→ Retries tab shows which tests needed retries and how often

### UC3: "What broke in this run vs last run?"
A test that was passing now fails.
→ Allure's history tab on the test shows when it started failing
→ Failure detail includes expected vs actual, screenshot at point of failure, error stack

### UC4: "Are our tests getting slower?"
→ Allure's trend charts show duration trends across runs
→ The existing progress-reporter.ts flags individual slow tests (>5s) in the tail log

### UC5: "Quick status while tests run"
→ `npm run test:e2e:tail` — existing tail-friendly log for live progress (unchanged)
→ Allure report is generated post-run for deep analysis

## Scope

### In Scope
- Install `allure-playwright` npm package
- Add Allure reporter to `playwright.config.ts` alongside existing reporters
- Configure Allure history via `historyPath` (JSONL file in `test-results/`)
- Add npm scripts: `test:e2e:report`, `test:e2e:report:open`
- Update `.gitignore` for `allure-results/` and `allure-report/` directories
- Install Allure CLI (document `brew install allure` requirement)
- Verify with a real test run

### Out of Scope
- CI/CD integration (no GitHub Actions setup)
- Cloud storage of reports (no S3/artifact uploads)
- Allure TestOps (paid tier — not needed)
- ReportPortal, Currents, or other alternatives
- Changes to test logic or test files themselves

## Non-Goals
- Replacing the existing progress-reporter.ts — it serves a different purpose (live tailing)
- Replacing the existing JSON/HTML reporters — they serve CI and quick-look purposes

## Testing Strategy
- Run `npm run test:e2e` after integration
- Verify `allure-results/` directory is populated with test data
- Run `npm run test:e2e:report` to generate HTML report
- Open report and verify: test results visible, screenshots attached, history tab works
- Run tests a second time and verify history accumulation (trend data shows 2 runs)

## Technology
- **allure-playwright** — official Allure adapter for Playwright (npm)
- **allure** CLI — report generator (`brew install allure` or `npm i -g allure-commandline`)
- **Allure Report 3** — latest version with JSONL history support
