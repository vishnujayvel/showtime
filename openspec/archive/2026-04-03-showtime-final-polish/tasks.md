## Group 1: Window Resizing (parallel)

- [ ] 1.1 Add dimension map + setBounds IPC handler in main process (#10)
  - **Files:** `src/main/index.ts`
  - **Work:** Replace the no-op `SET_VIEW_MODE` IPC handler (lines 384-399) with a real implementation. Define a `VIEW_DIMENSIONS` map at module level:
    ```
    const VIEW_DIMENSIONS = {
      pill:     { width: 340, height: 60 },
      expanded: { width: 580, height: 640 },
      full:     { width: 580, height: 700 },
    }
    ```
    In the handler, look up dimensions from the map. Calculate position to keep the window bottom-anchored and horizontally centered on the current display:
    ```
    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    const { width: sw, height: sh } = display.workAreaSize
    const { x: dx, y: dy } = display.workArea
    const x = dx + Math.round((sw - dims.width) / 2)
    const y = dy + sh - dims.height - PILL_BOTTOM_MARGIN
    mainWindow.setBounds({ x, y, width: dims.width, height: dims.height })
    ```
    Remove or update the `BAR_WIDTH` and `PILL_HEIGHT` constants (line 33-34) — keep them for initial window creation but document they are overridden by `setViewMode`. Update `createWindow()` to use `VIEW_DIMENSIONS.pill` for initial dimensions instead of the 1040x720 fixed size. Use Tailwind classes, NOT inline styles, for any renderer-side adjustments.
  - **GIVEN** the `SET_VIEW_MODE` IPC handler receives a mode string
  - **WHEN** the main process looks up the dimensions and calls `setBounds()`
  - **THEN** the native window SHALL resize to the exact dimensions for that view mode
  - **AND** the window SHALL be horizontally centered on the current display
  - **AND** the window bottom edge SHALL be anchored at `workArea.y + workAreaHeight - height - PILL_BOTTOM_MARGIN`
  - **AND** `createWindow()` SHALL use pill dimensions (340x60) for initial launch instead of 1040x720
  - **depends_on:** none

- [ ] 1.2 Add setViewMode IPC calls in App.tsx view routing + transitions (#10)
  - **Files:** `src/renderer/App.tsx`
  - **Work:** Add a `useEffect` hook that fires when `phase`, `isExpanded`, or `goingLiveActive` changes. Map the current state to the correct view mode:
    - `isExpanded === false` (any phase) -> `'pill'`
    - `phase === 'no_show'` (expanded) -> `'expanded'`
    - `phase === 'writers_room'` (expanded) -> `'full'`
    - `phase === 'live' | 'intermission' | 'director'` (expanded) -> `'expanded'`
    - `phase === 'strike'` (expanded) -> `'full'`
    - `goingLiveActive === true` -> `'expanded'` (GoingLive transition uses expanded size)
    Call `window.clui.setViewMode(mode)` with the determined mode. This effect runs before the Framer Motion animation renders, so the window resizes first and the content animates within the new bounds. Use Tailwind classes, NOT inline styles, for any component-level adjustments.
  - **GIVEN** the show phase changes (e.g., `no_show` -> `writers_room` -> `live` -> `strike`)
  - **WHEN** the `useEffect` fires for the new phase
  - **THEN** `window.clui.setViewMode()` SHALL be called with the correct mode for that phase
  - **AND** the native window SHALL resize before the Framer Motion view transition animation starts
  - **AND** transitions between pill (340x60) and expanded (580x640) SHALL feel seamless (transparent background hides any brief size mismatch)
  - **depends_on:** none (can be developed in parallel with 1.1 — both are needed for the feature to work)

## Group 2: Onboarding (parallel)

- [ ] 2.1 Create OnboardingView component (5-step flow with animations) (#15)
  - **Files:** `src/renderer/views/OnboardingView.tsx` (new)
  - **Work:** Create a new React component with 5 steps. Each step has a title, description, and animation. Use Framer Motion `AnimatePresence` with spring physics for step transitions. Step content:
    - Step 1: "Welcome to the Show" — spotlightFadeIn animation, intro to Show concept
    - Step 2: "The Writer's Room" — warm spotlight shift, Writer's Room explanation
    - Step 3: "Acts and the ON AIR Light" — onairGlow animation on sample ON AIR indicator
    - Step 4: "Beats: Moments of Presence" — beatIgnite animation on sample gold star
    - Step 5: "Ready for Your First Show?" — goldenGlow on CTA, "Enter the Writer's Room" button
    Include: step indicator dots (5 dots, current = `bg-accent`, others = `bg-txt-muted`), Back/Next buttons, "Skip" link. Step 1 has no Back. Step 5 has "Enter the Writer's Room" instead of Next. Props: `onComplete: () => void` callback. Use Tailwind classes, NOT inline styles. Use `font-body` for text, `font-mono` for labels. Colors from design system tokens. Reference animations from `index.css` (`spotlightFadeIn`, `onairGlow`, `beatIgnite`, `goldenGlow`). All animations use spring physics per CLAUDE.md rule 5.
  - **GIVEN** the OnboardingView component renders at step 1
  - **WHEN** the user clicks "Next" to advance through all 5 steps
  - **THEN** each step SHALL transition with spring physics animation
  - **AND** each step SHALL display its unique animation (spotlight, ON AIR, beat, golden glow)
  - **AND** step 5 SHALL show "Enter the Writer's Room" button that calls `onComplete()`
  - **AND** "Skip" link SHALL be visible on every step and call `onComplete()`
  - **AND** zero inline `style={{}}` objects SHALL be present in the component
  - **depends_on:** none

- [ ] 2.2 Add onboarding routing in App.tsx (localStorage check + Help button) (#15)
  - **Files:** `src/renderer/App.tsx`
  - **Work:** In the `renderView()` function, before the existing phase-based routing, check `localStorage.getItem('showtime-onboarding-complete')`. If not `'true'` and phase is `no_show`, render `<OnboardingView>` instead of `<DarkStudioView>`. The `onComplete` callback: (1) sets `showtime-onboarding-complete` to `'true'` in localStorage, (2) calls `useShowStore.getState().enterWritersRoom()` to go directly to Writer's Room. For the "Skip" path: sets localStorage but does NOT enter Writer's Room (user sees Dark Studio).
    Add a Help button (`?`) in the root layout, visible only when `isExpanded === true`. Position: top-right corner, `absolute top-3.5 right-3`, size `w-6 h-6`, styled as `text-txt-muted hover:text-txt-secondary bg-transparent rounded-full flex items-center justify-center text-xs font-mono`. Must have `data-clui-ui` attribute and `-webkit-app-region: no-drag` class. Clicking the Help button: removes `showtime-onboarding-complete` from localStorage and sets phase to `no_show` via `resetShow()` (which triggers the onboarding check). Use Tailwind classes, NOT inline styles.
  - **GIVEN** a first-time user launches Showtime (no localStorage flag)
  - **WHEN** the App component renders with `phase === 'no_show'`
  - **THEN** the OnboardingView SHALL render instead of DarkStudioView
  - **AND** completing onboarding SHALL set the localStorage flag and enter Writer's Room
  - **AND** skipping onboarding SHALL set the localStorage flag and show Dark Studio
  - **AND** the Help button SHALL be visible in the top-right of expanded views
  - **AND** clicking Help SHALL re-trigger the onboarding tutorial
  - **depends_on:** none (can import OnboardingView once 2.1 is done, but the routing logic can be stubbed)

- [ ] 2.3 Write onboarding E2E tests (#15)
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Add a new test section "Onboarding Flow" with the following tests:
    1. "shows onboarding on first launch" — clear localStorage, launch app, verify step 1 text "Welcome to the Show" is visible
    2. "navigates through all 5 steps" — click Next 4 times, verify each step's title appears, verify step 5 shows "Enter the Writer's Room" button
    3. "completing onboarding enters Writer's Room" — click through to step 5, click "Enter the Writer's Room", verify Writer's Room energy selector appears
    4. "skip goes to Dark Studio" — on step 1, click "Skip", verify Dark Studio CTA visible
    5. "does not show onboarding on subsequent launch" — set `showtime-onboarding-complete` in localStorage before launch, verify Dark Studio shows directly
    6. "Help button re-triggers onboarding" — complete onboarding, verify Dark Studio or Writer's Room, click Help button, verify onboarding step 1 reappears
    Use `page.evaluate(() => localStorage.clear())` and `page.evaluate(() => localStorage.setItem(...))` for state setup. Use Tailwind classes, NOT inline styles, for any test helpers or fixtures.
  - **GIVEN** the E2E test suite includes onboarding tests
  - **WHEN** `npm run test:e2e` is executed
  - **THEN** all 6 onboarding tests SHALL pass
  - **AND** the tests SHALL correctly manipulate localStorage to test both first-launch and returning-user scenarios
  - **AND** the tests SHALL verify step transitions use spring animations (by checking AnimatePresence wrapper exists)
  - **depends_on:** 2.1, 2.2

## Group 3: Claude E2E Verification (1 task)

- [ ] 3.1 Add conditional Claude verification to E2E test suite (#6, #13)
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Add a new test: "Writer's Room generates real lineup via Claude (conditional)". The test:
    1. Navigate to Writer's Room (click "Enter the Writer's Room" from Dark Studio)
    2. Select "Medium" energy
    3. Enter plan text: "Today I need to do deep work on the API for 90 minutes, exercise at lunch for 45 minutes, then admin tasks for 60 minutes"
    4. Click "Build my lineup"
    5. Verify "The writers are working..." loading text appears within 1 second
    6. Use `Promise.race` with two waiters:
       - **Lineup waiter:** `page.locator('[data-testid="act-card"], .act-card').first().waitFor({ timeout: 30000 })`
       - **Error waiter:** `page.locator('[data-testid="lineup-error"], :text("Try again")').first().waitFor({ timeout: 31000 })`
    7. If lineup waiter wins: assert at least 2 Act cards visible, each with non-empty text content and a duration pattern. Log "Claude path: lineup generated successfully."
    8. If error waiter wins: assert error message visible, retry button clickable. Log "Claude path: unavailable, error UI verified."
    9. The test passes in both cases.
    Use Tailwind classes, NOT inline styles, for any test page interactions. Ensure the test does not import Node.js modules in the renderer evaluation context.
  - **GIVEN** the E2E test suite runs in any environment
  - **WHEN** the conditional Claude verification test executes
  - **THEN** the test SHALL pass whether Claude responds with a lineup or the error UI appears
  - **AND** the loading indicator SHALL be verified within 1 second of clicking "Build my lineup"
  - **AND** if Claude responds, at least 2 Act cards SHALL be verified with names and durations
  - **AND** if Claude is unavailable, the error/retry UI SHALL be verified
  - **AND** the test output SHALL log which path was taken
  - **depends_on:** none (tests existing functionality, does not require new code)

## Group 4: Verification (depends on all above)

- [ ] 4.1 Run full E2E suite, take issue-specific screenshots, verify all pass
  - **Files:** `e2e/showtime.test.ts`, screenshots saved to `e2e/screenshots/`
  - **Work:** Run the complete E2E suite: `npm run test:e2e`. Capture screenshots at key moments:
    - **#10 Window sizing:** Screenshot pill view (should be 340x60 native), expanded view (580x640), Writer's Room (580x700), Strike (580x700). Use `page.evaluate` to read `window.outerWidth` and `window.outerHeight` and assert they match expected dimensions.
    - **#6/#13 Claude E2E:** Screenshot the loading state ("The writers are working...") and either the lineup result or error UI.
    - **#15 Onboarding:** Screenshot each of the 5 onboarding steps, the Help button, and the transition to Writer's Room after completion.
    Verify all existing tests still pass (128+ unit tests, existing E2E tests). Run `npm run test` for unit tests and `npm run test:e2e` for E2E. Document any regressions found. Use Tailwind classes, NOT inline styles, for any new screenshot comparison utilities.
  - **GIVEN** all tasks in Groups 1-3 are complete
  - **WHEN** `npm run test && npm run test:e2e` is executed
  - **THEN** all unit tests SHALL pass (128+ existing + any new)
  - **AND** all E2E tests SHALL pass (existing + new onboarding + new Claude verification)
  - **AND** screenshots SHALL be saved to `e2e/screenshots/` showing each issue's resolution
  - **AND** window dimensions SHALL be verified programmatically in the E2E tests
  - **depends_on:** 1.1, 1.2, 2.1, 2.2, 2.3, 3.1
