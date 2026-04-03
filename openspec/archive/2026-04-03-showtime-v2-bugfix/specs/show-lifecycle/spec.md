## MODIFIED Requirements

### Requirement: Beat Check celebration delay

When the user locks a Beat, Showtime SHALL display a 1.5-2 second celebration moment showing "That moment was real" with the beat-ignite animation BEFORE advancing to the next Act. The `lockBeat()` action in showStore SHALL NOT immediately dismiss the Beat Check modal or call `startAct()`.

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

#### Scenario: Celebration does not block app interaction

- **GIVEN** the Beat celebration is displaying
- **WHEN** the 1800ms timer is active
- **THEN** the celebration overlay SHALL remain visible
- **AND** the user SHALL NOT be able to dismiss it early (the moment is earned)

### Requirement: App close and quit behavior

Showtime SHALL provide clear mechanisms to quit the application and manage the window lifecycle on macOS.

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

#### Scenario: Expanded view close button

- **GIVEN** Showtime is in expanded view
- **WHEN** the user clicks the close button in the title bar
- **THEN** the window SHALL collapse back to pill view OR minimize to tray
