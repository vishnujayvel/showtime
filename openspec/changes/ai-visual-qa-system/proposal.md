## Why

Manual visual QA is the bottleneck in Showtime's development loop. Three feedback memories (`feedback_e2e_vs_manual_testing`, `feedback_real_test_evidence`, `feedback_screenshot_before_close`) create a self-reinforcing cycle: every feature requires a human to launch the app, eyeball it, and screenshot — even though Playwright E2E tests already capture screenshots and do pixel comparison. The root cause is that existing E2E tests have known blind spots (Playwright auto-scrolls past overflow, 5% pixel tolerance is too loose, no structural layout validation). Closing these gaps makes 60-80% of manual visual QA automatable.

## What Changes

- Add **viewport-aware interaction assertions** (`toBeInViewport()` + custom `toBeUserClickable()` matcher) that catch the Issue #74 class of bug (elements below fold, behind overlays, blocked by pointer-events)
- Add **structural layout validation** tests: overflow detection, z-index stacking audit, bounding box containment assertions
- Add **ARIA snapshot tests** (`toMatchAriaSnapshot()`) for every view — semantic structure as a visual correctness proxy
- **Harden existing pixel-diff tests**: tiered thresholds (1% static, 3% timer, 5% chat), `stylePath` for animation freezing, `colorScheme: 'dark'` in Electron launch, `force-device-scale-factor=1`, Framer Motion `skipAnimations`
- Create **visual-spec.json** — machine-readable design spec derived from design-system.md and CLAUDE.md, used by Claude Code runtime for screenshot evaluation
- Build **`/visual-qa` skill** — Claude Code reads E2E screenshots via Read tool, evaluates against visual-spec.json, reports structured pass/fail per view. Zero Anthropic API cost — runs entirely within Claude Code runtime.
- **Validate existing baseline screenshots from first principles** — never trust historical baselines; evaluate each against the design spec before accepting

## Capabilities

### New Capabilities
- `visual-qa-assertions`: Custom Playwright matchers (toBeUserClickable, toFitWithin, overflow detection, z-index audit) and viewport-aware interaction testing
- `visual-qa-oracle`: Claude Code runtime-based visual QA skill that reads screenshots and evaluates against visual-spec.json with structured pass/fail rubric
- `visual-spec`: Machine-readable JSON design specification derived from design-system.md, used as the single source of truth for automated visual validation

### Modified Capabilities
- `ui-views`: Requirements change — all views must have ARIA snapshot coverage and pass structural layout validation (overflow, z-index, viewport containment)

## Impact

- **Test files**: New test files in `e2e/` for layers 1-3, modifications to `e2e/visual-regression.test.ts` for layer 4
- **Test helpers**: New custom matchers in `e2e/matchers/`, updated `e2e/fixtures.ts`
- **Config**: Updated `playwright.config.ts` (stylePath, colorScheme, thresholds)
- **Electron main**: Add `force-device-scale-factor=1` flag in test mode
- **App code**: Add `MotionGlobalConfig.skipAnimations` in test builds
- **Skills**: New `/visual-qa` skill for Claude Code visual oracle
- **Specs**: New `e2e/visual-spec.json` design specification file
- **Memory**: 3 stale feedback memories updated after implementation proves gap is closed
