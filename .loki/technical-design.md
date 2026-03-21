# Technical Design Document — Showtime v2

**Spec:** `.claude/specs/showtime-v2/`
**Authored:** 2026-03-20
**Status:** Design generated, pending approval

This document provides implementation-level specifications for all 17 requirements defined in `requirements.md`. It is designed so that each section can be assigned to an independent Loki Mode agent without cross-dependencies.

---

## 1. Architecture Overview

### 1.1 Process Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Main Process (Node.js)                                         │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────────┐ │
│  │ Window Mgmt  │  │ ControlPlane │  │ IPC Handlers           │ │
│  │ - NSPanel    │  │ - RunManager │  │ - showtime:* channels  │ │
│  │ - resize     │  │ - StreamParse│  │ - clui:* channels      │ │
│  │ - click-thru │  │ - PtyRunMgr  │  │ - theme broadcast      │ │
│  └──────────────┘  └──────────────┘  └────────────────────────┘ │
└────────────────────────────┬────────────────────────────────────┘
                             │ contextBridge (preload/index.ts)
                             │ window.clui typed API
┌────────────────────────────┴────────────────────────────────────┐
│  Renderer Process (React 19)                                     │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────────┐ │
│  │  Views       │  │  Panels     │  │  Components              │ │
│  │  - DarkStudio│  │  - Timer    │  │  - ActCard               │ │
│  │  - Writers   │  │  - Lineup   │  │  - BeatCheckModal        │ │
│  │  - Pill      │  │  - Chat     │  │  - BeatCounter           │ │
│  │  - Expanded  │  │             │  │  - DirectorMode          │ │
│  │  - Strike    │  │             │  │  - IntermissionView      │ │
│  │  - GoingLive │  │             │  │  - EnergySelector        │ │
│  │              │  │             │  │  - ShowVerdict            │ │
│  │              │  │             │  │  - OnAirIndicator         │ │
│  │              │  │             │  │  - TallyLight             │ │
│  │              │  │             │  │  - ClapperboardBadge      │ │
│  └──────┬───────┘  └──────┬──────┘  └────────────┬─────────────┘ │
│         │                 │                       │               │
│  ┌──────┴─────────────────┴───────────────────────┴──────┐       │
│  │  Stores (Zustand 5)                                    │       │
│  │  - showStore.ts  → Show state machine, acts, beats     │       │
│  │  - sessionStore.ts → Claude session (simplified)       │       │
│  └────────────────────────────────────────────────────────┘       │
│  ┌────────────────────┐  ┌────────────────────────────────┐       │
│  │  Hooks              │  │  UI Primitives (shadcn/ui)     │       │
│  │  - useTimer         │  │  - Button, Dialog, Card        │       │
│  │  - useClaudeEvents  │  │  - styled with Tailwind        │       │
│  └────────────────────┘  └────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────────┘
```

### 1.2 Component Hierarchy

```
App.tsx
├── AnimatePresence (view transitions)
│   ├── DarkStudioView          (phase: no_show)
│   ├── WritersRoomView         (phase: writers_room)
│   │   ├── EnergySelector      (step 1)
│   │   ├── PlanDumpTextarea    (step 2)
│   │   └── LineupPanel         (step 3)
│   │       └── ActCard[]
│   ├── GoingLiveTransition     (phase transition: writers_room → live)
│   ├── PillView                (isExpanded: false, phase: live/intermission/strike)
│   │   ├── TallyLight
│   │   └── BeatCounter
│   ├── ExpandedView            (isExpanded: true, phase: live)
│   │   ├── TimerPanel
│   │   │   ├── ClapperboardBadge
│   │   │   └── BeatCounter
│   │   ├── LineupPanel (sidebar)
│   │   │   └── ActCard[] (compact)
│   │   ├── OnAirIndicator
│   │   └── IntermissionView    (phase: intermission, rendered inline)
│   ├── DirectorMode            (phase: director, overlay)
│   ├── StrikeView              (phase: strike)
│   │   ├── ShowVerdict
│   │   └── BeatCounter
│   └── BeatCheckModal          (overlay, beatCheckPending: true)
```

### 1.3 Data Flow

```
User Action (click "End Act")
  → React event handler
    → showStore.completeAct(actId)
      → Zustand set() updates state
        → Subscribed components re-render
          → window.clui.notifyActComplete(actName)  [IPC to main]
            → Main process: native notification + sound
        → beatCheckPending: true triggers BeatCheckModal
          → User clicks "Lock the Beat"
            → showStore.lockBeat()
              → showStore.startAct(nextActId) [auto-advance]
```

---

## 2. State Machine Design

### 2.1 Show Phase State Machine

```
                    ┌──────────┐
                    │ no_show  │◄─────────────────────────────┐
                    └────┬─────┘                              │
                         │ enterWritersRoom()                 │ resetShow()
                         ▼                                    │
                    ┌──────────────┐                          │
                    │ writers_room │                           │
                    └────┬─────────┘                          │
                         │ startShow()                        │
                         ▼                                    │
                    ┌──────────┐ enterIntermission() ┌──────────────┐
              ┌────►│   live   │◄───────────────────►│ intermission │
              │     └──┬───┬───┘ exitIntermission()  └──────────────┘
              │        │   │
              │        │   │ enterDirector()
              │        │   ▼
              │        │ ┌──────────┐
              │        │ │ director │─── callShowEarly() ──┐
              │        │ └────┬─────┘                      │
              │        │      │ exitDirector()             │
              │        │      │ (skip/break/breathe)       │
              │        │◄─────┘                            │
              │        │                                   │
              │        │ strikeTheStage()                   │
              │        ▼                                   ▼
              │   ┌──────────┐                        ┌──────────┐
              │   │  strike  │                        │  strike  │
              │   └────┬─────┘                        └────┬─────┘
              │        │ resetShow()                       │
              │        ▼                                   │
              └────── no_show ◄────────────────────────────┘
```

**Phase transition guards:**

| Transition | Guard | Effect |
|---|---|---|
| `no_show → writers_room` | None | `enterWritersRoom()` |
| `writers_room → live` | `acts.length > 0` | `startShow()` — sets first act active, starts timer, collapses to pill |
| `live → intermission` | `currentActId !== null` | Pauses timer, stores remaining time |
| `intermission → live` | Always | Resumes timer from paused remaining |
| `live → director` | Always | `enterDirector()` |
| `director → live` | `exitDirector()` with skip/break action | Executes selected action |
| `director → strike` | `callShowEarly()` | Skips all remaining acts, computes verdict |
| `live → strike` | No upcoming acts remain | `strikeTheStage()` — computes verdict |
| `strike → no_show` | Always | `resetShow()` — clears all state |

### 2.2 Timer State

Timer state is derived, not stored as a separate machine. The store holds:

- `timerEndAt: number | null` — absolute timestamp when timer expires (null = no active timer)
- `timerPausedRemaining: number | null` — milliseconds remaining when paused (null = not paused)

Timer operations:

| Operation | Store mutation |
|---|---|
| Start | `timerEndAt = Date.now() + durationMs` |
| Tick | Derived in `useTimer()` hook — `remaining = timerEndAt - Date.now()` |
| Pause | `timerPausedRemaining = timerEndAt - Date.now(); timerEndAt = null` |
| Resume | `timerEndAt = Date.now() + timerPausedRemaining; timerPausedRemaining = null` |
| Extend | `timerEndAt += 15 * 60 * 1000` |
| Complete | `timerEndAt = null; timerPausedRemaining = null; beatCheckPending = true` |

### 2.3 Beat Tracking State

- `beatsLocked: number` — count of confirmed presence moments
- `beatThreshold: number` — win target (default 3, set by Claude per energy level)
- `beatCheckPending: boolean` — true when Beat Check modal should display (transient, not persisted)
- `acts[].beatLocked: boolean` — per-act Beat indicator

### 2.4 Zustand Store Interface (showStore)

The existing `showStore.ts` interface is nearly complete. The following additions are needed for v2:

```typescript
interface ShowStoreState {
  // Existing fields (keep all)
  phase: ShowPhase
  energy: EnergyLevel | null
  acts: Act[]
  currentActId: string | null
  beatsLocked: number
  beatThreshold: number
  timerEndAt: number | null
  timerPausedRemaining: number | null
  claudeSessionId: string | null
  showDate: string
  verdict: ShowVerdict | null
  isExpanded: boolean
  beatCheckPending: boolean

  // NEW: Going Live transition state
  goingLiveActive: boolean

  // NEW: Writer's Room step tracking
  writersRoomStep: 'energy' | 'plan' | 'lineup'

  // NEW: Writer's Room nudge timer
  writersRoomEnteredAt: number | null

  // NEW: Director Mode breathing pause
  breathingPauseEndAt: number | null
}

interface ShowActions {
  // Existing actions (keep all)
  // ... (as defined in current showStore.ts)

  // NEW actions
  enterWritersRoom: () => void
  setWritersRoomStep: (step: 'energy' | 'plan' | 'lineup') => void
  triggerGoingLive: () => void
  completeGoingLive: () => void
  startBreathingPause: () => void
  endBreathingPause: () => void
}
```

**New action implementations:**

```typescript
enterWritersRoom: () => set({
  phase: 'writers_room',
  writersRoomStep: 'energy',
  writersRoomEnteredAt: Date.now(),
}),

setWritersRoomStep: (step) => set({ writersRoomStep: step }),

triggerGoingLive: () => set({ goingLiveActive: true }),

completeGoingLive: () => {
  set({ goingLiveActive: false })
  get().startShow()
},

startBreathingPause: () => {
  const endAt = Date.now() + 5 * 60 * 1000 // 5 minutes
  set({
    phase: 'intermission',
    breathingPauseEndAt: endAt,
  })
},

