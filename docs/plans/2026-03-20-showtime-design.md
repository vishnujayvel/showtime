# Showtime — SNL Day Planner Desktop App

**Date:** 2026-03-20
**Status:** Design (Pre-MLP)
**Foundation:** Fork of [CLUI CC](https://github.com/lcoutodemos/clui-cc) (MIT License)

## Vision

A minimalist floating desktop app that transforms daily planning into a live performance using the SNL (Saturday Night Live) framework. Built for ADHD minds, loved by anyone who procrastinates.

Your day is a Show. Tasks are Acts. Presence moments are Beats. Rest is free. The show adapts.

## Target Audience

- **Primary:** ADHD professionals who struggle with rigid task planners
- **Secondary:** Procrastinators who want motivation without guilt
- **Tertiary:** Anyone who vibes with the SNL metaphor over mechanical to-do lists

## Core Metaphor (SNL Framework)

| Term | Meaning | Duration |
|------|---------|----------|
| **Show** | Your entire day | Full day |
| **Act** | A block of focused execution | 45-90 min |
| **Beat** | A moment of presence/immersion | Seconds to minutes |
| **Sketch** | A category/type of activity | N/A |
| **Writer's Room** | Morning planning session | Max 20 min |
| **Cold Open** | Morning presence ritual | 5-10 min |
| **Intermission** | Active recovery (costs 0 capacity) | Variable |
| **Strike the Stage** | End-of-day cleanup ritual | 10-15 min |

### Roles

- **Performer** — Execution mode during Acts
- **Head Writer** — Planning mode in Writer's Room
- **Director** — Reflection/pivoting mode when overwhelmed

### Win Conditions

| Verdict | Condition |
|---------|-----------|
| **DAY WON** | Beats >= win threshold |
| **SOLID SHOW** | Beats = threshold - 1 |
| **GOOD EFFORT** | Beats >= 50% of threshold |
| **SHOW CALLED EARLY** | < 50% but valid reasons |

Default: 3 Beats = day won (adjustable per day).

## MLP Scope

### What's In

1. **Writer's Room flow** — User dumps their day plan in chat, Claude Code (via `claude -p`) structures it into a Show Lineup with energy-aware scheduling
2. **Show Lineup panel** — Visual display of Acts as a vertical list with status indicators
3. **Act Timer** — Countdown timer for the current Act, visible in collapsed pill
4. **Beat Tracking** — After each Act, prompt: "Did you have a moment of presence?" Lock the Beat if yes.
5. **Progress Dashboard** — Beat count vs win threshold, show verdict
6. **Collapsed Pill** — Default state: tiny floating always-on-top pill showing current Act + timer + Beat count
7. **Expanded Window** — Single window with Chat + Timer + Show Lineup + Calendar sections
8. **Rest Affirmation** — Intermission mode that affirms rest, shows progress, costs zero capacity
9. **Director Mode** — Overwhelm handling: skip Acts, call the show, no guilt
10. **Strike the Stage** — End-of-day summary with verdict

### What's NOT in MLP

- Calendar integration (user manually inputs schedule)
- Email integration
- Connectors/plugins system
- Cross-platform (macOS only)
- Persistence across days (each day is a fresh Show)
- Weekly reflection
- Cloud sync

## Architecture

### Stack

| Layer | Technology |
|-------|-----------|
| **Desktop Framework** | Electron (forked from CLUI CC) |
| **Frontend** | React 19 + Tailwind CSS 4 + Zustand |
| **AI Engine** | Claude Code subprocess (`claude -p --output-format stream-json`) |
| **SNL Knowledge** | Ships as a Claude Code skill (standalone) |
| **Build** | electron-vite |
| **Package** | electron-builder (macOS .app) |

### Component Architecture

```
Showtime (Electron App)
├── Main Process
│   ├── claude/ (from CLUI — subprocess management)
│   │   ├── control-plane.ts
│   │   ├── run-manager.ts
│   │   └── event-normalizer.ts
│   ├── window-manager.ts (pill ↔ expanded states)
│   └── tray.ts (menu bar icon)
│
├── Renderer (React)
│   ├── views/
│   │   ├── PillView.tsx (collapsed: Act + timer + Beats)
│   │   ├── ExpandedView.tsx (chat + panels)
│   │   └── WritersRoomView.tsx (morning planning flow)
│   ├── panels/
│   │   ├── ChatPanel.tsx (talk to Claude)
│   │   ├── LineupPanel.tsx (Show Lineup / todo)
│   │   ├── TimerPanel.tsx (Act countdown)
│   │   └── CalendarPanel.tsx (day schedule)
│   ├── components/
│   │   ├── ActCard.tsx
│   │   ├── BeatCounter.tsx
│   │   ├── EnergyGauge.tsx
│   │   └── ShowVerdict.tsx
│   └── stores/
│       ├── showStore.ts (current Show state)
│       └── sessionStore.ts (from CLUI — Claude session)
│
└── SNL Skill (ships with app)
    ├── SKILL.md (framework knowledge + commands)
    └── ref/ (reference files)
```

### Data Flow

```
User opens app
  → Pill appears (collapsed)
  → User clicks/hotkeys to expand
  → Writer's Room: user types their day plan in chat
  → Claude Code (with SNL skill) structures it into Show Lineup
  → App renders Lineup in panel, starts first Act timer
  → User collapses to pill
  → Timer ticks, Act completes → Beat check notification
  → User expands to log Beat or skip
  → Repeat until Strike the Stage
  → Show verdict displayed
```

### Window Behavior

| State | Size | Behavior |
|-------|------|----------|
| **Pill (collapsed)** | ~300x50px | Always-on-top, draggable, shows Act name + timer + Beat count |
| **Expanded** | ~600x700px | Spotlight/Raycast-style floating window, Chat + panels |
| **Transition** | Animated | Pill grows into expanded window (framer-motion) |
| **Dismiss** | Click outside or Escape | Collapses back to pill |

### SNL Skill (Standalone)

The skill ships with the app and gets installed to `~/.claude/skills/showtime/`. It contains:

- Full SNL framework terminology and rules
- Energy-aware scheduling logic
- Beat check prompts
- Director Mode triggers and responses
- SNL language translations (no guilt-inducing language)
- ADHD guardrails

This skill is **independent** of daily-copilot — no personal dependencies, no interview prep, no Mem0. Pure SNL framework.

## UX Flow

### Morning (Writer's Room)

1. User opens Showtime → expanded view
2. App: "Good morning! How's your energy?" → [High / Medium / Low / Recovery]
3. User selects energy level
4. App: "What's on the show today? Dump everything."
5. User types free-text: "project proposal, gym, review PRs, prep meeting"
6. Claude Code (SNL skill) → structures into Acts with timing, sketch categories
7. App renders Show Lineup in panel
8. User can drag to reorder, tap to edit, swipe to remove
9. User approves → "We're live!"
10. App collapses to pill, first Act timer starts

### During Day (Performer Mode)

- Pill shows: `Act 3: Gym | 42:15 | 2/3 Beats`
- Act completes → notification: "Act done! Did you have a moment of presence?"
- User taps Beat (yes/no) → counter updates
- Rest → pill shows: "Intermission | No rush | 2/3 Beats so far"
- Overwhelmed → expand → Director Mode: "The show adapts. What do you need?"

### Evening (Strike the Stage)

- Final Act completes or user triggers Strike
- Expanded view shows summary: Acts completed, Beats locked, verdict
- "DAY WON" / "SOLID SHOW" / "GOOD EFFORT" / "SHOW CALLED EARLY"
- Celebration animation for DAY WON

## Design Principles

1. **ADHD-first** — Every interaction minimizes friction and decision fatigue
2. **Guilt-free** — SNL language only. "Act got cut" not "you failed"
3. **Presence over productivity** — Beats reward being present, not checking boxes
4. **Rest is free** — Intermissions cost zero capacity, always affirmed
5. **The show adapts** — Skip, reorder, call it early — all valid
6. **Minimalist** — Pill by default. Only expand when needed.
7. **Beautiful** — Animations, smooth transitions, dark mode. Make it feel premium.

## What to Keep from CLUI

- `claude -p --output-format stream-json` subprocess management
- NDJSON stream parsing and event normalization
- IPC architecture (preload bridge)
- Permission server (tool approval UI)
- React + Tailwind + Zustand foundation
- electron-vite build system
- Framer Motion (already a dependency)

## What to Remove from CLUI

- Multi-tab session management (Showtime = one Show per day)
- Marketplace/skills browser
- Voice input (future, not MLP)
- History picker (not needed for MLP)
- General-purpose chat chrome

## What to Add

- Pill ↔ Expanded window state management
- SNL-specific panels (Lineup, Timer, Calendar, Beat counter)
- Show state store (Acts, Beats, energy, verdict)
- Act timer with notifications
- Writer's Room guided flow
- Director Mode UI
- Strike the Stage summary view
- SNL skill installation on first launch

## Open Questions

1. **Persistence:** Should Show state survive app restart? (Probably yes — save to localStorage)
2. **Sound:** Notification sounds for Act completion / Beat lock? (Nice to have)
3. **Hotkey:** What's the summon shortcut? (CLUI uses Alt+Space)
4. **Calendar panel:** Just a time-based view of Acts, or actual day hours?
5. **Drag-and-drop:** Priority for MLP or can we use buttons for reorder?
