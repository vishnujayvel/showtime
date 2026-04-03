# Bug Batch Wave 1 — Four Bug Fixes

GitHub Issues: #50, #49, #46, #44

## Why

Four open bugs affecting UX quality. Fixing them as a batch since they're independent and can be committed atomically.

## Bug 1: Going Live needs a start button (#50)

The "Live from your desk, it's [date]!" Going Live transition auto-advances without user input. The user needs a deliberate threshold crossing — pressing a button — to feel like they started the show.

### Fix

In `src/renderer/views/GoingLiveTransition.tsx`:
- After the animation and text appear, show a "Go Live" button
- Button uses spring physics animation (scale up from 0.8)
- User clicks the button to call `onComplete()` — don't auto-advance
- Button styling: accent color, large, weighty feel (not a small text link)

### Files
- `src/renderer/views/GoingLiveTransition.tsx`
- `e2e/writers-room.test.ts` (update to click the button)

## Bug 2: Google Calendar connection flickers (#49)

Writer's Room briefly shows "Connect your Google Calendar" for ~1 second even when the user already has a connection. The async check returns after the initial render.

### Fix

Cache the Google Calendar connection status in localStorage:
- When connection succeeds, write `showtime-gcal-connected=true` to localStorage
- On Writer's Room mount, read localStorage first for instant UI state
- Still run the async check in the background to verify — update if status changed
- If localStorage says connected, skip the "Connect" prompt on first render

### Files
- `src/renderer/views/WritersRoomView.tsx` (or the calendar panel component)
- Wherever the Google Calendar connection check lives

## Bug 3: Visual regression DPI mismatch (#46)

All 12 visual regression tests fail because baselines were captured at 2x retina but tests run at 1x.

### Fix

Set `deviceScaleFactor: 1` in the Playwright visual regression project config so screenshots are always 1x regardless of display. Then regenerate baselines:

```typescript
// playwright.config.ts — visual project
{
  name: 'visual',
  use: { deviceScaleFactor: 1 },
  // ...
}
```

Then run `npx playwright test --update-snapshots --project=visual` to regenerate baselines at 1x.

### Files
- `playwright.config.ts`
- `e2e/visual-regression.test.ts-snapshots/` (regenerated baselines)

## Bug 4: Help '?' button doesn't navigate (#44)

The `?` button re-triggers onboarding instead of showing help content.

### Fix

Change the `?` button behavior:
- Instead of re-triggering onboarding, show a help overlay/tooltip
- Help content: brief explanation of Acts, Beats, show phases, keyboard shortcuts
- Could be a simple modal/dialog using shadcn/ui Dialog component
- Accessible from Dark Studio (current location) — later extend to other views

### Files
- `src/renderer/App.tsx` (change handleHelpClick)
- `src/renderer/components/HelpDialog.tsx` (new — shadcn Dialog with help content)
- `e2e/onboarding.test.ts` (update help button test)

## Testing Strategy

Each bug fix needs:
1. Unit test (if applicable)
2. E2E test verifying the fix
3. All 235 existing unit tests must still pass
4. TypeScript must compile clean

## IMPORTANT RULES (from CLAUDE.md)
- No inline styles — Tailwind only
- Spring physics for all animations
- shadcn/ui for interactive components (Dialog for help)
- E2E coverage required for every change
- All changes go on a feature branch, not main
- Create a PR when done — do NOT push to main directly
