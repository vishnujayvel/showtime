# Technical Design — Showtime SNL Day Planner

## Overview

Transform CLUI CC (general-purpose Claude Code desktop wrapper) into Showtime (SNL-themed ADHD day planner). The fork preserves the main process infrastructure (subprocess management, IPC, permissions) while replacing the renderer entirely with SNL-specific views, stores, and components.

---

## 1. Architecture Changes from CLUI CC

### 1.1 What Stays (No Changes)

| File/Module | Why |
|-------------|-----|
| `src/main/claude/control-plane.ts` | Core subprocess lifecycle orchestration — unchanged |
| `src/main/claude/run-manager.ts` | Spawns `claude -p --output-format stream-json` — unchanged |
| `src/main/claude/event-normalizer.ts` | NDJSON → NormalizedEvent mapping — unchanged |
| `src/main/stream-parser.ts` | Incremental NDJSON parser — unchanged |
| `src/main/cli-env.ts` | Clean env for claude binary — unchanged |
| `src/main/hooks/permission-server.ts` | Tool approval — unchanged |
| `src/main/logger.ts` | Logging — unchanged |
| `src/preload/index.ts` | IPC bridge — extended (not replaced) |
| `src/shared/types.ts` | Stream event types — extended (not replaced) |
| `electron.vite.config.ts` | Build config — unchanged |

### 1.2 What Gets Modified

| File | Changes |
|------|---------|
| `src/main/index.ts` | Window dimensions, pill/expanded sizing, remove multi-tab IPC handlers, add show-specific IPC (timer notifications, etc.) |
| `src/preload/index.ts` | Add `showtime` namespace to bridge (timer, show state, notifications) |
| `src/shared/types.ts` | Add ShowState, Act, Beat, ShowVerdict types |

### 1.3 What Gets Removed

| File/Component | Reason |
|----------------|--------|
| `src/renderer/components/TabStrip.tsx` | Single session — no tabs |
| `src/renderer/components/MarketplacePanel.tsx` | No marketplace in MLP |
| `src/renderer/components/SettingsPopover.tsx` | Simplified to Show settings |
| Multi-tab logic in `sessionStore.ts` | Single Show, single session |
| Voice recording in `InputBar.tsx` | Not in MLP |
| History picker | Not needed |

### 1.4 What Gets Added

| New File | Purpose |
|----------|---------|
| **Stores** | |
| `src/renderer/stores/showStore.ts` | Core Show state (Acts, Beats, energy, verdict, phase) |
| **Views** | |
| `src/renderer/views/PillView.tsx` | Collapsed pill: Act + timer + Beats |
| `src/renderer/views/ExpandedView.tsx` | Main expanded window layout |
| `src/renderer/views/WritersRoomView.tsx` | Morning planning guided flow |
| `src/renderer/views/StrikeView.tsx` | End-of-day summary + verdict |
| **Panels** | |
| `src/renderer/panels/ChatPanel.tsx` | Claude chat (simplified from CLUI ConversationView) |
| `src/renderer/panels/LineupPanel.tsx` | Show Lineup (Act list) |
| `src/renderer/panels/TimerPanel.tsx` | Act countdown timer |
| `src/renderer/panels/CalendarPanel.tsx` | Time-based day view |
| **Components** | |
| `src/renderer/components/ActCard.tsx` | Single Act display |
| `src/renderer/components/BeatCounter.tsx` | Beat progress indicator |
| `src/renderer/components/BeatCheckModal.tsx` | Post-Act presence check |
| `src/renderer/components/EnergySelector.tsx` | Energy level picker |
| `src/renderer/components/ShowVerdict.tsx` | DAY WON / SOLID SHOW / etc. |
| `src/renderer/components/RestAffirmation.tsx` | Intermission messages |
| `src/renderer/components/DirectorMode.tsx` | Overwhelm handling UI |
| **Skill** | |
| `skills/showtime/SKILL.md` | SNL framework knowledge for Claude |

---

## 2. Data Model

### 2.1 Show State (Zustand Store)

