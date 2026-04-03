## ADDED Requirements

### Requirement: First-launch onboarding tutorial

Showtime SHALL display an interactive onboarding tutorial on first launch that introduces the SNL Day Framework concepts (Show, Acts, Beats, Writer's Room, Strike). The tutorial SHALL use the existing animation system and complete within 30 seconds of focused interaction.

#### Scenario: Onboarding shows on first launch

- **GIVEN** the user launches Showtime for the first time (no `showtime-onboarding-complete` key in localStorage)
- **AND** the show phase is `no_show`
- **WHEN** the App component renders
- **THEN** the `OnboardingView` SHALL render instead of the `DarkStudioView`
- **AND** step 1 ("Welcome to the Show") SHALL be visible
- **AND** the step indicator SHALL show 5 dots with the first dot highlighted in `accent` color
- **AND** the window SHALL use the `expanded` view mode (580x640)

#### Scenario: Onboarding does not show after completion

- **GIVEN** the user has previously completed the onboarding (`showtime-onboarding-complete` === `'true'` in localStorage)
- **AND** the show phase is `no_show`
- **WHEN** the App component renders
- **THEN** the `DarkStudioView` SHALL render (not OnboardingView)
- **AND** the onboarding SHALL not appear again unless triggered via the Help button

#### Scenario: User navigates through all 5 steps

- **GIVEN** the onboarding is visible at step 1
- **WHEN** the user clicks "Next" four times to advance through steps 1-4
- **THEN** each step SHALL transition using Framer Motion `AnimatePresence` with spring physics
- **AND** step 1 SHALL show "Your day is a Show" with `spotlightFadeIn` animation
- **AND** step 2 SHALL show "The Writer's Room" with a warm spotlight shift
- **AND** step 3 SHALL show "Acts and the ON AIR Light" with the `onairGlow` animation on a sample ON AIR indicator
- **AND** step 4 SHALL show "Beats: Moments of Presence" with the `beatIgnite` animation on a sample gold star
- **AND** step 5 SHALL show "Ready for Your First Show?" with `goldenGlow` on the CTA text
- **AND** step 5 SHALL have an "Enter the Writer's Room" button instead of "Next"

#### Scenario: Completing onboarding enters Writer's Room

- **GIVEN** the onboarding is visible at step 5
- **WHEN** the user clicks "Enter the Writer's Room"
- **THEN** Showtime SHALL set `showtime-onboarding-complete` to `'true'` in localStorage
- **AND** Showtime SHALL call `enterWritersRoom()` on the show store to transition to `writers_room` phase
- **AND** the `WritersRoomView` SHALL render with the energy selector visible
- **AND** the window SHALL resize to `full` mode (580x700) via `setViewMode('full')`

#### Scenario: User can skip onboarding

- **GIVEN** the onboarding is visible at any step
- **WHEN** the user clicks the "Skip" link
- **THEN** Showtime SHALL set `showtime-onboarding-complete` to `'true'` in localStorage
- **AND** the `DarkStudioView` SHALL render (standard first-launch experience)
- **AND** the onboarding SHALL not appear again unless re-triggered via Help

#### Scenario: User can go back to previous steps

- **GIVEN** the onboarding is visible at step 3 (or any step > 1)
- **WHEN** the user clicks the "Back" button
- **THEN** the view SHALL transition back to step 2 with a reverse spring animation
- **AND** step 1 SHALL NOT have a "Back" button (only "Next" and "Skip")

#### Scenario: Help button re-triggers onboarding

- **GIVEN** the user has completed onboarding and is on the DarkStudioView (phase `no_show`)
- **WHEN** the user clicks the Help button (`?`) in the title bar
- **THEN** Showtime SHALL remove the `showtime-onboarding-complete` key from localStorage
- **AND** the `OnboardingView` SHALL render starting at step 1
- **AND** the Help button SHALL be positioned at the top-right of the window (`right: 12px, top: 14px`)
- **AND** the Help button SHALL have `-webkit-app-region: no-drag` to remain clickable in the title bar drag region

#### Scenario: Onboarding uses no inline styles

- **GIVEN** the `OnboardingView` component renders at any step
- **THEN** all styling SHALL use Tailwind CSS utility classes
- **AND** all animations SHALL use Framer Motion spring physics or existing CSS keyframes from `index.css`
- **AND** zero `style={{}}` objects SHALL be present (per CLAUDE.md rule 1)
- **AND** the component SHALL use `font-body` (Inter) for body text and `font-mono` (JetBrains Mono) for labels
- **AND** the color palette SHALL use design system tokens (`bg-studio-bg`, `text-txt-primary`, `text-accent`, `text-beat`, etc.)

## Files

- `src/renderer/views/OnboardingView.tsx` — New component: 5-step tutorial with animations, Back/Next/Skip navigation
- `src/renderer/App.tsx` — Onboarding routing (localStorage check before DarkStudioView), Help button
- `src/renderer/index.css` — Any additional keyframes for onboarding-specific animations (if not covered by existing `spotlightFadeIn`, `onairGlow`, `beatIgnite`, `goldenGlow`)
