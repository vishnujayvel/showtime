## Context

Showtime's E2E test suite has 12 visual regression tests, 12+ visual validation tests, and 164 evidence screenshots. Despite this, every feature still requires manual human visual QA because of three known blind spots:

1. **Auto-scroll false positives**: Playwright's `page.click()` auto-scrolls to elements, so tests pass even when buttons are below the fold (Issue #74)
2. **Loose pixel tolerance**: 5% `maxDiffPixelRatio` allows ~17,000 pixels to differ in a 560x620 view
3. **No structural layout checks**: overflow, z-index stacking, and pointer-events issues are invisible to current tests

The design spec is solid — `design-system.md` (verified Apr 6, 2026), `direction-4-the-show.html` mockup, and `@theme` tokens in `index.css` are 99.5% aligned. One drift: `--color-cat-personal` exists in CSS but not in spec docs.

### Constraints

- **Zero API cost**: All AI analysis uses Claude Code runtime (Read tool for images), never the Anthropic API
- **Never trust baselines**: Every screenshot must be validated against the design spec from first principles before becoming a golden reference
- **60-80% target**: Explicitly call out what cannot be automated rather than over-promising

## Goals / Non-Goals

**Goals:**
- Eliminate manual visual QA for 60-80% of UI changes
- Catch the Issue #74 class of bug (viewport/clickability) automatically
- Catch CSS layout regressions (overflow, z-index, pointer-events) automatically
- Provide semantic structure validation via ARIA snapshots
- Harden existing pixel-diff tests to reduce false negatives
- Enable Claude Code to evaluate screenshots against the design spec during QA passes
- Update 3 stale feedback memories once the gap is provably closed

**Non-Goals:**
- Animation smoothness/jank detection (requires frame-rate analysis, not screenshots)
- Subjective aesthetic judgment ("does this feel like a live show?")
- Cross-platform/cross-browser testing (macOS-only Electron app)
- Drag interaction feel (pointer event responsiveness)
- Applitools/Percy/Chromatic integration (overkill for single-dev, macOS-only)
- Calling the Anthropic API from test code

## Decisions

### D1: Five-layer architecture (not a single tool)

**Decision**: Stack five independent layers rather than one comprehensive tool.

**Why**: Each layer catches a different class of bug. Layers 1-3 are deterministic (no AI needed). Layer 4 is existing infrastructure, improved. Layer 5 uses Claude Code runtime. Layering means each layer can be tested independently and any single layer provides value.

**Alternative considered**: Single AI-vision-only approach (send all screenshots to Claude). Rejected because deterministic checks (overflow, z-index) are faster, cheaper, and more reliable than AI judgment for structural issues.

### D2: Claude Code runtime as visual oracle (not API calls)

**Decision**: The `/visual-qa` skill invokes Claude Code to read screenshots via the Read tool and evaluate them. No Anthropic API calls in test code.

**Why**: Zero marginal cost. Claude Code already has full project context (design spec, code, mockup). The Read tool can read PNG files natively. Structured evaluation follows a visual-spec.json checklist.

**Alternative considered**: Embed `@anthropic-ai/sdk` calls in Playwright test helpers. Rejected because it adds API cost and requires maintaining separate prompts outside conversation context.

### D3: Visual spec as JSON, not screenshots-as-golden

**Decision**: The source of truth for "what correct looks like" is `e2e/visual-spec.json` — a machine-readable file derived from `design-system.md` and `CLAUDE.md`. Not historical baseline screenshots.

**Why**: Screenshots drift silently. A JSON spec can be version-controlled, diffed, and updated in the same PR as the feature change. Claude Code evaluates screenshots against the spec text, not pixel-by-pixel against an old screenshot.

**Alternative considered**: Use `toHaveScreenshot()` baselines as the sole golden reference. Rejected because baselines can become stale without anyone noticing, and the 5% tolerance already proved too loose.

**Hybrid approach**: Keep `toHaveScreenshot()` for pixel-level regression detection (catches exact regressions), but add the JSON spec + Claude Code evaluation for semantic correctness.

### D4: Custom Playwright matchers over external tools

**Decision**: Build `toBeUserClickable()`, `toFitWithin()`, overflow detection as custom `expect.extend()` matchers in Playwright.

**Why**: No new dependencies. Runs in the existing test pipeline. Custom matchers compose with existing test patterns. The research found no maintained Playwright layout-testing package (Galen is abandoned, the Playwright feature request #29430 is open).

### D5: ARIA snapshots as semantic proxy

**Decision**: Add `toMatchAriaSnapshot()` tests for every view as a structural regression check.

**Why**: If the accessibility tree matches the expected structure, the UI is almost certainly rendered correctly. This catches missing elements, wrong ordering, and broken rendering without pixel comparison. Dual benefit: accessibility compliance + visual regression in one test.

### D6: Baseline validation from first principles

**Decision**: Before any screenshot becomes a golden baseline, Claude Code must independently evaluate it against the design spec. No screenshot is trusted by historical existence alone.

**Why**: Screenshots accumulate over time and drift from the spec without anyone noticing. The validation step ensures every baseline actually matches the current design intent.

**Process**: Run E2E → capture screenshots → Claude Code reads each screenshot + visual-spec.json → evaluates pass/fail per criterion → only screenshots that pass become baselines.

## Risks / Trade-offs

**[Risk] Claude Code visual analysis may not be precise enough for subtle CSS issues**
→ Mitigation: Layers 1-3 handle precise structural checks deterministically. Layer 5 (Claude Code) handles semantic/holistic checks where approximate is sufficient. The hybrid approach means we don't rely solely on AI judgment.

**[Risk] ARIA snapshots may be too brittle for fast-moving UI**
→ Mitigation: Use partial matching (Playwright default) — only specify elements we care about, not the full tree. Update ARIA specs in the same PR as UI changes.

**[Risk] Visual spec JSON maintenance burden**
→ Mitigation: The spec is derived from `design-system.md` which is already maintained. One source of truth, one derived artifact.

**[Risk] 5% pixel tolerance changes may cause existing tests to break**
→ Mitigation: Update baselines in the same PR. Tiered thresholds (1%/3%/5%) mean only static views get stricter — dynamic views keep current tolerance with masked dynamic elements.

**[Risk] Over-engineering — spending more time on the testing system than on features**
→ Mitigation: Implement in priority order (Layer 1 first, highest impact). Stop at any layer that provides sufficient coverage. The journaling loop monitors for this anti-pattern.
