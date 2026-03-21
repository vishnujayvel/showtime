# UI Views

## ADDED Requirements

### Requirement: PillView
Collapsed pill (320x48px) showing current Act name, countdown timer, and Beat count.

**Scenarios:**
- GIVEN no active Show WHEN pill renders THEN display "Tap to start your show"
- GIVEN a live Show WHEN pill renders THEN display Act name, MM:SS countdown, and N/M Beat stars
- GIVEN intermission WHEN pill renders THEN display "Intermission | No rush | N/M Beats"

### Requirement: WritersRoomView
Morning planning guided flow: energy check → free-text dump → Claude structures lineup → preview → go live.

**Scenarios:**
- GIVEN no energy selected WHEN Writer's Room opens THEN show EnergySelector (High/Medium/Low/Recovery)
- GIVEN energy selected WHEN user types day plan and submits THEN send to Claude with SNL skill context
- GIVEN Claude returns ShowLineup JSON WHEN parsed successfully THEN display Act preview with reorder/skip
- GIVEN lineup previewed WHEN user clicks "We're live!" THEN start Show, collapse to pill, begin first Act timer

### Requirement: ExpandedView
Main expanded window (580x620px) with Timer + Chat + Lineup + Calendar grid.

**Scenarios:**
- GIVEN the Show is live WHEN expanded view renders THEN show TimerPanel top, ChatPanel left, LineupPanel+CalendarPanel right, BeatCounter bottom
- GIVEN phase is intermission WHEN expanded view renders THEN show RestAffirmation overlay
- GIVEN phase is director WHEN expanded view renders THEN show DirectorMode overlay

### Requirement: StrikeView
End-of-day summary with verdict display.

**Scenarios:**
- GIVEN all Acts complete WHEN Strike view renders THEN show completed/skipped/beat counts and ShowVerdict card
- GIVEN DAY_WON verdict WHEN verdict animates in THEN trigger celebration animation (rotate + scale)
- GIVEN user clicks "New Show" WHEN in Strike view THEN reset all state and return to no_show

### Requirement: Components
ActCard, BeatCounter, BeatCheckModal, EnergySelector, ShowVerdict, RestAffirmation, DirectorMode.

**Scenarios:**
- GIVEN an Act is active WHEN ActCard renders THEN highlight with sketch color border
- GIVEN BeatCheckModal is visible WHEN it displays THEN show random Beat prompt from library of 10
- GIVEN Director Mode active WHEN user selects an option THEN execute corresponding action with guilt-free messaging

## REMOVED Requirements

### Requirement: CLUI Chat Chrome
(Deprecated: replaced by SNL-specific views)

TabStrip, MarketplacePanel, SettingsPopover, StatusBar, HistoryPicker, voice recording are removed.
