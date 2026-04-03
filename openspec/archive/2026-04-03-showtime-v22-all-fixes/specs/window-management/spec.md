## MODIFIED Requirements

### Requirement: Window sizing and view layout

Showtime uses a fixed-size transparent NSPanel window (1040x720) with OS-level click-through for transparent regions. All views render at their specified CSS dimensions inside this frame. The window SHALL NOT dynamically resize between views.

#### Scenario: Views center within fixed frame

- **GIVEN** the native window is 1040x720 with `transparent: true` and `resizable: false`
- **WHEN** any view renders (Dark Studio, Writer's Room, Expanded, Pill, Strike)
- **THEN** the view SHALL be horizontally centered within the frame
- **AND** the view SHALL be vertically anchored to the bottom of the frame (matching pill position at screen bottom)
- **AND** no view content SHALL be clipped by the native window bounds

#### Scenario: Writer's Room fits within frame

- **GIVEN** Writer's Room renders at 560x680px (as specified in CLAUDE.md view dimensions)
- **WHEN** the Writer's Room view is displayed
- **THEN** the view SHALL fit within the 720px frame height with at least 20px top padding
- **AND** the plan dump textarea SHALL be fully visible and scrollable
- **AND** the "Build my lineup" button SHALL be fully visible without scrolling

#### Scenario: Strike view with variable height

- **GIVEN** Strike view has variable height depending on number of Acts in recap
- **WHEN** the recap list exceeds the available frame height
- **THEN** the Strike view SHALL apply `max-h-[680px]` with `overflow-y-auto`
- **AND** the scrollbar SHALL use the custom themed scrollbar from `index.css`
- **AND** the verdict headline and Beat stars SHALL remain visible (not scrolled out of view)

#### Scenario: Pill to Expanded transition

- **GIVEN** the user is in Pill view (320x48)
- **WHEN** the user clicks to expand
- **THEN** the Expanded view (560x620) SHALL animate into view using Framer Motion spring physics
- **AND** the transparent region around the view SHALL remain click-through
- **AND** there SHALL be no visible window resize flicker

#### Scenario: View transitions maintain position

- **GIVEN** the native window position is anchored to screen bottom-center
- **WHEN** transitioning between views of different sizes
- **THEN** the bottom edge of the active view SHALL remain at the same screen position
- **AND** view size changes SHALL only expand/contract upward from the bottom edge

### Requirement: Transparent click-through behavior

The transparent regions of the native window SHALL pass mouse events through to the desktop.

#### Scenario: Click-through on transparent regions

- **GIVEN** the native window contains a view smaller than the frame
- **WHEN** the user clicks on a transparent region outside the view
- **THEN** the click SHALL pass through to whatever is behind the window
- **AND** mouse move events SHALL still be forwarded to the renderer (for hover detection)

#### Scenario: Interactive regions disable click-through

- **GIVEN** the mouse enters a `[data-clui-ui]` element
- **WHEN** the user clicks
- **THEN** the click SHALL be handled by the renderer (click-through disabled)
- **AND** when the mouse leaves the UI element, click-through SHALL re-enable

## Files

- `src/main/index.ts` — Window creation, `BAR_WIDTH`/`PILL_HEIGHT` constants, `setIgnoreMouseEvents`
- `src/renderer/App.tsx` — View routing, root layout container
- `src/renderer/views/StrikeView.tsx` — Variable height, needs max-h + overflow
- All view files — CSS dimensions and vertical centering
