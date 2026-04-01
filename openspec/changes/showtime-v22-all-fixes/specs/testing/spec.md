## ADDED Requirements

### Requirement: Playwright MCP-based visual validation

Every Showtime view and major interaction SHALL have automated visual validation via Playwright E2E tests. Tests SHALL assert on DOM structure, CSS properties, and visual state — not just element existence.

#### Scenario: Each view has a visual validation test

- **GIVEN** the Playwright E2E test suite runs against the built Electron app
- **WHEN** each view is navigated to (Dark Studio, Writer's Room, Expanded, Pill, Beat Check, Intermission, Strike, GoingLive)
- **THEN** a screenshot SHALL be captured and saved to `e2e/screenshots/`
- **AND** DOM assertions SHALL verify expected CSS classes, dimensions, and visual properties

#### Scenario: No inline styles on migrated components

- **GIVEN** PermissionCard, WritersRoomView, GoingLiveTransition, and BeatCheckModal are rendered
- **WHEN** the test inspects their DOM
- **THEN** no element within these components SHALL have a `style` attribute containing `background`, `color`, or `display` (only `-webkit-app-region: drag` is permitted as an inline style)

#### Scenario: Animation classes are applied

- **GIVEN** the GoingLive transition is playing
- **WHEN** the ON AIR indicator animates in
- **THEN** the indicator's container SHALL have the `onair-glow` CSS class

- **GIVEN** the Beat Check celebration is showing
- **WHEN** "That moment was real" is displayed
- **THEN** the text element SHALL have the `animate-beat-ignite` CSS class

#### Scenario: Window dimensions match spec

- **GIVEN** each view is rendered
- **WHEN** the test measures the view container dimensions
- **THEN** the dimensions SHALL match the spec within 10px tolerance:
  - Pill: 320x48
  - Writer's Room: 560x680 (min-height)
  - Expanded: 560x620
  - Beat Check: 380px wide (modal card)
  - Strike: 560px wide, variable height (max 680px)

### Requirement: Comprehensive test matrix

Showtime SHALL have test coverage at three levels: unit (Vitest), component (Vitest + jsdom), and E2E (Playwright). The test matrix below defines all required test cases across these levels.

#### Scenario: All three test levels have coverage

- **GIVEN** the test matrix defines test cases at unit, component, and E2E levels
- **WHEN** `npm run test` and `npm run test:e2e` are executed
- **THEN** all P0 test cases SHALL pass
- **AND** unit tests SHALL cover store actions, hooks, and utility functions
- **AND** component tests SHALL cover rendering, user interactions, and state changes
- **AND** E2E tests SHALL cover the full user flow from Dark Studio through Strike

## TEST MATRIX

| Test ID | Level | View/Component | Scenario | GIVEN | WHEN | THEN | Priority |
|---------|-------|---------------|----------|-------|------|------|----------|
| U-01 | Unit | showStore | lockBeat increments beatsLocked | store with beatsLocked=0 | lockBeat() called | beatsLocked === 1, celebrationActive === true | P0 |
| U-02 | Unit | showStore | lockBeat sets beatLocked on current act | store with currentActId set, act.beatLocked=false | lockBeat() called | current act has beatLocked=true | P0 |
| U-03 | Unit | showStore | lockBeat celebration clears after 1800ms | store after lockBeat() | 1800ms elapses (fake timers) | celebrationActive=false, beatCheckPending=false | P0 |
| U-04 | Unit | showStore | lockBeat advances to next act after celebration | store with 2 acts, first completed | lockBeat() + 1800ms | currentActId === second act's id, phase === 'live' | P0 |
| U-05 | Unit | showStore | lockBeat strikes stage when no acts remain | store with all acts completed | lockBeat() + 1800ms | phase === 'strike', verdict is set | P0 |
| U-06 | Unit | showStore | lockBeat double-call cancels first timeout | store after lockBeat() | lockBeat() called again before 1800ms | only one advancement occurs after 1800ms | P0 |
| U-07 | Unit | showStore | resetShow cancels celebration timeout | store after lockBeat() | resetShow() called within 1800ms | no stale startAct fires, store is reset | P0 |
| U-08 | Unit | showStore | lockBeat guards against phase change | store after lockBeat(), phase=live | phase changed to 'intermission' before 1800ms | timeout callback does NOT call startAct | P1 |
| U-09 | Unit | showStore | skipBeat advances immediately | store with beatCheckPending=true | skipBeat() called | beatCheckPending=false, next act started immediately | P0 |
| U-10 | Unit | showStore | setEnergy stores energy level | store with energy=null | setEnergy('high') called | energy === 'high' | P1 |
| U-11 | Unit | showStore | setLineup populates acts array | store with empty acts | setLineup({ acts: [...], beatThreshold: 3 }) | acts.length > 0, beatThreshold === 3 | P0 |
| U-12 | Unit | showStore | strikeTheStage calculates correct verdict | store with beatsLocked=3, beatThreshold=3 | strikeTheStage() | verdict === 'DAY_WON' | P1 |
| U-13 | Unit | showStore | completeAct sets beatCheckPending | store with active act | completeAct(actId) | beatCheckPending === true, act.status === 'completed' | P0 |
| U-14 | Unit | showStore | enterIntermission pauses timer | store with timerEndAt set | enterIntermission() | phase === 'intermission', timerPausedRemaining > 0 | P1 |
| U-15 | Unit | showStore | exitIntermission resumes timer | store in intermission with timerPausedRemaining | exitIntermission() | phase === 'live', timerEndAt is set, timerPausedRemaining is null | P1 |
| U-16 | Unit | useTimer | countdown decrements every second | timerEndAt = now + 60000 | 1 second elapses | totalSeconds decreases by 1 | P0 |
| U-17 | Unit | useTimer | timer completes and triggers completeAct | timerEndAt = now + 1000 | 1 second elapses | isComplete === true, completeAct called | P0 |
| U-18 | Unit | useTimer | paused timer returns 0 | timerEndAt = null | hook renders | isRunning === false, totalSeconds === 0 | P1 |
| U-19 | Unit | useTimer | progress calculates elapsed fraction | timerEndAt = now + 30000, act.durationMinutes = 1 | 30 seconds elapsed | progress === 0.5 | P1 |
| U-20 | Unit | lineup-parser | parses valid showtime-lineup JSON | Claude response with ```showtime-lineup JSON block | tryParseLineup() called | returns parsed lineup object with acts array | P0 |
| U-21 | Unit | lineup-parser | returns null for invalid JSON | Claude response with malformed JSON | tryParseLineup() called | returns null | P0 |
| U-22 | Unit | lineup-parser | returns null for missing acts field | Claude response with JSON missing 'acts' | tryParseLineup() called | returns null | P1 |
| C-01 | Component | BeatCheckModal | renders prompt when beatCheckPending | beatCheckPending=true, celebrationActive=false | component mounts | "Did you have a moment of presence?" text visible | P0 |
| C-02 | Component | BeatCheckModal | renders celebration when celebrationActive | beatCheckPending=true, celebrationActive=true | component renders | "That moment was real" text visible, beat-ignite class present | P0 |
| C-03 | Component | BeatCheckModal | Lock the Beat button calls lockBeat | beatCheckPending=true | user clicks "Yes -- Lock the Beat" | lockBeat store action is called | P0 |
| C-04 | Component | BeatCheckModal | Not this time calls skipBeat | beatCheckPending=true | user clicks "Not this time" | skipBeat store action is called | P0 |
| C-05 | Component | BeatCheckModal | hidden when beatCheckPending=false | beatCheckPending=false | component renders | returns null, no DOM output | P1 |
| C-06 | Component | EnergySelector | renders four energy buttons | component mounts | rendered | High Energy, Medium, Low, Recovery buttons visible | P0 |
| C-07 | Component | EnergySelector | clicking button calls onSelect | component mounts | user clicks "High Energy" | onSelect('high') called | P0 |
| C-08 | Component | WritersRoomView | shows loading state when isSubmitting | plan text entered, "Build my lineup" clicked | Claude is processing | "The writers are working..." text visible, animated element present | P0 |
| C-09 | Component | WritersRoomView | shows error after timeout | isSubmitting=true for 30s | timeout fires | error message visible, "Try again" or retry option present | P1 |
| C-10 | Component | ActCard | renders act name and category | act with name="Deep Work session", sketch="Deep Work" | component renders | act name text visible, category badge visible with correct color | P1 |
| C-11 | Component | PermissionCard | renders with zero inline styles | permission object provided | component renders | no element has style attribute with background/color/display | P0 |
| C-12 | Component | GoingLiveTransition | applies onair-glow class | component mounts | spring animation completes | element with onair-glow class exists in DOM | P1 |
| C-13 | Component | ShowVerdict | renders correct verdict text | verdict='DAY_WON' | component renders | "DAY WON" text visible, golden-glow class present | P1 |
| E-01 | E2E | Full Flow | App launches to Dark Studio | Electron app built | app.firstWindow() obtained | "Enter the Writer's Room" CTA visible within 10s | P0 |
| E-02 | E2E | Full Flow | Dark Studio to Writer's Room | Dark Studio visible | click "Enter the Writer's Room" | Energy selector visible (High/Medium/Low/Recovery buttons) | P0 |
| E-03 | E2E | Full Flow | Energy selection to plan dump | Writer's Room energy step | click "High Energy" | Textarea visible, "Build my lineup" button visible | P0 |
| E-04 | E2E | Full Flow | Plan submission shows loading | textarea filled with plan text | click "Build my lineup" | "The writers are working..." loading animation visible | P0 |
| E-05 | E2E | Full Flow | Claude generates valid lineup | loading state active, Claude available | Claude responds within 30s | Lineup panel visible with Act cards, each showing name and category | P0 |
| E-06 | E2E | Full Flow | Claude timeout shows error | loading state active, Claude unavailable | 30s timeout | Error message visible, retry option available | P1 |
| E-07 | E2E | Full Flow | Going Live transition | lineup preview visible | click "WE'RE LIVE!" | GoingLive transition plays, ON AIR indicator visible with onair-glow | P0 |
| E-08 | E2E | Full Flow | Timer counts down in Expanded view | live phase, expanded view | 2-3 seconds elapse | Timer digits decrease, timer is in mm:ss format | P0 |
| E-09 | E2E | Full Flow | Beat Check after act completion | store: act completed, beatCheckPending=true | modal appears | "Did you have a moment of presence?" visible, both buttons visible | P0 |
| E-10 | E2E | Full Flow | Beat celebration plays for 1800ms | Beat Check visible | click "Yes -- Lock the Beat" | "That moment was real" visible for ~1800ms, then modal dismissed | P0 |
| E-11 | E2E | Full Flow | Intermission view | store: phase=intermission | view renders | "WE'LL BE RIGHT BACK" or intermission text visible | P1 |
| E-12 | E2E | Full Flow | Strike view with verdict | store: phase=strike, verdict=SOLID_SHOW | view renders | "SOLID SHOW" text visible, Beat stars rendered | P0 |
| E-13 | E2E | Window | macOS vibrancy config | app launched | inspect BrowserWindow options | vibrancy === 'under-window' (verified via main process evaluation) | P1 |
| E-14 | E2E | Window | View dimensions within frame | each view rendered | measure container bounds | width and height within 10px of spec values | P1 |
| E-15 | E2E | Window | Pill to Expanded transition | pill view visible | click to expand | expanded view animates in, pill disappears | P1 |
| E-16 | E2E | Quit | Tray menu has Quit option | app launched | access tray context menu | "Quit Showtime" menu item exists | P1 |
| E-17 | E2E | Quit | Cmd+Q quits the app | app launched | send Cmd+Q keypress | app process terminates | P2 |
| E-18 | E2E | Process | No orphan processes after test | all tests complete | afterAll hook runs | no Electron helper processes remain (GPU, Renderer, Network) | P1 |

### Priority Key
- **P0** — Must pass before merge. Blocks release.
- **P1** — Should pass. Can merge with known failures if documented.
- **P2** — Nice to have. Informational.

## Files

- `src/__tests__/showStore.test.ts` — Unit tests for store actions (U-01 through U-15)
- `src/__tests__/useTimer.test.ts` — Unit tests for timer hook (U-16 through U-19)
- `src/__tests__/lineup-parser.test.ts` — Unit tests for lineup parser (U-20 through U-22)
- `src/__tests__/components/BeatCheckModal.test.tsx` — Component tests (C-01 through C-05)
- `src/__tests__/components/EnergySelector.test.tsx` — Component tests (C-06, C-07)
- `src/__tests__/components/WritersRoomView.test.tsx` — Component tests (C-08, C-09)
- `src/__tests__/components/ActCard.test.tsx` — Component tests (C-10)
- `src/__tests__/components/PermissionCard.test.tsx` — Component tests (C-11)
- `src/__tests__/components/GoingLiveTransition.test.tsx` — Component tests (C-12)
- `src/__tests__/components/ShowVerdict.test.tsx` — Component tests (C-13)
- `e2e/showtime.test.ts` — E2E tests (E-01 through E-18)
