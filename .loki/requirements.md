# Requirements Document — Showtime v2

## Introduction

Showtime is an ADHD-friendly macOS desktop day planner that transforms daily planning into a live performance using the SNL Day Framework. Built as a fork of CLUI CC (Electron + React + Claude Code wrapper), it replaces the general-purpose chat UI with a theatrical experience where the user IS the performer on a live variety show. Every state transition in the app maps to a moment in a live television production — from the dark studio before the show to the standing ovation at strike.

The product targets ADHD professionals who have been burned by rigid planners and shame-metric productivity tools. It competes on framing, not features: the theatrical framework generates sustainable novelty through daily variation, positioning the user as the star of their own show rather than an employee filing task reports.

**Reference documents:**
- Product context: `docs/plans/product-context.md`
- Design system: `docs/plans/design-system.md`
- UI mockup: `docs/mockups/direction-4-the-show.html`
- SNL framework: `docs/plans/snl-framework-reference.md`
- Electron best practices: `docs/plans/electron-best-practices-research.md`

---

## Requirements

### Requirement 1: macOS Native Window Management

**Objective:** As a macOS user, I want Showtime to feel like a native macOS application, so that it integrates seamlessly with my desktop environment and does not feel like a web page in a frame.

#### Acceptance Criteria

1. WHEN Showtime launches THEN Showtime SHALL create a BrowserWindow with `vibrancy: 'under-window'`, `visualEffectState: 'active'`, `backgroundColor: '#00000000'`, `transparent: true`, and `titleBarStyle: 'hiddenInset'`.
2. WHEN Showtime launches THEN Showtime SHALL position the native traffic light buttons at `{ x: 12, y: 14 }` using `setWindowButtonPosition`.
3. WHEN Showtime launches THEN Showtime SHALL set the HTML, body, and React root elements to `background-color: transparent` so macOS vibrancy shows through.
4. WHILE Showtime is running THE window SHALL remain always-on-top using NSPanel type and be visible on all macOS workspaces.
5. WHEN the user moves the mouse over the titlebar region THEN Showtime SHALL allow window dragging via `-webkit-app-region: drag`.
6. WHEN the user interacts with buttons, inputs, or other interactive elements within a drag region THEN Showtime SHALL prevent drag behavior via `-webkit-app-region: no-drag`.
7. WHEN macOS dark mode setting changes THEN Showtime SHALL detect the change via `nativeTheme.on('updated')` and broadcast the new theme to the renderer via IPC.
8. WHEN Showtime is in collapsed pill state THEN Showtime SHALL allow click-through on transparent areas using `setIgnoreMouseEvents` with forward option, so the user can interact with windows behind the pill.

---

### Requirement 2: Show State Machine

**Objective:** As a user, I want Showtime to manage my day as a Show with a defined lifecycle, so that I experience a structured but flexible progression through my day.

#### Acceptance Criteria

1. WHEN Showtime launches with no active Show THEN Showtime SHALL enter the `no_show` phase and display the Dark Studio view.
2. WHEN the user enters the Writer's Room THEN Showtime SHALL transition to the `writers_room` phase.
3. WHEN the user approves the lineup and clicks "We're live!" THEN Showtime SHALL transition to the `live` phase, start the first Act's timer, and display the Going Live transition.
4. WHEN the user pauses via the Rest button during a live Act THEN Showtime SHALL transition to the `intermission` phase and stop the Act timer.
5. WHEN the user exits intermission THEN Showtime SHALL transition back to the `live` phase and resume the Act timer.
6. WHEN the user triggers Director Mode (via button or overwhelm detection) THEN Showtime SHALL transition to the `director` phase and present compassionate options.
7. WHEN the user selects a Director Mode action THEN Showtime SHALL execute the action (skip Act, call show early, extended break, or breathing pause) and transition to the appropriate phase.
8. WHEN all Acts are completed or the Director calls the show THEN Showtime SHALL transition to the `strike` phase and display the Strike the Stage view with the appropriate verdict.
9. WHEN the user resets the Show THEN Showtime SHALL clear all state and return to the `no_show` phase.
10. WHILE a Show is active THE Showtime state SHALL persist to localStorage so that refreshing the window does not lose progress.
11. WHEN a new calendar day begins (midnight crossing) THEN Showtime SHALL detect the day boundary and offer to start a fresh Show.

---

### Requirement 3: Dark Studio View

