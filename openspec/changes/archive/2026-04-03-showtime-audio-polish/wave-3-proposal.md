# Bug Fix Wave 3: Border Verify + Onboarding E2E + Live From Your Desk

## Issues
- #22: Verify border fix — ensure `rounded-xl` is NOT on view root elements, content fills window edge-to-edge
- #25: Onboarding E2E tests failing — skip/navigation broken after audio-polish changes
- #23: "Live from your desk" momentum pause before Writer's Room

## #22 Verification

Check ALL view root elements. The root `<div>` or `<motion.div>` of each view must NOT have `rounded-xl`. Content must fill the BrowserWindow edge-to-edge. The native `roundedCorners: true` on the BrowserWindow handles corner rounding.

Views to check: ExpandedView, StrikeView, WritersRoomView, OnboardingView, DarkStudioView, PillView, GoingLiveTransition.

Also check App.tsx root container — no padding, margin, or `items-center` that would create gaps between window edge and content.

## #25 Onboarding E2E Fix

3 Playwright tests failing:
- `shows onboarding on first launch`
- `can navigate through all 5 steps`
- `can skip onboarding` — Skip button click fails

Debug: Run `npm run test:e2e` and read the error output. Likely a DOM structure change from the audio-polish run (views were modified). Fix the OnboardingView or update the E2E test selectors.

## #23 "Live from Your Desk" Momentum Pause

Add a brief motivational splash when user clicks "Enter the Writer's Room":

1. User clicks button in DarkStudioView
2. Brief 1.5s splash: "Live from your desk... it's [Day]!" in large JetBrains Mono
3. Then transition to WritersRoom

Implementation:
- Reuse GoingLiveTransition pattern (auto-dismissing, spring animation)
- City = "your desk" (simple, no geolocation)
- Day from `new Date().toLocaleDateString('en-US', { weekday: 'long' })`
- Play the `going-live` audio cue during this splash
- Add to showStore: a `coldOpenActive` boolean (like `goingLiveActive`)

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