endBreathingPause: () => set({
  breathingPauseEndAt: null,
}),
```

**Persistence partialize update** — exclude transient UI fields:

```typescript
partialize: (state) => {
  const {
    beatCheckPending: _bcp,
    goingLiveActive: _gla,
    ...rest
  } = state
  return rest
}
```

### 2.5 Updated ShowPhase Type

The `ShowPhase` type in `src/shared/types.ts` remains unchanged:

```typescript
export type ShowPhase = 'no_show' | 'writers_room' | 'live' | 'intermission' | 'director' | 'strike'
```

No new phases are needed. The `goingLiveActive` boolean on the store handles the Going Live transition overlay without adding a phase, since it is a transient visual state lasting 2-3 seconds.

---

## 3. Component Architecture

### 3.1 DarkStudioView (NEW)

**File:** `src/renderer/views/DarkStudioView.tsx`

**Purpose:** Empty stage view when no Show exists. Displays warm spotlight on near-black background with entry CTA.

**Props interface:**
```typescript
// No props — reads directly from showStore
```

**Store subscriptions:**
```typescript
const enterWritersRoom = useShowStore((s) => s.enterWritersRoom)
```

**shadcn/ui primitives:** `Button`

**Key Tailwind classes:**
```
Container:     min-h-screen bg-studio-bg flex flex-col items-center justify-center relative
Spotlight:     absolute inset-0 pointer-events-none
               (CSS: radial-gradient(ellipse 400px 350px at 50% 35%, rgba(217,119,87,0.06) 0%, transparent 70%))
Heading:       font-body text-2xl font-light text-txt-primary tracking-tight
Subtext:       font-body text-sm text-txt-muted mt-3
CTA Button:    mt-8 px-5 py-2.5 rounded-lg bg-accent/15 text-accent font-medium text-sm
               border border-accent/30 hover:bg-accent/25 transition-colors
```

**Framer Motion animations:**
```typescript
// Container entrance (spotlightFadeIn)
<motion.div
  initial={{ opacity: 0, filter: 'blur(8px)' }}
  animate={{ opacity: 1, filter: 'blur(0px)' }}
  transition={{ type: 'spring', stiffness: 80, damping: 20, duration: 2 }}
>