**Objective:** As a user opening the app for the first time today, I want to see an empty stage with warm anticipation, so that I feel possibility rather than dread.

#### Acceptance Criteria

1. WHEN Showtime is in `no_show` phase THEN Showtime SHALL display the Dark Studio view with a near-black background (`#0d0d0f`), a radial spotlight gradient fading in, and centered text: "Tonight's show hasn't been written yet."
2. WHEN the Dark Studio view loads THEN Showtime SHALL animate the spotlight using a `spotlightFadeIn` animation (blur-to-sharp reveal over 1-2 seconds).
3. WHEN the user clicks "Enter the Writer's Room" THEN Showtime SHALL transition to the Writer's Room view with an animated transition.

---

### Requirement 4: Writer's Room (Morning Planning)

**Objective:** As a user, I want to plan my day in under 5 minutes through a guided flow, so that planning feels like writing tonight's show rather than filling out a form.

#### Acceptance Criteria

1. WHEN the Writer's Room opens THEN Showtime SHALL display Step 1: Energy Check with four options: High (amber), Medium (green), Low (blue), Recovery (purple).
2. WHEN the user selects an energy level THEN Showtime SHALL store the selection and advance to Step 2: Plan Dump.
3. WHEN Step 2 displays THEN Showtime SHALL show a textarea with placeholder text "What's on tonight's show?" styled as a notepad.
4. WHEN the user submits their plan text THEN Showtime SHALL send the text to Claude Code subprocess with the SNL skill context and the selected energy level.
5. WHEN Claude returns a structured lineup THEN Showtime SHALL parse the `showtime-lineup` JSON response and display Step 3: Lineup Preview.
6. WHEN the Lineup Preview displays THEN Showtime SHALL show each Act as a card with: Act number, name, sketch category (clapperboard badge), estimated duration, and reorder controls (up/down arrows).
7. WHEN the user clicks up/down arrows on an Act card THEN Showtime SHALL reorder that Act in the lineup.
8. WHEN the user clicks the skip button on an Act card THEN Showtime SHALL remove that Act from the lineup.
9. WHEN the user clicks "WE'RE LIVE!" THEN Showtime SHALL start the Show, transition to live phase, and display the Going Live transition.
10. WHILE the Writer's Room is open for more than 20 minutes THE Showtime SHALL display a gentle nudge: "The Writer's Room has a clock. Ready to go live?" — not a hard block.

---

### Requirement 5: Going Live Transition

**Objective:** As a user, I want the moment of going live to feel like a real production moment, so that I cross a psychological threshold from planning to performing.

#### Acceptance Criteria

1. WHEN the user clicks "WE'RE LIVE!" THEN Showtime SHALL display a 2-3 second transition showing the ON AIR light igniting from dark/off to glowing red.
2. WHEN the Going Live transition plays THEN Showtime SHALL display "Live from [your desk], it's [Today's Date]!" in bold typography.
3. WHEN the Going Live transition completes THEN Showtime SHALL collapse to the Pill view and start the first Act's timer.

---

### Requirement 6: Pill View (Collapsed State)

**Objective:** As a user, I want a minimal floating pill showing my current Act status, so that I can stay aware of my show without it being intrusive.

#### Acceptance Criteria

