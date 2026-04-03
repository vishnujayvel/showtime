## MODIFIED Requirements

### Requirement: macOS vibrancy on BrowserWindow

The BrowserWindow SHALL be configured with `vibrancy: 'under-window'` and `visualEffectState: 'active'` to provide native macOS frosted glass appearance, as mandated by CLAUDE.md section 4.

#### Scenario: Window has native vibrancy

- **GIVEN** Showtime launches on macOS
- **WHEN** the BrowserWindow is created
- **THEN** the window SHALL have `vibrancy` set to `'under-window'`
- **AND** the window SHALL have `visualEffectState` set to `'active'`
- **AND** the transparent background (`#00000000`) SHALL allow the vibrancy effect to show through

### Requirement: PermissionCard Tailwind migration

The PermissionCard component SHALL use Tailwind CSS utility classes for all styling, removing all inline `style={{}}` objects and the `useColors()` dependency from `theme.ts`. This brings the component into compliance with CLAUDE.md rule 1 (NO INLINE STYLES).

#### Scenario: PermissionCard renders without inline styles

- **GIVEN** a permission request is displayed in the UI
- **WHEN** the PermissionCard component renders
- **THEN** all styling SHALL use Tailwind utility classes
- **AND** the component SHALL NOT import or call `useColors()` from `theme.ts`
- **AND** the component SHALL NOT contain any React `style={{}}` objects
- **AND** the visual appearance SHALL match the current design (header with shield icon, tool name, input preview, allow/deny buttons)

#### Scenario: Allow and deny buttons use Tailwind color classes

- **GIVEN** a permission request with allow and deny options
- **WHEN** the buttons render
- **THEN** allow buttons SHALL use Tailwind classes for green-tinted background and border (e.g., `bg-green-500/10 border-green-500/25`)
- **AND** deny buttons SHALL use Tailwind classes for red-tinted background and border (e.g., `bg-red-500/10 border-red-500/25`)
- **AND** hover states SHALL use Tailwind hover modifiers, not `onMouseEnter`/`onMouseLeave` event handlers

### Requirement: GoingLive ON AIR animation

The GoingLiveTransition SHALL include the ON AIR light box igniting with the `onairGlow` animation. The ON AIR indicator SHALL animate in with theatrical weight -- not just appear statically.

#### Scenario: ON AIR light ignites during Going Live

- **GIVEN** the user clicks "WE'RE LIVE!" in the Writer's Room
- **WHEN** the GoingLiveTransition renders
- **THEN** the ON AIR indicator SHALL animate in with a spring entrance (scale from 0 to 1)
- **AND** once visible, the ON AIR box SHALL have the `onair-glow` CSS class applied for the pulsing box-shadow animation
- **AND** the glow animation SHALL be visible for the duration of the 2500ms transition

### Requirement: Spotlight gradient CSS class

The radial gradient spotlight overlay in WritersRoomView SHALL use a CSS class defined in `index.css` instead of an inline `style={{}}` object, complying with CLAUDE.md rule 1.

#### Scenario: WritersRoomView spotlight uses CSS class

- **GIVEN** the Writer's Room view is rendered
- **WHEN** the spotlight gradient overlay is displayed
- **THEN** the gradient SHALL be applied via a CSS class (e.g., `.spotlight-warm`) defined in `src/renderer/index.css`
- **AND** the WritersRoomView component SHALL NOT contain an inline `style={{ background: 'radial-gradient(...)' }}` for the spotlight
- **AND** the visual appearance SHALL remain identical: `radial-gradient(ellipse at 50% 0%, rgba(217,119,87,0.05) 0%, transparent 70%)`
