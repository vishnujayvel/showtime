# Show Lifecycle

## ADDED Requirements

### Requirement: Show State Machine
The app manages a day-long Show with 6 phases: no_show, writers_room, live, intermission, director, strike.

**Scenarios:**
- GIVEN the app launches with no active Show WHEN user opens the app THEN display Writer's Room view
- GIVEN the Show is live WHEN an Act timer completes THEN prompt Beat check and advance to next Act
- GIVEN the user enters Director Mode WHEN they select "call the show" THEN skip remaining Acts and transition to Strike phase
- GIVEN the Show date is not today WHEN the app opens THEN reset to fresh Show (no_show phase)

### Requirement: Act Timer
Each Act has a countdown timer that ticks at 1Hz.

**Scenarios:**
- GIVEN an Act is active WHEN the timer reaches zero THEN call completeAct and set beatCheckPending
- GIVEN an Act is active WHEN the user clicks "+15m" THEN extend timerEndAt by 15 minutes
- GIVEN an Act is active WHEN the user clicks "Pause" THEN save remaining time and enter intermission

### Requirement: Beat Tracking
Beats measure presence, not productivity. Users confirm or skip after each Act.

**Scenarios:**
- GIVEN beatCheckPending is true WHEN user clicks "Yes, lock it" THEN increment beatsLocked and set beatLocked on Act
- GIVEN beatCheckPending is true WHEN user clicks "Not this time" THEN dismiss modal and advance to next Act
- GIVEN all Acts complete WHEN computing verdict THEN DAY_WON if beatsLocked >= beatThreshold

### Requirement: Intermission
Rest costs zero. No timer, no guilt.

**Scenarios:**
- GIVEN the Show is live WHEN user enters intermission THEN pause timer and display random rest affirmation
- GIVEN the user is in intermission WHEN they click "Ready to continue" THEN restore timer and resume live phase

### Requirement: Show Persistence
Show state persists across app restarts via localStorage.

**Scenarios:**
- GIVEN an active Show WHEN the app restarts THEN resume from the persisted phase, acts, and timer state
- GIVEN a Show from yesterday WHEN the app opens today THEN clear state and start fresh (no_show)

## MODIFIED Requirements

### Requirement: Window Management
(Previously: CLUI uses fixed 1040x720 with multi-tab card layout)

The app now switches between Pill (320x48) and Expanded (580x620) states within the same native window frame. Click-through behavior preserved.

**Scenarios:**
- GIVEN the pill is visible WHEN user clicks it THEN expand to the appropriate view for the current phase
- GIVEN the expanded view is visible WHEN user clicks collapse THEN return to pill

## REMOVED Requirements

### Requirement: Multi-Tab Sessions
(Deprecated: Showtime uses a single Show per day, not multiple parallel sessions)

All multi-tab logic (createTab, closeTab, selectTab, TabStrip) is removed. A single session communicates with Claude via the existing ControlPlane.
