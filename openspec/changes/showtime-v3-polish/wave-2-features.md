# v3 Wave 2: Pill Sizes + History View + Planning Language

Loki completed the border fix but not these features. This is a focused run.

## Issues
- #28: Multi-size pill widget (micro/compact/dashboard)
- #26: History view for past days
- #27: Planning language temporal awareness

## #28 Multi-Size Pill (ARCHITECTURAL CHANGE)

Replace `isExpanded: boolean` with `viewTier: 'micro' | 'compact' | 'dashboard' | 'expanded'` in showStore.

See `docs/plans/2026-03-21-pill-sizes-design.md` for the full design with ASCII diagrams.

VIEW_DIMENSIONS in `src/main/index.ts`:
```typescript
const VIEW_DIMENSIONS = {
  micro:     { width: 320, height: 56 },
  compact:   { width: 340, height: 140 },
  dashboard: { width: 400, height: 320 },
  expanded:  { width: 560, height: 620 },
  full:      { width: 560, height: 740 },
}
```

New files: `CompactView.tsx`, `DashboardView.tsx`
Modified: showStore (viewTier enum), App.tsx (5-tier routing), main/index.ts (VIEW_DIMENSIONS), PillView→MicroView

Navigation: click = expand one tier, collapse button = shrink one tier.

## #26 History View

New `HistoryView.tsx` — query past shows from SQLite.
New IPC: `window.clui.dataGetShowHistory()` returning last 30 shows.
Accessible from StrikeView ("View Past Shows") and DarkStudioView.

## #27 Planning Language

Temporal greeting in DarkStudioView:
- Before noon: "Today's show"
- After 6 PM: "Tomorrow's show"
- Writer's Room shows planned date
- Cold open uses planned date

## Testing
```bash
npm run build && npm run test && npm run test:e2e && npx tsc --noEmit
```

## Loop Configuration
autonomous: true
max_iterations: 2
issue_labels: ["enhancement", "bug"]
cooldown_minutes: 2