```typescript
// src/renderer/stores/showStore.ts

type ShowPhase = 'no_show' | 'writers_room' | 'live' | 'intermission' | 'director' | 'strike'
type EnergyLevel = 'high' | 'medium' | 'low' | 'recovery'
type ActStatus = 'upcoming' | 'active' | 'completed' | 'skipped'
type ShowVerdict = 'DAY_WON' | 'SOLID_SHOW' | 'GOOD_EFFORT' | 'SHOW_CALLED_EARLY'

interface Act {
  id: string
  name: string
  sketch: string          // Category (e.g., "Deep Work", "Exercise", "Admin")
  durationMinutes: number // Planned duration
  status: ActStatus
  beatLocked: boolean     // True if user confirmed presence moment
  startedAt?: number      // Unix ms
  completedAt?: number    // Unix ms
  order: number           // Position in lineup
}

interface ShowState {
  // Core state
  phase: ShowPhase
  energy: EnergyLevel | null
  acts: Act[]
  currentActId: string | null

  // Beat tracking
  beatsLocked: number
  beatThreshold: number   // Default 3

  // Timer
  timerEndAt: number | null   // Unix ms when current Act timer expires
  timerPausedAt: number | null // If paused (intermission)

  // Session
  claudeSessionId: string | null
  showDate: string         // ISO date (YYYY-MM-DD)

  // Verdict
  verdict: ShowVerdict | null

  // UI
  isExpanded: boolean
  beatCheckPending: boolean // True when waiting for user to confirm Beat
}
```

### 2.2 Persistence

```typescript
// localStorage key: 'showtime-show-state'
// Saved on every state change via Zustand middleware
// On app launch:
//   1. Load from localStorage
//   2. If showDate !== today → clear (fresh Show)
//   3. If showDate === today → resume (restore phase, acts, timer)
```

### 2.3 SNL Skill Output Schema

Claude (with SNL skill) returns structured lineup via JSON in its response:

```typescript
interface ShowLineup {
  acts: Array<{
    name: string
    sketch: string
    durationMinutes: number
    reason?: string        // Why this order (energy-based)
  }>
  beatThreshold: number    // Suggested based on act count
  openingNote: string      // Motivational message
}
```

The Chat panel parses Claude's response looking for a JSON block matching this schema. When found, it dispatches to `showStore.setLineup()`.

---

## 3. Window Management

### 3.1 Dimensions

| State | Width | Height | Notes |
|-------|-------|--------|-------|
| Pill | 320px | 52px | Rendered inside existing 1040×720 native window |
| Expanded | 580px | 660px | Same native window, CSS-driven sizing |
| Native window | 1040×720 | Fixed | Extra space transparent + click-through |

The native Electron window stays at 1040×720 (from CLUI). The pill and expanded states are CSS-driven within that frame. Click-through (`setIgnoreMouseEvents`) handles the transparent regions.

### 3.2 Pill ↔ Expanded Transition

```
PillView (320×52, bottom-center)
  ↕ framer-motion layoutId animation
ExpandedView (580×660, centered)
```

Transition uses `framer-motion` `layout` prop with spring physics. The container div animates width/height. Content cross-fades with `AnimatePresence`.

### 3.3 Positioning

- Pill: bottom-center of display work area (keep CLUI logic)
- Expanded: centered on display
- Always-on-top, visible on all workspaces (keep NSPanel behavior)
- Click outside → collapse (existing `setIgnoreMouseEvents` pattern)

---

## 4. Component Architecture

### 4.1 App Root (Modified)

```tsx
// src/renderer/App.tsx (rewritten)
function App() {
  const phase = useShowStore(s => s.phase)
  const isExpanded = useShowStore(s => s.isExpanded)

  return (
    <PopoverLayerProvider>
      <AnimatePresence mode="wait">
        {!isExpanded ? (
          <PillView key="pill" />
        ) : phase === 'no_show' || phase === 'writers_room' ? (
          <WritersRoomView key="writers-room" />
        ) : phase === 'strike' ? (
          <StrikeView key="strike" />
        ) : (
          <ExpandedView key="expanded" />
        )}
      </AnimatePresence>
      <BeatCheckModal />
    </PopoverLayerProvider>
  )
}
```

### 4.2 View Breakdown

**PillView** — Collapsed state
```
┌──────────────────────────────────────┐
│ ▶ Act 3: Gym  │  42:15  │  2/3 ★    │
└──────────────────────────────────────┘
```
- Click to expand
- Shows: Act name, countdown, Beat count
- During intermission: "Intermission | No rush | 2/3 ★"
- Before show: "Tap to start your show"

**ExpandedView** — Live show
```
┌─────────────────────────────────────┐
│  Timer Panel (current Act + time)   │
├──────────────┬──────────────────────┤
│              │   Show Lineup        │
│  Chat Panel  │   (Act cards list)   │
│              ├──────────────────────┤
│              │   Calendar Panel     │
│              │   (time-based view)  │
├──────────────┴──────────────────────┤
│  Beat Counter (★★☆ 2/3)            │
└─────────────────────────────────────┘
```

