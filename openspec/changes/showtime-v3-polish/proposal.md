# Showtime v3 Polish: Border Fix + Pill Sizes + History + Planning Language

## Why

Four issues remain: the recurring border bug (vibrancy layer bleeding through), single-size pill limiting glanceability, no history view for past days, and wrong temporal language when planning tomorrow's show.

Fixes: Border (unfiled recurring), #26 (History view), #27 (Planning language), #28 (Multi-size pill)

## What Changes

### 1. BORDER FIX (CRITICAL — do this FIRST)

**Root cause (from Electron research):** `vibrancy: 'under-window'` inserts a native NSVisualEffectView behind web content. When views don't fill every pixel, the vibrancy gray layer shows through as a visible border. This is documented in Electron issues #31862, #46586.

**Fix (3 changes):**

**A. Remove vibrancy from BrowserWindow** (`src/main/index.ts`):
Remove these lines from createWindow():
```typescript
// DELETE THESE:
vibrancy: 'under-window' as const,
visualEffectState: 'active' as const,
```
The app paints its own opaque backgrounds (`bg-surface` #1a1a1e). It doesn't need native macOS blur. Apps like Raycast use `transparent: true` + `frame: false` alone, no vibrancy.

**B. Make views fill the window edge-to-edge:**
- `ExpandedView.tsx`: change `w-[560px] min-h-[620px]` to `w-full h-full`
- `WritersRoomView.tsx`: change `w-[560px] min-h-[680px]` to `w-full h-full`
- `StrikeView.tsx`: change `w-[560px] max-h-[680px]` to `w-full h-full`
- `OnboardingView.tsx`: change `w-[560px] min-h-[620px]` to `w-full h-full`
- `GoingLiveTransition.tsx`: verify it fills w-full h-full
- `DarkStudioView.tsx`: already uses `min-h-screen`, add `w-full` explicitly

**C. Fix App.tsx root container:**
Change: `<div className="w-full h-full relative bg-transparent flex flex-col items-center justify-end">`
To: `<div className="w-full h-full relative bg-transparent flex flex-col">`

PillView handles its own centering internally (it's a small element that should self-center via `mx-auto mt-auto mb-4` or similar).

**D. Update CLAUDE.md:**
Remove `vibrancy: 'under-window'` and `visualEffectState: 'active'` from the mandatory settings in Section 4. Add a note: "Do NOT use Electron vibrancy — it creates visible borders. Paint backgrounds in CSS."

### 2. Multi-Size Pill Widget (#28)

Replace `isExpanded: boolean` with `viewTier: 'micro' | 'compact' | 'dashboard' | 'expanded'` in showStore.

**Three pill sizes** (see `docs/plans/2026-03-21-pill-sizes-design.md` for full design):

| Tier | Dimensions | Shows |
|------|-----------|-------|
| Micro | 320x56 | Tally + act name + timer + beat stars + MiniRundownStrip |
| Compact | 340x140 | Header (act+timer) + RundownBar + drift badge + beat counter |
| Dashboard | 400x320 | Timer hero + RundownBar + next 2 acts + beat counter + status |

**Navigation:** Click expands one tier up. Collapse button shrinks one tier down. The existing `toggleExpanded` becomes `cycleTierUp()` / `cycleTierDown()`.

**VIEW_DIMENSIONS update** in `src/main/index.ts`:
```typescript
const VIEW_DIMENSIONS = {
  micro:     { width: 320, height: 56 },
  compact:   { width: 340, height: 140 },
  dashboard: { width: 400, height: 320 },
  expanded:  { width: 560, height: 620 },
  full:      { width: 560, height: 740 },
}
```

**New files:**
- `src/renderer/views/CompactView.tsx` — the 340x140 compact widget
- `src/renderer/views/DashboardView.tsx` — the 400x320 dashboard widget

**Modified files:**
- `src/renderer/stores/showStore.ts` — replace `isExpanded` with `viewTier`, add `cycleTierUp()`/`cycleTierDown()`
- `src/renderer/App.tsx` — update view routing for 5 tiers instead of 2
- `src/renderer/views/PillView.tsx` — rename to MicroView, add self-centering
- `src/main/index.ts` — update VIEW_DIMENSIONS, update applyViewMode

### 3. History View (#26)

A new view accessible from Strike view ("View Past Shows") and from DarkStudio ("Show History" link).

**Shows a list of past days:**
- Each row: date, verdict badge (DAY WON / SOLID SHOW / etc.), acts completed, beats locked
- Click a day to expand: see acts with durations, drift story, timeline
- At the top: streak counter ("5-day streak!") and summary stats

**Query from SQLite:**
```sql
SELECT * FROM shows ORDER BY id DESC LIMIT 30;
-- For each show:
SELECT * FROM acts WHERE show_id = ? ORDER BY sort_order;
SELECT * FROM timeline_events WHERE show_id = ? ORDER BY created_at;
```

**New files:**
- `src/renderer/views/HistoryView.tsx` — the history browser
- `src/renderer/components/ShowHistoryCard.tsx` — expandable card per past day

**IPC additions:**
- `window.clui.dataGetShowHistory()` — returns last 30 shows with acts
- Main process handler queries SQLite

### 4. Planning Language Fix (#27)

**Current problem:** DarkStudioView says "Tonight's show" regardless of what day is being planned.

**Fix with temporal awareness:**
- Before noon: "Today's show hasn't been written yet"
- After 6 PM: "Tomorrow's show hasn't been written yet"
- Between noon and 6 PM: "Your next show hasn't been written yet"
- The Writer's Room shows which date: "Planning: Monday, March 22"
- The cold open reflects the planned date: "Live from your desk... it's Monday!"
- The `showStore.startShow()` records the target date (today or tomorrow) in the `shows` table

**Files to modify:**
- `src/renderer/views/DarkStudioView.tsx` — temporal greeting
- `src/renderer/views/WritersRoomView.tsx` — date label reflects planned date
- `src/renderer/views/ColdOpenSplash.tsx` — use planned date for day name
- `src/renderer/stores/showStore.ts` — add `plannedDate` field

## Testing Strategy

```bash
npm run build
npm run test
npm run test:e2e
npx tsc --noEmit
```

### E2E Tests:
- App launches with NO visible border (verify via screenshot comparison)
- Pill click expands to compact, compact click to dashboard, dashboard click to expanded
- History view shows past shows (seed SQLite with test data)
- Planning language changes based on time of day
- All view tiers have correct window dimensions

## Loop Configuration
autonomous: true
max_iterations: 3
issue_labels: ["bug", "enhancement"]
cooldown_minutes: 2
