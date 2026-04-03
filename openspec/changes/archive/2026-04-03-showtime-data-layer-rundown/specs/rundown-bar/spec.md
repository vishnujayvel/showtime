# Capability: rundown-bar

Provides a live horizontal timeline visualization ("the rundown bar") that shows
planned vs actual timing for the day's show. Acts appear as proportional colored
blocks; a NOW marker tracks real-time progress; drift and overruns are visualized
inline. A compact 4px strip variant embeds in the pill view.

**Source proposal:** `openspec/changes/showtime-data-layer-rundown/proposal.md`

---

## ADDED Requirements

### Requirement: RundownBar component

A new `RundownBar` component SHALL be created at
`src/renderer/components/RundownBar.tsx`. It renders a horizontal timeline bar
where each act is a proportional block sized by duration relative to total show
duration.

- The component SHALL accept a `variant` prop: `'full'` (default, ~520px wide
  inside ExpandedView) or `'compact'` (used inside LineupPanel sidebar).
- Block widths SHALL be computed as `(act.plannedDurationMs / totalShowDurationMs) * 100%`.
- Each block SHALL be colored by act category using the design system tokens:
  `cat-deep` (purple), `cat-exercise` (green), `cat-admin` (blue),
  `cat-creative` (amber), `cat-social` (pink). Acts without a category SHALL use
  `surface-hover`.
- Completed acts SHALL show their actual duration overlay: if actual > planned,
  the overrun portion SHALL extend beyond the planned boundary with diagonal
  hatching (45-degree repeating-linear-gradient).
- The active act SHALL have an ON AIR glow (matching `onairGlow` animation from
  the design system) and a progress fill from left to right based on elapsed
  time.
- Future (upcoming) acts SHALL render at 40% opacity.
- Intermission gaps SHALL render as 8px-wide blocks with a dotted border pattern
  (`border-dashed border-txt-muted`).
- The bar SHALL have rounded corners (`rounded-lg`) and a 1px border
  (`border border-surface-hover`).
- All styling SHALL use Tailwind utility classes. No inline `style={{}}` objects.
- All animations SHALL use Framer Motion with spring physics.

#### Scenario: Render full rundown bar during live show

- **WHEN** the show is in `live` phase with 5 acts (2 completed, 1 active, 2 upcoming)
- **THEN** the RundownBar SHALL render 5 blocks sized proportionally to their planned durations
- **THEN** the 2 completed blocks SHALL be at full opacity with category colors
- **THEN** the active block SHALL pulse with the ON AIR glow
- **THEN** the 2 upcoming blocks SHALL be at 40% opacity

#### Scenario: Empty state

- **WHEN** the show has no acts (phase is `no_show` or `writers_room`)
- **THEN** the RundownBar SHALL render nothing (return null)

#### Scenario: All acts completed

- **WHEN** all acts are completed (phase is `strike`)
- **THEN** all blocks SHALL be at full opacity
- **THEN** no ON AIR glow SHALL be active
- **THEN** overrun hatching SHALL be visible on any acts that exceeded planned duration

---

### Requirement: MiniRundownStrip component

A new `MiniRundownStrip` component SHALL be created at
`src/renderer/components/MiniRundownStrip.tsx`. It renders a minimal 4px-tall
version of the rundown bar for the pill view.

- The strip SHALL be 4px in height and stretch to the full width of the pill
  (minus horizontal padding).
- Acts SHALL render as colored segments (same category colors as RundownBar).
- The active act segment SHALL have a subtle glow (1px box-shadow in the
  category color).
- No text, labels, or interactive elements.
- The NOW marker SHALL be a 1px-wide vertical line in `onair` red, 6px tall
  (extending 1px above and below the strip).

#### Scenario: Render mini strip in pill view

- **WHEN** the pill view renders during a live show
- **THEN** a 4px-tall colored strip SHALL appear below the content row
- **THEN** segment widths SHALL match the proportional durations from the full RundownBar

#### Scenario: Pill view during intermission

- **WHEN** the pill view renders during intermission
- **THEN** the mini strip SHALL still be visible
- **THEN** no segment SHALL have the active glow

---

### Requirement: Drift computation

The RundownBar SHALL compute and display schedule drift by comparing planned
timing against actual timing using data from the `timeline_events` table (via
IPC).

- Drift SHALL be defined as `actual_duration - planned_duration` per act, in
  seconds. Positive = overrun, negative = underrun.
- Cumulative drift SHALL be computed by the `TimelineRepository.computeDrift()`
  method (defined in the `data-persistence` capability) and fetched via
  `window.clui.getTimelineDrift(showId)`.
- Per-act drift SHALL be fetched via
  `window.clui.getTimelineDriftPerAct(showId)`.
- Drift data SHALL be fetched on act lifecycle events (start, complete, cut,
  reorder) -- NOT on every timer tick.
- A status badge SHALL render below the bar with the format:
  `"Act {n} of {total} -- {drift}m {behind|ahead} schedule"`.
  - If drift is zero: `"Act {n} of {total} -- on schedule"`.
  - If drift is negative (ahead): `"Act {n} of {total} -- {abs(drift)}m ahead of schedule"`.