**WritersRoomView** — Morning planning
```
┌─────────────────────────────────────┐
│  🎭 Writer's Room                   │
│                                     │
│  How's your energy?                 │
│  [High] [Medium] [Low] [Recovery]  │
│                                     │
│  What's on the show today?          │
│  ┌─────────────────────────────┐    │
│  │ (free-text input)           │    │
│  └─────────────────────────────┘    │
│                                     │
│  [We're live! →]                    │
└─────────────────────────────────────┘
```
After Claude structures the lineup, shows preview before confirming.

**StrikeView** — End of day
```
┌─────────────────────────────────────┐
│  🎬 Strike the Stage                │
│                                     │
│  Acts: 4/5 completed                │
│  Beats: 3/3 locked ★★★             │
│                                     │
│  ┌──────────────────────────┐       │
│  │    🏆 DAY WON            │       │
│  │    What a show!          │       │
│  └──────────────────────────┘       │
│                                     │
│  [New Show] [Close]                 │
└─────────────────────────────────────┘
```

### 4.3 Chat Panel Integration

The Chat panel reuses the core stream rendering from CLUI but simplified:

- **Keep:** `useClaudeEvents` hook, RAF-batched text rendering, markdown rendering
- **Remove:** tool call timeline cards, permission cards (keep permission flow but render differently), attachment chips
- **Add:** Lineup parsing — when Claude's response contains a `ShowLineup` JSON block, extract it and call `showStore.setLineup()`
- **Add:** Show-context system prompt — all prompts include current Show state (phase, energy, acts) so Claude has context

### 4.4 Timer Implementation

```typescript
// Timer lives in showStore, ticks via setInterval in TimerPanel

// Start Act:
timerEndAt = Date.now() + act.durationMinutes * 60 * 1000

// Display:
remaining = Math.max(0, timerEndAt - Date.now())
minutes = Math.floor(remaining / 60000)
seconds = Math.floor((remaining % 60000) / 1000)

// Tick: setInterval(forceUpdate, 1000) — 1Hz updates
// On complete: showStore.completeAct() → beatCheckPending = true
```

---

## 5. SNL Skill Design

### 5.1 Location

```
skills/showtime/SKILL.md
```

Shipped with the app. On first launch, copied to the skill path used by the Claude subprocess.

### 5.2 Skill Content (Summary)

The SKILL.md provides Claude with:

1. **SNL Framework** — Full terminology table (Show, Act, Beat, Sketch, etc.)
2. **Structured Output** — JSON schema for ShowLineup that the app can parse
3. **Energy-Aware Scheduling** — Rules for ordering Acts based on energy level
4. **Beat Check Prompts** — Library of presence-check questions
5. **Director Mode** — Response templates for overwhelm handling
6. **ADHD Guardrails** — Language rules (no guilt, no shame, no "you should have")
7. **Verdict Celebration** — Messages for each verdict tier
8. **Rest Affirmations** — Intermission support messages

### 5.3 Skill Loading

When `showStore.sendToClaudeCode()` is called, the prompt includes:
```
--system-prompt "You are the Showtime Director. [SNL context]. Current show state: [JSON]"
```

The skill file itself is loaded via `--append-system-prompt` or installed as a Claude Code skill in the project directory.

---

## 6. IPC Extensions

### 6.1 New Preload API Methods

```typescript
// Added to CluiAPI (or new ShowtimeAPI namespace)
interface ShowtimeAPI {
  // Notification for Act completion (macOS notification center)
  notifyActComplete(actName: string): void

  // Notification for Beat check
  notifyBeatCheck(): void

  // System notification for verdict
  notifyVerdict(verdict: ShowVerdict): void
}
```

### 6.2 New IPC Channels

| Channel | Direction | Purpose |
|---------|-----------|---------|
| `showtime:notify-act-complete` | renderer → main | Trigger macOS notification |
| `showtime:notify-beat-check` | renderer → main | Trigger Beat check notification |
| `showtime:notify-verdict` | renderer → main | Trigger verdict notification |

These use Electron's `Notification` API for macOS notification center integration.

---

## 7. Session Management Simplification

CLUI CC supports multi-tab sessions. Showtime simplifies to single-session:

| CLUI CC | Showtime |
|---------|----------|
| `tabs[]` array | Single `session` object |
| `activeTabId` | N/A (always one session) |
| `createTab()` / `closeTab()` | `startShow()` / `endShow()` |
| Tab strip UI | No tab strip |
| Per-tab messages | Single message array |

