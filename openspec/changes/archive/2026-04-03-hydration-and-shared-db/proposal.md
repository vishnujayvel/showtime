# Proposal: Writer's Room Hydration (#135) + Shared SQLite (#125)

## Part A: Writer's Room Hydration + Time-of-Day Awareness (#135)

### Problem
When restarting Showtime mid-day, the Writer's Room starts blank — no awareness of existing lineup or time of day.

### Fix

1. **On app start**, check localStorage (now working via #136) for today's show:
   - If acts exist → restore show state, skip to appropriate phase
   - If show is in `strike` → show "Show complete" summary, offer encore
   - If no show → proceed with fresh Writer's Room

2. **Time-of-day prompts** in Writer's Room conversation:
   - Morning (before 10am): "Fresh start! Let's build today's show."
   - Midday (10am-2pm): "Afternoon — here's what's left."
   - Late day (after 4pm): "Evening wind-down. [N] acts done, [M] remaining."
   - After 6pm: "Show's wrapping up. Strike or encore?"

3. **Quick-start templates** in Writer's Room:
   - "Resume today's show" (if exists)
   - "Same lineup as yesterday" (from history)
   - "Light day" / "Deep focus day" presets

### Files
- `src/renderer/views/WritersRoomView.tsx` — time-of-day prompts, resume option
- `src/renderer/views/DarkStudioView.tsx` — "Resume show" button if today's show exists
- `src/renderer/machines/showActor.ts` — hydration already done (#136), may need enhancement

---

## Part B: Shared SQLite Access (#125)

### Problem
Skill and app operate on separate data. Both must read/write the same showtime.db.

### Fix

1. **Create `src/shared/db-path.ts`** — resolves DB path in both contexts:
   - Electron: `app.getPath('userData')`
   - Node.js/CLI: `~/Library/Application Support/showtime/`

2. **Create `src/shared/showtime-db.ts`** — lightweight read/write module:
   - `readToday()` — get today's show + acts
   - `writeLineup(lineup)` — write show + acts from showtime-lineup JSON
   - `getPhase()` — quick phase check
   - Reuses existing Drizzle schema

3. **Update `src/skills/showtime/SKILL.md`**:
   - On invocation → check DB for today's show
   - If show exists → present lineup, current phase, offer to refine
   - If no show → energy check → build lineup → write to DB

### Files
- `src/shared/db-path.ts` (new)
- `src/shared/showtime-db.ts` (new)
- `src/skills/showtime/SKILL.md` (update)

---

## Testing

- All existing 578 tests must pass
- New tests for time-of-day logic
- New tests for db-path resolution
- New tests for showtime-db read/write
- Run `npm run build` after implementation
- Run evidence capture script for UI screenshots
- Create PR with screenshots attached

## Verification (Loki must do this before completing)

1. `npm test` — all tests pass
2. `npm run build` — Electron app builds
3. `node e2e/capture-evidence.mjs` — capture screenshots
4. Create PR with all changes
