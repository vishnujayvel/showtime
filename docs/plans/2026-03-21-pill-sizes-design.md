# Multi-Size Pill / Widget System

**Date:** 2026-03-21
**Status:** Design — ready for implementation
**Author:** Research agent

---

## Problem

Showtime has exactly one collapsed state: the 320x48 Micro Pill. It shows the act
name, timer, beat stars, and a thin rundown strip — enough to know *what* is
happening but not enough to know *where you are in the day*. To see that, you must
click into the full 560x620 ExpandedView, which takes you out of flow.

People with ADHD lose context fast. A single glance at a slightly larger widget
should answer three questions without a click:

1. **What am I doing right now?** (act name + timer)
2. **Where am I in the day?** (rundown progress + drift)
3. **What's coming next?** (upcoming acts)

The ExpandedView answers all three but is too large to float while working. The
Micro Pill answers only #1. We need two intermediate sizes.

---

## macOS Widget Size Precedents

### Apple WidgetKit (Notification Center)

macOS WidgetKit defines four families relevant to desktop:

| Family          | Approx. Points | Role                        |
|-----------------|-----------------|-----------------------------|
| `systemSmall`   | 170 x 170       | Single metric / glance      |
| `systemMedium`  | 338 x 170       | Two-column or list summary  |
| `systemLarge`   | 338 x 376       | Full detail, scrollable     |
| `systemExtraLarge` | 692 x 376    | Dashboard (iPad / large screens) |

Key insight: **the medium widget is exactly 2x the width of a small widget at the
same height.** Width scaling is the primary axis; height stays constant until the
large size, which doubles height instead.

### Fantastical Mini Window

Fantastical's menu-bar popover is roughly 350px wide, showing a mini-calendar +
scrollable event list. It can be detached and floated. It collapses to a menu-bar
icon (the "micro" state) and expands to the popover (the "compact" state). The full
app window is the "dashboard" state.

### Dato / Timery / Toggl Track

These apps use a ~320-360px wide menu-bar popover for compact state, with the
running timer visible in the menu bar itself as the micro state.

### Key Takeaway

The industry standard for a floating utility widget on macOS is **320-400px wide**.
Beyond 400px, you start competing with the user's primary window for horizontal
space — especially on a 1440px MacBook Air screen where effective working width is
~1200px after the Dock.

---

## Screen Budget Analysis

| Display          | Work Area Width | 400px Widget | % Consumed |
|------------------|-----------------|--------------|------------|
| MacBook Air 13"  | ~1440px         | 400px        | 28%        |
| MacBook Pro 14"  | ~1512px         | 400px        | 26%        |
| MacBook Pro 16"  | ~1728px         | 400px        | 23%        |
| External 1080p   | ~1920px         | 400px        | 21%        |
| Ultrawide 1440p  | ~2560px         | 400px        | 16%        |

**Conclusion:** 400px is the absolute maximum width for a floating widget that
doesn't feel invasive. The Micro Pill at 320px is excellent. The intermediate
sizes should stay at 320-360px wide and grow vertically.

---

## The Three Sizes

### Size 1: Micro Pill (existing)

**Dimensions:** 320 x 48 (grows to ~56 when MiniRundownStrip is visible)
**VIEW_DIMENSIONS key:** `pill`

```
┌──────────────────────────────────────────────┐
│  ●  │  Morning Deep Work      18:42   ★★☆   │  48px
│     ├────────────────────────────────────────│
│     │ ▓▓▓▓▓▓▓▓▓█▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░│   4px strip
└──────────────────────────────────────────────┘
                     320px
```

**Content:**
- Tally light (live indicator)
- Current act name (truncated)
- Countdown timer (MM:SS)
- Beat counter (stars)
- MiniRundownStrip (thin 4px progress bar, live/intermission only)

**Interaction:**
- Click anywhere (except drag handle) → expand to Compact
- Drag handle on the left → reposition
- Alt+Space global shortcut → cycle to next size

**No changes needed.** This is working well.

---

### Size 2: Compact Widget

**Dimensions:** 340 x 140
**VIEW_DIMENSIONS key:** `compact`

