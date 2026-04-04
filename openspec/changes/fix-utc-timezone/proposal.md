# Fix: UTC Timezone Bug — Shared localToday() Utility (#200)

**Issue:** #200
**Type:** Bug fix
**Priority:** P0 — actively causes wrong lineup restoration

## Problem

The app uses `new Date().toISOString().slice(0, 10)` in 10 places across src/ to compute "today's date". This returns UTC, not local time. For users in PDT (UTC-7), after 5 PM local time UTC rolls to the next day, causing stale lineup restoration and wrong day boundary detection.

## Fix

### 1. Create `src/shared/date-utils.ts`

```typescript
export function localToday(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
```

### 2. Replace all 10 instances in src/ (not tests)

| File | Line | Priority |
|------|------|----------|
| `src/renderer/machines/showMachine.ts` | 88 | CRITICAL |
| `src/renderer/machines/showActor.ts` | 84 | CRITICAL |
| `src/main/data/SyncEngine.ts` | 62 | CRITICAL |
| `src/main/data/ShowRepository.ts` | 36 | CRITICAL |
| `src/shared/showtime-db.ts` | 82, 121, 173 | CRITICAL |
| `src/main/day-boundary.ts` | 7, 9 | Important |
| `src/renderer/views/DarkStudioView.tsx` | 22 | Important |
| `src/main/metrics.ts` | 116 | Low |
| `src/main/app-logger.ts` | 51 | Low |

### 3. Add CLAUDE.md rule

Add to Known Pitfalls: "Always use `localToday()` from `src/shared/date-utils.ts` — never `toISOString().slice(0,10)` which returns UTC and breaks after 5 PM in negative-UTC timezones"

### 4. Update tests

Update test files that use `toISOString().slice(0, 10)` to use `localToday()` or the same local date logic for consistency.

## Acceptance Criteria

- [ ] `src/shared/date-utils.ts` exists with `localToday()` function
- [ ] Zero instances of `toISOString().slice(0, 10)` remain in src/ (excluding test files)
- [ ] CLAUDE.md Known Pitfalls updated
- [ ] All existing tests pass
- [ ] New test: `localToday()` returns YYYY-MM-DD in local timezone
