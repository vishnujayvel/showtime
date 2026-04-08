## MODIFIED Requirements

### Requirement: All views have ARIA snapshot coverage
Every full-screen view in the XState machine SHALL have a corresponding `toMatchAriaSnapshot()` test that validates the semantic structure of the rendered view.

#### Scenario: ARIA snapshot for each view state
- **WHEN** running the visual test project
- **THEN** ARIA snapshot tests SHALL exist for: DarkStudioView, WritersRoomView (chat, with-lineup), ExpandedView, CompactView, DashboardView, PillView, Intermission, StrikeView (all 4 verdicts)

#### Scenario: ARIA snapshot catches missing element
- **WHEN** a required element (e.g., ON AIR indicator) is removed from a view
- **THEN** the corresponding ARIA snapshot test SHALL fail

### Requirement: All views pass structural layout validation
Every view SHALL pass overflow detection, z-index stacking audit, and viewport containment checks.

#### Scenario: Overflow-free rendering
- **WHEN** seeding any view fixture and running overflow detection
- **THEN** zero elements SHALL have unintentional overflow (scrollWidth > clientWidth with overflow:visible)

#### Scenario: No interactive elements obscured
- **WHEN** seeding any view fixture and running z-index audit
- **THEN** every button, link, and input SHALL be the topmost element at its center point

### Requirement: Hardened pixel-diff thresholds
Visual regression tests SHALL use tiered thresholds based on view dynamism.

#### Scenario: Static views use strict threshold
- **WHEN** comparing DarkStudioView or StrikeView screenshots
- **THEN** `maxDiffPixelRatio` SHALL be 0.01 (1%)

#### Scenario: Timer views use moderate threshold with masking
- **WHEN** comparing ExpandedView, CompactView, or PillView screenshots
- **THEN** `maxDiffPixelRatio` SHALL be 0.03 (3%) with timer elements masked via `stylePath`

#### Scenario: Chat views use current threshold
- **WHEN** comparing WritersRoomView screenshots
- **THEN** `maxDiffPixelRatio` SHALL be 0.05 (5%)

### Requirement: Animation and rendering consistency
Visual tests SHALL freeze animations and normalize rendering environment.

#### Scenario: Framer Motion animations skipped in test
- **WHEN** the app runs in test mode (NODE_ENV=test)
- **THEN** Framer Motion `skipAnimations` SHALL be true

#### Scenario: Device scale factor pinned
- **WHEN** launching Electron in test mode
- **THEN** `force-device-scale-factor=1` SHALL be passed as a command-line switch

#### Scenario: Color scheme forced to dark
- **WHEN** launching Electron via Playwright
- **THEN** `colorScheme: 'dark'` SHALL be set in the launch options
