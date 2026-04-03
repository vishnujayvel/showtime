## MODIFIED Requirements

### Requirement: Beat celebration race condition fix

The `lockBeat()` action in showStore SHALL be safe against re-entry and stale state. The celebration timeout SHALL be tracked and cancelable.

#### Scenario: Normal Beat lock with celebration

- **GIVEN** the Beat Check modal is visible after an Act completes
- **WHEN** the user clicks "Yes -- Lock the Beat"
- **THEN** Showtime SHALL increment `beatsLocked` and set `celebrationActive: true`
- **AND** Showtime SHALL display "That moment was real" with the `beat-ignite` animation
- **AND** after 1800ms, Showtime SHALL set `celebrationActive: false`, `beatCheckPending: false`
- **AND** Showtime SHALL advance to the next Act (or Strike if no Acts remain)

#### Scenario: Double-click on Lock the Beat

- **GIVEN** the user clicks "Yes -- Lock the Beat"
- **AND** the celebration is actively displaying (within the 1800ms window)
- **WHEN** the user somehow triggers `lockBeat()` again (e.g., programmatic, rapid re-render)
- **THEN** the first celebration timeout SHALL be cancelled
- **AND** a new 1800ms timeout SHALL start
- **AND** `beatsLocked` SHALL have been incremented only once for the original click (the button is hidden during celebration)

#### Scenario: Store reset during celebration

- **GIVEN** the celebration is actively displaying
- **WHEN** `resetShow()` is called (e.g., day boundary, manual reset)
- **THEN** the celebration timeout SHALL be cancelled
- **AND** no stale `startAct()` or `strikeTheStage()` SHALL fire after the reset
- **AND** the store SHALL return to `initialState`

#### Scenario: Phase change during celebration

- **GIVEN** the celebration is actively displaying and the phase is `live`
- **WHEN** the celebration timeout fires but the phase has changed (e.g., to `intermission` or `director`)
- **THEN** the timeout callback SHALL detect the phase mismatch
- **AND** the callback SHALL NOT call `startAct()` or `strikeTheStage()`
- **AND** `celebrationActive` SHALL be set to `false` to clean up the UI

### Requirement: Theatrical loading indicator during Claude processing

When the user submits their plan for Claude to process, Showtime SHALL display a theatrical loading animation that maintains the show metaphor.

#### Scenario: Loading animation appears during Claude processing

- **GIVEN** the user is in Writer's Room plan step with text entered
- **WHEN** the user clicks "Build my lineup"
- **THEN** Showtime SHALL immediately show a loading overlay replacing the plan form
- **AND** the overlay SHALL display "The writers are working..." in `font-body text-lg text-txt-secondary`
- **AND** the overlay SHALL include an animated visual element (pulsing dots or spotlight sweep)
- **AND** the `spotlight-warm` gradient SHALL be visible in the background

#### Scenario: Extended loading feedback

- **GIVEN** Claude has been processing for more than 10 seconds
- **WHEN** the timer crosses the 10-second mark
- **THEN** the loading text SHALL update to a secondary message (e.g., "Still writing... almost there")
- **AND** the animation SHALL continue uninterrupted

#### Scenario: Loading timeout with retry

- **GIVEN** Claude has been processing for more than 30 seconds
- **WHEN** the timeout fires
- **THEN** the loading overlay SHALL be replaced with an error message
- **AND** the error SHALL include a "Try again" button
- **AND** the error message SHALL use show metaphor language (e.g., "The writers need a coffee break. Try again?")

#### Scenario: Successful lineup replaces loading

- **GIVEN** the loading animation is displaying
- **WHEN** Claude responds with a valid `showtime-lineup` JSON block
- **THEN** the loading overlay SHALL transition to the lineup preview using Framer Motion `AnimatePresence`
- **AND** the transition SHALL use spring physics per CLAUDE.md rule 5

#### Scenario: Loading animation uses no inline styles

- **GIVEN** the loading animation component is rendered
- **THEN** all styling SHALL use Tailwind CSS utility classes
- **AND** all animations SHALL use CSS classes defined in `index.css` or Framer Motion spring physics
- **AND** zero `style={{}}` objects SHALL be present (per CLAUDE.md rule 1)

### Requirement: Beat Check celebration display

When the user locks a Beat, Showtime SHALL display a 1800ms celebration moment showing "That moment was real" with the beat-ignite animation BEFORE advancing to the next Act. Skipping a Beat SHALL dismiss immediately with no celebration.

#### Scenario: User locks a Beat and sees celebration

- **GIVEN** the Beat Check modal is visible after an Act completes
- **WHEN** the user clicks "Yes -- Lock the Beat"
- **THEN** Showtime SHALL increment `beatsLocked` and set `beatLocked: true` on the current Act
- **AND** Showtime SHALL display "That moment was real" with the `beat-ignite` animation
- **AND** the celebration SHALL remain visible for 1800ms
- **AND** after the celebration delay, Showtime SHALL advance to the next Act (or Strike if no Acts remain)

#### Scenario: User skips the Beat

- **GIVEN** the Beat Check modal is visible after an Act completes
- **WHEN** the user clicks "Not this time"
- **THEN** Showtime SHALL immediately dismiss the modal and advance to the next Act
- **AND** no celebration SHALL be shown

### Requirement: App close and quit behavior

Showtime SHALL provide clear mechanisms to quit the application and manage the window lifecycle on macOS, including tray context menu quit, Cmd+Q keyboard shortcut, and traffic light minimize-to-tray behavior.

#### Scenario: Quit via tray context menu

- **GIVEN** Showtime is running with a system tray icon
- **WHEN** the user right-clicks the tray icon and selects "Quit Showtime"
- **THEN** the app SHALL quit completely (all processes terminated)

#### Scenario: Quit via Cmd+Q

- **GIVEN** Showtime is running
- **WHEN** the user presses Cmd+Q
- **THEN** the app SHALL quit on the first press (not hide)

#### Scenario: macOS red traffic light minimizes to tray

- **GIVEN** Showtime is in expanded view
- **WHEN** the user clicks the macOS red traffic light (close button)
- **THEN** the window SHALL minimize to tray (hide), not quit
- **AND** the app SHALL remain accessible from the tray icon

## Files

- `src/renderer/stores/showStore.ts` — `lockBeat()`, `resetShow()`, `celebrationActive`, timeout management
- `src/renderer/components/BeatCheckModal.tsx` — Celebration display, button disable during celebration
- `src/renderer/views/WritersRoomView.tsx` — Loading indicator component, `isSubmitting` state
- `src/renderer/index.css` — Loading animation keyframes (if CSS-based)
- `src/main/index.ts` — Tray, quit behavior (already implemented)
