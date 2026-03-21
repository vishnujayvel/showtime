# Implementation Tasks — Showtime SNL Day Planner

## Task Execution Order

Tasks are ordered by dependency. Each task produces a verifiable, testable artifact. Atomic commits after each task.

---

## Phase 1: Foundation (Types, Store, Skill)

### Task 1: Add Show Types to shared/types.ts
- [x] **Completed**
**Files:** `src/shared/types.ts`
**Action:** Add ShowPhase, EnergyLevel, ActStatus, ShowVerdict, Act, ShowState, ShowLineup types + Showtime IPC channels
**Verify:** TypeScript compiles with no errors
**Depends on:** Nothing

### Task 2: Create showStore.ts (Zustand)
- [x] **Completed**
**Files:** `src/renderer/stores/showStore.ts` (405 lines)
**Action:** Full ShowState store with all actions, localStorage persistence, day boundary detection, computed selectors
**Verify:** Store imports clean, all actions implemented
**Depends on:** Task 1

### Task 3: Create SNL Skill (SKILL.md)
- [x] **Completed**
**Files:** `src/skills/showtime/SKILL.md` (208 lines)
**Action:** Full SNL framework, ShowLineup JSON schema, energy-aware scheduling rules, 10 beat check prompts, Director Mode templates, ADHD guardrails, verdict messages, rest affirmations
**Verify:** Valid markdown, JSON examples parseable
**Depends on:** Nothing

### Task 4: Simplify sessionStore.ts to Single-Session
- [ ] **Deferred to Phase 5** — sessionStore kept as-is, views use `tabs[0]` pattern. Lower risk for MLP.
**Files:** `src/renderer/stores/sessionStore.ts`
**Depends on:** Task 1

---

## Phase 2: Core Views (Pill, Expanded, Writers Room)

### Task 5: Create PillView.tsx
- [x] **Completed**
**Files:** `src/renderer/views/PillView.tsx` (96 lines)
**Action:** Collapsed pill with act name, timer, beats. States: no_show, live, intermission, strike.
**Depends on:** Task 2

### Task 6: Create useTimer.ts Hook
- [x] **Completed**
**Files:** `src/renderer/hooks/useTimer.ts` (62 lines)
**Action:** 1Hz timer hook reading timerEndAt, auto-completes Act at zero.
**Depends on:** Task 2

### Task 7: Create EnergySelector.tsx
- [x] **Completed**
**Files:** `src/renderer/components/EnergySelector.tsx` (53 lines)
**Action:** Four-button energy picker with Phosphor icons and animated selection.
**Depends on:** Task 2

### Task 8: Create WritersRoomView.tsx
- [x] **Completed**
**Files:** `src/renderer/views/WritersRoomView.tsx` (168 lines)
**Action:** 3-step flow: energy → free-text → Claude structures lineup → preview → "We're live!"
**Depends on:** Tasks 2, 3, 7

### Task 9: Create TimerPanel.tsx
- [x] **Completed**
**Files:** `src/renderer/panels/TimerPanel.tsx` (99 lines)
**Action:** Large countdown, +15m/End/Pause buttons, urgency color shift.
**Depends on:** Tasks 2, 6

### Task 10: Create ActCard.tsx
- [x] **Completed**
**Files:** `src/renderer/components/ActCard.tsx` (106 lines)
**Action:** Status-aware card with sketch colors, reorder buttons, skip button.
**Depends on:** Task 2

### Task 11: Create LineupPanel.tsx
- [x] **Completed**
**Files:** `src/renderer/panels/LineupPanel.tsx` (33 lines)
**Action:** Sorted ActCard list with reorder and skip.
**Depends on:** Tasks 2, 10

### Task 12: Create BeatCounter.tsx
- [x] **Completed**
**Files:** `src/renderer/components/BeatCounter.tsx` (48 lines)
**Action:** Star display with compact mode for pill.
**Depends on:** Task 2

### Task 13: Create BeatCheckModal.tsx
- [x] **Completed**
**Files:** `src/renderer/components/BeatCheckModal.tsx` (115 lines)
**Action:** Modal with random beat prompt, lock/skip buttons, spring animation.
**Depends on:** Task 2

---

## Phase 3: Expanded Layout & Remaining Panels

### Task 14: Create CalendarPanel.tsx
- [x] **Completed**
**Files:** `src/renderer/panels/CalendarPanel.tsx` (124 lines)
**Action:** 7am-11pm timeline, colored Act blocks, current time marker.
**Depends on:** Task 2

