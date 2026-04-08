## 1. Foundation — Custom Matchers & Test Infrastructure

- [ ] 1.1 Create `e2e/matchers/toBeUserClickable.ts` — custom matcher checking viewport, z-index, pointer-events
- [ ] 1.2 Create `e2e/matchers/toFitWithin.ts` — bounding box containment matcher
- [ ] 1.3 Create `e2e/matchers/index.ts` — re-export all custom matchers and extend Playwright's expect
- [ ] 1.4 Update `e2e/fixtures.ts` to import and use the extended expect
- [ ] 1.5 Create `e2e/screenshot-overrides.css` — stylePath CSS for freezing animations and masking dynamic content

## 2. Layer 1 — Viewport & Clickability Tests

- [ ] 2.1 Create `e2e/viewport-clickability.test.ts` — test every interactive element across all views with `toBeUserClickable()`
- [ ] 2.2 Add `toBeInViewport({ ratio: 0.9 })` assertions before all existing `click()` calls in E2E tests
- [ ] 2.3 Verify: run tests with a known-bad fixture (element below fold) to confirm the matcher catches it

## 3. Layer 2 — Structural Layout Validation

- [ ] 3.1 Create `e2e/structural-layout.test.ts` — overflow detection for all views
- [ ] 3.2 Add z-index stacking audit test — scan all interactive elements across all view fixtures
- [ ] 3.3 Add bounding box containment tests — verify key elements fit within their containers
- [ ] 3.4 Verify: intentionally introduce an overflow bug and confirm the test catches it

## 4. Layer 3 — ARIA Snapshots

- [ ] 4.1 Create `e2e/aria-snapshots.test.ts` — toMatchAriaSnapshot() for DarkStudioView, WritersRoom (chat, lineup), ExpandedView, CompactView, DashboardView, PillView
- [ ] 4.2 Add ARIA snapshots for Intermission and all 4 Strike verdict views
- [ ] 4.3 Verify: remove a visible element from a fixture and confirm ARIA snapshot fails

## 5. Layer 4 — Hardened Pixel Diff

- [ ] 5.1 Update `playwright.config.ts` visual project — add stylePath, tiered thresholds config
- [ ] 5.2 Add `colorScheme: 'dark'` to Electron launch options in `e2e/fixtures.ts`
- [ ] 5.3 Add `force-device-scale-factor=1` CLI switch in test mode (update `src/main/index.ts` or launch args)
- [ ] 5.4 Add `MotionGlobalConfig.skipAnimations = true` for NODE_ENV=test in renderer entry
- [ ] 5.5 Update `e2e/visual-regression.test.ts` — apply tiered thresholds (1% static, 3% timer+mask, 5% chat)
- [ ] 5.6 Regenerate baseline screenshots with `--update-snapshots` after all rendering changes
- [ ] 5.7 Add element-level screenshots for ActCard, BeatCounter, OnAirIndicator components

## 6. Layer 5 — Visual Spec & Claude Code Oracle

- [ ] 6.1 Create `e2e/visual-spec.json` — derive from design-system.md, CLAUDE.md, and mockup HTML for all 12 views
- [ ] 6.2 Create `/visual-qa` skill (SKILL.md) — instructions for Claude Code to read screenshots, evaluate against visual-spec.json, report structured pass/fail
- [ ] 6.3 Run `/visual-qa` skill against current screenshots — validate or flag each as golden-worthy
- [ ] 6.4 Document what cannot be automated (animation smoothness, subjective aesthetics, drag feel, multi-monitor DPI)

## 7. Integration & Verification

- [ ] 7.1 Run full E2E suite: `npm run test:e2e` — all layers pass
- [ ] 7.2 Run visual project specifically: `npx playwright test --project=visual` — all new tests pass
- [ ] 7.3 Intentionally break 3 different UI elements and verify each layer catches its class of bug
- [ ] 7.4 Take Playwright screenshots of all views as evidence
- [ ] 7.5 Create PR with all changes

## 8. Memory Cleanup & Documentation

- [ ] 8.1 Update `feedback_e2e_vs_manual_testing.md` — narrow scope to what genuinely can't be automated
- [ ] 8.2 Update `feedback_screenshot_before_close.md` — E2E screenshots are evidence, remove stale Playwright MCP references
- [ ] 8.3 Update `feedback_real_test_evidence.md` — E2E artifacts count as real evidence
- [ ] 8.4 Add `--color-cat-personal: #14b8a6` to design-system.md (fix the one drift found)
