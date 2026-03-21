## Context

Brownfield fix+verify change building on Showtime v2.1 bugfix. Of the 14 open issues, 8 appear already resolved in the codebase but lack visual verification. 4 are genuinely open (window sizing #10, Beat race condition #11, Playwright MCP integration #12, loading indicator #14). 2 are partially resolved (E2E Claude verification #6/#13 — tests exist but with wrong button text).

**Current state of each genuinely open gap:**

- **Window sizing (#10)** — `main/index.ts` line 33-34 sets `BAR_WIDTH=1040`, `PILL_HEIGHT=720`, `resizable: false`. The renderer draws views at varying CSS sizes inside this fixed transparent frame. Click-through (`setIgnoreMouseEvents`) makes invisible areas passthrough. The problem: views cannot exceed 720px height, and the large transparent dead zone between Pill (48px) and Expanded (620px) can confuse screen readers and accessibility tools.

- **Beat race condition (#11)** — `showStore.ts` line 256: `setTimeout(() => { set(...); get().startAct(...) }, 1800)`. No timeout ID stored, no cleanup on unmount or re-entry. If `lockBeat()` is called twice (double-click before first timeout fires), two timeouts race, potentially calling `startAct()` twice or operating on stale `currentActId`.

- **Playwright MCP integration (#12)** — `e2e/showtime.test.ts` uses Playwright's built-in `page.screenshot()` but never asserts visual properties. Playwright MCP tools (`browser_snapshot`, `browser_take_screenshot`) enable DOM snapshot + screenshot capture that can be validated programmatically.

- **Loading indicator (#14)** — `WritersRoomView.tsx` line 187: the only loading feedback is `{isSubmitting ? 'Planning...' : 'Build my lineup'}` on the button. No animation, no theatrical metaphor, no progress indication for the 5-30s Claude processing time.

## Goals / Non-Goals

**Goals:**

- Fix the 4 genuinely open issues (#10, #11, #12, #14)
- Fix the 2 partially resolved issues (#6, #13) — correct button text in E2E, add Claude lineup verification
- Visually verify all 8 already-resolved issues (#1-#5, #7-#9) with Playwright MCP screenshots
- Generate comprehensive test matrix (30-50 test cases) covering unit, component, and E2E levels
- Ensure no regression in the 128 existing unit tests

**Non-Goals:**

- No new product features beyond loading indicator
- No architecture changes
- No new dependencies (Playwright MCP is already available via the MCP server)
- No data model changes

## Decisions

### D1: Window sizing — CSS-only layout within fixed frame

**Choice:** Keep the fixed 1040x720 native window. Fix CSS layout so all views center vertically within the frame, and ensure no view exceeds the available height.

**Rationale:** Dynamic `setBounds()` via IPC introduces animation race conditions — Electron's `setBounds()` is synchronous on the main process but asynchronous from the renderer's perspective. The current approach (fixed frame + transparent click-through) already works for the primary use case (floating panel). The issue is CSS layout, not window management.

**Alternative considered:** Dynamic `setBounds()` IPC calls during view transitions. Rejected because: (1) `setBounds()` during Framer Motion animations creates visual tearing, (2) the NSPanel type on macOS has quirks with size changes while visible, (3) the click-through system already handles the transparent dead zone correctly.

**Implementation:**
1. Add `items-center justify-end` to the root layout container (views anchor to bottom of frame, matching the pill position)
2. Ensure Writer's Room (680px) and Expanded View (620px) fit within the 720px frame with padding
3. For Strike view (variable height), add `max-h-[680px] overflow-y-auto` with custom scrollbar styling
4. Add `transition-all` to the view container for smooth height changes between views
5. Test each view transition to verify no clipping or layout shift

### D2: Beat celebration race condition — timeout ID + guard

**Choice:** Store the celebration timeout ID in a closure variable within the store. Clear any existing timeout before starting a new one. Guard the timeout callback against stale state.

**Rationale:** The current bare `setTimeout` has three problems: (1) no cancellation if `lockBeat()` is called again during the 1800ms window, (2) the callback captures `get()` which reads current state — but if the store has been reset between timeout creation and execution, `get().startAct()` operates on invalid state, (3) no cleanup on store reset.

**Implementation:**
```typescript
// Module-level timeout tracker (outside the store to avoid serialization)
let celebrationTimeout: ReturnType<typeof setTimeout> | null = null

// Inside lockBeat():
lockBeat: () => {
  // Clear any in-flight celebration
  if (celebrationTimeout) {
    clearTimeout(celebrationTimeout)
    celebrationTimeout = null
  }

  const { currentActId } = get()
  set((s) => ({
    beatsLocked: s.beatsLocked + 1,
    celebrationActive: true,
    acts: s.acts.map((a) =>
      a.id === currentActId ? { ...a, beatLocked: true } : a
    ),
  }))

  // Capture the phase at time of lock — if it changes, the callback is stale
  const lockPhase = get().phase

  celebrationTimeout = setTimeout(() => {
    celebrationTimeout = null

    // Guard: only advance if we are still in the same phase
    if (get().phase !== lockPhase || !get().celebrationActive) return

    set({ celebrationActive: false, beatCheckPending: false })

    const state = get()
    const nextAct = state.acts.find((a) => a.status === 'upcoming')
    if (nextAct) {
      get().startAct(nextAct.id)
    } else {
      get().strikeTheStage()
    }
  }, 1800)
},
```

Also add cleanup in `resetShow()`:
```typescript
resetShow: () => {
  if (celebrationTimeout) {
    clearTimeout(celebrationTimeout)
    celebrationTimeout = null
  }
  set({ ...initialState, showDate: today(), isExpanded: true })
},
```

### D3: Loading indicator — theatrical "Writers Room" animation

**Choice:** Replace the "Planning..." button text with a full-panel loading state that shows a spotlight sweep animation and the text "The writers are working..." in the show metaphor.

**Rationale:** ADHD users need visual novelty and progress indication. A text-only loading state feels broken after 3 seconds. The theatrical metaphor (writers in a room, working on tonight's lineup) maintains immersion and reduces anxiety during the 5-30s Claude processing time.

**Implementation:**
1. In WritersRoomView, when `isSubmitting === true`, render a loading overlay instead of the plan dump form
2. The overlay uses the existing `spotlight-warm` gradient with an added sweep animation
3. Text: "The writers are working..." in `font-body text-lg text-txt-secondary`
4. Animated elements: three pulsing dots (like a typing indicator) below the text
5. A subtle progress bar or spinning stage light icon
6. After 10s without response, show "Still writing... Claude is thinking hard about this one"
7. After 20s, show "Almost there..." with the option to cancel
8. The animation uses spring physics per CLAUDE.md rule 5

### D4: Playwright MCP integration for visual validation

**Choice:** Add Playwright MCP-based visual validation helpers to the E2E test suite. Use `browser_snapshot` for DOM structure validation and `browser_take_screenshot` for visual regression.

**Rationale:** Current tests take screenshots but never assert on them. Playwright MCP provides programmatic access to DOM snapshots that can be queried for CSS properties, element visibility, and layout dimensions — exactly what we need to verify issues like vibrancy config, inline styles, animation classes, and window sizing.

**Implementation:**
1. E2E tests will use standard Playwright assertions (`toBeVisible`, `toHaveCSS`, `toHaveClass`) for visual property verification
2. Screenshots captured at each view transition for visual regression baseline
3. DOM queries verify: CSS classes present (e.g., `onair-glow`), no inline `style` attributes on migrated components, correct dimensions
4. For Claude integration tests: conditional wait with timeout — verify lineup if Claude responds, verify error UI if timeout

### D5: Fix E2E button text mismatch (#6, #13)

**Choice:** Update E2E test to use correct button text "Build my lineup" instead of "Show me the lineup".

**Implementation:** Single line change in `e2e/showtime.test.ts` line 110:
```typescript
// Before:
const nextButton = page.getByText('Show me the lineup')
// After:
const nextButton = page.getByText('Build my lineup')
```

Add Claude lineup verification: after clicking "Build my lineup", wait up to 30s for lineup panel to appear with Act cards. If timeout, verify error message.

## Risks / Trade-offs

**[Risk] CSS-only window layout may still clip on smaller displays**
Mitigation: The 720px fixed height accommodates all views (max is Writer's Room at 680px + title bar). Test on 1080p and 1440p displays. The `max-h` + `overflow-y-auto` on Strike view handles variable content.

**[Risk] Beat celebration timeout guard may prevent legitimate advancement**
Mitigation: The guard only blocks if `phase` has changed (e.g., user navigated away during celebration) or `celebrationActive` was cleared (e.g., store reset). In normal flow, the phase remains `live` and `celebrationActive` remains `true` throughout the 1800ms.

**[Risk] Theatrical loading animation may feel too slow for simple plans**
Mitigation: The animation starts immediately (no artificial delay). If Claude responds in < 2s, the transition to lineup view happens seamlessly. The animation is a loading state, not a forced wait.

**[Risk] Playwright MCP tests may be flaky in CI without Claude subprocess**
Mitigation: All Claude-dependent tests use conditional logic — verify lineup generation when Claude is available, verify error/retry UI when not. Non-Claude tests (window sizing, visual properties, animation classes) are deterministic.