1. WHILE Showtime is in collapsed state THE pill SHALL display as a 320x48px rounded capsule positioned at the bottom center of the screen with backdrop blur and shadow.
2. WHILE an Act is live THE pill SHALL display: a pulsing red tally light (10px), the current Act name (truncated if long), the countdown timer in monospaced font (MM:SS), and Beat progress as stars (e.g., ★★☆).
3. WHEN the Act timer has less than 5 minutes remaining THEN the pill timer text SHALL shift to amber (#f59e0b) to indicate urgency without alarm.
4. WHILE in intermission THE pill SHALL display: tally light OFF, "Intermission" in muted text, and "no rush" label.
5. WHILE in strike phase THE pill SHALL display: "Show complete!" with a golden glow and final Beat count.
6. WHEN the user clicks the pill THEN Showtime SHALL expand to the full Expanded View with an animated transition.
7. WHEN the user presses Alt+Space (global hotkey) THEN Showtime SHALL toggle between pill and expanded states.

---

### Requirement 7: Expanded View (Live Show)

**Objective:** As a user during an active show, I want a full view with timer, lineup, and controls, so that I can manage my show like a production control room.

#### Acceptance Criteria

1. WHEN Showtime expands during a live show THEN Showtime SHALL display a ~560x620px window with: title bar, timer hero section, show lineup sidebar, and bottom status bar.
2. WHEN the Expanded View loads THEN the title bar SHALL display "SHOWTIME" in monospaced uppercase, a Director Mode button (🎬), and a collapse button (▼), with `-webkit-app-region: drag` for window dragging.
3. WHILE an Act is active THE timer hero section SHALL display: a clapperboard badge (`SKETCH | ACT N`), the Act name, a 64px monospaced countdown timer, a progress bar, and three action buttons (+15m, End Act, Rest).
4. WHEN the user clicks "+15m" THEN Showtime SHALL extend the current Act's remaining time by 15 minutes.
5. WHEN the user clicks "End Act" THEN Showtime SHALL complete the current Act and trigger the Beat Check modal.
6. WHEN the user clicks "Rest" THEN Showtime SHALL enter Intermission phase.
7. WHILE the Expanded View is open THE show lineup sidebar (~200px) SHALL display all Acts with status indicators: 🔴 active, ✅ completed (with ★ if Beat locked), ⏭ skipped (muted), ⏳ upcoming.
8. WHILE the Expanded View is open THE bottom status bar SHALL display the ON AIR indicator (lit red when live, dark when off) and the Beat counter (gold stars for locked, gray for empty).
9. WHEN the user clicks the collapse button THEN Showtime SHALL animate back to the Pill view.

---

### Requirement 8: Act Timer

**Objective:** As a user, I want a countdown timer for each Act, so that I have external time awareness without anxiety.

#### Acceptance Criteria

1. WHEN an Act begins THEN Showtime SHALL start a countdown timer based on the Act's estimated duration in minutes.
2. WHILE an Act timer is running THE timer SHALL tick at 1Hz (once per second) and display remaining time in MM:SS format.
3. WHEN the timer reaches 0:00 THEN Showtime SHALL auto-complete the Act and trigger the Beat Check modal.
4. WHEN the timer has less than 5 minutes remaining THEN the timer display SHALL shift to amber (#f59e0b) and pulse gently.
5. WHEN the user extends an Act by +15 minutes THEN Showtime SHALL add 15 minutes to the remaining time.
6. WHEN the user enters Intermission THEN Showtime SHALL pause the timer and preserve remaining time.
7. WHEN the user exits Intermission THEN Showtime SHALL resume the timer from where it was paused.
8. WHILE the timer is running THE progress bar SHALL display the percentage of time elapsed, colored by the Act's sketch category.

---

### Requirement 9: Beat Tracking

**Objective:** As a user, I want to be asked about presence after each Act, so that I track moments of immersion rather than just task completion.

#### Acceptance Criteria

1. WHEN an Act completes (timer reaches 0 or user clicks "End Act") THEN Showtime SHALL display the Beat Check modal.
2. WHEN the Beat Check modal appears THEN Showtime SHALL display: the completed Act's name and category, the question "Did you have a moment of presence?", a prominent "Yes — Lock the Beat" button (gold), and a subtle "Not this time" link.
3. WHEN the Beat Check modal appears THEN Showtime SHALL apply a spotlight effect (radial gradient from above) and dark scrim overlay.
4. WHEN the user clicks "Yes — Lock the Beat" THEN Showtime SHALL increment the Beat counter, play the `beatIgnite` animation (star transitions from gray to golden with glow), and display "That moment was real."
5. WHEN the user clicks "Not this time" THEN Showtime SHALL dismiss the modal without penalty, guilt, or negative feedback, and advance to the next Act.
6. WHILE the Show is active THE Beat counter SHALL display the current locked Beats vs the win threshold (e.g., "2/3 Beats") using gold stars for locked and gray stars for empty.

---

### Requirement 10: Intermission (Rest)

**Objective:** As a user, I want rest to feel like permission rather than failure, so that I can recharge without guilt.

#### Acceptance Criteria

1. WHEN the user enters Intermission THEN Showtime SHALL turn OFF the ON AIR indicator (red → dark gray).
2. WHEN the Intermission view displays THEN Showtime SHALL show a "WE'LL BE RIGHT BACK" card with no timer, no countdown, and no pressure to return.
3. WHEN the Intermission view displays THEN Showtime SHALL show a rotating affirmation from the affirmation library (e.g., "Rest is free. Always has been.", "The stage will be here when you're ready.").
4. WHILE in Intermission THE affirmation text SHALL have a gentle breathing animation.
5. WHILE in Intermission THE Beat counter SHALL be visible but dimmed — showing progress without pressure.
6. WHEN the user clicks "Back to the show" THEN Showtime SHALL exit Intermission and resume the paused Act.
7. WHILE in Intermission THE pill view SHALL display "Intermission" with no timer and "no rush" text.

---

### Requirement 11: Director Mode (Overwhelm Handler)

**Objective:** As a user feeling overwhelmed, I want a calm authority figure to help me make a decision, so that I can regain control without guilt.

#### Acceptance Criteria

1. WHEN the user clicks the Director Mode button (🎬) in the Expanded View THEN Showtime SHALL enter Director phase and display the Director Mode overlay.
2. WHEN Director Mode displays THEN Showtime SHALL show "The Director is here." in confident typography followed by four compassionate options:
   - "Skip to next Act" — rearrange what's left
   - "Call the show early" — trigger Strike with SHOW CALLED EARLY verdict
   - "Take a longer break" — extended intermission
   - "I just need a moment" — 5-minute breathing pause
3. WHEN the user selects any Director Mode option THEN Showtime SHALL execute the action immediately without confirmation dialogs ("Are you sure?").
4. WHEN the user selects "Call the show early" THEN Showtime SHALL transition to Strike phase with the SHOW CALLED EARLY verdict.
5. WHEN the user selects "I just need a moment" THEN Showtime SHALL enter a 5-minute breathing pause with no pressure to return early.

---

### Requirement 12: Strike the Stage (End of Day)

**Objective:** As a user ending my day, I want a curtain call that celebrates what I did rather than cataloging what I missed, so that I close the app feeling valued.

#### Acceptance Criteria

1. WHEN Showtime enters the `strike` phase THEN Showtime SHALL turn OFF the ON AIR indicator permanently.
2. WHEN Strike displays THEN Showtime SHALL compute the verdict based on locked Beats vs win threshold and display the appropriate verdict card.
3. IF Beats >= win threshold THEN Showtime SHALL display "DAY WON." with golden glow animation, warm lighting, and "You showed up and you were present."
4. IF Beats = win threshold - 1 THEN Showtime SHALL display "SOLID SHOW." with amber tones and "Not every sketch lands. The show was still great."
5. IF Beats >= 50% of threshold THEN Showtime SHALL display "GOOD EFFORT." with calm blue tones and "You got on stage. That's the hardest part."
6. IF Beats < 50% of threshold THEN Showtime SHALL display "SHOW CALLED EARLY." with warm neutral tones and "Sometimes the show is short. The audience still came."
7. WHEN Strike displays THEN Showtime SHALL show three stats: Acts Completed, Acts Cut, and Beats Locked.
8. WHEN Strike displays THEN Showtime SHALL show an Act recap list (scrollable) showing each Act with its status and Beat indicator, styled like end credits.
9. WHEN the user clicks "New Show" THEN Showtime SHALL reset all state and return to Dark Studio.
10. WHEN the user clicks "Close" THEN Showtime SHALL collapse to pill and enter a dormant state.

---

### Requirement 13: Claude Code Integration

**Objective:** As a user, I want Claude to help me plan my day by structuring my free-text input into a Show Lineup, so that I get the benefits of AI-assisted planning within the theatrical framework.

#### Acceptance Criteria

1. WHEN the user submits plan text in the Writer's Room THEN Showtime SHALL send a prompt to the Claude Code subprocess (`claude -p --output-format stream-json`) including the user's text, selected energy level, and the SNL skill context.
2. WHEN Claude responds with a `showtime-lineup` JSON block THEN Showtime SHALL parse the response and populate the Show Lineup with Acts (name, sketch category, duration, order).
3. IF Claude's response does not contain a valid `showtime-lineup` JSON block THEN Showtime SHALL display the raw response in the chat area and allow the user to retry.
4. WHILE Claude is processing THE Writer's Room SHALL display a "Planning..." state on the submit button and disable resubmission.
5. WHEN the user adds an ad-hoc Act mid-show via chat THEN Showtime SHALL parse any new `showtime-lineup` additions and insert them into the current lineup.

---

### Requirement 14: Visual Design System Compliance

**Objective:** As a developer, I want all UI components to follow the Direction 4 design system, so that the app has a consistent, production-grade theatrical aesthetic.

#### Acceptance Criteria

1. WHILE implementing any UI component THE developer SHALL use Tailwind CSS utility classes exclusively — never React `style={{}}` inline style objects.
2. WHILE implementing interactive components THE developer SHALL use shadcn/ui + Radix UI headless primitives for buttons, modals, dialogs, cards, and other interactive patterns.
3. WHILE implementing any UI component THE developer SHALL use the color palette defined in `docs/plans/design-system.md` via Tailwind `@theme` CSS custom properties.
4. WHILE implementing typography THE developer SHALL use JetBrains Mono for data (timers, badges, labels) and Inter for body text (headings, descriptions, buttons).
5. WHILE implementing animations THE developer SHALL use Framer Motion with spring physics (`type: "spring"`) — never linear transitions.
6. WHERE a component references the mockup THE developer SHALL match the dimensions, spacing, colors, and typography specified in `docs/mockups/direction-4-the-show.html`.
7. WHILE implementing the ON AIR light THE developer SHALL implement both live (red, pulsing glow) and off (dark gray, no glow) states as specified in the design system.
8. WHILE implementing Beat stars THE developer SHALL use gold (#f59e0b) for locked and gray (#5a5855) for empty, with a `beatIgnite` animation on lock.

---

### Requirement 15: Theatrical Language System

**Objective:** As a user, I want all app language to use theatrical/production terminology, so that I feel like a performer, not an employee being managed.

#### Acceptance Criteria

1. WHILE displaying any user-facing text THE Showtime SHALL use SNL framework terminology exclusively — Acts (not tasks), Beats (not completions), Show (not day), Lineup (not schedule), Strike (not end), Director (not settings), Intermission (not break).
2. WHILE displaying any user-facing text THE Showtime SHALL never use guilt language: never "failed," "missed," "behind," "overdue," "should have," or "procrastinating."
3. WHERE an Act is not completed THE Showtime SHALL describe it as "cut from tonight's show" — not "incomplete" or "failed."
4. WHERE the user ends the day early THE Showtime SHALL describe it as "the Director called the show" — not "gave up" or "quit."
5. WHERE the user takes a break THE Showtime SHALL affirm rest: "Rest is free. Always has been." — never imply the user should return sooner.

---

### Requirement 16: Testing and Verification

**Objective:** As a developer, I want comprehensive E2E and unit test coverage, so that refactoring and agent-generated code do not break user-visible behavior.

#### Acceptance Criteria

1. WHEN a new feature is implemented THEN the developer SHALL write Playwright E2E tests covering the feature's user-visible behavior.
2. WHEN Playwright E2E tests run THEN they SHALL launch the full Electron application via `electron.launch()` and assert DOM states.
3. WHEN unit tests run THEN they SHALL use Vitest with jsdom environment for store logic, hooks, and pure functions.
4. WHEN the full test suite runs THEN all E2E tests SHALL cover: app launch, Dark Studio → Writer's Room transition, energy selection, plan submission, lineup preview, "We're live!" transition, Act timer countdown, Beat Check modal interaction, Intermission flow, Director Mode actions, Strike the Stage with all four verdicts, and Pill ↔ Expanded transitions.
5. WHEN the CI pipeline runs THEN both `npm run test` (Vitest) and `npm run test:e2e` (Playwright) SHALL pass before code is merged.

---

### Requirement 17: CLUI Dead Weight Removal

**Objective:** As a developer, I want all unused CLUI components removed, so that the codebase contains only Showtime-relevant code.

#### Acceptance Criteria

1. WHEN implementing Showtime v2 THEN the developer SHALL remove these CLUI-specific files: ConversationView.tsx, InputBar.tsx (replace with simplified Showtime chat input), AttachmentChips.tsx, SlashCommandMenu.tsx, PopoverLayer.tsx (replace with shadcn/ui), HistoryPicker.tsx, MarketplacePanel.tsx, SettingsPopover.tsx, StatusBar.tsx, TabStrip.tsx.
2. WHEN implementing Showtime v2 THEN the developer SHALL simplify sessionStore.ts from multi-tab to single-session — removing tab array management, tab switching, and tab close logic.
3. WHEN removing CLUI components THEN the developer SHALL verify that Claude subprocess communication (RunManager, ControlPlane, StreamParser, IPC bridge) remains fully functional.
