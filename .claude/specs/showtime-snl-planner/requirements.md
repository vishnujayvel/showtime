# Requirements Document — Showtime SNL Day Planner

## Project Description

Showtime is a minimalist floating macOS desktop app that transforms daily planning into a live performance using the SNL (Saturday Night Live) framework. Built as a fork of CLUI CC (Electron + React Claude Code wrapper), it replaces the general-purpose chat interface with an ADHD-first day planner where your day is a Show, tasks are Acts, and presence moments are Beats.

**Source:** `docs/plans/2026-03-20-showtime-design.md`

---

## Functional Requirements

### FR-1: Window States (Pill ↔ Expanded)

- **FR-1.1:** App launches in collapsed **Pill** state (~300×50px), always-on-top, draggable
- **FR-1.2:** Pill displays: current Act name, countdown timer, Beat count (e.g. `Act 3: Gym | 42:15 | 2/3`)
- **FR-1.3:** User clicks pill or uses hotkey (Alt+Space) to expand to single window (~600×700px)
- **FR-1.4:** Expanded window contains four sections: Chat, Timer, Show Lineup, Calendar
- **FR-1.5:** Click outside or Escape collapses back to pill
- **FR-1.6:** Transition between pill and expanded is animated (framer-motion)
- **FR-1.7:** Pill state persists across spaces (macOS NSPanel, visible on all workspaces)

### FR-2: Writer's Room (Morning Planning)

- **FR-2.1:** On first open of the day (no active Show), app opens in expanded Writer's Room view
- **FR-2.2:** Guided flow: energy check → free-text dump → Claude structures into Show Lineup
- **FR-2.3:** Energy prompt: "How's your energy?" with options [High / Medium / Low / Recovery]
- **FR-2.4:** Planning prompt: "What's on the show today? Dump everything."
- **FR-2.5:** Claude Code (via SNL skill) structures user input into ordered Acts with:
  - Act name
  - Sketch category (type of activity)
  - Estimated duration (45-90 min default range)
  - Energy-aware ordering (high-energy acts scheduled when user energy is highest)
- **FR-2.6:** User can reorder, edit, or remove Acts before approving
- **FR-2.7:** User approves → "We're live!" → app collapses to pill, first Act timer starts
- **FR-2.8:** Writer's Room session capped at 20 minutes (gentle nudge, not hard block)

### FR-3: Show Lineup Panel

- **FR-3.1:** Vertical list of Acts with status indicators (upcoming / active / completed / skipped)
- **FR-3.2:** Each Act card shows: name, sketch category, estimated duration, status
- **FR-3.3:** Active Act is visually highlighted
- **FR-3.4:** Completed Acts show Beat status (locked / missed)
- **FR-3.5:** User can reorder Acts via buttons (up/down) in expanded view
- **FR-3.6:** User can skip an Act ("Act got cut" — no guilt language)
- **FR-3.7:** User can add ad-hoc Acts mid-show via chat

### FR-4: Act Timer

- **FR-4.1:** Countdown timer for the current Act, visible in both pill and expanded views
- **FR-4.2:** Timer starts automatically when Act begins
- **FR-4.3:** Timer completion triggers Beat Check notification
- **FR-4.4:** User can extend time (+15 min), end early, or pause (becomes Intermission)
- **FR-4.5:** Timer shows elapsed/remaining in MM:SS format
- **FR-4.6:** Visual urgency cues as timer approaches zero (subtle color shift, not alarming)

### FR-5: Beat Tracking

