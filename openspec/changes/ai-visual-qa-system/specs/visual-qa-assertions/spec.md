## ADDED Requirements

### Requirement: Viewport-aware clickability assertion
The system SHALL provide a custom Playwright matcher `toBeUserClickable()` that asserts an element is (1) visible in the DOM, (2) within the viewport without auto-scroll, (3) not obscured by another element at its center point, and (4) does not have `pointer-events: none`.

#### Scenario: Button below fold detected
- **WHEN** a button exists in the DOM but its bounding box is below `window.innerHeight`
- **THEN** `toBeUserClickable()` SHALL fail with message "Element is outside the viewport"

#### Scenario: Button obscured by overlay
- **WHEN** a button exists within viewport but `document.elementFromPoint()` at its center returns a different element
- **THEN** `toBeUserClickable()` SHALL fail with message "Element is obscured by another element"

#### Scenario: Button with pointer-events none
- **WHEN** a button has `pointer-events: none` via computed style
- **THEN** `toBeUserClickable()` SHALL fail with message "Element has pointer-events: none"

#### Scenario: Fully interactive button passes
- **WHEN** a button is visible, in viewport, topmost at center point, and has pointer-events auto
- **THEN** `toBeUserClickable()` SHALL pass

### Requirement: Overflow detection
The system SHALL detect content overflow in all views by scanning for elements where `scrollWidth > clientWidth` or `scrollHeight > clientHeight` with `overflow: visible`.

#### Scenario: Content spills outside container
- **WHEN** any element inside `[data-testid="showtime-app"]` has scrollWidth exceeding clientWidth with overflow:visible
- **THEN** the overflow detection test SHALL fail listing the offending element's tag, class, and dimensions

#### Scenario: Intentional scroll containers pass
- **WHEN** an element has `overflow: auto` or `overflow: hidden` and its scroll dimensions exceed client dimensions
- **THEN** the overflow detection test SHALL NOT flag it (intentional scrollable area)

### Requirement: Z-index stacking audit
The system SHALL verify that no interactive element (button, a, input, [role="button"]) is obscured by another element at its center point.

#### Scenario: Interactive element blocked by overlay
- **WHEN** `document.elementFromPoint()` at an interactive element's center returns a non-ancestor element
- **THEN** the z-index audit SHALL fail listing the obscured element and what obscures it

### Requirement: Bounding box containment
The system SHALL provide a `toFitWithin()` matcher that asserts one element's bounding box is fully contained within another's.

#### Scenario: Child element overflows parent
- **WHEN** an element's bounding box extends beyond its container's bounding box
- **THEN** `toFitWithin()` SHALL fail with the exact pixel coordinates of both boxes

### Requirement: All interactive elements use toBeInViewport before click
Every E2E test that clicks an interactive element SHALL assert `toBeInViewport({ ratio: 0.9 })` before the click action.

#### Scenario: Existing click tests upgraded
- **WHEN** running the E2E test suite
- **THEN** every `page.click()` or `locator.click()` on a user-facing element SHALL be preceded by a `toBeInViewport()` assertion
