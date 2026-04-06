---
title: "Showtime Codebase Audit — March 28, 2026"
status: current
last-verified: 2026-04-06
---
# Showtime Codebase Audit — March 28, 2026

> **Note:** This audit predates the XState v5 migration. State management now uses
> XState (ShowMachineProvider) instead of Zustand-only. The preload API was renamed
> from `window.clui` to `window.showtime`. See issue #153 for the latest audit.

## Overall Health: 8/10

The codebase is in excellent shape architecturally (8/8 CLAUDE.md rules pass, zero inline styles, zero IPC violations) with strong E2E coverage. Key gaps are in test visibility, hook coverage, docs organization, and CI integration.

## 1. Architecture & Code Quality

**CLAUDE.md Compliance: 100% (8/8 rules)**

| Rule | Status |
|------|--------|
| No inline styles | PASS — 0 violations across 4,656 LOC |
| shadcn/ui + Radix | PASS — 4 components properly implemented |
| Tailwind v4 CSS-first | PASS — @theme tokens used |
| macOS native feel | PASS — frame:false, no vibrancy |
| Spring physics only | PASS — 100% spring-based animations |
| E2E test coverage | PASS — 18 files, 242+ tests |
| IPC type safety | PASS — typed window.clui bridge, zero raw ipcRenderer |
| Zustand only | PASS — all stores Zustand, zero React Context |

**Code Issues Found:**

| Issue | Severity | Location | Fix |
|-------|----------|----------|-----|
| 2 `any` types in SQLite hydration | Medium | showStore.ts:701-702 | Create ActSnapshot interface |
| CompactView/DashboardView undocumented | Low | CLAUDE.md | Add to view inventory |

**Codebase Stats:**
- Renderer: 4,656 LOC across 12 views, 20 components, 2 stores, 5 hooks
- Largest file: showStore.ts (767 LOC) — well-organized
- Zero TODO/FIXME/HACK comments
- Zero console.log in production (1 intentional console.warn for diagnostics)

## 2. Docs Organization

**Status: Mostly correct, 1-2 files misplaced**

| Directory | Files | Status |
|-----------|-------|--------|
| docs/ (public VitePress) | 49 | CORRECT — user-facing + contributor guides |
| docs/plans/ | 12 | 2 QUESTIONABLE — product-context.md and skill-vs-current-architecture.md are internal |
| docs/mockups/ | 15 HTML | CORRECT — all referenced by code, zero orphans |
| docs-internal/ | 16 | CORRECT — properly gitignored |
| openspec/specs/ | 4 | CORRECT — public specs tracked |
| openspec/changes/ | 29 active | CORRECT — gitignored |

**Recommended Moves:**

| File | From | To | Reason |
|------|------|----|--------|
| product-context.md | docs/plans/ | docs-internal/ | Internal roadmap, not contributor-facing |
| skill-vs-current-architecture.md | docs/plans/ | docs-internal/audits/ | Completed decision audit, not ongoing reference |

## 3. Test Pyramid

```text
                    E2E (18 files, 242 tests)
                      Playwright + Electron
                    /                       \
            Core Flow (5)              Visual (3)
           /          \               /          \
      Smoke (2)    Data (5)    Cassette (1)   Real (1)
        /
  Unit (22 files, 135 tests)          Property (2 files)
       Vitest + RTL                    fast-check
```

**Coverage by Component:**

| Component | Unit | E2E | Gap? |
|-----------|------|-----|------|
| Stores (2) | 100% | - | No |
| Views (12) | - | 83% (10/12) | ColdOpenTransition, SettingsView missing |
| Hooks (5) | 40% (2/5) | - | useClaudeEvents, useHealthReconciliation, useTraySync missing |
| Components (20) | Partial | Covered via E2E | Acceptable |

**Execution Model:**

| Command | What runs | Duration | When |
|---------|-----------|----------|------|
| `npm test` | Vitest (22 files) | ~2s | Local dev, CI |
| `npm run test:e2e` | Playwright (18 files, 6 projects) | ~5-10 min | Local only |
| CI (GitHub Actions, `.github/workflows/ci.yml`) | Vitest + TSC only | ~1 min | PR + push to main |

## 4. Critical Gaps & Recommendations

### Priority 1: Fix Now

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 1 | **E2E tests not in CI** — Playwright skipped on GitHub Actions (no display) | Regressions only caught locally | Medium — needs xvfb or headless setup |
| 2 | **No test duration tracking** — no per-test timing, no slow test detection | Can't identify degrading tests | Low — add custom Playwright reporter |
| 3 | **3 hooks untested** — useClaudeEvents, useHealthReconciliation, useTraySync | Event handling bugs slip through | Medium — mock IPC + event streams |

### Priority 2: Should Do

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 4 | **No pre-commit hooks** — no husky, no lint-staged | Broken code can be committed | Low — add husky + npm test |
| 5 | **2 `any` types** in showStore.ts SQLite hydration | TypeScript strictness gap | Low — create ActSnapshot interface |
| 6 | **Move 2 docs to docs-internal/** | Public docs cleanliness | Trivial |
| 7 | **Document CompactView/DashboardView** in CLAUDE.md | Spec accuracy | Trivial |

### Priority 3: Nice to Have

| # | Issue | Impact | Effort |
|---|-------|--------|--------|
| 8 | Add JSON/JUnit Playwright reporter for CI | PR check integration | Low |
| 9 | Add test duration budgets (warn >5s unit, >30s smoke) | Performance regression detection | Low |
| 10 | Add ColdOpenTransition + SettingsView E2E tests | 100% view coverage | Medium |
| 11 | Record Claude cassettes for deterministic API tests | Repeatable AI testing | Medium |

## 5. Test Visibility Improvement Plan

**Problem:** "I don't know how many tests are pending or how long it will take"

**Solution — Custom Playwright reporter:**

```typescript
// reporters/progress-reporter.ts
class ProgressReporter {
  private total = 0
  private completed = 0
  private startTime = 0

  onBegin(config, suite) {
    this.total = suite.allTests().length
    this.startTime = Date.now()
    console.log(`Running ${this.total} tests across ${config.projects.length} projects...`)
  }

  onTestEnd(test, result) {
    this.completed++
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1)
    const pct = ((this.completed / this.total) * 100).toFixed(0)
    const slow = result.duration > 5000 ? ' SLOW' : ''
    console.log(`[${this.completed}/${this.total}] (${pct}%) ${elapsed}s — ${test.title} (${result.duration}ms)${slow}`)
  }

  onEnd(result) {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1)
    console.log(`Done: ${result.status} in ${duration}s`)
  }
}
```

Add to playwright.config.ts:
```typescript
reporters: [
  ['./reporters/progress-reporter.ts'],
  ['html', { open: 'never' }],
]
```

This gives real-time progress: `[15/242] (6%) 23.5s — Live show timer countdown (1234ms)`

---

*Generated by codebase audit — March 28, 2026*