// CTA button entrance (delayed)
<motion.div
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 1.2 }}
>
```

**View dimensions:** Full window (expanded). On mount, calls `window.clui.setExpanded(true)` equivalent via store.

**Window resize:** On entering this view, resize window to 560x520 via `window.clui.resizeHeight(520)`.

---

### 3.2 WritersRoomView (REWRITE)

**File:** `src/renderer/views/WritersRoomView.tsx`

**Purpose:** 3-step guided planning flow: Energy Check → Plan Dump → Lineup Preview.

**Props interface:**
```typescript
// No props — reads from showStore
```

**Store subscriptions:**
```typescript
const phase = useShowStore((s) => s.phase)
const energy = useShowStore((s) => s.energy)
const writersRoomStep = useShowStore((s) => s.writersRoomStep)
const acts = useShowStore((s) => s.acts)
const setEnergy = useShowStore((s) => s.setEnergy)
const setWritersRoomStep = useShowStore((s) => s.setWritersRoomStep)
const setLineup = useShowStore((s) => s.setLineup)
const triggerGoingLive = useShowStore((s) => s.triggerGoingLive)
const writersRoomEnteredAt = useShowStore((s) => s.writersRoomEnteredAt)
```

**Internal state:**
```typescript
const [planText, setPlanText] = useState('')
const [isSubmitting, setIsSubmitting] = useState(false)
const [showNudge, setShowNudge] = useState(false) // After 20 minutes
```

**shadcn/ui primitives:** `Button`, `Card`

**Key Tailwind classes:**
```
Outer:         w-[560px] min-h-[680px] bg-surface rounded-xl overflow-hidden flex flex-col
Title bar:     bg-[#151517] px-5 py-3 flex items-center [-webkit-app-region:drag]
App name:      font-mono text-xs tracking-widest uppercase text-txt-muted
Step heading:  font-body text-xl font-semibold text-txt-primary
Spotlight:     absolute pointer-events-none
               (CSS: radial-gradient(ellipse at 50% 0%, rgba(217,119,87,0.05) 0%, transparent 70%))
Content:       px-8 py-8 flex-1 flex flex-col
Notepad BG:    bg-[#13130f] border border-[#2a2a24] rounded-lg
Notepad text:  font-body text-sm text-[#c8c6b8] placeholder:text-txt-muted
Nudge:         text-xs text-txt-muted mt-4 animate-breathe
```

**Framer Motion animations:**
```typescript
// Step transitions (slideUp)
<motion.div
  key={writersRoomStep}
  initial={{ opacity: 0, y: 12 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -12 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
>
```

**Sub-components rendered inline:**
- Step 1: `<EnergySelector />` — grid of 4 energy buttons
- Step 2: Notepad textarea + submit button (sends to Claude via sessionStore)
- Step 3: `<LineupPanel />` with Act cards + "WE'RE LIVE!" CTA

**Claude integration (Step 2 → Step 3):**
```typescript
// On plan submit:
const tab = useSessionStore.getState().tabs[0]
useSessionStore.getState().sendMessage(
  `[Energy: ${energy}] Plan my show: ${planText}`,
  // projectPath uses default
)
// Listen for showtime-lineup JSON in Claude response → setLineup()
```

**Window resize:** On mount, `window.clui.resizeHeight(680)` and `window.clui.setWindowWidth(560)`.

**20-minute nudge:** `useEffect` checks `writersRoomEnteredAt` and sets `showNudge = true` after 20 minutes.

---

### 3.3 GoingLiveTransition (NEW)

**File:** `src/renderer/views/GoingLiveTransition.tsx`

**Purpose:** 2-3 second cinematic transition when the Show goes live. ON AIR light ignites, date headline displays.

**Props interface:**
```typescript
interface GoingLiveTransitionProps {
  onComplete: () => void
}
```

**Store subscriptions:**
```typescript
const goingLiveActive = useShowStore((s) => s.goingLiveActive)
const completeGoingLive = useShowStore((s) => s.completeGoingLive)
```

**Key Tailwind classes:**
```
Container:     fixed inset-0 bg-studio-bg flex flex-col items-center justify-center z-50
ON AIR box:    See OnAirIndicator component (live state)
Headline:      font-body text-3xl font-extrabold text-txt-primary tracking-tight
               (format: "Live from your desk, it's {formattedDate}!")
Subtext:       font-body text-sm text-txt-secondary mt-2
```

**Spotlight gradient:**
```css
radial-gradient(ellipse 600px 400px at 50% 50%, rgba(217,119,87,0.08) 0%, transparent 70%)
```

**Framer Motion animations:**
```typescript
// ON AIR light: scale from 0 to 1 with spring
<motion.div
  initial={{ scale: 0, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
/>

// Headline: fade up
<motion.h1
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.8 }}
/>

// Auto-dismiss after ~2.5s
useEffect(() => {
  const timer = setTimeout(onComplete, 2500)
  return () => clearTimeout(timer)
}, [onComplete])
```

**View dimensions:** Full window height (400px). Renders as overlay.

---

### 3.4 PillView (REWRITE)

**File:** `src/renderer/views/PillView.tsx`

**Purpose:** Minimal 320x48 floating capsule showing current show status.

**Props interface:**
```typescript
// No props — reads from showStore
```

**Store subscriptions:**
```typescript
const phase = useShowStore((s) => s.phase)
const currentAct = useShowStore(selectCurrentAct)
const beatsLocked = useShowStore((s) => s.beatsLocked)
const beatThreshold = useShowStore((s) => s.beatThreshold)
const isExpanded = useShowStore((s) => s.isExpanded)
const toggleExpanded = useShowStore((s) => s.toggleExpanded)
```

**Hook usage:**
```typescript
const { minutes, seconds, isRunning } = useTimer()
const isUrgent = minutes < 5 && isRunning
```

**Key Tailwind classes:**
```
Pill container:  w-80 h-12 rounded-full flex items-center gap-3 py-2.5 px-4
                 bg-surface/85 backdrop-blur-[20px]
                 border border-white/[0.06]
                 shadow-[0_8px_32px_rgba(0,0,0,0.4)]
                 cursor-pointer select-none
                 [data-clui-ui]

Act name:        font-body text-sm font-medium text-txt-primary truncate flex-1
Timer:           font-mono text-sm font-semibold text-txt-primary tabular-nums
Timer (urgent):  text-beat animate-warm-pulse
Beat stars:      text-sm tracking-wider

// Intermission state
Intermission label: font-body text-sm text-txt-secondary
No rush:            font-body text-xs text-txt-muted

// Strike state
Strike label:    font-body text-sm text-txt-primary
Golden glow:     animate-golden-glow
```

**Contains:**
- `<TallyLight />` — 10px pulsing red dot (live), static gray (off)
- `<BeatCounter size="sm" />` — inline star display

**Framer Motion animations:**
```typescript
// Pill entrance from expanded collapse
<motion.div
  initial={{ scale: 0.8, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.8, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 400, damping: 30 }}
/>
```

**Click-through:** The pill is wrapped in `[data-clui-ui]` to participate in the click-through system defined in `App.tsx`. Transparent areas outside the pill allow click-through to desktop.

---

### 3.5 ExpandedView (REWRITE)

**File:** `src/renderer/views/ExpandedView.tsx`

**Purpose:** Full control room view during live show. Timer hero + lineup sidebar + bottom status bar.

**Props interface:**
```typescript
// No props
```

**Store subscriptions:**
```typescript
const phase = useShowStore((s) => s.phase)
const acts = useShowStore((s) => s.acts)
const currentAct = useShowStore(selectCurrentAct)
const beatsLocked = useShowStore((s) => s.beatsLocked)
const beatThreshold = useShowStore((s) => s.beatThreshold)
const toggleExpanded = useShowStore((s) => s.toggleExpanded)
const enterDirector = useShowStore((s) => s.enterDirector)
const enterIntermission = useShowStore((s) => s.enterIntermission)
```

**Layout structure (560x620):**
```
┌─────────────────────────────────────────────┐
│ Title Bar (44px)                             │ [-webkit-app-region: drag]
│  SHOWTIME    🎬 Director    ▼ Collapse       │
├──────────────────────────┬──────────────────┤
│ Timer Hero (main)        │ Lineup Sidebar   │
│                          │ (200px)          │
│  ┌─ ClapperboardBadge   │                  │
│  │  DEEP WORK | ACT 3   │  ● Act 1 ✅     │
│  │                       │  ● Act 2 ✅★    │
│  │  API Integration      │  ● Act 3 🔴     │
│  │                       │  ○ Act 4 ⏳     │
│  │     32:15             │  ○ Act 5 ⏳     │
│  │  ████████░░░░         │                  │
│  │                       │                  │
│  │  [+15m] [End Act] [⏸] │                  │
│  └───────────────────────│                  │
├──────────────────────────┴──────────────────┤
│ Bottom Bar (44px)                            │
│  [ON AIR] ●                    ★★☆ 2/3      │
└─────────────────────────────────────────────┘
```

**Key Tailwind classes:**
```
Outer:         w-[560px] min-h-[620px] bg-surface rounded-xl overflow-hidden flex flex-col
               [data-clui-ui]

Title bar:     bg-[#151517] px-5 py-3 flex items-center justify-between
               [-webkit-app-region:drag] border-b border-[#242428]
App name:      font-mono text-xs tracking-widest uppercase text-txt-muted
Director btn:  [-webkit-app-region:no-drag] px-3 py-1.5 rounded-lg
               bg-surface-hover text-txt-secondary text-sm font-medium
               hover:text-txt-primary
Collapse btn:  [-webkit-app-region:no-drag] ml-2 text-txt-muted hover:text-txt-secondary

Main content:  flex flex-1 overflow-hidden
Timer section: flex-1 px-8 py-8 flex flex-col
Sidebar:       w-[200px] border-l border-[#242428] px-3 py-3 overflow-y-auto

Bottom bar:    bg-[#151517] px-5 py-3 flex items-center justify-between
               border-t border-[#242428]
```

**Conditionally renders:**
- `<IntermissionView />` when `phase === 'intermission'` (replaces timer hero content)
- `<DirectorMode />` when `phase === 'director'` (as overlay)

**Contains:**
- `<TimerPanel />` in main content area
- `<LineupPanel variant="sidebar" />` in sidebar
- `<OnAirIndicator />` in bottom bar
- `<BeatCounter size="sm" />` in bottom bar

**Framer Motion animations:**
```typescript
// Expand from pill
<motion.div
  initial={{ scale: 0.9, opacity: 0, y: 20 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: 0.9, opacity: 0, y: 20 }}
  transition={{ type: 'spring', stiffness: 300, damping: 30 }}
/>
```

**Window resize:** On mount, `window.clui.resizeHeight(620)` and `window.clui.setWindowWidth(560)`.

---

### 3.6 TimerPanel (REWRITE)

**File:** `src/renderer/panels/TimerPanel.tsx`

**Purpose:** Hero countdown display with Act name, progress bar, and action buttons.

**Props interface:**
```typescript
// No props — reads from showStore via hook
```

**Store subscriptions:**
```typescript
const currentAct = useShowStore(selectCurrentAct)
const completeAct = useShowStore((s) => s.completeAct)
const extendAct = useShowStore((s) => s.extendAct)
const enterIntermission = useShowStore((s) => s.enterIntermission)
```

**Hook usage:**
```typescript
const { minutes, seconds, isRunning, progress } = useTimer()
const isUrgent = minutes < 5 && isRunning
```

**shadcn/ui primitives:** `Button`

**Key Tailwind classes:**
```
Container:       flex flex-col items-center

Clapperboard:    (see ClapperboardBadge component)

Act name:        font-body text-lg font-bold text-txt-primary mt-3

Timer digits:    font-mono text-[64px] font-bold text-txt-primary leading-none tracking-tight
                 tabular-nums
Timer (urgent):  text-beat animate-warm-pulse

Progress bar:
  Track:         w-full h-1 bg-surface-hover rounded-full mt-4 overflow-hidden
  Fill:          h-full rounded-full transition-all duration-1000
                 (background: linear gradient using category color)

Action buttons:  flex items-center gap-3 mt-6
  +15m:          px-4 py-2 rounded-lg bg-surface-hover text-txt-secondary
                 font-mono text-sm border border-[#333]
  End Act:       px-5 py-2.5 rounded-lg bg-accent/15 text-accent
                 font-medium text-sm border border-accent/30
  Rest:          px-4 py-2 rounded-lg bg-cat-deep/10 text-cat-deep
                 text-sm border border-cat-deep/25
```

**Framer Motion:** Timer digits use `AnimatePresence` for number transitions.

---

### 3.7 LineupPanel (REWRITE)

**File:** `src/renderer/panels/LineupPanel.tsx`

**Purpose:** Displays all Acts as a vertical list. Two variants: full cards (Writer's Room) and compact rows (sidebar).

**Props interface:**
```typescript
interface LineupPanelProps {
  variant: 'full' | 'sidebar'
}
```

**Store subscriptions:**
```typescript
const acts = useShowStore((s) => s.acts)
const currentActId = useShowStore((s) => s.currentActId)
const reorderAct = useShowStore((s) => s.reorderAct)
const removeAct = useShowStore((s) => s.removeAct)
```

**Key Tailwind classes:**
```
// Full variant (Writer's Room)
Container:      flex flex-col gap-3

// Sidebar variant (Expanded View)
Container:      flex flex-col gap-1
Section label:  font-mono text-[11px] font-normal tracking-[0.15em] uppercase text-txt-muted mb-2
```

**Renders:** `<ActCard>` for each act, passing `variant` prop.

**Framer Motion animations:**
```typescript
// Staggered slide-up for full cards
{acts.map((act, i) => (
  <motion.div
    key={act.id}
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ type: 'spring', stiffness: 300, damping: 30, delay: i * 0.08 }}
  >
    <ActCard act={act} variant={variant} />
  </motion.div>
))}
```

---

### 3.8 ActCard (REWRITE)

**File:** `src/renderer/components/ActCard.tsx`

**Purpose:** Individual Act item in the lineup. Full card for Writer's Room, compact row for sidebar.

**Props interface:**
```typescript
interface ActCardProps {
  act: Act
  variant: 'full' | 'sidebar'
  onReorder?: (direction: 'up' | 'down') => void
  onRemove?: () => void
}
```

**shadcn/ui primitives:** `Button` (icon variants for reorder/remove)

**Key Tailwind classes (full variant):**
```
Card:           flex items-center gap-3 p-3.5 rounded-lg bg-surface-hover
Drag handle:    text-txt-muted cursor-grab select-none
Category stripe: w-1 h-10 rounded-full (bg-cat-{sketch})
Content:        flex-1 min-w-0
Act name:       font-body text-sm font-medium text-txt-primary truncate
Badge area:     (ClapperboardBadge, 10px variant)
Duration:       font-mono text-xs text-txt-muted
Reorder btns:   flex flex-col gap-0.5
Arrow btn:      text-txt-muted hover:text-txt-secondary text-xs
Remove btn:     text-txt-muted hover:text-onair text-xs ml-2
```

**Key Tailwind classes (sidebar variant):**

| Status | Background | Border | Name style |
|---|---|---|---|
| `active` | `bg-{cat}/[0.08]` | `border border-{cat}/25` | `text-xs font-semibold text-txt-primary` |
| `completed` | `bg-green-500/[0.05]` | none | `text-xs font-medium text-txt-secondary` |
| `completed+beat` | `bg-green-500/[0.05]` | none | `text-xs font-medium text-txt-secondary` + gold star |
| `skipped` | none | none | `text-xs font-medium text-txt-muted line-through` |
| `upcoming` | none | none | `text-xs font-medium text-txt-muted opacity-60` |

```
Sidebar row:    flex items-center gap-2 p-2 rounded-md
Color bar:      w-6 h-0.5 rounded-full (bg-cat-{sketch})
Timer (sidebar): font-mono text-[10px] text-txt-muted
```

---

### 3.9 BeatCheckModal (REWRITE)

**File:** `src/renderer/components/BeatCheckModal.tsx`

**Purpose:** Post-Act presence check overlay. "Did you have a moment of presence?"

**Props interface:**
```typescript
// No props — reads from showStore
```

**Store subscriptions:**
```typescript
const beatCheckPending = useShowStore((s) => s.beatCheckPending)
const currentAct = useShowStore(selectCurrentAct)
const lockBeat = useShowStore((s) => s.lockBeat)
const skipBeat = useShowStore((s) => s.skipBeat)
```

**shadcn/ui primitives:** `Dialog` (for accessible modal), `Button`

**Key Tailwind classes:**
```
Scrim:          fixed inset-0 bg-black/75 backdrop-blur-[8px] z-50
                flex items-center justify-center

Card:           w-[380px] p-8 rounded-2xl bg-surface border border-[#2a2a2e]
                relative overflow-hidden

Spotlight:      absolute inset-0 pointer-events-none
                (CSS: radial-gradient(ellipse 300px 250px at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 70%))

Act name:       font-body text-lg font-bold text-txt-primary text-center
Badge:          (ClapperboardBadge with act info)
Question:       font-body text-sm text-txt-secondary text-center mt-4
                "Did you have a moment of presence?"

Lock btn:       w-full py-3.5 rounded-xl font-semibold text-base text-beat
                bg-gradient-to-br from-beat/20 to-beat/10
                border-[1.5px] border-beat/40
                shadow-[0_0_20px_rgba(245,158,11,0.1)]

Skip link:      font-body text-sm text-txt-muted hover:text-txt-secondary
                mt-4 text-center cursor-pointer
                "Not this time"
```

**Framer Motion animations:**
```typescript
// Card entrance
<motion.div
  initial={{ scale: 0.9, opacity: 0, y: 20 }}
  animate={{ scale: 1, opacity: 1, y: 0 }}
  exit={{ scale: 0.9, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
/>

// On "Lock the Beat" — flash golden before dismissing
// Trigger beatIgnite animation on the star, show "That moment was real." text
<motion.p
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ delay: 0.3 }}
  className="text-beat text-sm font-medium text-center mt-2"
>
  That moment was real.
</motion.p>
```

**Confirmation text on lock:** Display "That moment was real." for 1 second, then auto-dismiss and advance to next Act.

---

### 3.10 BeatCounter (REWRITE)

**File:** `src/renderer/components/BeatCounter.tsx`

**Purpose:** Gold/gray star display showing locked Beats vs threshold.

**Props interface:**
```typescript
interface BeatCounterProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'  // sm=14px, md=20px, lg=24px, xl=30px
  showLabel?: boolean                  // Show "2/3 Beats" text
  dimmed?: boolean                     // Intermission dimmed state (opacity: 0.35)
  justIgnitedIndex?: number | null     // Index of star to animate with beatIgnite
}
```

**Store subscriptions:**
```typescript
const beatsLocked = useShowStore((s) => s.beatsLocked)
const beatThreshold = useShowStore((s) => s.beatThreshold)
```

**Key Tailwind classes:**
```
Container:      inline-flex items-center gap-1
Stars:          tracking-wider

// Size mapping
sm:             text-sm
md:             text-xl
lg:             text-2xl
xl:             text-3xl

// Star states
Locked:         text-beat [text-shadow:0_0_8px_rgba(245,158,11,0.4)]
Unlocked:       text-txt-muted
Igniting:       animate-beat-ignite

// Label
Label:          font-mono text-xs text-txt-muted ml-2

// Dimmed (intermission)
Dimmed:         opacity-35
```

**Star characters:** Filled `\u2605` (&#9733;) for locked, outline `\u2606` (&#9734;) for unlocked.

---

### 3.11 EnergySelector (REWRITE)

**File:** `src/renderer/components/EnergySelector.tsx`

**Purpose:** 2x2 grid of energy level buttons for Writer's Room Step 1.

**Props interface:**
```typescript
interface EnergySelectorProps {
  onSelect: (level: EnergyLevel) => void
}
```

**Key Tailwind classes:**
```
Grid:           grid grid-cols-2 gap-3

Button base:    text-left p-4 rounded-lg border cursor-pointer
                transition-colors

// Per energy level:
High:           bg-[rgba(245,158,11,0.06)] border-[rgba(245,158,11,0.25)]
                hover:bg-[rgba(245,158,11,0.12)]
Medium:         bg-[rgba(34,197,94,0.06)] border-[rgba(34,197,94,0.25)]
                hover:bg-[rgba(34,197,94,0.12)]
Low:            bg-[rgba(96,165,250,0.06)] border-[rgba(96,165,250,0.25)]
                hover:bg-[rgba(96,165,250,0.12)]
Recovery:       bg-[rgba(139,92,246,0.06)] border-[rgba(139,92,246,0.25)]
                hover:bg-[rgba(139,92,246,0.12)]

Emoji:          text-2xl block mb-1
Label:          font-semibold text-sm  (colored per energy)
Sublabel:       text-xs text-txt-muted mt-1
```

**Energy level data:**

| Level | Emoji | Label | Sublabel | Color |
|---|---|---|---|---|
| High | `⚡` | High Energy | 8+ hours capacity | `#f59e0b` |
| Medium | `🌤` | Medium Energy | 6-8 hours capacity | `#22c55e` |
| Low | `🌙` | Low Energy | 4-6 hours capacity | `#60a5fa` |
| Recovery | `🛌` | Recovery Day | 2-4 hours, gentle only | `#8b5cf6` |

**Framer Motion:** Each button enters with staggered `slideUp` (delay: 0, 0.08, 0.16, 0.24).

---

### 3.12 IntermissionView (REWRITE + RENAME from RestAffirmation)

**File:** `src/renderer/components/IntermissionView.tsx`

**Delete:** `src/renderer/components/RestAffirmation.tsx`

**Purpose:** "WE'LL BE RIGHT BACK" rest screen with rotating affirmations and no timer pressure.

**Props interface:**
```typescript
// No props — reads from showStore
```

**Store subscriptions:**
```typescript
const phase = useShowStore((s) => s.phase)
const exitIntermission = useShowStore((s) => s.exitIntermission)
const beatsLocked = useShowStore((s) => s.beatsLocked)
const beatThreshold = useShowStore((s) => s.beatThreshold)
```

**Key Tailwind classes:**
```
Container:      flex-1 flex flex-col items-center justify-center px-8 py-10
                (background: linear-gradient(180deg, #1a1a1e 0%, #1e1c1a 100%))

Card:           max-w-[380px] p-8 rounded-xl bg-surface border border-[#2a2a2e]
                text-center

Heading:        font-mono text-xs tracking-[0.15em] uppercase text-txt-muted mb-6
                "INTERMISSION"

Main text:      font-body text-2xl font-light text-txt-primary
                "WE'LL BE RIGHT BACK"

Affirmation:    font-body text-sm text-txt-secondary mt-6 animate-breathe
                (randomly selected from library)

Beat counter:   mt-6 opacity-35
                (BeatCounter dimmed=true)

Resume btn:     mt-8 px-5 py-2.5 rounded-lg bg-accent/15 text-accent
                font-medium text-sm border border-accent/30
                "Back to the show"
```

**Affirmation library (rotate randomly on mount):**
```typescript
const AFFIRMATIONS = [
  "Rest is free. Always has been.",
  "The stage will be here when you're ready.",
  "No clock. No pressure. Just breathe.",
  "Intermission is part of the show.",
  "The audience can wait.",
  "You've earned this pause.",
  "The best performers know when to rest.",
]
```

**Framer Motion:**
```typescript
// breathe animation on affirmation text
<motion.p
  animate={{ opacity: [0.6, 1, 0.6] }}
  transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
/>
```

**Renders inside ExpandedView** when `phase === 'intermission'`, replacing the timer hero section. The sidebar remains visible but dimmed.

---

### 3.13 DirectorMode (REWRITE)

**File:** `src/renderer/components/DirectorMode.tsx`

**Purpose:** Overwhelm handler overlay with four compassionate options.

**Props interface:**
```typescript
// No props — reads from showStore
```

**Store subscriptions:**
```typescript
const phase = useShowStore((s) => s.phase)
const exitDirector = useShowStore((s) => s.exitDirector)
const skipAct = useShowStore((s) => s.skipAct)
const currentActId = useShowStore((s) => s.currentActId)
const callShowEarly = useShowStore((s) => s.callShowEarly)
const enterIntermission = useShowStore((s) => s.enterIntermission)
const startBreathingPause = useShowStore((s) => s.startBreathingPause)
```

**shadcn/ui primitives:** `Dialog`, `Button`

**Key Tailwind classes:**
```
Scrim:          fixed inset-0 bg-black/80 backdrop-blur-[12px] z-50
                flex items-center justify-center

Card:           w-[420px] p-8 rounded-2xl bg-surface border border-[#2a2a2e]

Heading:        font-body text-xl font-semibold text-txt-primary mb-2
                "The Director is here."
Subtext:        font-body text-sm text-txt-secondary mb-6
                "What's the call?"

Option btns:    flex flex-col gap-3 w-full
Option:         text-left p-4 rounded-lg border border-[#333] bg-surface-hover
                hover:border-accent/30 transition-colors cursor-pointer
Option label:   font-body text-sm font-medium text-txt-primary
Option desc:    font-body text-xs text-txt-muted mt-1
```

**Options data:**

| Label | Description | Action |
|---|---|---|
| "Skip to next Act" | "Rearrange what's left" | `skipAct(currentActId); exitDirector()` |
| "Call the show early" | "Wrap it up — no judgment" | `callShowEarly()` |
| "Take a longer break" | "Extended intermission" | `enterIntermission(); exitDirector()` |
| "I just need a moment" | "5-minute breathing pause" | `startBreathingPause(); exitDirector()` |

**No confirmation dialogs.** Each option executes immediately on click.

**Framer Motion:**
```typescript
<motion.div
  initial={{ scale: 0.95, opacity: 0 }}
  animate={{ scale: 1, opacity: 1 }}
  exit={{ scale: 0.95, opacity: 0 }}
  transition={{ type: 'spring', stiffness: 300, damping: 25 }}
/>
```

---

### 3.14 ShowVerdict (REWRITE)

**File:** `src/renderer/components/ShowVerdict.tsx`

**Purpose:** Verdict card displayed in StrikeView with headline, message, and color treatment.

**Props interface:**
```typescript
interface ShowVerdictProps {
  verdict: ShowVerdict
  beatsLocked: number
  beatThreshold: number
}
```

**Verdict configurations:**

| Verdict | Headline | Color | Message | Animation |
|---|---|---|---|---|
| `DAY_WON` | "DAY WON." | `#f59e0b` | "Standing ovation. You showed up and you were present." | `goldenGlow` on headline + stars |
| `SOLID_SHOW` | "SOLID SHOW." | `#d97757` | "Not every sketch lands. The show was still great." | Warm accent glow |
| `GOOD_EFFORT` | "GOOD EFFORT." | `#60a5fa` | "You got on stage. That's the hardest part." | Calm blue tones |
| `SHOW_CALLED_EARLY` | "SHOW CALLED EARLY." | `#9a9890` | "Sometimes the show is short. The audience still came." | Neutral, warm |

**Key Tailwind classes:**
```
Container:      text-center py-8

Headline:       font-body text-5xl font-black tracking-wide
                (color set per verdict)
                DAY_WON: animate-golden-glow

Message:        font-body text-sm text-txt-secondary mt-4

Beat stars:     mt-6 (BeatCounter size="xl")

// DAY WON spotlight
Spotlight:      absolute inset-0 pointer-events-none
                (CSS: radial-gradient(ellipse 500px 300px at 50% 30%, rgba(245,158,11,0.06) 0%, transparent 70%))
```

---

### 3.15 StrikeView (REWRITE)

**File:** `src/renderer/views/StrikeView.tsx`

**Purpose:** End-of-day curtain call. Verdict + stats + act recap + actions.

**Props interface:**
```typescript
// No props — reads from showStore
```

**Store subscriptions:**
```typescript
const verdict = useShowStore((s) => s.verdict)
const acts = useShowStore((s) => s.acts)
const beatsLocked = useShowStore((s) => s.beatsLocked)
const beatThreshold = useShowStore((s) => s.beatThreshold)
const completedActs = useShowStore(selectCompletedActs)
const skippedActs = useShowStore(selectSkippedActs)
const resetShow = useShowStore((s) => s.resetShow)
const setExpanded = useShowStore((s) => s.setExpanded)
```

**shadcn/ui primitives:** `Button`, `Card`

**Key Tailwind classes:**
```
Outer:          w-[560px] bg-surface rounded-xl overflow-hidden flex flex-col
                [data-clui-ui]

Title bar:      bg-[#151517] px-5 py-3 [-webkit-app-region:drag]
                border-b border-[#242428]
                (OnAirIndicator in OFF state)

Content:        px-8 py-10 flex-1 overflow-y-auto

Verdict:        (ShowVerdict component)

Stats row:      flex justify-center gap-8 mt-8
Stat:           text-center
Stat number:    font-mono text-3xl font-bold text-txt-primary
Stat label:     font-mono text-[11px] tracking-[0.15em] uppercase text-txt-muted mt-1

Recap panel:    mt-8 p-4 rounded-lg bg-[#151517]
Recap heading:  font-mono text-[11px] tracking-[0.15em] uppercase text-txt-muted mb-3
Recap row:      flex items-center gap-3 py-2 border-b border-[#1e1e22] last:border-0
Recap act name: font-body text-sm text-txt-secondary flex-1
Recap status:   font-mono text-[10px] uppercase text-txt-muted

Action btns:    flex gap-3 mt-8 justify-center
New Show btn:   px-5 py-2.5 rounded-lg bg-accent/15 text-accent
                font-medium text-sm border border-accent/30
Close btn:      px-4 py-2 rounded-lg bg-surface-hover text-txt-secondary
                text-sm border border-[#333]
```

**Stats displayed:**
1. Acts Completed — `completedActs.length`
2. Acts Cut — `skippedActs.length`
3. Beats Locked — `beatsLocked`

**Framer Motion:** Staggered entrance for stats (delay 0.2 each), recap rows (delay 0.05 each).

**Window resize:** Variable height based on number of acts. Min 560px.

---

### 3.16 OnAirIndicator (NEW)

**File:** `src/renderer/components/OnAirIndicator.tsx`

**Purpose:** Broadcast-style "ON AIR" / "OFF" box with tally dot and pulsing glow.

**Props interface:**
```typescript
interface OnAirIndicatorProps {
  isLive: boolean
}
```

**Key Tailwind classes:**
```
Container:      inline-flex items-center gap-[5px] rounded px-2 py-[2px]
                font-mono text-[10px] font-bold tracking-[0.12em]

// Live state
Live:           text-onair border-[1.5px] border-onair animate-onair-glow
Live tally:     w-1.5 h-1.5 rounded-full bg-onair animate-tally-pulse

// Off state
Off:            text-[#3a3a3e] border-[1.5px] border-[#3a3a3e]
Off tally:      w-1.5 h-1.5 rounded-full bg-[#3a3a3e]
```

**Text content:** Always reads "ON AIR" in both states (industry convention — the light itself indicates status, not the text).

---

### 3.17 TallyLight (NEW)

**File:** `src/renderer/components/TallyLight.tsx`

**Purpose:** Pulsing red dot indicating a live session.

**Props interface:**
```typescript
interface TallyLightProps {
  isLive: boolean
  size?: 'sm' | 'md' | 'lg'  // sm=6px, md=8px, lg=10px
}
```

**Key Tailwind classes:**
```
// Size mapping
sm:             w-1.5 h-1.5
md:             w-2 h-2
lg:             w-2.5 h-2.5

Base:           rounded-full

// Live
Live:           bg-onair animate-tally-pulse

// Off
Off:            bg-[#3a3a3e]
```

**CSS animation (registered in Tailwind):**
```css
@keyframes tallyPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px 2px rgba(239,68,68,0.6); }
  50%      { opacity: 0.4; box-shadow: 0 0 2px 1px rgba(239,68,68,0.2); }
}
```

---

### 3.18 ClapperboardBadge (NEW)

**File:** `src/renderer/components/ClapperboardBadge.tsx`

**Purpose:** Category + act number label styled as a film clapperboard slate.

**Props interface:**
```typescript
interface ClapperboardBadgeProps {
  sketch: string          // Category name (e.g., "Deep Work")
  actNumber: number
  duration?: string       // Optional, e.g., "45:00"
  status?: 'active' | 'complete'  // Optional override text
  size?: 'sm' | 'md'     // sm=10px, md=11px
}
```

**Key Tailwind classes:**
```
Container:      inline-flex items-center gap-1.5 rounded px-2.5 py-[3px]
                font-mono font-semibold uppercase tracking-[0.08em]

// Size mapping
sm:             text-[10px]
md:             text-[11px]

// Border + text use category color
// e.g., Deep Work: text-cat-deep border-cat-deep/40
Border:         border-[1.5px]

Pipe divider:   opacity-40
```

**Content pattern:** `{CATEGORY} | ACT {N}` or `{CATEGORY} | ACT {N} | {DURATION}` or `{CATEGORY} | ACT {N} | COMPLETE`

**Category color mapping:**
```typescript
const CATEGORY_COLORS: Record<string, string> = {
  'Deep Work':  'cat-deep',
  'Exercise':   'cat-exercise',
  'Admin':      'cat-admin',
  'Creative':   'cat-creative',
  'Social':     'cat-social',
}
```

Falls back to `accent` color for unknown categories.

---

## 4. IPC Bridge Updates

### 4.1 New IPC Channels

Add to `src/shared/types.ts` IPC constant:

```typescript
export const IPC = {
  // ... existing channels ...

  // NEW: Showtime window management
  SET_VIEW_MODE: 'showtime:set-view-mode',       // renderer → main: 'pill' | 'expanded' | 'full'
  REGISTER_HOTKEY: 'showtime:register-hotkey',    // renderer → main: register Alt+Space toggle

  // NEW: Showtime notification triggers (already exist, verify handlers)
  NOTIFY_ACT_COMPLETE: 'showtime:notify-act-complete',   // EXISTS
  NOTIFY_BEAT_CHECK: 'showtime:notify-beat-check',       // EXISTS
  NOTIFY_VERDICT: 'showtime:notify-verdict',             // EXISTS

  // NEW: Day boundary detection
  DAY_BOUNDARY: 'showtime:day-boundary',          // main → renderer: midnight crossed
} as const
```

### 4.2 CluiAPI Interface Updates

Add to `src/preload/index.ts`:

```typescript
export interface CluiAPI {
  // ... existing methods ...

  // NEW: Showtime window management
  setViewMode(mode: 'pill' | 'expanded' | 'full'): void
  onDayBoundary(callback: () => void): () => void
}
```

**Implementation:**

```typescript
setViewMode: (mode) => ipcRenderer.send(IPC.SET_VIEW_MODE, mode),

onDayBoundary: (callback) => {
  const handler = () => callback()
  ipcRenderer.on(IPC.DAY_BOUNDARY, handler)
  return () => ipcRenderer.removeListener(IPC.DAY_BOUNDARY, handler)
},
```

### 4.3 Main Process: setViewMode Handler

In `src/main/index.ts`, add handler that adjusts window dimensions:

```typescript
ipcMain.on(IPC.SET_VIEW_MODE, (_event, mode: 'pill' | 'expanded' | 'full') => {
  if (!mainWindow) return
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width: sw, height: sh } = display.workAreaSize
  const { x: dx, y: dy } = display.workArea

  switch (mode) {
    case 'pill':
      // Current behavior: large transparent window, UI renders pill internally
      // No native resize needed — the pill is CSS-sized within the existing window
      break
    case 'expanded':
    case 'full':
      // Window stays at BAR_WIDTH x PILL_HEIGHT — all sizing is CSS within the renderer
      // The transparent window approach means we don't resize natively
      break
  }
})
```

> **Note:** The existing architecture uses a single large transparent window (1040x720) positioned at screen bottom. The pill/expanded distinction is entirely CSS within the renderer. This avoids native resize animation conflicts. We keep this approach for v2.

### 4.4 Main Process: Day Boundary Detection

```typescript
// In createWindow() or app.whenReady():
function startDayBoundaryCheck(): void {
  let currentDay = new Date().toISOString().slice(0, 10)
  setInterval(() => {
    const now = new Date().toISOString().slice(0, 10)
    if (now !== currentDay) {
      currentDay = now
      broadcast(IPC.DAY_BOUNDARY)
    }
  }, 60_000) // Check every minute
}
```

### 4.5 Main Process: Notification Handlers

Verify/update the existing notification handlers in `src/main/index.ts`:

```typescript
ipcMain.on(IPC.NOTIFY_ACT_COMPLETE, (_event, actName: string) => {
  new Notification({ title: 'Act Complete', body: `${actName} — time for a Beat check!` }).show()
})

ipcMain.on(IPC.NOTIFY_BEAT_CHECK, () => {
  // Play notification sound
  // Sound is optional — the modal itself is the primary signal
})

ipcMain.on(IPC.NOTIFY_VERDICT, (_event, verdict: string) => {
  const messages: Record<string, string> = {
    DAY_WON: 'Standing ovation! You showed up and you were present.',
    SOLID_SHOW: 'Not every sketch lands. The show was still great.',
    GOOD_EFFORT: 'You got on stage. That\'s the hardest part.',
    SHOW_CALLED_EARLY: 'A short show is still a show.',
  }
  new Notification({ title: 'Show Complete', body: messages[verdict] || 'The show is over.' }).show()
})
```

### 4.6 Global Hotkey (Alt+Space)

```typescript
// In app.whenReady():
globalShortcut.register('Alt+Space', () => {
  if (mainWindow?.isVisible()) {
    // Toggle expanded state by broadcasting to renderer
    broadcast('showtime:toggle-expanded')
  } else {
    showWindow('hotkey')
  }
})
```

Add to preload:
```typescript
onToggleExpanded: (callback) => {
  const handler = () => callback()
  ipcRenderer.on('showtime:toggle-expanded', handler)
  return () => ipcRenderer.removeListener('showtime:toggle-expanded', handler)
},
```

---

## 5. Window Configuration

### 5.1 BrowserWindow Settings

The existing `createWindow()` in `src/main/index.ts` is already configured correctly. Key settings to verify/maintain:

```typescript
mainWindow = new BrowserWindow({
  width: 1040,           // BAR_WIDTH — wide enough for expanded + breathing room
  height: 720,           // PILL_HEIGHT — tall enough for all views
  type: 'panel',         // NSPanel — non-activating, visible on all spaces
  frame: false,
  transparent: true,
  resizable: false,
  movable: true,
  alwaysOnTop: true,
  skipTaskbar: true,
  hasShadow: false,
  roundedCorners: true,
  backgroundColor: '#00000000',
  show: false,
  webPreferences: {
    preload: join(__dirname, '../preload/index.js'),
    contextIsolation: true,
    nodeIntegration: false,
  },
})

// Traffic light positioning
mainWindow.setWindowButtonPosition({ x: 12, y: 14 })

// Visible on all workspaces
mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
mainWindow.setAlwaysOnTop(true, 'screen-saver')
```

**Missing from current config:** `vibrancy` and `visualEffectState` are not set in the current `createWindow()`. These must be added for Req 1:

```typescript
// ADD to BrowserWindow options:
vibrancy: 'under-window',
visualEffectState: 'active',
titleBarStyle: 'hiddenInset',  // ADD — enables native traffic lights
```

> **Important:** `titleBarStyle: 'hiddenInset'` and `frame: false` may conflict. Since we use `frame: false` (fully frameless), traffic lights are not shown by Electron. We render custom traffic-light-style window controls in React if needed, or switch to `titleBarStyle: 'hiddenInset'` with `frame` removed. For MLP, we keep `frame: false` and handle all chrome in React.

### 5.2 Window Positioning

The window is positioned at the bottom-center of the active display:

```
Screen work area:  (dx, dy, sw, sh)
Window x:          dx + (sw - 1040) / 2
Window y:          dy + sh - 720 - 24   // 24px bottom margin
```

All view sizing (pill 320x48, expanded 560x620, etc.) is handled in CSS within this fixed native window. The transparent background makes non-UI areas click-through.

### 5.3 Click-Through Behavior

The existing `App.tsx` click-through system works as follows:

1. On `ready-to-show`, window starts with `setIgnoreMouseEvents(true, { forward: true })`
2. `mousemove` events still fire in the renderer (via `forward: true`)
3. `App.tsx` checks `document.elementFromPoint()` for `[data-clui-ui]` ancestors
4. If cursor is over UI: `setIgnoreMouseEvents(false)` — clicks hit the app
5. If cursor is over transparent area: `setIgnoreMouseEvents(true, { forward: true })` — clicks pass through

**All Showtime views and the pill must include `data-clui-ui` attribute** on their outermost interactive container.

---

## 6. Tailwind Configuration

### 6.1 CSS-First Configuration (Tailwind v4)

**File:** `src/renderer/index.css` (or `src/renderer/styles/globals.css`)

```css
@import "tailwindcss";

/* ─── Google Fonts (loaded via <link> in index.html) ─── */

/* ─── Design Tokens (@theme) ─── */
@theme {
  /* Backgrounds */
  --color-studio-bg: #0d0d0f;
  --color-surface: #1a1a1e;
  --color-surface-hover: #242428;
  --color-titlebar: #151517;
  --color-notepad-bg: #13130f;
  --color-notepad-header: #1a1a14;
  --color-notepad-border: #2a2a24;

  /* Text */
  --color-txt-primary: #e8e6e0;
  --color-txt-secondary: #9a9890;
  --color-txt-muted: #5a5855;
  --color-notepad-text: #c8c6b8;

  /* Accents */
  --color-accent: #d97757;
  --color-accent-dark: #c4613e;
  --color-onair: #ef4444;
  --color-beat: #f59e0b;
  --color-beat-light: #fbbf24;

  /* Status */
  --color-off: #3a3a3e;
  --color-border-default: #333333;
  --color-divider: #242428;
  --color-card-border: #2a2a2e;

  /* Category colors */
  --color-cat-deep: #8b5cf6;
  --color-cat-exercise: #22c55e;
  --color-cat-admin: #60a5fa;
  --color-cat-creative: #f59e0b;
  --color-cat-social: #ec4899;

  /* Typography */
  --font-mono: 'JetBrains Mono', monospace;
  --font-body: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;

  /* Custom animation durations */
  --animate-tally-pulse: tallyPulse 2s ease-in-out infinite;
  --animate-onair-glow: onairGlow 2s ease-in-out infinite;
  --animate-breathe: breathe 4s ease-in-out infinite;
  --animate-beat-ignite: beatIgnite 0.6s ease-out forwards;
  --animate-warm-pulse: warmPulse 2s ease-in-out infinite;
  --animate-golden-glow: goldenGlow 3s ease-in-out infinite;
  --animate-slide-up: slideUp 0.5s ease-out forwards;
}

/* ─── Keyframes ─── */

@keyframes tallyPulse {
  0%, 100% { opacity: 1; box-shadow: 0 0 6px 2px rgba(239,68,68,0.6); }
  50%      { opacity: 0.4; box-shadow: 0 0 2px 1px rgba(239,68,68,0.2); }
}

@keyframes onairGlow {
  0%, 100% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.5), inset 0 0 4px rgba(239,68,68,0.2); }
  50%      { box-shadow: 0 0 16px 4px rgba(239,68,68,0.8), inset 0 0 8px rgba(239,68,68,0.3); }
}

@keyframes breathe {
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
}

@keyframes beatIgnite {
  0%   { color: #5a5855; text-shadow: none; }
  50%  { color: #fbbf24; text-shadow: 0 0 20px rgba(245,158,11,0.8); }
  100% { color: #f59e0b; text-shadow: 0 0 8px rgba(245,158,11,0.4); }
}

@keyframes warmPulse {
  0%, 100% { opacity: 0.8; }
  50%      { opacity: 1; }
}

@keyframes goldenGlow {
  0%, 100% { text-shadow: 0 0 30px rgba(245,158,11,0.3); }
  50%      { text-shadow: 0 0 60px rgba(245,158,11,0.6), 0 0 100px rgba(245,158,11,0.2); }
}

@keyframes slideUp {
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
}

/* ─── Global Styles ─── */

html, body, #root {
  background-color: transparent;
  margin: 0;
  padding: 0;
  overflow: hidden;
  font-family: var(--font-body);
  color: var(--color-txt-primary);
  -webkit-font-smoothing: antialiased;
}

/* Custom scrollbar */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: #444; }
```

### 6.2 Font Imports

In `src/renderer/index.html`:

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet">
```

> **Alternative for offline use:** Bundle the font files in `resources/fonts/` and use `@font-face` declarations in the CSS. This is preferred for the packaged Electron app since it eliminates network dependency.

### 6.3 Vite Plugin Configuration

In `electron.vite.config.ts`, ensure the Tailwind Vite plugin is loaded only for the renderer:

```typescript
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  renderer: {
    plugins: [
      react(),
      tailwindcss(),
    ],
    // ...
  },
  // main and preload do NOT include tailwindcss plugin
})
```

### 6.4 Source Detection

Tailwind v4 auto-detects source files. Ensure it only scans `src/renderer/`:

```css
/* At top of index.css, if needed: */
@source "../renderer";
```

This prevents Tailwind from scanning `src/main/` or `src/preload/` for class usage, which would cause unnecessary recompilation.

---

## 7. shadcn/ui Setup

### 7.1 Components to Install

```bash
npx shadcn@latest init    # Initialize with New York style, neutral palette
npx shadcn@latest add button
npx shadcn@latest add dialog
npx shadcn@latest add card
npx shadcn@latest add input
npx shadcn@latest add textarea
npx shadcn@latest add progress
```

These install to `src/renderer/ui/` (configure via `components.json`).

### 7.2 components.json Configuration

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/renderer/index.css",
    "baseColor": "neutral",
    "cssVariables": true
  },
  "aliases": {
    "components": "src/renderer/ui",
    "utils": "src/renderer/lib/utils"
  }
}
```

### 7.3 Custom Variants Needed

**Button variants** (extend shadcn/ui Button):

```typescript
// src/renderer/ui/button.tsx — add these variants
const buttonVariants = cva('...', {
  variants: {
    variant: {
      // Existing: default, destructive, outline, secondary, ghost, link
      // NEW:
      primary: 'w-full py-4 rounded-xl bg-gradient-to-br from-accent to-accent-dark text-white font-bold text-base tracking-wide shadow-[0_0_30px_rgba(217,119,87,0.3),0_4px_20px_rgba(0,0,0,0.4)]',
      accent: 'px-5 py-2.5 rounded-lg bg-accent/15 text-accent font-medium text-sm border border-accent/30 hover:bg-accent/25',
      beat: 'px-5 py-2.5 rounded-lg bg-beat/15 text-beat font-medium text-sm border border-beat/30 hover:bg-beat/25',
      'beat-large': 'w-full py-3.5 rounded-xl bg-gradient-to-br from-beat/20 to-beat/10 text-beat font-semibold text-base border-[1.5px] border-beat/40 shadow-[0_0_20px_rgba(245,158,11,0.1)]',
      neutral: 'px-4 py-2 rounded-lg bg-surface-hover text-txt-secondary font-mono text-sm border border-border-default',
      ghost_muted: 'text-txt-muted hover:text-txt-secondary text-sm',
    },
  },
})
```

### 7.4 Theme Integration

shadcn/ui components use CSS variables. Override the default shadcn variables with our design tokens:

```css
/* In index.css, after @theme block: */
:root {
  --background: var(--color-studio-bg);
  --foreground: var(--color-txt-primary);
  --card: var(--color-surface);
  --card-foreground: var(--color-txt-primary);
  --popover: var(--color-surface);
  --popover-foreground: var(--color-txt-primary);
  --primary: var(--color-accent);
  --primary-foreground: #ffffff;
  --secondary: var(--color-surface-hover);
  --secondary-foreground: var(--color-txt-secondary);
  --muted: var(--color-surface-hover);
  --muted-foreground: var(--color-txt-muted);
  --accent: var(--color-accent);
  --accent-foreground: #ffffff;
  --destructive: var(--color-onair);
  --destructive-foreground: #ffffff;
  --border: var(--color-border-default);
  --input: var(--color-border-default);
  --ring: var(--color-accent);
  --radius: 0.5rem;
}
```

---

## 8. Testing Strategy

### 8.1 Playwright E2E Test Structure

**Directory:** `e2e/`

**Config:** `playwright.config.ts` (already exists)

```
e2e/
├── app-launch.spec.ts           # App starts, Dark Studio visible
├── dark-studio.spec.ts          # Dark Studio view, CTA, spotlight animation
├── writers-room.spec.ts         # Energy → Plan → Lineup → "WE'RE LIVE!"
├── going-live.spec.ts           # Going Live transition, ON AIR light
├── pill-view.spec.ts            # Pill displays, act name, timer, beats
├── expanded-view.spec.ts        # Timer, lineup sidebar, action buttons
├── act-timer.spec.ts            # Countdown, +15m extend, amber warning
├── beat-check.spec.ts           # Beat Check modal, lock/skip
├── intermission.spec.ts         # Rest flow, affirmation, resume
├── director-mode.spec.ts        # All four options
├── strike.spec.ts               # All four verdicts, stats, recap
├── pill-expanded-toggle.spec.ts # Pill ↔ Expanded transitions
└── day-boundary.spec.ts         # Midnight crossing reset
```

**Key test scenarios:**

| Test | Steps | Assertions |
|---|---|---|
| Full show flow | Launch → Dark Studio → Writer's Room → Energy: High → Plan → Lineup → "WE'RE LIVE!" → Complete Act → Lock Beat → Strike | Verdict = DAY_WON or appropriate |
| Beat Check lock | Complete an act → Modal appears → Click "Lock the Beat" | `beatsLocked` increments, star turns gold |
| Beat Check skip | Complete an act → Modal appears → Click "Not this time" | `beatsLocked` unchanged, next act starts |
| Intermission | During live act → Click "Rest" → See "WE'LL BE RIGHT BACK" → Click "Back to the show" | Timer resumes from paused value |
| Director: call show | During live → Director Mode → "Call the show early" | Phase = strike, verdict = SHOW_CALLED_EARLY |
| Director: skip act | During live → Director Mode → "Skip to next Act" | Current act skipped, next act starts |
| Pill ↔ Expanded | Live show → Click pill → Expanded view → Click collapse → Pill view | Window content matches expected state |

**Playwright Electron launch:**
```typescript
import { _electron as electron } from 'playwright'

const app = await electron.launch({ args: ['.'] })
const page = await app.firstWindow()
```

### 8.2 Vitest Unit Test Targets

**Directory:** `src/__tests__/`

```
src/__tests__/
├── stores/
│   ├── showStore.test.ts        # State machine transitions, guards, verdict computation
│   └── sessionStore.test.ts     # Simplified session management
├── hooks/
│   └── useTimer.test.ts         # Timer countdown, pause/resume, extend
├── components/
│   ├── BeatCounter.test.ts      # Star rendering, dimmed state
│   ├── ClapperboardBadge.test.ts # Category color mapping, content patterns
│   └── OnAirIndicator.test.ts   # Live/off states
└── utils/
    └── verdictLogic.test.ts     # Verdict computation edge cases
```

**showStore tests should cover:**
- Phase transitions (all valid transitions succeed, invalid transitions rejected)
- `startShow()` guard: fails if no acts
- `completeAct()` sets `beatCheckPending: true`
- `lockBeat()` increments `beatsLocked` and auto-advances
- `skipBeat()` auto-advances without incrementing
- `enterIntermission()` correctly stores remaining time
- `exitIntermission()` correctly resumes timer
- `callShowEarly()` skips all remaining acts
- `strikeTheStage()` computes correct verdict for all threshold scenarios
- `resetShow()` returns to initial state
- Day boundary detection resets state
- Persistence: state survives hydration

**useTimer tests should cover:**
- Correct MM:SS formatting
- `isRunning` is true when `timerEndAt` is set and future
- `progress` computes correctly (0 at start, 1 at end)
- Timer completes and calls `completeAct()`
- Extending adds 15 minutes to remaining

### 8.3 Visual Regression

For MLP, visual regression is not in scope. The strategy for post-MLP:

- Use Playwright `page.screenshot()` for key states
- Compare against baseline screenshots stored in `.loki/` (Loki visual regression tool, already has directory)
- Key screenshot states: Dark Studio, Writer's Room each step, Pill (live), Expanded (live), Beat Check, Intermission, Director Mode, Strike (each verdict)

---

## 9. Migration Plan

### 9.1 Order of Implementation

The migration is structured in layers. Each layer is independently testable.

**Layer 0: Foundation (no visual changes)**
1. Install and configure Tailwind CSS v4 (`@tailwindcss/vite` plugin, `index.css` with `@theme`)
2. Install and configure shadcn/ui (`components.json`, Button, Dialog, Card)
3. Add font imports (JetBrains Mono, Inter) to `index.html`
4. Create `src/renderer/index.css` with all design tokens and keyframe animations
5. Update `electron.vite.config.ts` to include Tailwind plugin for renderer only

**Layer 1: Store Updates (no visual changes)**
1. Add new fields to `showStore.ts`: `goingLiveActive`, `writersRoomStep`, `writersRoomEnteredAt`, `breathingPauseEndAt`
2. Add new actions: `enterWritersRoom`, `setWritersRoomStep`, `triggerGoingLive`, `completeGoingLive`, `startBreathingPause`, `endBreathingPause`
3. Update persistence `partialize` to exclude new transient fields
4. Write Vitest tests for all new store logic

**Layer 2: Atomic Components (NEW, no migration needed)**
1. `TallyLight` — standalone, no dependencies
2. `OnAirIndicator` — depends on TallyLight
3. `ClapperboardBadge` — standalone
4. `BeatCounter` — reads from showStore
5. `EnergySelector` — standalone with callback

**Layer 3: Views (REWRITE, replace inline styles with Tailwind)**
1. `DarkStudioView` — NEW, no existing file to migrate
2. `GoingLiveTransition` — NEW
3. `IntermissionView` — RENAME from RestAffirmation, rewrite with Tailwind
4. `ShowVerdict` — REWRITE with Tailwind
5. `DirectorMode` — REWRITE with Tailwind
6. `BeatCheckModal` — REWRITE with Tailwind + shadcn Dialog

**Layer 4: Core Views (REWRITE)**
1. `WritersRoomView` — REWRITE with 3-step flow, Tailwind
2. `TimerPanel` — REWRITE with Tailwind
3. `LineupPanel` — REWRITE with two variants
4. `ActCard` — REWRITE with two variants
5. `PillView` — REWRITE with Tailwind
6. `ExpandedView` — REWRITE with Tailwind layout
7. `StrikeView` — REWRITE with Tailwind

**Layer 5: App Shell Update**
1. Update `App.tsx` — add DarkStudioView routing, GoingLiveTransition, replace inline styles with Tailwind
2. Update IPC bridge — add new channels
3. Update main process — add day boundary detection, verify notification handlers

**Layer 6: CLUI Cleanup (Req 17)**
1. Delete files (verify no imports remain):
   - `src/renderer/components/ConversationView.tsx`
   - `src/renderer/components/InputBar.tsx`
   - `src/renderer/components/AttachmentChips.tsx`
   - `src/renderer/components/SlashCommandMenu.tsx`
   - `src/renderer/components/PopoverLayer.tsx`
   - `src/renderer/components/HistoryPicker.tsx` (already deleted per git status)
   - `src/renderer/components/MarketplacePanel.tsx` (already deleted)
   - `src/renderer/components/SettingsPopover.tsx` (already deleted)
   - `src/renderer/components/StatusBar.tsx` (already deleted)
   - `src/renderer/components/TabStrip.tsx` (already deleted)
   - `src/renderer/components/RestAffirmation.tsx` (replaced by IntermissionView)
2. Simplify `sessionStore.ts` — remove tab array, tab switching, tab close. Single session.
3. Verify Claude subprocess communication still works after cleanup.

**Layer 7: E2E Tests**
1. Write Playwright E2E tests for each view and flow
2. Verify full show lifecycle end-to-end

### 9.2 Files to Delete vs Modify

**DELETE** (CLUI dead weight):
```
src/renderer/components/ConversationView.tsx
src/renderer/components/InputBar.tsx
src/renderer/components/AttachmentChips.tsx
src/renderer/components/SlashCommandMenu.tsx
src/renderer/components/PopoverLayer.tsx
src/renderer/components/RestAffirmation.tsx        ← replaced by IntermissionView
src/renderer/panels/CalendarPanel.tsx              ← not in MLP scope
```

**MODIFY** (rewrite internals, keep file):
```
src/renderer/App.tsx                               ← new view routing, Tailwind classes
src/renderer/stores/showStore.ts                   ← add new fields and actions
src/renderer/stores/sessionStore.ts                ← simplify to single session
src/renderer/hooks/useTimer.ts                     ← minor, already correct
src/renderer/views/PillView.tsx                    ← rewrite with Tailwind
src/renderer/views/WritersRoomView.tsx             ← rewrite with 3-step flow
src/renderer/views/ExpandedView.tsx                ← rewrite with Tailwind layout
src/renderer/views/StrikeView.tsx                  ← rewrite with Tailwind
src/renderer/panels/TimerPanel.tsx                 ← rewrite with Tailwind
src/renderer/panels/LineupPanel.tsx                ← rewrite with two variants
src/renderer/components/ActCard.tsx                ← rewrite with two variants
src/renderer/components/BeatCheckModal.tsx         ← rewrite with shadcn Dialog
src/renderer/components/BeatCounter.tsx            ← rewrite with Tailwind
src/renderer/components/DirectorMode.tsx           ← rewrite with Tailwind
src/renderer/components/EnergySelector.tsx         ← rewrite with Tailwind
src/renderer/components/ShowVerdict.tsx            ← rewrite with Tailwind
src/renderer/theme.ts                              ← simplify (Tailwind handles tokens)
src/preload/index.ts                               ← add new IPC methods
src/shared/types.ts                                ← add new IPC channels
src/main/index.ts                                  ← add day boundary, verify handlers
```

**CREATE** (new files):
```
src/renderer/views/DarkStudioView.tsx
src/renderer/views/GoingLiveTransition.tsx
src/renderer/components/IntermissionView.tsx
src/renderer/components/OnAirIndicator.tsx
src/renderer/components/TallyLight.tsx
src/renderer/components/ClapperboardBadge.tsx
src/renderer/index.css                             ← Tailwind config + design tokens
src/renderer/ui/                                   ← shadcn/ui generated components
src/renderer/lib/utils.ts                          ← shadcn/ui cn() utility
```

### 9.3 Inline Style Migration Pattern

When rewriting a component from inline styles to Tailwind:

```tsx
// BEFORE (CLUI pattern — WRONG)
<div style={{
  display: 'flex',
  padding: '16px',
  backgroundColor: '#1a1a1e',
  borderRadius: '8px',
  color: '#e8e6e0',
  fontFamily: 'Inter, sans-serif',
  fontSize: '14px',
}}>

// AFTER (Showtime v2 — CORRECT)
<div className="flex p-4 bg-surface rounded-lg text-txt-primary font-body text-sm">
```

**Rules:**
1. Every `style={{}}` must be converted to Tailwind classes
2. Color values map to `@theme` tokens (e.g., `#1a1a1e` → `bg-surface`)
3. Spacing maps to Tailwind scale (e.g., `16px` → `p-4`)
4. Fonts use `font-mono` or `font-body`
5. No `className` string concatenation — use `cn()` from shadcn/ui utils for conditional classes

---

## 10. File Structure

### 10.1 Complete Target File Tree (Renderer)

```
src/renderer/
├── index.html                      # Entry point, font imports
├── index.css                       # Tailwind @import, @theme tokens, keyframes, global styles
├── main.tsx                        # React root mount
├── App.tsx                         # View router, AnimatePresence, click-through, theme init
├── env.d.ts                        # Window.clui type augmentation
│
├── views/                          # Top-level views (one visible at a time)
│   ├── DarkStudioView.tsx          # NEW — no_show phase
│   ├── WritersRoomView.tsx         # REWRITE — writers_room phase (3-step)
│   ├── GoingLiveTransition.tsx     # NEW — transient 2-3s overlay
│   ├── PillView.tsx                # REWRITE — collapsed pill (320x48)
│   ├── ExpandedView.tsx            # REWRITE — full control room (560x620)
│   └── StrikeView.tsx              # REWRITE — end-of-day curtain call
│
├── panels/                         # Sub-sections within views
│   ├── TimerPanel.tsx              # REWRITE — hero countdown + actions
│   ├── LineupPanel.tsx             # REWRITE — act list (full + sidebar variants)
│   └── ChatPanel.tsx               # KEEP — simplified Claude chat for ad-hoc acts
│
├── components/                     # Reusable UI components
│   ├── ActCard.tsx                 # REWRITE — lineup item (full + sidebar variants)
│   ├── BeatCheckModal.tsx          # REWRITE — post-act presence check
│   ├── BeatCounter.tsx             # REWRITE — gold/gray star display
│   ├── ClapperboardBadge.tsx       # NEW — category + act badge
│   ├── DirectorMode.tsx            # REWRITE — overwhelm handler overlay
│   ├── EnergySelector.tsx          # REWRITE — 2x2 energy grid
│   ├── IntermissionView.tsx        # NEW (replaces RestAffirmation.tsx)
│   ├── OnAirIndicator.tsx          # NEW — broadcast ON AIR box
│   ├── ShowVerdict.tsx             # REWRITE — verdict card
│   ├── TallyLight.tsx             # NEW — pulsing red dot
│   └── PermissionCard.tsx          # KEEP — Claude tool approval
│
├── stores/                         # Zustand state management
│   ├── showStore.ts                # MODIFY — add new fields/actions
│   └── sessionStore.ts             # MODIFY — simplify to single session
│
├── hooks/                          # Custom React hooks
│   ├── useTimer.ts                 # KEEP (minor tweaks)
│   ├── useClaudeEvents.ts         # KEEP
│   └── useHealthReconciliation.ts  # KEEP
│
├── ui/                             # shadcn/ui generated components
│   ├── button.tsx                  # Generated + custom variants
│   ├── dialog.tsx                  # Generated
│   ├── card.tsx                    # Generated
│   ├── input.tsx                   # Generated
│   ├── textarea.tsx                # Generated
│   └── progress.tsx                # Generated
│
├── lib/                            # Utilities
│   └── utils.ts                    # cn() class merge utility (shadcn/ui)
│
└── theme.ts                        # SIMPLIFY — minimal, Tailwind handles tokens
```

### 10.2 Deleted Files (Post-Migration)

```
src/renderer/components/ConversationView.tsx    # CLUI chat (replaced by Showtime views)
src/renderer/components/InputBar.tsx            # CLUI rich input (replaced by simplified chat)
src/renderer/components/AttachmentChips.tsx     # CLUI attachments (not needed)
src/renderer/components/SlashCommandMenu.tsx    # CLUI slash commands (not needed)
src/renderer/components/PopoverLayer.tsx        # CLUI popover (replaced by shadcn/ui Dialog)
src/renderer/components/RestAffirmation.tsx     # Renamed to IntermissionView
src/renderer/panels/CalendarPanel.tsx           # Not in MLP scope
src/renderer/components/PermissionDeniedCard.tsx # Simplify — merge into PermissionCard
```

### 10.3 Untouched Files (Infrastructure)

```
src/main/                           # All main process files — KEEP
src/main/claude/                    # RunManager, ControlPlane, StreamParser — KEEP
src/main/skills/                    # Skill installer — KEEP
src/main/marketplace/               # Catalog fetcher — KEEP (may remove later)
src/preload/index.ts                # IPC bridge — MODIFY (add new methods)
src/shared/types.ts                 # Type definitions — MODIFY (add new IPC channels)
src/skills/                         # SNL skill — KEEP
```

---

## Appendix A: App.tsx Updated View Router

The updated `App.tsx` should route views as follows:

```typescript
const renderView = () => {
  // Going Live transition overlays everything
  if (goingLiveActive) {
    return <GoingLiveTransition key="going-live" onComplete={completeGoingLive} />
  }

  // Pill view (collapsed)
  if (!isExpanded) {
    return <PillView key="pill" />
  }

  // Expanded views by phase
  switch (phase) {
    case 'no_show':
      return <DarkStudioView key="dark-studio" />
    case 'writers_room':
      return <WritersRoomView key="writers-room" />
    case 'strike':
      return <StrikeView key="strike" />
    case 'live':
    case 'intermission':
    case 'director':
      return <ExpandedView key="expanded" />
    default:
      return <DarkStudioView key="dark-studio-default" />
  }
}
```

Key changes from current App.tsx:
1. `no_show` now routes to `DarkStudioView` instead of `WritersRoomView`
2. `GoingLiveTransition` is handled as a conditional overlay
3. Root `<div>` uses Tailwind: `className="w-full h-full relative bg-transparent"` (replacing `style={{}}`)

## Appendix B: Category Color Utility

```typescript
// src/renderer/lib/category.ts
export type SketchCategory = 'Deep Work' | 'Exercise' | 'Admin' | 'Creative' | 'Social'

export const CATEGORY_CONFIG: Record<string, { token: string; hex: string }> = {
  'Deep Work':  { token: 'cat-deep',     hex: '#8b5cf6' },
  'Exercise':   { token: 'cat-exercise', hex: '#22c55e' },
  'Admin':      { token: 'cat-admin',    hex: '#60a5fa' },
  'Creative':   { token: 'cat-creative', hex: '#f59e0b' },
  'Social':     { token: 'cat-social',   hex: '#ec4899' },
}

export function getCategoryToken(sketch: string): string {
  return CATEGORY_CONFIG[sketch]?.token ?? 'accent'
}

export function getCategoryHex(sketch: string): string {
  return CATEGORY_CONFIG[sketch]?.hex ?? '#d97757'
}
```

## Appendix C: Verdict Computation Reference

```typescript
function computeVerdict(beatsLocked: number, beatThreshold: number): ShowVerdict {
  if (beatsLocked >= beatThreshold) return 'DAY_WON'
  if (beatsLocked === beatThreshold - 1) return 'SOLID_SHOW'
  if (beatsLocked >= Math.ceil(beatThreshold / 2)) return 'GOOD_EFFORT'
  return 'SHOW_CALLED_EARLY'
}
```

| Threshold = 3 | Beats = 3 | Beats = 2 | Beats = 1 | Beats = 0 |
|---|---|---|---|---|
| Verdict | DAY_WON | SOLID_SHOW | GOOD_EFFORT | SHOW_CALLED_EARLY |

| Threshold = 4 | Beats = 4 | Beats = 3 | Beats = 2 | Beats = 1 | Beats = 0 |
|---|---|---|---|---|---|
| Verdict | DAY_WON | SOLID_SHOW | GOOD_EFFORT | SHOW_CALLED_EARLY | SHOW_CALLED_EARLY |

## Appendix D: Affirmation Library

```typescript
export const REST_AFFIRMATIONS = [
  "Rest is free. Always has been.",
  "The stage will be here when you're ready.",
  "No clock. No pressure. Just breathe.",
  "Intermission is part of the show.",
  "The audience can wait.",
  "You've earned this pause.",
  "The best performers know when to rest.",
  "Even the spotlight takes a break.",
  "The show doesn't run on empty.",
  "This is your intermission. Own it.",
]
```