- **FR-5.1:** After each Act completes (timer ends or user ends early), prompt: "Did you have a moment of presence?"
- **FR-5.2:** User responds yes (lock Beat) or no (skip, no penalty)
- **FR-5.3:** Beat counter visible in pill: `N/M Beats` where M is the win threshold
- **FR-5.4:** Default win threshold: 3 Beats per day (adjustable in Writer's Room)
- **FR-5.5:** Beats measure presence, not productivity — the prompt is about being immersed, not checking boxes

### FR-6: Intermission (Rest)

- **FR-6.1:** User can enter Intermission at any time (pause current Act or between Acts)
- **FR-6.2:** Pill shows: "Intermission | No rush | N/M Beats so far"
- **FR-6.3:** Intermission costs zero capacity — no timer, no guilt
- **FR-6.4:** Rest affirmation message displayed (e.g., "The show is better for the break.")
- **FR-6.5:** User exits Intermission to resume or start next Act

### FR-7: Director Mode (Overwhelm Handling)

- **FR-7.1:** Accessible via chat or a dedicated button in expanded view
- **FR-7.2:** Prompt: "The show adapts. What do you need?"
- **FR-7.3:** Options: skip remaining Acts, reorder, call the show early, take extended break
- **FR-7.4:** All options are guilt-free — "calling the show early" is a valid outcome
- **FR-7.5:** Claude provides supportive, non-judgmental responses using SNL language

### FR-8: Strike the Stage (End of Day)

- **FR-8.1:** Triggered when final Act completes, or user manually triggers via chat/button
- **FR-8.2:** Expanded view shows summary: Acts completed, Acts skipped, Beats locked
- **FR-8.3:** Show verdict based on Beat count vs threshold:
  - DAY WON: Beats >= win threshold
  - SOLID SHOW: Beats = threshold - 1
  - GOOD EFFORT: Beats >= 50% of threshold
  - SHOW CALLED EARLY: < 50% but valid reasons
- **FR-8.4:** DAY WON triggers celebration animation
- **FR-8.5:** All verdicts use positive/neutral language — no negative verdicts

### FR-9: Chat Panel (Claude Code Integration)

- **FR-9.1:** Chat panel in expanded view for conversing with Claude Code
- **FR-9.2:** Claude runs as subprocess via `claude -p --output-format stream-json`
- **FR-9.3:** SNL skill loaded for all conversations (framework knowledge, energy-aware scheduling, ADHD guardrails)
- **FR-9.4:** Chat supports: planning, mid-day adjustments, Director Mode, general questions
- **FR-9.5:** Streaming responses rendered incrementally (reuse CLUI NDJSON parsing)
- **FR-9.6:** Single session per Show (no multi-tab)

### FR-10: Calendar Panel

- **FR-10.1:** Time-based view of the day's Acts mapped to hours
- **FR-10.2:** Shows current time marker
- **FR-10.3:** Acts displayed as colored blocks in their scheduled time slots
- **FR-10.4:** Read-only in MLP (no drag to reschedule)

### FR-11: SNL Skill (Standalone)

- **FR-11.1:** Ships with the app, installed to a skill directory
- **FR-11.2:** Contains: full SNL framework terminology, energy-aware scheduling logic, Beat check prompts, Director Mode triggers, ADHD guardrails
- **FR-11.3:** Independent of daily-copilot — no personal dependencies, no interview prep, no Mem0
- **FR-11.4:** Provides structured output format for Show Lineup (JSON schema for Acts)

### FR-12: Show State Persistence

- **FR-12.1:** Show state survives app restart (save to localStorage or file)
- **FR-12.2:** On restart with active Show, resume from current state (don't re-run Writer's Room)
- **FR-12.3:** Each day is a fresh Show — no cross-day persistence
- **FR-12.4:** Clear state at midnight or on explicit "new show" action

---

## Non-Functional Requirements

### NFR-1: Platform & Build

- **NFR-1.1:** macOS only (Electron with NSPanel)
- **NFR-1.2:** Built with electron-vite, packaged with electron-builder
- **NFR-1.3:** Stack: React 19, Tailwind CSS 4, Zustand 5, Framer Motion 12+

### NFR-2: Performance

- **NFR-2.1:** Pill must feel instant — no perceptible lag on expand/collapse
- **NFR-2.2:** Timer updates at 1Hz (not per-frame) to minimize CPU
- **NFR-2.3:** App idle CPU < 2% when pill is visible but no Act is running
- **NFR-2.4:** Streaming text renders via RAF batching (reuse CLUI pattern)

### NFR-3: ADHD-First Design

- **NFR-3.1:** All language is guilt-free — SNL metaphor only, never "you failed" or "overdue"
- **NFR-3.2:** Minimal decision points — each interaction has a clear default action
- **NFR-3.3:** Visual hierarchy: one thing demands attention at a time
- **NFR-3.4:** Rest and skipping are always available with zero friction
- **NFR-3.5:** No streaks, no shame metrics, no red warnings

### NFR-4: UX & Design

- **NFR-4.1:** Dark mode by default, premium feel
- **NFR-4.2:** Smooth animations on all state transitions (framer-motion springs)
- **NFR-4.3:** Phosphor icons (already in CLUI dependency)
- **NFR-4.4:** Accessible — keyboard navigable, sufficient contrast

### NFR-5: Reuse from CLUI CC

- **NFR-5.1:** Keep: subprocess management (RunManager, ControlPlane, StreamParser)
- **NFR-5.2:** Keep: IPC architecture (preload bridge, CluiAPI)
- **NFR-5.3:** Keep: Permission server (tool approval)
- **NFR-5.4:** Keep: electron-vite build, React/Tailwind/Zustand/Framer foundation
- **NFR-5.5:** Remove: multi-tab sessions, marketplace/skills browser, voice input, history picker
- **NFR-5.6:** Remove: general-purpose chat chrome (replace with SNL-specific UI)

---

## Constraints

- **C-1:** Claude Code binary must be installed on user's machine (`claude` in PATH)
- **C-2:** No cloud services — all state is local
- **C-3:** No calendar API integration in MLP — user inputs schedule manually
- **C-4:** Single Show per day — no concurrent Shows
- **C-5:** SNL skill must not import or depend on daily-copilot skill

---

## Decisions Resolved (from Open Questions)

| Question | Decision | Rationale |
|----------|----------|-----------|
| Persistence | localStorage for Show state | Simplest for MLP, survives restart |
| Sound | Not in MLP | Nice-to-have, deferred |
| Hotkey | Alt+Space (keep from CLUI) | Familiar to existing users |
| Calendar panel | Time-based view of Acts mapped to hours | More useful than abstract list |
| Drag-and-drop reorder | Buttons (up/down) for MLP | Simpler implementation, DnD deferred |
