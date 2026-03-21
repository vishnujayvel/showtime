## MODIFIED Requirements

### Requirement: Writer's Room Claude Integration

The WritersRoomView SHALL call the Claude subprocess via `sessionStore.sendMessage()` to generate the Show Lineup, replacing the current mock lineup generation. The integration SHALL reuse the existing `tryParseLineup()` pattern from ChatPanel to parse `showtime-lineup` JSON blocks from Claude's response.

#### Scenario: Successful lineup generation via Claude

- **GIVEN** the user is on the Writer's Room "plan" step with energy level selected
- **WHEN** the user enters plan text and clicks "Build my lineup"
- **THEN** Showtime SHALL send the plan text and energy level to Claude via `sessionStore.sendMessage()`
- **AND** the submit button SHALL display "Planning..." and be disabled while Claude processes
- **AND** when Claude responds with a `showtime-lineup` JSON block, Showtime SHALL parse it and populate the Show Lineup
- **AND** the view SHALL advance to the "lineup" step showing the parsed Acts

#### Scenario: Claude timeout or unavailability

- **GIVEN** the user submits plan text in the Writer's Room
- **WHEN** Claude does not respond within 30 seconds or returns an error
- **THEN** Showtime SHALL display an error message with an option to retry
- **AND** the user SHALL be able to retry the submission or manually edit the lineup

#### Scenario: Claude response without valid lineup JSON

- **GIVEN** Claude responds to the plan submission
- **WHEN** the response does not contain a valid `showtime-lineup` JSON block
- **THEN** Showtime SHALL display an error message indicating the lineup could not be parsed
- **AND** the user SHALL be able to retry

### Requirement: Shared lineup parser utility

The `tryParseLineup()` function SHALL be extracted from ChatPanel into a shared utility module so both ChatPanel and WritersRoomView use the same parsing logic.

#### Scenario: Both consumers parse lineup consistently

- **GIVEN** a Claude response containing a `showtime-lineup` JSON block
- **WHEN** either ChatPanel or WritersRoomView processes the response
- **THEN** both SHALL use the same `tryParseLineup()` function from the shared utility
- **AND** the parsed result SHALL be identical for the same input
