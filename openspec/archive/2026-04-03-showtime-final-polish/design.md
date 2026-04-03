## Context

Final polish change building on Showtime v2.2. The app is fully functional with all core flows working, but three gaps remain: (1) the native window is a fixed oversized transparent box instead of dynamically fitting each view, (2) E2E tests never verify that Claude produces a real lineup, and (3) first-time users have no introduction to the SNL Day Framework concepts.

**Current state of each gap:**

- **Window sizing (#10)** — `main/index.ts` lines 33-34 define `BAR_WIDTH=1040` and `PILL_HEIGHT=720` as fixed constants. The `SET_VIEW_MODE` IPC handler (lines 384-399) receives `'pill'|'expanded'|'full'` from the renderer but no-ops for all modes — the comment says "No native resize needed." The renderer draws views at varying CSS sizes (Pill 320x48, Writer's Room 560x680, Expanded 560x620) inside this fixed frame. Click-through via `setIgnoreMouseEvents` handles the transparent dead zone, but the large invisible window prevents proper macOS window shadows, confuses accessibility tools, and makes the pill view appear as a 1040x720 window in Mission Control.

- **Claude E2E verification (#6, #13)** — `e2e/showtime.test.ts` has a Writer's Room flow test that clicks "Build my lineup" and verifies the loading indicator appears. It never waits for Claude to respond, never checks that Act cards render, and never validates the lineup structure. These are the same issue filed from two angles.

- **Onboarding (#15)** — No `OnboardingView` exists. First-time users land on the Dark Studio screen with "Enter the Writer's Room" — a call to action that assumes they understand what a Writer's Room, Show, Act, and Beat mean. The product context (section 9) envisions "a moment of possibility" on first launch, but that moment requires context the user does not yet have.

## Goals / Non-Goals

**Goals:**

- Replace the fixed 1040x720 native window with dynamic `setBounds()` calls per view mode
- Add conditional Claude E2E verification that passes whether Claude is available or not
- Create a 5-step onboarding tutorial that teaches the SNL Day Framework on first launch
- Add a Help button in the title bar to re-access the onboarding at any time
- Maintain all existing tests passing throughout

**Non-Goals:**

- No architecture changes to the store, IPC bridge, or subprocess management
- No new dependencies
- No changes to the Claude integration logic itself (only the E2E test verification)
- No calendar integration, cross-day persistence, or gamification (these remain out of MLP scope)
- No changes to the show phase state machine

## Decisions

### D1: Dynamic window sizing via setBounds() with dimension map

**Choice:** Implement real window resizing in the `SET_VIEW_MODE` IPC handler. Each view mode maps to specific native window dimensions. The renderer calls `setViewMode()` during view transitions, and the main process calls `mainWindow.setBounds()` with the correct dimensions.

**Rationale:** The v2.2 design doc rejected dynamic sizing due to animation race conditions with `setBounds()`. However, the current approach has worse problems: Mission Control shows a 1040x720 rectangle for a 320x48 pill, accessibility tools report an oversized window, and macOS window shadows cannot render correctly on a transparent frame. The race condition concern is mitigated by: (1) performing the resize before the Framer Motion animation starts, not during it, (2) using a single `setBounds()` call per transition rather than animated incremental resizing, and (3) keeping the window transparent so any brief size mismatch is invisible.

**Dimension map:**

| View Mode | IPC Value | Width | Height | Notes |
|-----------|-----------|-------|--------|-------|
| Pill | `pill` | 340 | 60 | 320x48 pill + 10px padding each side + 6px vertical |
| DarkStudio | `expanded` | 580 | 400 | 560px panel + 10px padding each side |
| Expanded/Live | `expanded` | 580 | 640 | Timer hero + lineup sidebar |
| WritersRoom | `full` | 580 | 700 | Energy + plan + lineup preview |
| StrikeView | `full` | 580 | 700 | Stats + verdict + act recap |

**Implementation:**

1. In `main/index.ts`, replace the no-op `SET_VIEW_MODE` handler with a dimension lookup and `setBounds()` call
2. Add a `VIEW_DIMENSIONS` map: `{ pill: { width: 340, height: 60 }, expanded: { width: 580, height: 640 }, full: { width: 580, height: 700 } }`
3. Calculate the new `x` position to keep the window centered horizontally on the current display
4. Calculate the new `y` position to keep the bottom edge anchored (views expand upward from the bottom)
5. Call `mainWindow.setBounds({ x, y, width, height })` — single call, no animation
6. In `App.tsx`, add `setViewMode()` calls in the `renderView()` function based on the current phase and `isExpanded` state
7. Use a `useEffect` that fires when `phase` or `isExpanded` changes, calling `window.clui.setViewMode()` with the appropriate mode

**Position recalculation:**
```
const display = screen.getDisplayNearestPoint(cursor)
const { width: screenWidth, height: screenHeight } = display.workAreaSize
const { x: dx, y: dy } = display.workArea
const newX = dx + Math.round((screenWidth - newWidth) / 2)
const newY = dy + screenHeight - newHeight - PILL_BOTTOM_MARGIN
```

This keeps the window bottom-anchored and horizontally centered, matching the initial pill positioning logic in `createWindow()`.

### D2: Conditional Claude E2E verification with timeout

**Choice:** Add a new E2E test that submits a real plan to Claude and uses conditional logic to validate either the success or failure path.

**Rationale:** The current test verifies the UI flow (button clicks, loading state) but never confirms the core value proposition — that Claude turns a text dump into a structured lineup. The test must work in both scenarios (Claude available, Claude unavailable) to avoid CI failures.

**Implementation:**

1. New test: "Writer's Room generates real lineup via Claude (conditional)"
2. Navigate to Writer's Room, select energy, enter plan text ("Today I need to do deep work on the API, exercise at lunch, then admin tasks")
3. Click "Build my lineup"
4. Wait for either: (a) Act cards to appear (selector: `[data-testid="act-card"]` or text matching act names), or (b) error/retry UI (selector: retry button or error message text)
5. Use `Promise.race` with a 30-second timeout:
   - **If Act cards appear:** Assert at least 2 Act cards are visible. Each card has a name (text content), duration (text matching `\d+ min`), and category badge (element with category color). Assert the lineup panel header is visible.
   - **If error/retry appears:** Assert the error message is visible. Assert a retry button exists. Assert the error uses show-metaphor language (not generic error text). This path also passes the test.
   - **If 30s timeout with neither:** The test verifies the timeout error UI appears (this is the existing 30s timeout in WritersRoomView).
6. This is a single test with conditional assertions, not separate tests. The test documents which path was taken in the test output.

### D3: OnboardingView — 5-step interactive tutorial

**Choice:** Create a new `OnboardingView` component that replaces the Dark Studio on first launch. The view walks through 5 interactive steps teaching the SNL Day Framework, using existing animations from the design system.

**Rationale:** The product context (section 9) envisions first launch as "a moment of possibility." For users who do not understand the theatrical metaphor, the Dark Studio screen is confusing rather than inviting. The onboarding converts confusion into anticipation by teaching the framework through the same visual language the app uses.

**localStorage flag:** `showtime-onboarding-complete` — checked on app launch, set to `true` after completing the tutorial. This is separate from the Zustand persist store to avoid coupling onboarding state with show state.

**5-step flow:**

| Step | Title | Content | Animation | Interactive Element |
|------|-------|---------|-----------|-------------------|
| 1 | "Welcome to the Show" | "Your day is a Show. You are the Performer. Every task is an Act on your stage." | `spotlightFadeIn` — spotlight illuminates center text | "Next" button |
| 2 | "The Writer's Room" | "Each morning, you enter the Writer's Room. Tell Claude what's on your plate, and the writers draft tonight's lineup." | Spotlight shifts warm (`accent` color) | "Next" button |
| 3 | "Acts and the ON AIR Light" | "When the show goes live, the ON AIR light ignites. Each Act has a timer — a broadcast clock counting down to the next moment." | `onairGlow` animation on a sample ON AIR indicator | "Next" button |
| 4 | "Beats: Moments of Presence" | "A Beat is not productivity. A Beat is presence. Lock a Beat when you notice you are truly here." | `beatIgnite` animation on a sample gold star | "Next" button |
| 5 | "Ready for Your First Show?" | "The stage is set. The spotlight is warm. The Writer's Room is waiting." | `goldenGlow` on the CTA text | "Enter the Writer's Room" button (completes onboarding) |

**Component structure:**
```
OnboardingView
  - Step indicator (5 dots, current highlighted in accent color)
  - Content area with AnimatePresence for step transitions
  - Navigation: Back/Next buttons (step 1 has no Back, step 5 has "Enter the Writer's Room" instead of Next)
  - "Skip" link in bottom-right for users who want to jump straight in
```

**Routing integration in App.tsx:**
```typescript
// Before the existing renderView() logic:
const onboardingComplete = localStorage.getItem('showtime-onboarding-complete') === 'true'
if (!onboardingComplete && phase === 'no_show') {
  return <OnboardingView key="onboarding" onComplete={() => {
    localStorage.setItem('showtime-onboarding-complete', 'true')
    // Optionally enter Writer's Room directly
  }} />
}
```

**Help button:** Add a small `?` button in the title bar drag region (positioned near the traffic lights but on the opposite side). Clicking it resets the onboarding flag and navigates to the OnboardingView. The button uses `no-drag` to remain clickable within the drag region.

**All styling uses Tailwind classes. All animations use spring physics or existing CSS keyframes from `index.css`. No inline styles.**

### D4: Window mode mapping for onboarding

**Choice:** The OnboardingView uses the `expanded` view mode (580x640) — the same size as the Dark Studio / Expanded view.

**Rationale:** The onboarding content needs more vertical space than the pill but less than the full Writer's Room. The expanded dimensions (580x640) provide a comfortable reading area for the tutorial steps. Since onboarding only shows in `no_show` phase when `isExpanded` is true (default), it uses the same window size as the Dark Studio it replaces.

## Risks / Trade-offs

**[Risk] setBounds() during Framer Motion animations may cause visual tearing**
Mitigation: The `setBounds()` call happens in a `useEffect` that fires on phase/expansion change — this runs BEFORE the Framer Motion animation starts in the next render cycle. The window is transparent, so any brief frame where the bounds do not match the content is invisible. The content animates within the new bounds.

**[Risk] setBounds() position calculation may be wrong on multi-monitor setups**
Mitigation: The position calculation uses `screen.getDisplayNearestPoint(screen.getCursorScreenPoint())` — the same approach as the existing `createWindow()` function. This correctly identifies the current display on multi-monitor setups. The bottom-anchor calculation uses `display.workArea` which accounts for menu bar and dock.

**[Risk] Onboarding may feel like friction for users who just want to start**
Mitigation: The "Skip" link is always visible. The tutorial is 5 short steps with large "Next" buttons — it takes under 30 seconds. The final step goes directly into the Writer's Room. Users who skip still get the Dark Studio which has its own implicit onboarding through the "Enter the Writer's Room" CTA.

**[Risk] Claude E2E test may be flaky with conditional logic**
Mitigation: The test uses `Promise.race` with clear selectors for both paths. The conditional is binary (Act cards appear OR error UI appears) with no intermediate state. The 30-second timeout matches the app's own timeout, so the error UI is guaranteed to appear if Claude does not respond. The test logs which path was taken for debugging.

**[Risk] Help button in title bar may conflict with drag region or traffic lights**
Mitigation: Position the Help button at `right: 12px, top: 14px` — opposite side from the traffic lights (which are at `left: 12px, top: 14px`). The button has `-webkit-app-region: no-drag` to remain clickable. It is small (24x24px) and uses `text-txt-muted hover:text-txt-secondary` to stay unobtrusive.
