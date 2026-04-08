---
name: visual-qa
description: Automated visual QA pass using Claude Code runtime. Reads E2E screenshots, evaluates against visual-spec.json, reports structured pass/fail per view. Zero API cost.
---

# Visual QA — Claude Code Runtime Oracle

## When to Use

Invoke after E2E tests complete, before closing issues or merging PRs that include UI changes. Also invoke when validating baseline screenshots.

## Workflow

### Step 1: Run E2E Tests

Ensure the E2E suite has run and screenshots exist:

```bash
npm run build && npx playwright test --project=visual
```

Verify screenshots exist in `e2e/screenshots/`.

### Step 2: Load the Visual Spec

Read `e2e/visual-spec.json` — this is the machine-readable design specification derived from `docs/plans/design-system.md` and `CLAUDE.md`.

### Step 3: Evaluate Each View

For each view in the visual spec, read the corresponding screenshot from `e2e/screenshots/` using the Read tool (which can read images natively).

For each screenshot, evaluate against the spec entry's checklist:

**Structural Checks (binary pass/fail):**
- [ ] All `required_elements` are visible (text present, positioned in correct region)
- [ ] Background color matches spec (dark background, no white flash)
- [ ] Window appears to fill the expected dimensions (no visible gaps)
- [ ] No content is clipped or overflowing window edges
- [ ] Text is readable (not transparent, not overlapping)
- [ ] Interactive elements (buttons) are visible and not obscured

**Design System Checks (binary pass/fail):**
- [ ] Typography appears correct (monospaced where expected, sans-serif elsewhere)
- [ ] Color scheme is dark mode (studio-bg, surface, accent colors)
- [ ] ON AIR indicator is red when in live phase
- [ ] Beat stars show correct state (gold for locked, gray for empty)
- [ ] Category colors match the spec (purple for deep work, green for exercise, etc.)

**Composition Checks (binary pass/fail):**
- [ ] Elements are in expected spatial relationship (timer above lineup, ON AIR at top)
- [ ] No unexpected elements from other views bleeding through
- [ ] Layout matches the view's intended structure (sidebar right, timer center, etc.)

### Step 4: Report Results

For each view, output a structured result:

```
## [ViewName] — PASS / FAIL

| Check | Status | Notes |
|-------|--------|-------|
| Required elements | PASS/FAIL | list any missing |
| Background color | PASS/FAIL | expected vs observed |
| Dimensions | PASS/FAIL | |
| No overflow | PASS/FAIL | |
| Typography | PASS/FAIL | |
| Color scheme | PASS/FAIL | |
| Composition | PASS/FAIL | |

Overall: PASS/FAIL
Severity: critical/major/minor (if FAIL)
```

### Step 5: Baseline Validation (if --validate-baselines)

When invoked with baseline validation, evaluate each screenshot in `e2e/visual-regression.test.ts-snapshots/` against the visual spec. Flag any baseline that doesn't match the current spec as stale.

## What Cannot Be Automated

These require occasional human inspection:
- **Animation smoothness/jank** — frame drops aren't visible in screenshots
- **Subjective aesthetic feel** — "does this feel like a live TV show?"
- **Drag interaction responsiveness** — pointer event timing
- **Multi-monitor DPI edge cases** — requires physical hardware variety

## Principles

1. **Zero API cost** — this skill runs entirely within Claude Code runtime. No `@anthropic-ai/sdk` imports, no Anthropic API calls.
2. **Never trust baselines** — validate every screenshot against the spec from first principles.
3. **Measurable criteria only** — never evaluate subjective qualities. Use specific checks (font, color, position, presence).
4. **Uncertain is valid** — if a check can't be determined from the screenshot, report "uncertain" rather than guessing.