### Task 15: Create ChatPanel.tsx
- [x] **Completed**
**Files:** `src/renderer/panels/ChatPanel.tsx` (168 lines)
**Action:** Simplified chat with markdown rendering, ShowLineup JSON extraction, show context injection.
**Depends on:** Tasks 2, 4

### Task 16: Create ExpandedView.tsx
- [x] **Completed**
**Files:** `src/renderer/views/ExpandedView.tsx` (128 lines)
**Action:** Timer + Chat/Lineup/Calendar grid + BeatCounter + Director Mode button.
**Depends on:** Tasks 5, 9, 11, 12, 14, 15

### Task 17: Create RestAffirmation.tsx
- [x] **Completed**
**Files:** `src/renderer/components/RestAffirmation.tsx` (63 lines)
**Action:** Random affirmation, breathing animation, resume button.
**Depends on:** Task 2

### Task 18: Create DirectorMode.tsx
- [x] **Completed**
**Files:** `src/renderer/components/DirectorMode.tsx` (80 lines)
**Action:** 4-option overwhelm handler with guilt-free language.
**Depends on:** Task 2

### Task 19: Create ShowVerdict.tsx + StrikeView.tsx
- [x] **Completed**
**Files:** `src/renderer/components/ShowVerdict.tsx` (84 lines), `src/renderer/views/StrikeView.tsx` (100 lines)
**Action:** 4 verdict tiers, celebration animation for DAY_WON, summary stats.
**Depends on:** Task 2

---

## Phase 4: Integration & Main Process

### Task 20: Rewrite App.tsx (View Router)
- [x] **Completed**
**Files:** `src/renderer/App.tsx` (116 lines)
**Action:** Phase-based routing, theme init, click-through, AnimatePresence transitions.
**Depends on:** Tasks 5, 8, 16, 19

### Task 21: Modify main/index.ts for Showtime
- [x] **Completed** (partial — notification handlers added, multi-tab not yet stripped)
**Files:** `src/main/index.ts`
**Action:** Added Showtime notification IPC handlers (NOTIFY_ACT_COMPLETE, NOTIFY_BEAT_CHECK, NOTIFY_VERDICT).
**Depends on:** Task 4

### Task 22: Extend preload/index.ts
- [x] **Completed**
**Files:** `src/preload/index.ts` (153 lines)
**Action:** Added notifyActComplete, notifyBeatCheck, notifyVerdict to CluiAPI + implementation.
**Depends on:** Task 21

### Task 23: Update theme.ts for Showtime Palette
- [x] **Completed**
**Files:** `src/renderer/theme.ts` (430 lines)
**Action:** Added ShowtimeColors interface with convenience aliases (text, border, cardBg, pillBg).
**Depends on:** Nothing

---

## Phase 5: Cleanup & Polish

### Task 24: Remove CLUI-Only Components
- [ ] **Pending**
**Files:** Multiple
**Action:** Delete TabStrip, MarketplacePanel, SettingsPopover, StatusBar, HistoryPicker, dead imports.
**Depends on:** Task 20

### Task 25: Update package.json & Build Config
- [ ] **Pending**
**Files:** `package.json`
**Action:** App name "Showtime", bundle ID, remove unused deps.
**Depends on:** Task 24

### Task 26: End-to-End Smoke Test
- [ ] **Pending**
**Files:** None (manual verification)
**Action:** Full 10-step flow test.
**Depends on:** All previous tasks

---

## Summary

| Phase | Tasks | Status |
|-------|-------|--------|
| 1: Foundation | 1-3 ✅, 4 deferred | **3/4 complete** |
| 2: Core Views | 5-13 ✅ | **9/9 complete** |
| 3: Expanded Layout | 14-19 ✅ | **6/6 complete** |
| 4: Integration | 20-23 ✅ | **4/4 complete** |
| 5: Cleanup | 24-26 ⬜ | **0/3 pending** |

**Overall: 22/26 tasks complete (85%)**

### Brownfield Notes
- Zero Showtime-specific TypeScript errors
- 43 pre-existing CLUI errors in StatusBar.tsx, HistoryPicker.tsx, MarketplacePanel.tsx (all slated for deletion in Task 24)
- sessionStore kept as-is (uses tabs[0] pattern) — deferred simplification reduces risk
