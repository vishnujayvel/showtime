# Bug Fix Wave 2: Border Fix + Architecture Cleanup

## Issues
- #22: RECURRING double-border — window background bleeds around content panel
- #24: Architecture cleanup — hooks violation, dead code, bundle bloat

## #22 Fix (CRITICAL — most visible UX bug)

The React content has `rounded-xl` (12px border radius) which creates visible gaps at the window edges. The window is `transparent: true` so the gap shows the desktop behind it.

**Fix:** Remove `rounded-xl` from ALL view root elements. The native macOS `roundedCorners: true` on the BrowserWindow handles corner rounding. The CSS border-radius is redundant and creates the double-border.

Files to modify:
- `src/renderer/views/ExpandedView.tsx` — remove `rounded-xl` from root
- `src/renderer/views/WritersRoomView.tsx` — remove `rounded-xl` from root
- `src/renderer/views/StrikeView.tsx` — remove `rounded-xl` from root
- `src/renderer/views/OnboardingView.tsx` — remove `rounded-xl` from root
- `src/renderer/views/DarkStudioView.tsx` — verify no rounded corners
- `src/renderer/App.tsx` — ensure root container has no padding/margin creating gaps

Also check: is there any padding or margin on the root `<div>` in App.tsx that creates space between the window edge and the view content? Remove it.

## #24 Fix (Architecture cleanup)

### CRITICAL
1. **MiniRundownStrip hooks violation** — Move early returns BELOW the `useEffect` call (line 22). All hooks must be called before any conditional returns.
2. **Delete PermissionCard** — `src/renderer/components/PermissionCard.tsx` is dead code, imported nowhere
3. **Delete ChatPanel** — `src/renderer/panels/ChatPanel.tsx` is dead code. Also remove `react-markdown` and `remark-gfm` from `package.json` dependencies.

### IMPORTANT
4. **Delete unused shadcn components** — `src/renderer/ui/input.tsx`, `src/renderer/ui/textarea.tsx`
5. **Type the preload data methods** — Replace `any` with `ShowStateSnapshot` and `TimelineEventInput` from `src/main/data/types.ts`
6. **Remove unused exports** — `selectNextAct`, `selectCompletedActs`, `selectSkippedActs`, `selectBeatsRemaining` from showStore.ts; `SKETCH_COLORS`, `getCategoryHex`, `getCategoryToken` from category-colors.ts
7. **Fix ShowVerdict inline style** — Move gradient to CSS class

### MINOR
8. Extract `formatDateLabel()` to shared utility (duplicated in ExpandedView + WritersRoomView)
9. Remove legacy no-op IPC handlers (RESIZE_HEIGHT, SET_WINDOW_WIDTH, ANIMATE_HEIGHT) from main + preload
10. Remove unused CSS class `.spotlight-in` from index.css

## Testing Strategy
```bash
npm run build
npm run test
npm run test:e2e
npx tsc --noEmit
```

Verify: no `rounded-xl` on view root elements. No double-border visible in Playwright screenshots.

## Loop Configuration
autonomous: true
max_iterations: 2
issue_labels: ["bug"]
cooldown_minutes: 2