This is the "glanceable day-at-a-glance" size. It answers questions #1 and #2
(what am I doing + where am I in the day) without any clicking. Think of it as
the macOS `systemMedium` widget equivalent.

```
┌──────────────────────────────────────────────────┐
│ ● TALLY   Morning Deep Work          22:14  ▼   │  32px — header row
├──────────────────────────────────────────────────┤
│                                                  │
│  ▓▓▓▓▓▓▓▓▓▓▓▓█▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░░  │  28px — RundownBar
│                ▲ NOW                             │
│  Act 3 of 7 — 4m behind                         │  16px — drift badge
│                                                  │
├──────────────────────────────────────────────────┤
│  ★★☆  2/3 Beats     ON AIR ●   Started 9:15a   │  28px — status bar
└──────────────────────────────────────────────────┘
                      340px                    140px total
```

**Layout (top to bottom):**

1. **Header Row (32px)** — drag region
   - Tally light (8px dot, pulsing when live)
   - `TALLY` label in mono 9px (only when live)
   - Current act name (Inter 13px semibold, truncated)
   - Countdown timer (JetBrains Mono 14px, amber when < 5min)
   - Collapse chevron `▼` (no-drag, click to go back to Micro)

2. **RundownBar section (52px)** — reuse `<RundownBar variant="compact" />`
   - The existing RundownBar component at 28px height (already supports `compact` variant)
   - NOW marker with red pulsing line
   - Drift badge below: `Act 3 of 7 — 4m behind` (mono 10px)
   - 8px vertical padding

3. **Status Bar (28px)** — bottom info strip
   - Beat counter (stars, `sm` size)
   - Beat label: `2/3 Beats`
   - ON AIR indicator (reuse `<OnAirIndicator />`)
   - Show start time
   - 8px vertical padding

**Intermission variant:**
```
┌──────────────────────────────────────────────────┐
│ ●     Intermission               no rush     ▼   │
├──────────────────────────────────────────────────┤
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░  │
│  Act 4 of 7 — on schedule                       │
├──────────────────────────────────────────────────┤
│  ★★☆  2/3 Beats                   Started 9:15a │
└──────────────────────────────────────────────────┘
```

**Strike variant:**
```
┌──────────────────────────────────────────────────┐
│       Show complete!                  ★★★    ▼   │
├──────────────────────────────────────────────────┤
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  │
│  7 of 7 acts — finished                         │
├──────────────────────────────────────────────────┤
│  ★★★  3/3 Beats      DAY WON                    │
└──────────────────────────────────────────────────┘
```

**Why 340x140?**
- 340px: 20px wider than the Micro Pill, enough room for the RundownBar labels
  and drift badge without cramping, but still under the 400px threshold.
- 140px: Three distinct visual rows. Compact enough that it doesn't feel like a
  "window" — it still feels like a widget. Matches Apple's `systemMedium` height
  of ~170pt scaled down to account for higher information density.

---

### Size 3: Dashboard Widget

**Dimensions:** 400 x 320
**VIEW_DIMENSIONS key:** `dashboard`

