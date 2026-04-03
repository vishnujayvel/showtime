# Enhancements Wave 2 — UX Mockups (#41) + Application Log Trail (#40)

GitHub Issues: #41, #40

## Why

Two remaining open enhancements that improve the project's maturity:
- #41: Missing UX mockups for three implemented features (HistoryView, Calendar Sync, Settings)
- #40: No diagnostic logging — when something breaks, there's no trace of what happened

## Enhancement 1: UX Mockups (#41)

### What to build

Create three HTML mockup files in `docs/mockups/`:

1. **`history-view.html`** — HistoryView states: empty, few shows, many shows, expanded detail, loading
2. **`calendar-sync.html`** — Calendar sync flow: no MCP access → connect → import events → show in lineup
3. **`settings-view.html`** — Settings states: general preferences, reset show confirmation, about

Match the visual style of the existing `direction-4-the-show.html` mockup:
- Dark background (#0d0d0f)
- JetBrains Mono for labels, Inter for body
- Gold accents for beats, red for ON AIR
- Each state shown as a labeled card in the HTML

### Files
- `docs/mockups/history-view.html`
- `docs/mockups/calendar-sync.html`
- `docs/mockups/settings-view.html`

## Enhancement 2: Application Log Trail (#40)

### What to build

Structured JSONL event logging for diagnostics.

**Logger module** (`src/main/app-logger.ts`):
- Writes to `~/Library/Logs/Showtime/showtime-YYYY-MM-DD.log`
- JSONL format: `{"ts":"ISO","level":"INFO","event":"phase_change","data":{"from":"live","to":"intermission"}}`
- Severity levels: ERROR, WARN, INFO, DEBUG
- Log rotation: keep last 7 days, delete older on startup
- Startup log: app version, Electron version, macOS version, Node version, SQLite path
- **No PII**: never log plan text, act names, or user content — only event types + metadata

**Events to log:**
- App lifecycle: launch, quit, crash recovery
- Show phases: all transitions (no_show → writers_room → live → intermission → strike)
- Data layer: SQLite hydration success/failure, sync events
- Window management: view mode changes, resize events
- Claude subprocess: spawn, connect, disconnect, timeout
- IPC errors: any handler catch blocks
- User actions: energy selection, act start/complete, beat lock, director mode (event type only, not content)

**Issue reporting** (`src/main/menu.ts`):
- Add "Report Issue" to app menu
- Collects: last 24h of logs, app version, macOS version, Electron version
- Copies to clipboard as formatted text for pasting into GitHub issues

### Files
- `src/main/app-logger.ts` (new)
- `src/main/index.ts` (init logger on startup)
- `src/main/ipc/showtime.ts` (add log calls to handlers)
- `src/main/window.ts` (log view mode changes)
- `src/main/menu.ts` (add Report Issue item)
- `src/renderer/stores/showStore.ts` (log phase transitions via IPC)
- `src/shared/types.ts` (add LOG_EVENT IPC channel)

### Testing
- Unit test: logger writes JSONL, rotates files, respects severity
- Unit test: startup log contains expected fields
- E2E test: verify log file exists after app launch

## IMPORTANT RULES (from CLAUDE.md)
- No inline styles — Tailwind only
- Spring physics for all animations
- All changes on a feature branch, PR to main
- E2E coverage required
- CodeRabbit will review the PR
