# Wave 2: UX Enhancements

## Why

Wave 1 fixed the core flow (lineup → finalize → go live). Now the UX needs polish: auto-resuming existing lineups, inline editing, menu bar timer, and help buttons. These make the app usable for daily use, not just demo-able.

## What Changes

### 1. Auto-Resume Existing Lineup (#165)

**Files:** `src/renderer/App.tsx`, `src/renderer/machines/showActor.ts`, `src/main/ipc/core.ts`

On app startup, check the database for today's show state. Route to the correct view based on phase:

| DB State | What to Show |
|----------|-------------|
| No show today | Writer's Room (current behavior) |
| Show exists, phase = writers_room, lineup = draft | Writer's Room with lineup pre-loaded |
| Show exists, phase = writers_room, lineup = confirmed | Going Live transition |
| Show exists, phase = live | Expanded view with current act + timer |
| Show exists, phase = strike | Strike view with summary |

The key: hydrate the XState machine from persisted state BEFORE rendering. The `showActor.ts` already has `PERSIST_VERSION` and SQLite sync — extend the hydration to restore on startup.

### 2. Inline Lineup Editing + Chat with Claude (#166)

**Files:** `src/renderer/views/WritersRoomView.tsx`, `src/renderer/components/LineupCard.tsx`

The lineup card should support two editing modes:

**Direct inline editing:**
- Click act name → edit text inline
- Click duration → adjust with +/- or type
- Drag to reorder (or use existing up/down arrows)
- Delete button per act (already exists)
- "+ Add Act" button (already exists but may not be wired)

**"Chat with Claude" refinement:**
- When lineup is in `lineup_ready` step, show a chat input below the lineup card
- User types refinement request → Claude responds with updated `showtime-lineup` JSON
- Lineup card updates in place (already works via `tryParseLineup`)

The state flow: after finalization, user can go back to `conversation` step via the existing "Refine" button, chat with Claude, get a new lineup, re-finalize.

### 3. Menu Bar Countdown Timer (#167)

**Files:** `src/main/tray.ts`, `src/main/ipc/core.ts`, `src/preload/index.ts`

Show the current act's remaining time in the macOS menu bar using `tray.setTitle()`:

| State | Menu Bar Text |
|-------|-------------|
| Active act | `23:45` (countdown) |
| Intermission | `BREAK` |
| No show | (empty) |
| Strike | `DONE` |

The timer updates every second via IPC from the renderer (which owns the XState machine timer state). Use `setTitle()` — this shows text next to the tray icon on macOS.

**Mutually exclusive with pill view:** Add a setting in `uiStore` for `timerDisplay: 'pill' | 'menubar'`. When menubar is active, hide the pill window. When pill is active, don't update tray title.

Add to tray right-click menu: "Show as Floating Pill" / "Show in Menu Bar" toggle.

### 4. Help Button on Every Screen (#168)

**Files:** All view files in `src/renderer/views/`, new `src/renderer/components/HelpButton.tsx`

Add a small `?` button in the title bar of every view that opens the docs site in the default browser.

```tsx
// HelpButton.tsx
function HelpButton({ page }: { page: string }) {
  return (
    <button
      onClick={() => window.showtime.openExternal(`https://vishnujayvel.github.io/showtime/${page}`)}
      className="text-txt-muted hover:text-accent transition-colors text-xs"
      title="Help"
    >
      ?
    </button>
  )
}
```

Context-aware links per view:
- Dark Studio → `/guide/getting-started`
- Writer's Room → `/guide/writers-room`
- Expanded/Pill → `/guide/live-show`
- Strike → `/guide/framework#strike`
- Settings → `/guide/settings`

If `openExternal` IPC doesn't exist yet, add it (Electron `shell.openExternal()`).

## Testing Strategy

- Unit tests: State hydration from DB, tray title updates, help button rendering
- E2E: App launch with existing lineup → auto-resume, menu bar timer visible
- Manual: Verify inline editing, help links open correct pages

## Acceptance Criteria

1. App resumes today's show on startup instead of showing empty Writer's Room
2. Lineup acts are editable inline (name, duration, reorder, remove)
3. Chat input available for Claude-powered refinement after lineup exists
4. Menu bar shows countdown timer as alternative to pill
5. Help button visible on every view, opens correct docs page
