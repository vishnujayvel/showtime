# Code Audit — Dead Code, Testing Gaps, Refactoring

**Issue:** #153
**Type:** Refactor + Testing

## Work Items (from audit findings)

### 1. Dead Code Removal
- Delete orphaned components: `CalendarBanner.tsx`, `LineupChatInput.tsx`, `EnergySelector.tsx` (226 LOC)
- Remove unused export `prevViewTier()` from showMachine.ts (keep only in tests if needed)
- Rename CLUI legacy naming: `window.clui` → `window.showtime`, `clui:*` IPC channels → `showtime:*`
  - NOTE: This is a large rename. Touch preload/index.ts, main IPC handlers, and all renderer call sites. Do it as a single atomic rename.

### 2. Fix Process Boundary Violations
- Move 7 types from `src/main/data/types.ts` to `src/shared/types.ts`
- Fix imports in `HistoryView.tsx` and `preload/index.ts` to use shared types

### 3. Fix Remaining Inline Styles
- Audit the 2 fixable `style={{}}` violations and convert to Tailwind classes
- Leave the 6 genuinely dynamic ones (progress bars, timelines) but add comments explaining why

### 4. Testing Gaps — Add Unit Tests
- Add tests for: `ActCard`, `BeatCheckModal`, `DirectorMode`, `RundownBar`
- Add test for `useAudio` hook
- Target: at least basic render + event handler tests for each

### 5. Extract Duplicated Patterns
- Create `src/renderer/constants/animations.ts` with the 3 spring transition presets (currently duplicated in 10+ files)
- Extract view tier expand/collapse pattern into a shared hook or utility
- Replace 3 hardcoded IPC channel strings with typed `IPC` constants

### 6. Fix Stale Documentation
- Remove `ChatPanel` from CLAUDE.md architecture tree (it doesn't exist)
- Update March 28 audit references (predates XState migration)

## Testing Strategy
- Run full test suite after each category of changes
- New component tests must pass
- TypeScript must compile clean

## Non-Goals
- No new features
- No E2E test additions (that's a separate issue)
- Don't rename the preload API if it would break the Electron build