This is the "mini control room." It answers all three questions (what + where +
what's next) and provides enough context that most users will never need the full
ExpandedView during a normal show. Think of it as the macOS `systemLarge` widget.

```
┌──────────────────────────────────────────────────────────┐
│ ● SHOWTIME   Mon Mar 21                Director   ▼  ✕  │  36px — title bar
├──────────────────────────────────────────────────────────┤
│  ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓█▒▒▒▒▒▒▒▒░░░░░░░░░░░░░░░░░░░░░░░░░░  │  32px — RundownBar
│  Act 3 of 7 — 4m behind schedule                        │  16px — drift badge
├──────────────────────────────────────────────────────────┤
│                                                          │
│            DEEP WORK | ACT 3                             │  clap badge
│         Morning Deep Work                                │  act name
│                                                          │
│              22 : 14                                     │  timer (36px mono)
│         ━━━━━━━━━━━━━━━━━━━━━━━━━░░░░░░░░░░░            │  progress bar
│                                                          │
├──────────────────────────────────────────────────────────┤
│  COMING UP                                               │  section label
│  ┌─ ● Afternoon Run         30m   Exercise    ─┐        │  next act 1
│  └─ ● Email triage          15m   Admin       ─┘        │  next act 2
├──────────────────────────────────────────────────────────┤
│  ON AIR ●          ★★☆  2/3 Beats    Started 9:15a     │  36px — status bar
└──────────────────────────────────────────────────────────┘
                         400px                        320px total
```

**Layout (top to bottom):**

1. **Title Bar (36px)** — drag region
   - Tally light
   - `SHOWTIME` mono label
   - Date label (e.g., `Mon Mar 21`)
   - Director button (no-drag)
   - Collapse chevron `▼` (no-drag, goes back to Compact)
   - Close button `✕` (no-drag)

2. **RundownBar section (52px)**
   - Full `<RundownBar variant="full" />` with NOW marker and colored blocks
   - Drift status badge centered below

3. **Timer Section (100px)** — the hero area
   - `<ClapperboardBadge />` (sketch + act number)
   - Act name (Inter 16px bold)
   - Countdown timer (JetBrains Mono 36px — smaller than ExpandedView's 64px)
   - Linear progress bar (slim, showing elapsed %)

4. **Coming Up Section (64px)** — next 2 acts
   - `COMING UP` section label (mono 10px, muted)
   - Two compact act rows, each showing:
     - Category color dot (6px)
     - Act name (Inter 13px, truncated)
     - Duration badge (mono 11px)
     - Sketch label (mono 10px, category-colored)
   - If only 1 act remains, show 1 row. If 0 remain, show "Final act!"

5. **Status Bar (36px)** — bottom info strip
   - ON AIR indicator with pulsing glow
   - Beat counter (stars, `sm` size) + label
   - Show start time

**Intermission variant:**
- Timer section replaced with `WE'LL BE RIGHT BACK` message (reuse logic from
  `IntermissionView`, but condensed to ~80px)
- Coming Up section shows the next act that will resume after intermission

**Director Mode:**
- Director overlay renders inside the timer section (condensed 4-button layout)
- RundownBar and Coming Up remain visible for context

**Why 400x320?**
- 400px: the maximum width that doesn't feel invasive. Wide enough for the
  RundownBar to show act labels on hover and for the timer to be legible.
- 320px: tall enough for the five-section layout without scrolling, but still
  significantly smaller than the 620px ExpandedView. On a 900px-tall MacBook Air
  screen, this consumes 36% of vertical space — acceptable for a floating widget.

---

## Size Comparison Table

| Property          | Micro (pill)   | Compact        | Dashboard       | Expanded (existing) |
|-------------------|----------------|----------------|-----------------|---------------------|
| VIEW_DIMENSIONS   | 320 x 48       | 340 x 140      | 400 x 320       | 560 x 620           |
| Key in main       | `pill`         | `compact`      | `dashboard`     | `expanded`          |
| Current act       | Name + timer   | Name + timer   | Name + timer + badge + progress | Full TimerPanel  |
| Rundown progress  | 4px strip      | 28px bar + drift | 32px bar + drift | 28px bar + drift  |
| Upcoming acts     | None           | None           | Next 2 acts     | Full lineup sidebar |
| Beat counter      | Stars only     | Stars + label  | Stars + label   | Stars + label       |
| ON AIR indicator  | Tally dot      | Tally + badge  | Full ON AIR box | Full ON AIR box     |
| Director access   | None           | None           | Director button | Director button     |
| Drag region       | Left 48px      | Full header    | Title bar       | Title bar           |
| Shape             | rounded-full   | rounded-2xl    | rounded-xl      | squared (window)    |

---

## VIEW_DIMENSIONS Update (main/index.ts)

Current:
```typescript
const VIEW_DIMENSIONS: Record<string, { width: number; height: number }> = {
  pill: { width: 320, height: 48 },
  expanded: { width: 560, height: 620 },
  full: { width: 560, height: 740 },
}
```

Proposed:
```typescript
const VIEW_DIMENSIONS: Record<string, { width: number; height: number }> = {
  pill: { width: 320, height: 56 },   // bumped from 48 to 56 to account for MiniRundownStrip
  compact: { width: 340, height: 140 },
  dashboard: { width: 400, height: 320 },
  expanded: { width: 560, height: 620 },
  full: { width: 560, height: 740 },
}
```

Note: the pill height bump from 48 to 56 accounts for the MiniRundownStrip that
already renders below the main row during live/intermission phases. The current
48px height clips it slightly.

The IPC handler type also needs updating:

```typescript
// Current
ipcMain.on(IPC.SET_VIEW_MODE, (_event, mode: 'pill' | 'expanded' | 'full') => {
  applyViewMode(mode)
})

// Proposed
ipcMain.on(IPC.SET_VIEW_MODE, (_event, mode: 'pill' | 'compact' | 'dashboard' | 'expanded' | 'full') => {
  applyViewMode(mode)
})
```

---

## Navigation Between Sizes

### Interaction Model: Click Cycle + Shortcut

The sizes form a linear progression:

```
Micro Pill  ←→  Compact  ←→  Dashboard  ←→  ExpandedView
   (320x56)     (340x140)     (400x320)      (560x620)
```

**Click interactions:**

| From        | Action                | Result          |
|-------------|-----------------------|-----------------|
| Micro       | Click content area    | → Compact       |
| Compact     | Click timer/act area  | → Dashboard     |
| Compact     | Click `▼` chevron     | → Micro         |
| Dashboard   | Click timer area      | → ExpandedView  |
| Dashboard   | Click `▼` chevron     | → Compact       |
| Expanded    | Click `▼` chevron     | → Dashboard     |

**Keyboard shortcut (Alt+Space):**
- When visible: cycles through the sizes in order:
  `Micro → Compact → Dashboard → Expanded → Micro → ...`
- When hidden: shows the window at whatever size it was last at.

**Scroll wheel (future enhancement):**
- Scroll up on any pill-family view = expand one size.
- Scroll down = collapse one size.
- Not for v1 — adds complexity to hit-testing on the transparent window.

### Why Not Double-Click?

Double-click has ambiguity (did the user mean to click twice?) and conflicts with
macOS conventions where double-click typically means "open." Single click to
expand matches Fantastical's menu-bar popover behavior and iOS widget tap-to-open.

---

## State Management Changes

### showStore.ts

The existing `isExpanded: boolean` flag is insufficient for 4 view tiers. Replace
with an enum:

```typescript
// New type
export type ViewTier = 'micro' | 'compact' | 'dashboard' | 'expanded'

// In ShowState interface
// REMOVE: isExpanded: boolean
// ADD:
viewTier: ViewTier

// New actions (replace toggleExpanded / setExpanded)
cycleViewTier: () => void        // Alt+Space: micro → compact → dashboard → expanded → micro
expandViewTier: () => void       // Click to expand: go up one tier
collapseViewTier: () => void     // Click chevron: go down one tier
setViewTier: (tier: ViewTier) => void  // Direct set (e.g., beat check forces dashboard+)
```

**Backward compatibility:** The `isExpanded` getter can be derived:
```typescript
// Selector for components that just need expanded vs collapsed
export const selectIsExpanded = (s: ShowState) => s.viewTier !== 'micro'
```

### View-tier-to-VIEW_DIMENSIONS mapping

In `App.tsx`, the `useEffect` that calls `window.clui.setViewMode()` maps:

```typescript
const TIER_TO_VIEW_MODE: Record<ViewTier, string> = {
  micro: 'pill',
  compact: 'compact',
  dashboard: 'dashboard',
  expanded: 'expanded',   // or 'full' for writers_room / strike / no_show
}
```

Full-screen views (DarkStudio, WritersRoom, GoingLive, ColdOpen, Strike) always
use `full` regardless of viewTier.

---

## Renderer Component Plan

### New Files

| File                                   | Purpose                                          |
|----------------------------------------|--------------------------------------------------|
| `src/renderer/views/CompactView.tsx`   | Size 2 — Compact Widget                          |
| `src/renderer/views/DashboardView.tsx` | Size 3 — Dashboard Widget                        |
| `src/renderer/components/UpcomingActs.tsx` | "Coming Up" section for Dashboard             |
| `src/renderer/components/CompactTimer.tsx` | Condensed timer (36px font) for Dashboard      |

### Modified Files

| File                              | Changes                                           |
|-----------------------------------|---------------------------------------------------|
| `src/renderer/App.tsx`            | Route to CompactView/DashboardView based on viewTier |
| `src/renderer/stores/showStore.ts`| Replace `isExpanded` with `viewTier` enum          |
| `src/renderer/views/PillView.tsx` | Update click handler to `expandViewTier()`         |
| `src/main/index.ts`              | Add `compact` and `dashboard` to VIEW_DIMENSIONS   |
| `src/shared/types.ts`            | Export `ViewTier` type                              |

### Reusable Components

Both new views heavily reuse existing components:

- `<TallyLight />` — all three pill sizes
- `<BeatCounter />` — all three pill sizes (with `showLabel` on Compact/Dashboard)
- `<RundownBar variant="compact" />` — Compact and Dashboard
- `<OnAirIndicator />` — Compact and Dashboard status bars
- `<ClapperboardBadge />` — Dashboard timer section
- `<MiniRundownStrip />` — Micro Pill only (replaced by RundownBar in larger sizes)

---

## Animation Between Sizes

Per CLAUDE.md rule #5: all animations use spring physics.

### Window Resize

The main process `applyViewMode()` already uses `setBounds()` which is instant at
the OS level. The *content* transition is what needs animation.

**Strategy:** Framer Motion `AnimatePresence` with `mode="wait"` (already used in
App.tsx). Each view size is a keyed motion component. The exit/enter animations:

```typescript
// Expanding (micro → compact → dashboard → expanded)
initial={{ scale: 0.9, opacity: 0, y: 10 }}
animate={{ scale: 1, opacity: 1, y: 0 }}
exit={{ scale: 0.95, opacity: 0, y: -5 }}
transition={{ type: 'spring', stiffness: 400, damping: 30 }}

// Collapsing (expanded → dashboard → compact → micro)
initial={{ scale: 1.05, opacity: 0, y: -10 }}
animate={{ scale: 1, opacity: 1, y: 0 }}
exit={{ scale: 1.1, opacity: 0, y: 5 }}
transition={{ type: 'spring', stiffness: 400, damping: 30 }}
```

The window bounds change is intentionally *not* animated (Electron `setBounds` is
a snap). This matches macOS widget behavior — widgets don't animate their frame,
but their content fades/scales in.

### RundownBar Continuity

The RundownBar appears in Compact, Dashboard, and Expanded views. To avoid a
jarring re-render when switching between these, the RundownBar's NOW marker
position and act block widths use `layout` animations from Framer Motion (already
implemented). The bar will smoothly rescale when the container width changes.

---

## Window Shape Per Size

| Size      | Border Radius | Background                                | Notes                           |
|-----------|---------------|-------------------------------------------|---------------------------------|
| Micro     | `rounded-full` (9999px) | `bg-surface/85 backdrop-blur-[20px]` | Capsule shape, vibrancy     |
| Compact   | `rounded-2xl` (16px) | `bg-surface/90 backdrop-blur-[20px]`   | Rounded rectangle, vibrancy    |
| Dashboard | `rounded-xl` (12px)  | `bg-surface/95 backdrop-blur-[16px]`   | Subtle rounding, less blur     |
| Expanded  | `rounded-none` (0px) | `bg-surface`                            | Full window, no vibrancy       |

The progression from pill-shaped → rounded-rect → squared mirrors the transition
from "widget floating over your work" to "app window with full attention."

---

## Anchor Point Behavior

The existing `anchorPoint` system in `main/index.ts` preserves the center-bottom
point across view transitions. This means:

- Expanding from Micro to Compact: the pill grows *upward and outward* from its
  bottom-center position. The user's eyes stay on the same screen region.
- Expanding from Compact to Dashboard: same behavior, grows up and slightly wider.
- The pill always stays anchored to where the user dragged it.

This already works correctly with the existing `computeAnchorFromBounds` /
`computeBoundsFromAnchor` / `clampToDisplay` pipeline. No changes needed to the
anchor system — just adding new entries to VIEW_DIMENSIONS is sufficient.

---

## Edge Cases

### Beat Check Modal

Currently, `beatCheckPending` forces `setExpanded(true)`. With the new system, it
should force at least `dashboard` tier so the modal has room to render:

```typescript
if (beatCheckPending && viewTier === 'micro') {
  setViewTier('dashboard')
}
if (beatCheckPending && viewTier === 'compact') {
  setViewTier('dashboard')
}
```

### Intermission on Compact

The Compact view during intermission shows `Intermission` in the header instead of
the act name/timer. The RundownBar still renders. The status bar shows beats but
no ON AIR indicator.

### Strike on Compact / Dashboard

Both views work in Strike phase. The RundownBar shows all acts completed (full
color). The timer area shows the verdict message. The Coming Up section (Dashboard
only) shows "That's a wrap!" instead of upcoming acts.

### Writer's Room / Dark Studio / Transitions

These full-screen phases always render at `full` size regardless of viewTier.
When the show starts (Going Live transition completes), the viewTier resets to
`micro` so the user starts in the least-distracting state.

### Window Dragging During Resize

The existing `isDragging` / `deferredViewMode` system handles this. If the user is
dragging when a tier change fires, the resize is deferred until drag ends.

---

## Test Plan

### E2E Tests (Playwright)

1. **Size cycling via click:**
   - Start show → verify pill view → click → verify compact → click → verify dashboard → click → verify expanded
   - Verify chevron collapse at each level

2. **Size cycling via Alt+Space:**
   - Verify full cycle: micro → compact → dashboard → expanded → micro

3. **Window dimensions:**
   - At each tier, verify `mainWindow.getBounds()` matches VIEW_DIMENSIONS

4. **Content rendering per tier:**
   - Compact: verify RundownBar, drift badge, beat counter visible
   - Dashboard: verify timer, RundownBar, upcoming acts, ON AIR indicator visible

5. **Beat Check forces dashboard:**
   - Trigger beat check while in micro → verify auto-expansion to dashboard

6. **Anchor preservation:**
   - Drag pill to corner → expand through sizes → verify window stays anchored

### Unit Tests (Vitest)

1. `cycleViewTier()` cycles correctly through all 4 tiers
2. `expandViewTier()` / `collapseViewTier()` clamp at boundaries
3. `selectIsExpanded` backward-compat selector works
4. Tier-to-view-mode mapping is correct for each phase

---

## Implementation Order

1. **Phase 1: State + Main Process** (~1 hour)
   - Add `ViewTier` type to `shared/types.ts`
   - Replace `isExpanded` with `viewTier` in `showStore.ts`
   - Add `compact` and `dashboard` to VIEW_DIMENSIONS in `main/index.ts`
   - Update IPC handler type

2. **Phase 2: CompactView** (~2 hours)
   - Create `CompactView.tsx`
   - Wire into `App.tsx` routing
   - Update PillView click handler

3. **Phase 3: DashboardView** (~2 hours)
   - Create `DashboardView.tsx`
   - Create `UpcomingActs.tsx` and `CompactTimer.tsx`
   - Wire into `App.tsx` routing

4. **Phase 4: Navigation + Shortcuts** (~1 hour)
   - Implement click-to-expand / chevron-to-collapse
   - Update Alt+Space handler to cycle through 4 tiers

5. **Phase 5: Polish + Tests** (~2 hours)
   - Spring animations between sizes
   - Beat Check auto-expansion
   - E2E tests for all size transitions
   - Screenshot verification at each size

---

## Open Questions

1. **Should Compact auto-collapse to Micro after N seconds of inactivity?**
   Fantastical does this with its menu-bar popover. Could reduce screen clutter
   for users who expand to check progress then forget to collapse. Suggest: not
   for v1, add as a preference later.

2. **Should the user's preferred "resting size" be remembered?**
   Some users may always want Compact instead of Micro as their default collapsed
   state. Suggest: persist `viewTier` in showStore (already has Zustand persist
   middleware). The tier resets to `micro` only on show start (Going Live).

3. **Should Dashboard show a condensed lineup editor?**
   The Coming Up section could allow drag-to-reorder. Suggest: not for v1 — the
   Dashboard is read-only. Editing requires the full ExpandedView.