The `sessionStore.ts` is simplified but keeps the same IPC interaction patterns with ControlPlane.

---

## 8. State Machine

```
                     ┌─────────────┐
          app open → │  no_show    │ ← midnight reset
                     └──────┬──────┘
                            │ user opens Writer's Room
                     ┌──────▼──────┐
                     │writers_room │ ← Claude structures lineup
                     └──────┬──────┘
                            │ "We're live!"
                     ┌──────▼──────┐
              ┌──────│    live     │◄────────┐
              │      └──┬────┬────┘         │
              │         │    │              │
    pause Act │  Act    │    │ overwhelmed  │ resume
              │  done   │    │              │
        ┌─────▼────┐   │  ┌─▼──────────┐   │
        │intermiss- │   │  │  director  ├───┘
        │   ion     │───┘  └──────┬─────┘
        └──────────┘              │ call show early
                     ┌────────────▼──┐
         all done →  │    strike     │
                     └───────────────┘
```

---

## 9. Build & Packaging

No changes to electron-vite or electron-builder config except:

1. **App name:** Change from "CLUI" to "Showtime" in `package.json` and electron-builder config
2. **App icon:** New Showtime icon (can be placeholder for MLP)
3. **Tray icon:** New tray template image
4. **Bundle ID:** `com.showtime.app`

---

## 10. File Tree (Final MLP)

```
src/
├── main/
│   ├── index.ts                    # Modified: window sizing, single-session, notifications
│   ├── claude/
│   │   ├── control-plane.ts        # Unchanged
│   │   ├── run-manager.ts          # Unchanged
│   │   ├── event-normalizer.ts     # Unchanged
│   │   └── pty-run-manager.ts      # Unchanged (kept for compatibility)
│   ├── hooks/
│   │   └── permission-server.ts    # Unchanged
│   ├── stream-parser.ts            # Unchanged
│   ├── cli-env.ts                  # Unchanged
│   └── logger.ts                   # Unchanged
├── preload/
│   └── index.ts                    # Extended: showtime namespace
├── renderer/
│   ├── App.tsx                     # Rewritten: SNL view routing
│   ├── views/
│   │   ├── PillView.tsx            # New: collapsed pill
│   │   ├── ExpandedView.tsx        # New: main expanded layout
│   │   ├── WritersRoomView.tsx     # New: morning planning
│   │   └── StrikeView.tsx          # New: end-of-day summary
│   ├── panels/
│   │   ├── ChatPanel.tsx           # New: simplified chat (from ConversationView)
│   │   ├── LineupPanel.tsx         # New: Act list
│   │   ├── TimerPanel.tsx          # New: countdown
│   │   └── CalendarPanel.tsx       # New: time-based day view
│   ├── components/
│   │   ├── ActCard.tsx             # New: Act display
│   │   ├── BeatCounter.tsx         # New: Beat progress
│   │   ├── BeatCheckModal.tsx      # New: presence check
│   │   ├── EnergySelector.tsx      # New: energy picker
│   │   ├── ShowVerdict.tsx         # New: verdict display
│   │   ├── RestAffirmation.tsx     # New: intermission messages
│   │   ├── DirectorMode.tsx        # New: overwhelm UI
│   │   ├── ConversationView.tsx    # Kept: simplified for ChatPanel
│   │   ├── InputBar.tsx            # Kept: simplified (remove voice, attachments)
│   │   └── PermissionCard.tsx      # Kept: unchanged
│   ├── hooks/
│   │   ├── useClaudeEvents.ts      # Kept: unchanged
│   │   ├── useHealthReconciliation.ts # Kept: simplified
│   │   └── useTimer.ts             # New: timer tick hook
│   ├── stores/
│   │   ├── showStore.ts            # New: core Show state
│   │   └── sessionStore.ts         # Modified: single-session only
│   └── theme.ts                    # Modified: Showtime color palette
├── shared/
│   └── types.ts                    # Extended: Show types
└── skills/
    └── showtime/
        └── SKILL.md                # New: SNL framework for Claude
```

---

## 11. Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| Claude doesn't reliably output ShowLineup JSON | Chat works but no auto-lineup | Strong skill prompt + fallback: let user manually create Acts |
| Timer drift over long Acts | Minor UX issue | Use absolute `timerEndAt` timestamp, not decrement |
| Pill click-through issues on macOS | UX regression | Reuse proven CLUI `setIgnoreMouseEvents` pattern |
| SNL metaphor confuses users | Adoption | Clear onboarding in Writer's Room, conventional labels underneath |
