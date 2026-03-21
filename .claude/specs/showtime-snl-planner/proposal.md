# Showtime SNL Day Planner

## Why

ADHD-first day planning is broken. Existing tools use guilt, streaks, and shame metrics that make executive dysfunction worse. Showtime reframes daily planning as a live performance using the SNL (Saturday Night Live) framework — your day is a Show, tasks are Acts, and presence moments are Beats. Rest costs zero. The show adapts to the performer.

Built as a fork of CLUI CC (Electron + React Claude Code wrapper), Showtime replaces the general-purpose chat interface with a minimalist floating macOS desktop app optimized for focus and self-compassion.

## What Changes

Transform CLUI CC from a general-purpose Claude Code desktop wrapper into an SNL-themed ADHD day planner:

- **Replace** multi-tab chat UI with SNL-specific views (Pill, Writer's Room, Expanded, Strike)
- **Replace** general-purpose session management with single-Show-per-day state machine
- **Add** Show lifecycle: Writer's Room → Live → Intermission → Director Mode → Strike the Stage
- **Add** Act timer with 1Hz countdown, energy-aware scheduling, Beat tracking
- **Add** Claude Code integration via standalone SNL skill (no daily-copilot dependency)
- **Keep** subprocess management (RunManager, ControlPlane, StreamParser, permission system)
- **Keep** Electron window management (NSPanel, always-on-top, click-through)
- **Remove** multi-tab sessions, marketplace, voice input, history picker

## Capabilities

### New

- Show state machine with 6 phases (no_show, writers_room, live, intermission, director, strike)
- Zustand showStore with localStorage persistence and day-boundary detection
- PillView: collapsed 320x48px pill with Act name, timer, Beat count
- WritersRoomView: energy check → free-text dump → Claude structures lineup
- ExpandedView: Timer + Chat + Lineup + Calendar grid layout
- StrikeView: end-of-day summary with 4 verdict tiers (DAY_WON, SOLID_SHOW, GOOD_EFFORT, SHOW_CALLED_EARLY)
- TimerPanel: countdown with +15m/End/Pause buttons and urgency color shift
- LineupPanel: reorderable Act cards with skip capability
- CalendarPanel: 7am-11pm timeline with colored Act blocks and current time marker
- ChatPanel: simplified Claude chat with ShowLineup JSON extraction
- BeatCheckModal: post-Act presence check with randomized prompts
- DirectorMode: overwhelm handler with guilt-free options
- RestAffirmation: intermission with breathing animation and affirmation library
- Standalone SNL SKILL.md with energy-aware scheduling, ADHD guardrails, verdict messages
- macOS notifications for Act completion, Beat checks, verdicts
- useTimer hook with 1Hz tick and auto-completion

### Modified

- App.tsx: rewritten from multi-tab chat to phase-based SNL view routing
- theme.ts: added ShowtimeColors interface with convenience aliases
- shared/types.ts: added ShowPhase, EnergyLevel, Act, ShowState, ShowLineup, ShowVerdict types + Showtime IPC channels
- preload/index.ts: added notifyActComplete, notifyBeatCheck, notifyVerdict to CluiAPI
- main/index.ts: added Showtime notification IPC handlers using Electron Notification API

## Impact

- **User experience**: Complete UI replacement — all CLUI chrome replaced with SNL-specific views
- **Data model**: New ShowState alongside existing TabState (sessionStore kept for Claude communication)
- **Build**: No changes to electron-vite or electron-builder pipeline
- **Dependencies**: No new npm packages — reuses existing React 19, Zustand 5, Framer Motion 12, Phosphor Icons, react-markdown
- **Removed surface**: TabStrip, MarketplacePanel, StatusBar, HistoryPicker, SettingsPopover, voice recording
