# Bug Batch: UX Quick Fixes Wave 1 (#192, #194, #196)

**Type:** Bug Batch
**Priority:** High — these are user-visible UX issues found during manual testing

## Bug 1: Evening copy says "tomorrow's" instead of "tonight's" (#192)

**File:** `src/renderer/views/DarkStudioView.tsx` (lines 55-68), `src/renderer/lib/utils.ts` (lines 18-23)

**Problem:** After 6 PM, greeting says "Tomorrow's show hasn't been written yet." But if no show was started today, it should say "Tonight's show hasn't been written yet."

**Fix:** The `getTemporalGreeting` function in DarkStudioView already receives a `hasTodayShow` boolean parameter. When `hour >= 18 && !hasTodayShow`, use "Tonight's show" instead of "Tomorrow's show". Also update `getTemporalShowLabel` in utils.ts to accept an optional `hasCompletedShow` parameter.

**Tests:** Update `src/__tests__/property/temporal.property.test.ts` to cover the tonight/tomorrow distinction.

## Bug 2: Pill view too wide — reduce width and tighten spacing (#194)

**File:** `src/renderer/views/PillView.tsx`

**Problem:** The pill is ~400px+ wide with excessive gaps between the tally light, "SHOWTIME" label, act name, timer, and action icons. Should be 280-320px max.

**Fix:**
- Reduce horizontal padding (`px-4` → `px-2` or `px-3`)
- Tighten gaps between elements (`gap-3` → `gap-1.5` or `gap-2`)
- Consider hiding or abbreviating the "SHOWTIME" label in pill mode (it's redundant)
- Ensure `min-w` constraint doesn't force unnecessary width
- The window size in `src/main/index.ts` VIEW_SIZES.pill.width may need adjusting

**Tests:** Visual verification via Playwright screenshot. Check that timer text, act name, and icons remain readable.

## Bug 3: Tray menu truncates act name (#196)

**File:** `src/main/tray/` (tray menu construction)

**Problem:** "ON AIR · PERSONAL · Milk Run" is cut off in the tray dropdown. The category prefix makes it too long.

**Fix:** Shorten the tray menu format:
- Current: "ON AIR · PERSONAL · Milk Run"
- Proposed: "🔴 Milk Run" (just the act name, tally dot prefix)
- Or: "Milk Run — 09:37" (act name + timer inline)
- The category is already visible in the expanded/pill view — no need to repeat it in the tray

**Tests:** Visual verification.

## Acceptance Criteria

- [ ] After 6 PM with no show today: "Tonight's show hasn't been written yet."
- [ ] After 6 PM with completed show: "Tomorrow's show hasn't been written yet."
- [ ] Pill view width ≤ 320px with tight spacing
- [ ] Tray menu shows full act name without truncation
- [ ] All existing tests pass
- [ ] Temporal property tests updated for tonight/tomorrow
