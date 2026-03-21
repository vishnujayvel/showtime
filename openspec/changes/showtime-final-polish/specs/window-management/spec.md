## MODIFIED Requirements

### Requirement: Dynamic window resizing per view mode

Showtime SHALL dynamically resize the native BrowserWindow via `mainWindow.setBounds()` when the view mode changes, replacing the fixed 1040x720 transparent frame. Each view mode maps to specific native window dimensions. The window SHALL remain bottom-anchored and horizontally centered on the current display.

#### Scenario: Pill view dimensions

- **GIVEN** the user is in live phase and collapses to pill view
- **WHEN** the renderer calls `setViewMode('pill')`
- **THEN** the main process SHALL call `mainWindow.setBounds()` with width 340 and height 60
- **AND** the window SHALL be horizontally centered on the current display
- **AND** the window bottom edge SHALL be anchored at `screenHeight - 60 - PILL_BOTTOM_MARGIN` within the work area
- **AND** the pill content (320x48) SHALL be fully visible within the window

#### Scenario: Expanded/Live view dimensions

- **GIVEN** the user is in live phase and expands the window (or transitions from pill to expanded)
- **WHEN** the renderer calls `setViewMode('expanded')`
- **THEN** the main process SHALL call `mainWindow.setBounds()` with width 580 and height 640
- **AND** the window SHALL be horizontally centered on the current display
- **AND** the window bottom edge SHALL remain at the same screen position as the pill (bottom-anchored)
- **AND** the Expanded view content (560x620 timer hero + lineup sidebar) SHALL be fully visible

#### Scenario: WritersRoom view dimensions

- **GIVEN** the user enters the Writer's Room phase
- **WHEN** the renderer calls `setViewMode('full')`
- **THEN** the main process SHALL call `mainWindow.setBounds()` with width 580 and height 700
- **AND** the window SHALL be horizontally centered on the current display
- **AND** the window bottom edge SHALL remain bottom-anchored
- **AND** the Writer's Room content (560x680 energy + plan + lineup) SHALL be fully visible without clipping

#### Scenario: StrikeView dimensions

- **GIVEN** the show enters strike phase
- **WHEN** the renderer calls `setViewMode('full')`
- **THEN** the main process SHALL call `mainWindow.setBounds()` with width 580 and height 700
- **AND** the Strike view content (stats + verdict + act recap) SHALL be fully visible
- **AND** if the act recap exceeds available height, the view SHALL scroll internally

#### Scenario: DarkStudio view dimensions

- **GIVEN** the app launches in `no_show` phase with no existing show
- **WHEN** the renderer calls `setViewMode('expanded')`
- **THEN** the main process SHALL call `mainWindow.setBounds()` with width 580 and height 640
- **AND** the Dark Studio content (spotlight + "Enter the Writer's Room" CTA) SHALL be centered within the window

#### Scenario: Position recalculation maintains bottom-anchor during transitions

- **GIVEN** the user transitions between views of different heights (e.g., pill 60px to expanded 640px)
- **WHEN** the main process calculates the new window position
- **THEN** the new `y` position SHALL be calculated as `workArea.y + workAreaHeight - newHeight - PILL_BOTTOM_MARGIN`
- **AND** the new `x` position SHALL be calculated as `workArea.x + (workAreaWidth - newWidth) / 2`
- **AND** the bottom edge of the window SHALL remain at a consistent screen position across all view sizes
- **AND** views SHALL expand/contract upward from the bottom edge, never downward

### Requirement: View mode IPC integration in renderer

The renderer SHALL call `window.clui.setViewMode()` whenever the active view changes, ensuring the native window dimensions stay in sync with the rendered content.

#### Scenario: App.tsx sends correct view mode on phase change

- **GIVEN** the App component mounts and the show phase or `isExpanded` state changes
- **WHEN** `useEffect` fires for the phase/expansion change
- **THEN** the renderer SHALL call `window.clui.setViewMode()` with the correct mode:
  - `'pill'` when `isExpanded === false` (any phase)
  - `'expanded'` when `isExpanded === true` and phase is `no_show`, `live`, `intermission`, or `director`
  - `'full'` when `isExpanded === true` and phase is `writers_room` or `strike`
- **AND** the call SHALL happen before the Framer Motion animation starts rendering

## Files

- `src/main/index.ts` — `SET_VIEW_MODE` IPC handler (lines 384-399), `BAR_WIDTH`/`PILL_HEIGHT` constants (lines 33-34), `createWindow()` (line 95), `VIEW_DIMENSIONS` map (new)
- `src/renderer/App.tsx` — `renderView()` function, new `useEffect` for `setViewMode()` calls
- `src/preload/index.ts` — `setViewMode` already defined (line 168)
- `src/shared/types.ts` — `SET_VIEW_MODE` IPC constant already defined (line 418)
