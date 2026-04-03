## MODIFIED Requirements

### Requirement: Claude E2E verification with conditional test

The E2E test suite SHALL verify that submitting a plan in the Writer's Room produces a real Claude-generated lineup when Claude is available, and gracefully handles the error/retry path when Claude is unavailable. The test SHALL pass in both scenarios.

#### Scenario: Claude available — lineup generated with valid Act cards

- **GIVEN** the E2E test has navigated to the Writer's Room plan step (energy selected, textarea visible)
- **AND** the Claude subprocess is available and responding
- **WHEN** the test enters plan text ("Today I need to do deep work on the API, exercise at lunch, then admin tasks") and clicks "Build my lineup"
- **THEN** within 30 seconds, the lineup panel SHALL appear with Act cards
- **AND** each Act card SHALL contain a visible name (non-empty text)
- **AND** each Act card SHALL contain a duration (text matching a `\d+` minute pattern)
- **AND** each Act card SHALL contain a category badge with a category color class
- **AND** at least 2 Act cards SHALL be visible (the plan mentions 3 activities)
- **AND** the test SHALL log "Claude path: lineup generated successfully" for debugging

#### Scenario: Claude unavailable — error/retry UI appears

- **GIVEN** the E2E test has navigated to the Writer's Room plan step
- **AND** the Claude subprocess is unavailable (no auth, network error, or timeout)
- **WHEN** the test enters plan text and clicks "Build my lineup"
- **AND** 30 seconds elapse without a Claude response
- **THEN** the error UI SHALL appear with a message using show-metaphor language
- **AND** a retry button SHALL be visible and clickable
- **AND** the error message SHALL NOT use generic error language (no "Error", "Failed", "Something went wrong")
- **AND** the test SHALL log "Claude path: unavailable, error UI verified" for debugging

#### Scenario: Conditional test passes in both environments

- **GIVEN** the E2E test suite runs in any environment (local dev, CI, offline)
- **WHEN** the Claude verification test executes
- **THEN** exactly one of the two paths (lineup generated OR error UI) SHALL be validated
- **AND** the test SHALL pass regardless of which path was taken
- **AND** the test result SHALL clearly indicate which path was exercised

#### Scenario: Loading indicator appears immediately after submission

- **GIVEN** the user has entered plan text in the Writer's Room
- **WHEN** the user clicks "Build my lineup"
- **THEN** the "The writers are working..." loading text SHALL appear within 500ms
- **AND** the loading animation SHALL be visible while waiting for Claude
- **AND** the "Build my lineup" button SHALL be disabled or hidden during loading

## Files

- `e2e/showtime.test.ts` — New conditional test: "Writer's Room generates real lineup via Claude", loading indicator verification