- The badge SHALL use `font-mono text-xs text-txt-secondary`.

#### Scenario: Show running behind schedule

- **WHEN** cumulative drift is +720 seconds (12 minutes behind)
- **THEN** the status badge SHALL display `"Act 3 of 5 -- 12m behind schedule"`

#### Scenario: Show running ahead of schedule

- **WHEN** cumulative drift is -180 seconds (3 minutes ahead)
- **THEN** the status badge SHALL display `"Act 4 of 5 -- 3m ahead of schedule"`

#### Scenario: Show on schedule

- **WHEN** cumulative drift is 0 seconds
- **THEN** the status badge SHALL display `"Act 2 of 5 -- on schedule"`

#### Scenario: Drift data refresh cadence

- **WHEN** the timer ticks every second during a live act
- **THEN** the RundownBar SHALL NOT refetch drift data from SQLite
- **WHEN** an act completes or a new act starts
- **THEN** the RundownBar SHALL refetch drift data via IPC

---

### Requirement: NOW marker

A vertical marker SHALL indicate the current point in time on the RundownBar.

- The marker SHALL be a 2px-wide vertical line spanning the full height of the
  bar, colored `onair` red (`#ef4444`).
- The marker position SHALL be computed as:
  `(elapsed show time / total planned show duration) * 100%`,
  where elapsed show time = `Date.now() - show.started_at`.
- The marker position SHALL update on a 1-second interval using
  `requestAnimationFrame` or `setInterval(1000)`.
- If the show has overrun its total planned duration, the marker SHALL be clamped
  to the right edge of the bar (100%).
- The marker SHALL have a subtle drop shadow (`shadow-sm`) for visibility
  against colored blocks.
- The marker SHALL animate position changes with Framer Motion
  `layout` transition (spring physics, `stiffness: 400, damping: 40`).

#### Scenario: NOW marker positioned mid-show

- **WHEN** the show started 45 minutes ago and total planned duration is 120 minutes
- **THEN** the NOW marker SHALL be positioned at 37.5% from the left edge

#### Scenario: NOW marker at show start

- **WHEN** the show just started (elapsed = 0)
- **THEN** the NOW marker SHALL be at the left edge (0%)

#### Scenario: NOW marker clamped on overrun

- **WHEN** total elapsed time exceeds total planned duration
- **THEN** the NOW marker SHALL be clamped at the right edge (100%)
- **THEN** the status badge SHALL reflect the total overrun

---

### Requirement: Overrun visualization

Acts that run longer than their planned duration SHALL display a visual overrun
indicator on their RundownBar block.

- The overrun portion SHALL be rendered as a secondary overlay within the act
  block, extending rightward from the planned boundary.
- The overlay SHALL use a diagonal hatching pattern: 45-degree
  repeating-linear-gradient using the act's category color at 30% opacity
  alternating with transparent.
- The hatching pattern SHALL be implemented via a Tailwind arbitrary value class
  or a CSS custom class defined in the app's global stylesheet -- NOT an inline
  `style={{}}` object.
- The overrun overlay SHALL only appear on completed acts (not the active act,
  since its final duration is not yet known).
- Overrun blocks MAY visually compress subsequent future blocks to maintain the
  bar's total width at 100%. Alternatively, the bar MAY grow beyond 100% and
  scroll -- the implementation SHALL choose whichever approach avoids layout
  jank. The chosen approach MUST be documented in a code comment.

#### Scenario: Act overruns by 5 minutes

- **WHEN** an act with planned duration 15 minutes completes with actual duration 20 minutes
- **THEN** the act block SHALL show a hatched extension covering the rightmost 25% of the block (5/20)

#### Scenario: Act finishes early

- **WHEN** an act with planned duration 30 minutes completes in 22 minutes
- **THEN** the act block SHALL shrink to reflect actual duration (no overrun hatching)
- **THEN** the freed space SHALL be redistributed to subsequent blocks

#### Scenario: No overrun on active act

- **WHEN** an act is currently active and has been running past its planned duration
- **THEN** the progress fill SHALL extend to 100% of the block
- **THEN** no hatching SHALL appear (overrun hatching only renders on completed acts)

---

### Requirement: Plan modification with time projections

The `LineupPanel` component (`src/renderer/panels/LineupPanel.tsx`) SHALL be
enhanced to show projected start/end times per act and support mid-show plan
modifications.

**Time projections:**
- Each act card in the sidebar variant SHALL display projected start and end
  times in `HH:MM` format (e.g., `"9:30 -- 10:15"`).
- Projected times SHALL be computed by stacking act durations from the show's
  `started_at` timestamp, accounting for actual durations of completed acts and
  planned durations of upcoming acts.
- If an act has been pushed back due to drift, the projected time SHALL be shown
  with a strike-through on the original planned time and the new projected time
  beside it (e.g., `"~~9:50~~ 10:15"`), styled with `line-through text-txt-muted`
  for the original and `text-txt-secondary` for the projected.

**Reorder acts:**
- Upcoming acts SHALL be reorderable via up/down buttons (already implemented in
  `ActCard` via `onReorder` prop) or via drag-and-drop.
