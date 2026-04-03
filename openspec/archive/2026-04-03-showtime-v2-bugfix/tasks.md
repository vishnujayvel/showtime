## 1. Critical — Claude Integration

- [ ] 1.1 Wire Claude subprocess into WritersRoomView (#1)
  - **Files:** `src/renderer/views/WritersRoomView.tsx`, `src/renderer/panels/ChatPanel.tsx`, `src/renderer/lib/lineup-parser.ts` (new)
  - **Work:** Extract `tryParseLineup()` from ChatPanel into shared `lineup-parser.ts`. In WritersRoomView, replace mock `handleBuildLineup()` with `sessionStore.sendMessage()` call that includes energy level and plan text. Subscribe to sessionStore messages, parse `showtime-lineup` JSON from Claude response, call `setLineup()`. Add "Planning..." loading state, 30s timeout, error display with retry option.
  - **Acceptance:** Submitting plan text in Writer's Room calls Claude, parses response into lineup. Loading/error/retry states work. ChatPanel still works using shared parser.
  - **depends_on:** none

## 2. UX Bugs

- [ ] 2.1 Add Beat Check celebration delay (#2)
  - **Files:** `src/renderer/stores/showStore.ts`, `src/renderer/components/BeatCheckModal.tsx`
  - **Work:** In `lockBeat()`, do NOT immediately set `beatCheckPending: false` or call `startAct()`. Instead, set a `celebrationActive: true` flag (new store field). BeatCheckModal reads this flag to show the "That moment was real" + beat-ignite view. After 1800ms setTimeout in `lockBeat()`, clear the flag, set `beatCheckPending: false`, and call `startAct()` (or `strikeTheStage()`).
  - **Acceptance:** Clicking "Lock the Beat" shows "That moment was real" with beat-ignite animation for ~1.8s before advancing. "Not this time" still dismisses immediately.
  - **depends_on:** none

- [ ] 2.2 Fix app close/quit behavior (#3)
  - **Files:** `src/main/index.ts`
  - **Work:** Create system Tray with context menu containing "Quit Showtime" item that calls `app.quit()`. Verify Cmd+Q works on first press (the existing `before-quit` handler sets `forceQuit=true` which should already allow quit — test and fix if needed). Add IPC handler `clui:request-quit` for renderer close button. Traffic light close already hides to tray via the existing close handler — verify this behavior.
  - **Acceptance:** Tray icon visible with "Quit Showtime" menu item. Cmd+Q quits on first press. Red traffic light hides window (does not quit). App can be re-shown from tray.
  - **depends_on:** none

- [ ] 2.3 Fix Playwright process cleanup (#9)
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** In `afterAll`, after `app.close()`, kill the process tree using `app.process().pid` with `process.kill()` or `execSync('kill -9 ...')`. Add a helper that finds and kills orphaned Electron helper processes (GPU, Renderer, Network, Audio) by parent PID.
  - **Acceptance:** Running `npm run test:e2e` leaves no orphaned Electron processes after test completion. Verify with `ps aux | grep -i electron` after test run.
  - **depends_on:** none

## 3. Visual Polish

- [ ] 3.1 Add macOS vibrancy to BrowserWindow (#4)
  - **Files:** `src/main/index.ts`
  - **Work:** Add `vibrancy: 'under-window'` and `visualEffectState: 'active'` to the BrowserWindow constructor options (around line 104). These are mandatory per CLAUDE.md section 4.
  - **Acceptance:** Window shows native macOS frosted glass effect. Transparent regions reveal desktop with blur.
  - **depends_on:** none

- [ ] 3.2 Migrate PermissionCard to Tailwind (#5)
  - **Files:** `src/renderer/components/PermissionCard.tsx`, `src/renderer/theme.ts`
  - **Work:** Replace all `style={{}}` objects with Tailwind classes. Map `useColors()` values to Tailwind tokens: container bg -> `bg-surface-hover`, borders -> `border-beat/30`, header bg -> `bg-beat/[0.06]`, allow buttons -> `bg-green-500/10 hover:bg-green-500/20 border-green-500/25 text-green-500`, deny buttons -> `bg-red-500/10 hover:bg-red-500/20 border-red-500/25 text-red-500`. Remove `useColors()` import. Remove `onMouseEnter`/`onMouseLeave` handlers (use Tailwind `hover:` modifiers). Add any missing color tokens to `@theme` in `index.css` if needed.
  - **Acceptance:** PermissionCard renders identically with zero inline styles. `useColors()` no longer imported. All hover states via Tailwind. `theme.ts` can have its permission color objects removed if no other consumer.
  - **depends_on:** none

- [ ] 3.3 Add GoingLive ON AIR glow animation (#7)
  - **Files:** `src/renderer/views/GoingLiveTransition.tsx`
  - **Work:** Ensure the `OnAirIndicator` component receives or applies the `onair-glow` CSS class when `isLive={true}` during the transition. The class already exists in `index.css`. If OnAirIndicator does not apply it, add `className="onair-glow"` to the indicator's outer element when live. Verify the pulsing box-shadow is visible during the 2500ms transition.
  - **Acceptance:** During Going Live, the ON AIR box has a visible pulsing red glow (onairGlow keyframe). The glow starts after the spring entrance animation completes (~0.3s delay + spring).
  - **depends_on:** none

- [ ] 3.4 Move spotlight gradient to CSS class (#8)
  - **Files:** `src/renderer/views/WritersRoomView.tsx`, `src/renderer/index.css`
  - **Work:** Add a `.spotlight-warm` class to `index.css` with `background: radial-gradient(ellipse at 50% 0%, rgba(217,119,87,0.05) 0%, transparent 70%)`. In WritersRoomView, replace the inline `style={{ background: 'radial-gradient(...)' }}` on the spotlight overlay div with `className="spotlight-warm"`. Also fix the same pattern in BeatCheckModal and GoingLiveTransition if they use inline gradient styles.
  - **Acceptance:** No inline `style={{ background: 'radial-gradient(...)' }}` in WritersRoomView. Spotlight gradient applied via `.spotlight-warm` CSS class. Visual appearance unchanged.
  - **depends_on:** none

## 4. Testing

- [ ] 4.1 Update E2E tests for Claude integration (#6)
  - **Files:** `e2e/showtime.test.ts`
  - **Work:** Update the "7.3 Writer's Room Flow" test section. The "can submit plan and see lineup preview" test currently looks for a "Show me the lineup" button which does not exist (the button is "Build my lineup"). Fix button text matching. Add conditional logic: if Claude is available, wait up to 30s for lineup to appear after submission; if Claude times out, verify error/retry UI appears. Add a test that verifies the lineup panel shows parsed Acts when Claude responds.
  - **Acceptance:** E2E tests pass whether Claude is available or not. When available, lineup is generated from Claude. When unavailable, timeout/error handling is verified. Button text matches actual UI.
  - **depends_on:** 1.1, 2.3
