# Wave 4: All Remaining Issues

## Issues
- #6: E2E tests verify mock data flow, not real Claude integration
- #13: E2E tests don't verify Claude actually generates lineup
- #15: First-time onboarding experience — visual verification
- #16: Add 'Reset Show' button accessible from any view

## #6 + #13: Claude Integration E2E Tests

The Claude CLI is available at `/Users/vishnu/.local/bin/claude` (v2.1.81). The WritersRoomView already calls `sendMessage()` via the Claude subprocess. The E2E tests need to verify the REAL flow:

1. E2E test sends a plan text via WritersRoomView
2. The Claude subprocess generates a `showtime-lineup` JSON block
3. The lineup is parsed and displayed as Act cards

**Implementation approach:**
- The E2E test should use the real Claude subprocess (it's available)
- If Claude is slow or unavailable, use a timeout with a graceful skip (not a hard failure)
- Add a test fixture: a pre-recorded Claude response with a valid `showtime-lineup` JSON block that can be used as a fallback
- The test should verify: (a) sendMessage was called, (b) a lineup appeared with Act cards, (c) the Acts have names and durations

**Key files:**
- `e2e/showtime.test.ts` — add/update Claude integration test
- `src/renderer/views/WritersRoomView.tsx` — verify sendMessage integration
- `src/renderer/stores/sessionStore.ts` — the sendMessage flow

## #15: Onboarding Visual Verification

The OnboardingView exists and was implemented. The E2E tests for onboarding were just fixed in wave 3. This issue needs:
- Visual verification that all 5 onboarding steps render correctly
- Screenshots captured at each step via Playwright
- Close the issue if everything looks good

## #16: Reset Show Button

Add a "Reset Show" button accessible from any view for easy restart/demos:

**Implementation:**
- Add a reset option to the tray menu: "Reset Show" (already has "Quit Showtime")
- Add a reset button in the Director Mode view (fits the "compassionate options" pattern)
- The reset action: calls `showStore.resetShow()` which sets phase to 'no_show', clears acts/beats/timer, sets isExpanded to true
- Also clears the SQLite show record for today (or marks it as reset)
- Confirm with a small dialog: "Reset tonight's show? This can't be undone."

**Key files:**
- `src/renderer/stores/showStore.ts` — add `resetShow()` action
- `src/renderer/components/DirectorMode.tsx` — add reset as 5th option
- `src/main/index.ts` — add reset to tray menu, add IPC handler
- `src/preload/index.ts` — add reset IPC bridge

## Testing Strategy
```bash
npm run build
npm run test
npm run test:e2e
npx tsc --noEmit
```

## Loop Configuration
autonomous: true
max_iterations: 1
issue_labels: ["bug", "enhancement"]
cooldown_minutes: 2