- Reordering SHALL only be allowed for acts with status `upcoming`. Active and
  completed acts SHALL NOT be reorderable.
- Each reorder SHALL trigger a `window.clui.dataSync()` call and record an
  `act_reordered` timeline event via IPC.

**Add acts mid-show:**
- An "Encore" button SHALL appear at the bottom of the lineup sidebar during
  `live` and `intermission` phases.
- Clicking "Encore" SHALL open a minimal form (act name, sketch, duration) to
  add a new act at the end of the lineup.
- Adding an act SHALL trigger an `act_planned` timeline event.

**Cut acts mid-show:**
- The existing `removeAct` action SHALL be extended to record an `act_cut`
  timeline event when an act is removed during a live show.
- Cut acts SHALL remain in the timeline_events log for drift analysis but SHALL
  be removed from the active lineup.

#### Scenario: Display projected times in sidebar

- **WHEN** the sidebar lineup renders during a live show that started at 9:00 with 4 acts of 30 min each
- **THEN** the first completed act SHALL show `"9:00 -- 9:30"`
- **THEN** the active act SHALL show `"9:30 -- 10:00"`
- **THEN** the third act SHALL show projected `"10:00 -- 10:30"`
- **THEN** the fourth act SHALL show projected `"10:30 -- 11:00"`

#### Scenario: Projected times shift after overrun

- **WHEN** Act 1 (planned 30 min) completes at 40 min actual
- **THEN** Act 2 projected start SHALL shift from `"9:30"` to `"9:40"` (or display both with strike-through on the original)
- **THEN** all subsequent projected times SHALL shift by +10 minutes

#### Scenario: Reorder upcoming acts

- **WHEN** the user moves Act 4 (upcoming) above Act 3 (upcoming) via the up button
- **THEN** `sort_order` values SHALL swap
- **THEN** an `act_reordered` timeline event SHALL be recorded with metadata containing the old and new order
- **THEN** projected start/end times SHALL recalculate for all affected acts

#### Scenario: Add encore act during live show

- **WHEN** the user clicks "Encore" during a live show and enters "Email catchup" / "Quick inbox sweep" / 15 min
- **THEN** a new act SHALL be appended to the lineup with status `upcoming`
- **THEN** an `act_planned` timeline event SHALL be recorded
- **THEN** projected times for all subsequent acts SHALL update

#### Scenario: Cut an act during live show

- **WHEN** the user removes an upcoming act during a live show
- **THEN** the act SHALL be removed from the active lineup
- **THEN** an `act_cut` timeline event SHALL be recorded
- **THEN** projected times for remaining acts SHALL recalculate

---

### Requirement: ExpandedView integration

The `RundownBar` component SHALL be integrated into `ExpandedView`
(`src/renderer/views/ExpandedView.tsx`).

- The RundownBar SHALL be placed between the ON AIR indicator bar and the timer
  section, inside the main content area.
- It SHALL span the full width of the expanded view (minus padding), with 16px
  horizontal padding (`px-4`).
- The RundownBar SHALL have 8px vertical margin (`my-2`) to separate it from
  adjacent elements.
- The RundownBar SHALL only render when the phase is `live`, `intermission`, or
  `director` (not in `no_show`, `writers_room`, or `strike`).

#### Scenario: RundownBar visible during live show

- **WHEN** the ExpandedView renders in `live` phase
- **THEN** the RundownBar SHALL be visible between the ON AIR indicator and the timer
- **THEN** acts SHALL render as proportional colored blocks with the NOW marker

#### Scenario: RundownBar hidden in Writer's Room

- **WHEN** the ExpandedView renders in `writers_room` phase
- **THEN** the RundownBar SHALL NOT render

#### Scenario: RundownBar visible during intermission

- **WHEN** the ExpandedView renders in `intermission` phase
- **THEN** the RundownBar SHALL remain visible (show progress does not disappear during breaks)

---

### Requirement: PillView integration

The `MiniRundownStrip` component SHALL be integrated into `PillView`
(`src/renderer/views/PillView.tsx`).

- The MiniRundownStrip SHALL be placed below the content row (act name, timer,
  beat counter) and above the bottom edge of the pill.
- It SHALL span the full width of the pill minus 12px horizontal padding (`mx-3`).
- It SHALL add 4px bottom padding to the pill to accommodate the strip.
- The strip SHALL only render when the phase is `live` or `intermission`.

#### Scenario: Mini strip visible in pill during live show

- **WHEN** the PillView renders in `live` phase
- **THEN** a 4px-tall colored strip SHALL appear below the main content row
- **THEN** the NOW marker SHALL be visible as a thin red vertical line

#### Scenario: Mini strip hidden when not live

- **WHEN** the PillView renders in `strike` or `no_show` phase
- **THEN** the MiniRundownStrip SHALL NOT render

#### Scenario: Pill height accommodates strip

- **WHEN** the MiniRundownStrip renders in the pill
- **THEN** the pill height SHALL increase by approximately 8px (4px strip + 4px padding) to avoid clipping
