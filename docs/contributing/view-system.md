# View System

Showtime uses a combination of **show phases** and **view tiers** to determine which view component renders and how the window is sized.

## View Routing

The `App.tsx` component routes to the correct view. Some phases are full-screen regardless of tier; others respect the user's chosen tier.

### Full-Screen Phases

These phases always render at full window size:

| Phase | View Component | When |
|-------|----------------|------|
| `no_show` | `DarkStudioView` | App opens, no show planned |
| `writers_room` | `WritersRoomView` | Planning the day via chat |
| `strike` | `StrikeView` | Show is over, stats displayed |

### Tier-Based Phases (Live / Intermission)

During `live` and `intermission`, the view depends on the `viewTier`:

| Tier | View Component | IPC View Mode | Description |
|------|----------------|---------------|-------------|
| `micro` | `PillView` | `pill` | Floating 320px capsule |
| `compact` | `CompactView` | `compact` | One step up from pill |
| `dashboard` | `DashboardView` | `dashboard` | Control room overview |
| `expanded` | `ExpandedView` | `expanded` | Full stage with hero timer |

### Overlay Views

These render on top of any phase:

| View | Trigger |
|------|---------|
| `SettingsView` | Cmd+, or tray menu |
| `HistoryView` | "Show History" from Dark Studio or Strike |
| `OnboardingView` | First launch (before onboarding completes) |

### Transition Views

Transitions are full-screen animated sequences between phases:

| Transition | From → To | Description |
|------------|-----------|-------------|
| `ColdOpenTransition` | Dark Studio → Writer's Room | Stage lights warming up |
| `GoingLiveTransition` | Writer's Room → ON AIR | "Live from your desk!" countdown |

Transitions take priority in the render order. While active, `coldOpenActive` or `goingLiveActive` is true in `showStore`.

## View Tier State Machine

```
expandViewTier()     collapseViewTier()
     ──►                  ◄──
micro ↔ compact ↔ dashboard ↔ expanded
```

Users switch tiers by:
- **Clicking the Pill** → `expandViewTier()` (moves up one tier)
- **Pressing Escape** → `collapseViewTier()` (moves down one tier)
- **Beat Check appearing** → Forces expansion to `dashboard` if currently `micro` or `compact`

## Window Sizing

The main process resizes the `BrowserWindow` to match the active view. `App.tsx` calls `window.clui.setViewMode(mode)` whenever phase, tier, or overlay state changes.

```ts
function tierToViewMode(tier: ViewTier, phase: ShowPhase): ViewMode {
  if (phase === 'no_show' || phase === 'writers_room' || phase === 'strike') {
    return 'full'
  }
  const map: Record<ViewTier, ViewMode> = {
    micro: 'pill',
    compact: 'compact',
    dashboard: 'dashboard',
    expanded: 'expanded',
  }
  return map[tier]
}
```

## View Component List

All view files live in `src/renderer/views/`:

| File | Purpose |
|------|---------|
| `DarkStudioView.tsx` | Empty stage with spotlight — starting screen |
| `WritersRoomView.tsx` | Chat-first day planning with Claude |
| `ColdOpenTransition.tsx` | Animated transition into Writer's Room |
| `GoingLiveTransition.tsx` | "Live from your desk!" animated countdown |
| `PillView.tsx` | Floating capsule with timer + tally light + mini rundown |
| `CompactView.tsx` | Compact view — timer + progress + beat count |
| `DashboardView.tsx` | Full control room — lineup sidebar + current act |
| `ExpandedView.tsx` | Hero timer + full lineup + ON AIR bar |
| `StrikeView.tsx` | End-of-show stats and verdict |
| `HistoryView.tsx` | Past show history |
| `SettingsView.tsx` | App settings |
| `OnboardingView.tsx` | First-launch walkthrough |
