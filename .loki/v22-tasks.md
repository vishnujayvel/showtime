## Wave 1: Core Fixes (parallel)

- [ ] 1.1 Fix Beat celebration race condition (#11)
  - **Files:** `src/renderer/stores/showStore.ts`
  - **Work:** Add module-level `celebrationTimeout` variable outside the store. In `lockBeat()`, clear any existing timeout before starting new one. Store the timeout ID. Guard the timeout callback: check `get().phase === lockPhase && get().celebrationActive` before advancing. In `resetShow()`, clear the timeout. In `callShowEarly()`, clear the timeout.
  - **GIVEN** the user clicks "Yes -- Lock the Beat"
  - **WHEN** the celebration timeout fires after 1800ms
  - **THEN** the callback SHALL verify phase has not changed and celebrationActive is still true before calling startAct/strikeTheStage
  - **AND** double-calling lockBeat SHALL cancel the first timeout
  - **AND** resetShow SHALL cancel any pending celebration timeout
  - **depends_on:** none

- [ ] 1.2 Add theatrical loading indicator (#14)
  - **Files:** `src/renderer/views/WritersRoomView.tsx`, `src/renderer/index.css`
  - **Work:** In WritersRoomView, when `isSubmitting === true` during the `plan` step, render a loading overlay instead of the plan form. The overlay shows: (1) "The writers are working..." text with `font-body text-lg text-txt-secondary`, (2) animated pulsing dots using a CSS keyframe or Framer Motion, (3) `spotlight-warm` gradient background. After 10s, update text to "Still writing... almost there". After 20s, show "Almost there..." with cancel option. All styling via Tailwind classes and CSS keyframes -- no inline styles. Add `@keyframes writersDots` to index.css if needed.
  - **GIVEN** the user clicks "Build my lineup" with plan text entered
  - **WHEN** Claude is processing the request
  - **THEN** a theatrical loading animation SHALL appear with "The writers are working..." text
  - **AND** the loading SHALL use spring physics or CSS keyframe animations, not inline styles
  - **AND** the existing 30s timeout and error handling SHALL continue to work
  - **depends_on:** none

- [ ] 1.3 Fix window sizing / CSS layout (#10)
  - **Files:** `src/renderer/App.tsx`, `src/renderer/views/StrikeView.tsx`
  - **Work:** In App.tsx root container, add `flex flex-col items-center justify-end` so views anchor to the bottom of the 720px frame. Ensure each view has explicit dimensions matching the spec (Writer's Room 560x680, Expanded 560x620, etc.). In StrikeView, add `max-h-[680px] overflow-y-auto` to the outer container. Verify all views fit within 720px frame height. The existing click-through system handles transparent regions correctly.
  - **GIVEN** each view renders within the 1040x720 fixed frame
  - **WHEN** the view dimensions are measured
  - **THEN** no view content SHALL be clipped by the native window bounds
  - **AND** views SHALL be bottom-anchored within the frame
  - **AND** StrikeView with many acts SHALL scroll instead of clipping
  - **depends_on:** none

## Wave 2: Test Infrastructure (sequential)

- [ ] 2.1 Fix E2E button text mismatch (#6, #13)
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Line 110: change `page.getByText('Show me the lineup')` to `page.getByText('Build my lineup')`. Add a new test in the "7.3 Writer's Room Flow" section that waits for Claude lineup generation: after clicking "Build my lineup", wait up to 30s for a lineup panel with Act cards. If Claude is available, verify at least one Act card with name and category badge. If Claude times out, verify error message appears. Add test that verifies "The writers are working..." loading text appears immediately after clicking the button.
  - **GIVEN** the E2E test suite runs the Writer's Room flow
  - **WHEN** the test submits a plan
  - **THEN** it SHALL click "Build my lineup" (correct button text)
  - **AND** it SHALL verify the loading indicator appears
  - **AND** it SHALL conditionally verify lineup generation or error handling
  - **depends_on:** 1.2 (loading indicator must exist to verify)

- [ ] 2.2 Generate unit test suite from test matrix
  - **Files:** `src/__tests__/showStore.test.ts` (new), `src/__tests__/useTimer.test.ts` (new), `src/__tests__/lineup-parser.test.ts` (new)
  - **Work:** Implement test cases U-01 through U-22 from the test matrix. Use Vitest with `vi.useFakeTimers()` for timeout-dependent tests (U-03 through U-08). Mock `window.clui` for store tests that call IPC methods. Import `useShowStore` from the real store and test actions directly. For `useTimer` tests, use `renderHook` from `@testing-library/react`.
  - **GIVEN** the test matrix defines 22 unit test cases
  - **WHEN** `npm run test` is executed
  - **THEN** all 22 unit tests SHALL pass
  - **AND** fake timers SHALL properly test the 1800ms celebration delay
  - **AND** the lockBeat race condition tests (U-06, U-07, U-08) SHALL verify the fix from task 1.1
  - **depends_on:** 1.1 (race condition fix must be in place for U-06, U-07, U-08)

- [ ] 2.3 Generate component test suite from test matrix
  - **Files:** `src/__tests__/components/BeatCheckModal.test.tsx` (new), `src/__tests__/components/EnergySelector.test.tsx` (new), `src/__tests__/components/WritersRoomView.test.tsx` (new), `src/__tests__/components/ActCard.test.tsx` (new), `src/__tests__/components/PermissionCard.test.tsx` (new), `src/__tests__/components/GoingLiveTransition.test.tsx` (new), `src/__tests__/components/ShowVerdict.test.tsx` (new)
  - **Work:** Implement test cases C-01 through C-13 from the test matrix. Use Vitest with jsdom environment. Mock Zustand store with `vi.mock()` or use `useShowStore.setState()` to set up test state. Use `@testing-library/react` for rendering and querying. For C-11 (PermissionCard inline styles), query all elements and assert none have style attributes with layout/color properties. For C-12 (GoingLiveTransition), assert the `onair-glow` class is in the DOM.
  - **GIVEN** the test matrix defines 13 component test cases
  - **WHEN** `npm run test` is executed
  - **THEN** all 13 component tests SHALL pass
  - **AND** components SHALL render correctly with mocked store state
  - **depends_on:** 1.2 (loading indicator component must exist for C-08, C-09)

- [ ] 2.4 Expand E2E test suite from test matrix
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Implement test cases E-01 through E-18 from the test matrix. E-01 through E-03 already exist (verify and update as needed). Add new tests: E-04 (loading indicator), E-05 (Claude lineup verification with conditional logic), E-07 (GoingLive with onair-glow assertion), E-10 (Beat celebration 1800ms timing), E-13 (vibrancy config via main process evaluation), E-14 (view dimension measurement), E-16 (tray menu), E-18 (orphan process check). For visual property assertions, use `page.locator().evaluate()` to check CSS classes and computed styles.
  - **GIVEN** the test matrix defines 18 E2E test cases
  - **WHEN** `npm run test:e2e` is executed
  - **THEN** all non-Claude-dependent tests SHALL pass
  - **AND** Claude-dependent tests SHALL pass when Claude is available, and skip gracefully otherwise
  - **AND** screenshots SHALL be saved to `e2e/screenshots/` for each view
  - **depends_on:** 1.1, 1.2, 1.3, 2.1 (all fixes must be in place for E2E to validate them)

## Wave 3: Visual Verification (parallel)

- [ ] 3.1 Verify Claude integration (#1) with screenshot
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** In the E2E test for Writer's Room flow, after Claude generates a lineup, capture a screenshot showing Act cards with names and category badges. Assert that the lineup panel contains at least one `[data-testid="act-card"]` or similar identifiable element. If Claude is unavailable, screenshot the error/retry UI instead.
  - **GIVEN** Claude integration is wired into WritersRoomView (already done)
  - **WHEN** the E2E test runs the plan submission flow
  - **THEN** a screenshot SHALL capture the lineup preview or error state
  - **depends_on:** 2.4

- [ ] 3.2 Verify Beat Check celebration (#2) with screenshot
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Set up store state with `beatCheckPending: true` via localStorage manipulation. Screenshot the Beat Check prompt. Click "Yes -- Lock the Beat". Immediately screenshot to capture the celebration ("That moment was real"). Wait 2000ms and screenshot again to verify the modal has been dismissed and the next act or strike view is showing.
  - **GIVEN** Beat Check celebration with 1800ms delay is implemented (already done)
  - **WHEN** the E2E test locks a Beat
  - **THEN** three screenshots SHALL be captured: prompt, celebration, and post-celebration
  - **AND** the celebration screenshot SHALL show "That moment was real"
  - **depends_on:** 2.4

- [ ] 3.3 Verify close/quit (#3) with screenshot
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Use `app.evaluate()` to access the main process and verify tray context menu items include "Quit Showtime". Screenshot is not directly applicable for tray menus, but verify via main process API. For the window close behavior, test that `mainWindow.hide()` is called on close (not quit).
  - **GIVEN** tray menu with "Quit Showtime" exists (already done)
  - **WHEN** the E2E test inspects the tray context menu
  - **THEN** "Quit Showtime" SHALL be present as a menu item
  - **depends_on:** 2.4

- [ ] 3.4 Verify macOS vibrancy (#4) via config inspection
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Use `app.evaluate()` to access the main process BrowserWindow and verify the vibrancy setting. The setting is already at line 113 of main/index.ts. Assert: `mainWindow.getVibrancy?.() === 'under-window'` or verify the constructor options.
  - **GIVEN** vibrancy is configured in BrowserWindow (already done)
  - **WHEN** the E2E test inspects window config
  - **THEN** vibrancy SHALL be 'under-window'
  - **depends_on:** 2.4

- [ ] 3.5 Verify PermissionCard Tailwind (#5) via DOM inspection
  - **Files:** `e2e/showtime.test.ts` or `src/__tests__/components/PermissionCard.test.tsx`
  - **Work:** Render PermissionCard in a component test. Query all descendant elements. Assert no element has a `style` attribute containing `background`, `color`, or `display` properties (only `-webkit-app-region` is allowed). The migration is already complete — this test documents the requirement.
  - **GIVEN** PermissionCard uses only Tailwind classes (already done)
  - **WHEN** the test renders the component and inspects all elements
  - **THEN** zero elements SHALL have inline layout/color styles
  - **depends_on:** 2.3

- [ ] 3.6 Verify GoingLive ON AIR animation (#7) via DOM inspection
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Set up store state to trigger GoingLive transition. After the spring animation entrance (~500ms), query the DOM for an element with the `onair-glow` class. Assert it exists and is visible. Already present at line 30 of GoingLiveTransition.tsx.
  - **GIVEN** GoingLive applies onair-glow class (already done)
  - **WHEN** the E2E test renders the GoingLive transition
  - **THEN** an element with `onair-glow` class SHALL exist in the DOM
  - **depends_on:** 2.4

- [ ] 3.7 Verify spotlight gradient CSS class (#8) via source inspection
  - **Files:** `src/__tests__/components/WritersRoomView.test.tsx`
  - **Work:** Render WritersRoomView. Assert the spotlight overlay div has the `spotlight-warm` CSS class. Assert no element in the component has an inline `style` attribute with a `radial-gradient` value. Already migrated — line 131 uses the class.
  - **GIVEN** WritersRoomView uses spotlight-warm CSS class (already done)
  - **WHEN** the test renders the component
  - **THEN** the spotlight overlay SHALL have the `spotlight-warm` class
  - **AND** no inline gradient styles SHALL be present
  - **depends_on:** 2.3

- [ ] 3.8 Verify Playwright process cleanup (#9) via process check
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** The existing afterAll already kills the process tree (lines 43-52). Add a verification: after afterAll completes, check that no Electron helper processes with the same PPID are still running. This is hard to test within the test itself (afterAll has already run), so this is a manual verification step documented in the test comments.
  - **GIVEN** afterAll kills the process tree (already done)
  - **WHEN** the test suite completes
  - **THEN** no orphaned Electron processes SHALL remain
  - **depends_on:** 2.4

## Wave 4: Polish (parallel)

- [ ] 4.1 Fix any issues found during Wave 3
  - **Files:** TBD based on Wave 3 findings
  - **Work:** For each failed visual verification in Wave 3, create a targeted fix. Common expected fixes: (1) BeatCheckModal inline gradient style at line 37-40 (still uses `style={{ background: 'radial-gradient(...)' }}`), (2) WritersRoomView title bar uses inline `style={{ WebkitAppRegion: 'drag' }}` (acceptable per spec — only layout/color inline styles are prohibited). Document each fix with before/after screenshots.
  - **GIVEN** Wave 3 visual verification identified issues
  - **WHEN** fixes are applied
  - **THEN** re-running the verification tests SHALL pass
  - **depends_on:** 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8

- [ ] 4.2 Fix BeatCheckModal inline gradient (#8 follow-up)
  - **Files:** `src/renderer/components/BeatCheckModal.tsx`, `src/renderer/index.css`
  - **Work:** BeatCheckModal line 37-40 has an inline `style={{ background: 'radial-gradient(...)' }}` for the golden spotlight gradient. This violates CLAUDE.md rule 1. Add a `.spotlight-golden` CSS class to `index.css`: `background: radial-gradient(ellipse 300px 200px at 50% 30%, rgba(245,158,11,0.06) 0%, transparent 70%)`. Replace the inline style with `className="spotlight-golden"`.
  - **GIVEN** BeatCheckModal uses an inline gradient style
  - **WHEN** the class is migrated to CSS
  - **THEN** zero inline `style` attributes with `background` SHALL remain
  - **AND** the visual appearance SHALL be identical
  - **depends_on:** none (can be done in parallel with other Wave 4 tasks)
