# Implementation Tasks — Showtime v2

**Spec:** `.claude/specs/showtime-v2/`
**Generated:** 2026-03-20
**Total tasks:** 30 across 7 groups
**Estimated effort:** 15-60 minutes per task for a Loki Mode agent

**Global rules (apply to EVERY task):**
- Follow `docs/plans/design-system.md` for all color tokens, typography, and animation specs
- Match `docs/mockups/direction-4-the-show.html` for visual implementation
- Use Tailwind utility classes, NOT inline `style={{}}` objects
- Use `cn()` from `src/renderer/lib/utils.ts` for conditional class merging
- Use Framer Motion with spring physics (`type: "spring"`) — never linear transitions
- Use theatrical language per Requirement 15: Acts not tasks, Beats not completions, Show not day
- Read `CLAUDE.md` before starting any task

---

## Group 1: Foundation

These tasks must complete first. They establish the Tailwind v4 design token system, shadcn/ui primitives, and font imports that every subsequent task depends on. Tasks 1.1-1.4 can be parallelized.

### Task 1.1: Tailwind CSS v4 Configuration & Design Tokens

**Files to create:**
- `src/renderer/index.css`

**Files to modify:**
- `electron.vite.config.ts` (add `@tailwindcss/vite` plugin to renderer config only)

**Depends on:** Nothing

**Acceptance criteria:**
- [ ] `src/renderer/index.css` contains `@import "tailwindcss"` at top
- [ ] `@theme` block defines ALL design tokens from Section 6.1 of design.md: `studio-bg`, `surface`, `surface-hover`, `titlebar`, `notepad-bg`, `notepad-header`, `notepad-border`, `txt-primary`, `txt-secondary`, `txt-muted`, `notepad-text`, `accent`, `accent-dark`, `onair`, `beat`, `beat-light`, `off`, `border-default`, `divider`, `card-border`, `cat-deep`, `cat-exercise`, `cat-admin`, `cat-creative`, `cat-social`, `font-mono`, `font-body`
- [ ] `@theme` block defines ALL custom animation keyframes: `tallyPulse`, `onairGlow`, `breathe`, `beatIgnite`, `warmPulse`, `goldenGlow`, `slideUp`
- [ ] `@theme` block defines animation shorthand tokens: `animate-tally-pulse`, `animate-onair-glow`, `animate-breathe`, `animate-beat-ignite`, `animate-warm-pulse`, `animate-golden-glow`, `animate-slide-up`
- [ ] Global styles set `html, body, #root` to `background-color: transparent`, `overflow: hidden`, `font-family: var(--font-body)`, `color: var(--color-txt-primary)`, `-webkit-font-smoothing: antialiased`
- [ ] Custom scrollbar styles applied (6px width, transparent track, #333 thumb)
- [ ] `@source "../renderer"` directive limits Tailwind scanning to renderer directory
- [ ] shadcn/ui CSS variable overrides (`:root` block mapping `--background`, `--foreground`, `--card`, etc. to design tokens) are present
- [ ] `electron.vite.config.ts` imports `@tailwindcss/vite` and adds it to `renderer.plugins` array only (not main or preload)
- [ ] App compiles without errors: `npm run build` succeeds

**Notes:** Copy the full CSS from design.md Section 6.1 and Section 7.4. The `@keyframes` blocks go AFTER the `@theme` block. The `:root` shadcn variable overrides go after keyframes. Ensure the existing `src/renderer/theme.ts` is NOT deleted yet (that happens in Group 6).

---

### Task 1.2: shadcn/ui Setup & Custom Button Variants

**Files to create:**
- `components.json` (project root)
- `src/renderer/lib/utils.ts`
- `src/renderer/ui/button.tsx`
- `src/renderer/ui/dialog.tsx`
- `src/renderer/ui/card.tsx`
- `src/renderer/ui/input.tsx`
- `src/renderer/ui/textarea.tsx`
- `src/renderer/ui/progress.tsx`

**Depends on:** Task 1.1 (needs index.css with design tokens)

**Acceptance criteria:**
- [ ] `components.json` matches Section 7.2 of design.md: style "new-york", rsc false, tsx true, aliases point to `src/renderer/ui` and `src/renderer/lib/utils`
- [ ] `src/renderer/lib/utils.ts` exports `cn()` function using `clsx` + `tailwind-merge`
- [ ] All six shadcn/ui components are generated and present in `src/renderer/ui/`
- [ ] `button.tsx` has custom variants added per Section 7.3: `primary`, `accent`, `beat`, `beat-large`, `neutral`, `ghost_muted`
- [ ] All shadcn components import from the correct relative paths (not `@/` aliases unless tsconfig is updated)
- [ ] TypeScript compilation passes with no errors in `src/renderer/ui/`

**Notes:** Run `npx shadcn@latest init` then `npx shadcn@latest add button dialog card input textarea progress`. After generation, manually add the custom button variants from design.md Section 7.3. Verify import paths work with the project's tsconfig path aliases.

---

### Task 1.3: Font Imports

**Files to modify:**
- `src/renderer/index.html`

**Depends on:** Nothing

**Acceptance criteria:**
- [ ] `index.html` contains `<link rel="preconnect" href="https://fonts.googleapis.com">` and `<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>`
- [ ] `index.html` contains Google Fonts `<link>` loading Inter (weights 300-900) and JetBrains Mono (weights 400-700)
- [ ] Font links are placed in `<head>` before any script tags
- [ ] Fonts render correctly in the app (verify JetBrains Mono loads for mono text, Inter for body)

**Notes:** The design.md Section 6.2 has the exact `<link>` tag. Place it in the `<head>` of the existing index.html. Do not remove any existing content from index.html.

---

### Task 1.4: Category Color Utility

**Files to create:**
- `src/renderer/lib/category.ts`

**Depends on:** Nothing

**Acceptance criteria:**
- [ ] Exports `SketchCategory` type: `'Deep Work' | 'Exercise' | 'Admin' | 'Creative' | 'Social'`
- [ ] Exports `CATEGORY_CONFIG` record mapping each category to `{ token: string; hex: string }`
- [ ] Exports `getCategoryToken(sketch: string): string` — returns Tailwind token name, falls back to `'accent'`
- [ ] Exports `getCategoryHex(sketch: string): string` — returns hex color, falls back to `'#d97757'`
- [ ] Matches Appendix B of design.md exactly

**Notes:** This is a pure utility with no dependencies. Used by ClapperboardBadge, ActCard, TimerPanel, and other components for category-aware coloring.

---

## Group 2: Store & Types

Store and type updates that the UI components depend on. Must complete before Group 3. Tasks 2.1 and 2.2 can be parallelized.

### Task 2.1: showStore Updates — New Fields & Actions

**Files to modify:**
- `src/renderer/stores/showStore.ts`

**Depends on:** Nothing (store logic is independent of UI)

**Acceptance criteria:**
- [ ] New state fields added to store interface: `goingLiveActive: boolean`, `writersRoomStep: 'energy' | 'plan' | 'lineup'`, `writersRoomEnteredAt: number | null`, `breathingPauseEndAt: number | null`
- [ ] New actions added: `enterWritersRoom()`, `setWritersRoomStep()`, `triggerGoingLive()`, `completeGoingLive()`, `startBreathingPause()`, `endBreathingPause()`
- [ ] `enterWritersRoom()` sets `phase: 'writers_room'`, `writersRoomStep: 'energy'`, `writersRoomEnteredAt: Date.now()`
- [ ] `triggerGoingLive()` sets `goingLiveActive: true`
- [ ] `completeGoingLive()` sets `goingLiveActive: false` then calls `get().startShow()`
- [ ] `startBreathingPause()` sets `phase: 'intermission'`, `breathingPauseEndAt: Date.now() + 5 * 60 * 1000`
- [ ] `endBreathingPause()` sets `breathingPauseEndAt: null`
- [ ] Persistence `partialize` excludes `beatCheckPending` and `goingLiveActive` (transient UI fields)
- [ ] Initial state values: `goingLiveActive: false`, `writersRoomStep: 'energy'`, `writersRoomEnteredAt: null`, `breathingPauseEndAt: null`
- [ ] Existing actions and fields remain unchanged and functional
- [ ] TypeScript compiles with no errors

**Notes:** Follow the implementation from design.md Section 2.4 exactly. The `completeGoingLive` action must call `get().startShow()` after setting the flag, not `set()` — this ensures the existing `startShow()` logic executes.

---

### Task 2.2: Shared Types — IPC Channel Constants

**Files to modify:**
- `src/shared/types.ts`

**Depends on:** Nothing

**Acceptance criteria:**
- [ ] `IPC` constant object has new channels added: `SET_VIEW_MODE: 'showtime:set-view-mode'`, `REGISTER_HOTKEY: 'showtime:register-hotkey'`, `DAY_BOUNDARY: 'showtime:day-boundary'`
- [ ] Existing IPC channels (`NOTIFY_ACT_COMPLETE`, `NOTIFY_BEAT_CHECK`, `NOTIFY_VERDICT`) remain unchanged
- [ ] `ShowPhase` type remains: `'no_show' | 'writers_room' | 'live' | 'intermission' | 'director' | 'strike'`
- [ ] TypeScript compiles with no errors across main, preload, and renderer

**Notes:** Only add the new channels listed in design.md Section 4.1. Do not remove or rename any existing channels. Verify the `IPC` object uses `as const` assertion.

---

### Task 2.3: showStore Vitest Unit Tests

**Files to create:**
- `src/__tests__/stores/showStore.test.ts`

**Depends on:** Task 2.1

**Acceptance criteria:**
- [ ] Tests use Vitest with jsdom environment
- [ ] Tests cover ALL phase transitions from the state machine (design.md Section 2.1):
  - `no_show -> writers_room` via `enterWritersRoom()`
  - `writers_room -> live` via `startShow()` (with acts loaded)
  - `startShow()` guard: fails/no-ops if `acts.length === 0`
  - `live -> intermission` via `enterIntermission()`
  - `intermission -> live` via `exitIntermission()`
  - `live -> director` via `enterDirector()`
  - `director -> live` via `exitDirector()` (skip/break/breathe actions)
  - `director -> strike` via `callShowEarly()`
  - `live -> strike` via `strikeTheStage()` when no upcoming acts remain
  - `strike -> no_show` via `resetShow()`
- [ ] Tests cover `completeAct()` sets `beatCheckPending: true`
- [ ] Tests cover `lockBeat()` increments `beatsLocked` and auto-advances to next act
- [ ] Tests cover `skipBeat()` auto-advances without incrementing `beatsLocked`
- [ ] Tests cover timer state: `enterIntermission()` stores remaining time, `exitIntermission()` resumes
- [ ] Tests cover verdict computation for all four thresholds:
  - `DAY_WON`: beats >= threshold
  - `SOLID_SHOW`: beats === threshold - 1
  - `GOOD_EFFORT`: beats >= 50% of threshold
  - `SHOW_CALLED_EARLY`: beats < 50% of threshold
- [ ] Tests cover `resetShow()` returns all state to initial values
- [ ] Tests cover new actions: `enterWritersRoom()`, `setWritersRoomStep()`, `triggerGoingLive()`, `completeGoingLive()`, `startBreathingPause()`, `endBreathingPause()`
- [ ] All tests pass: `npx vitest run src/__tests__/stores/showStore.test.ts`

**Notes:** Use `useShowStore.getState()` and `useShowStore.setState()` for direct store manipulation in tests. Reset store between tests using `useShowStore.getState().resetShow()` or `useShowStore.setState(initialState)`. Follow the test scenarios from design.md Section 8.2.

---

### Task 2.4: useTimer Hook Vitest Tests

**Files to create:**
- `src/__tests__/hooks/useTimer.test.ts`

**Depends on:** Task 2.1 (store must have timer fields)

**Acceptance criteria:**
- [ ] Tests use Vitest with jsdom environment and `vi.useFakeTimers()`
- [ ] Tests cover correct MM:SS formatting for various remaining times
- [ ] Tests cover `isRunning` is true when `timerEndAt` is set and in the future
- [ ] Tests cover `isRunning` is false when `timerEndAt` is null or in the past
- [ ] Tests cover `progress` computes correctly (0 at start, approaching 1 at end)
- [ ] Tests cover timer auto-completion (calls `completeAct()` when reaching 0)
- [ ] Tests cover extending adds 15 minutes to remaining time
- [ ] All tests pass: `npx vitest run src/__tests__/hooks/useTimer.test.ts`

**Notes:** Use `@testing-library/react` `renderHook` to test the hook. Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` to simulate time passage. The `useTimer` hook reads from `showStore` — set timer state directly on the store before asserting hook output.

---

## Group 3: Atomic Components

Small, standalone UI components with no inter-component dependencies. All tasks in this group can be parallelized. Each produces a single reusable component.

### Task 3.1: TallyLight Component

**Files to create:**
- `src/renderer/components/TallyLight.tsx`

**Depends on:** Group 1 (Tailwind config with `animate-tally-pulse` token)

**Acceptance criteria:**
- [ ] Component accepts props: `isLive: boolean`, `size?: 'sm' | 'md' | 'lg'` (defaults to `'lg'`)
- [ ] Size mapping: sm=`w-1.5 h-1.5`, md=`w-2 h-2`, lg=`w-2.5 h-2.5`
- [ ] Live state: `bg-onair animate-tally-pulse` with `rounded-full`
- [ ] Off state: `bg-[#3a3a3e]` with `rounded-full`, no animation
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Uses `cn()` for conditional class merging
- [ ] Component matches design.md Section 3.17

**Notes:** This is the simplest component. It is a single `<div>` with conditional classes. Used by PillView (lg size) and OnAirIndicator (internally) and LineupPanel sidebar (sm size).

---

### Task 3.2: OnAirIndicator Component

**Files to create:**
- `src/renderer/components/OnAirIndicator.tsx`

**Depends on:** Group 1 (Tailwind config with `animate-onair-glow` token)

**Acceptance criteria:**
- [ ] Component accepts props: `isLive: boolean`
- [ ] Renders "ON AIR" text in both live and off states (industry convention)
- [ ] Font: `font-mono text-[10px] font-bold tracking-[0.12em]`
- [ ] Container: `inline-flex items-center gap-[5px] rounded px-2 py-[2px]`
- [ ] Live state: `text-onair border-[1.5px] border-onair animate-onair-glow` with 6px red tally dot (`w-1.5 h-1.5 rounded-full bg-onair animate-tally-pulse`)
- [ ] Off state: `text-[#3a3a3e] border-[1.5px] border-[#3a3a3e]` with gray dot (`bg-[#3a3a3e]`)
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Component matches design.md Section 3.16

**Notes:** The tally dot inside OnAirIndicator is rendered directly (not using the TallyLight component) since it is a fixed 6px size. Follow the exact Tailwind classes from design.md Section 3.16.

---

### Task 3.3: ClapperboardBadge Component

**Files to create:**
- `src/renderer/components/ClapperboardBadge.tsx`

**Depends on:** Task 1.4 (category utility)

**Acceptance criteria:**
- [ ] Component accepts props: `sketch: string`, `actNumber: number`, `duration?: string`, `status?: 'active' | 'complete'`, `size?: 'sm' | 'md'` (defaults to `'md'`)
- [ ] Renders text pattern: `{CATEGORY} | ACT {N}` with optional `| {DURATION}` or `| COMPLETE`
- [ ] Font: `font-mono font-semibold uppercase tracking-[0.08em]`
- [ ] Size mapping: sm=`text-[10px]`, md=`text-[11px]`
- [ ] Container: `inline-flex items-center gap-1.5 rounded px-2.5 py-[3px]`
- [ ] Border and text color derived from category using `getCategoryToken()` from `src/renderer/lib/category.ts`
- [ ] Border: `border-[1.5px]` with category color at 40% opacity
- [ ] Pipe divider `|` has `opacity-40`
- [ ] Falls back to `accent` color for unknown categories
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Component matches design.md Section 3.18

**Notes:** The category-aware coloring requires dynamic class construction. Use `cn()` and map category tokens to Tailwind classes. If dynamic `text-cat-*` classes don't work with Tailwind's JIT, use the hex values from `getCategoryHex()` with arbitrary value syntax: `text-[${hex}]` and `border-[${hex}]/40`.

---

### Task 3.4: BeatCounter Component

**Files to modify:**
- `src/renderer/components/BeatCounter.tsx`

**Depends on:** Task 2.1 (showStore with beats fields), Group 1 (Tailwind config with `animate-beat-ignite`)

**Acceptance criteria:**
- [ ] Component accepts props: `size?: 'sm' | 'md' | 'lg' | 'xl'` (defaults to `'md'`), `showLabel?: boolean`, `dimmed?: boolean`, `justIgnitedIndex?: number | null`
- [ ] Reads `beatsLocked` and `beatThreshold` from `showStore`
- [ ] Size mapping: sm=`text-sm`, md=`text-xl`, lg=`text-2xl`, xl=`text-3xl`
- [ ] Renders filled star `\u2605` for locked beats (gold: `text-beat` with `text-shadow: 0 0 8px rgba(245,158,11,0.4)`)
- [ ] Renders outline star `\u2606` for unlocked beats (gray: `text-txt-muted`)
- [ ] When `justIgnitedIndex` matches a star index, that star gets `animate-beat-ignite` class
- [ ] When `showLabel` is true, displays `"N/M Beats"` text in `font-mono text-xs text-txt-muted ml-2`
- [ ] When `dimmed` is true, container has `opacity-35`
- [ ] Container: `inline-flex items-center gap-1`
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Component matches design.md Section 3.10

**Notes:** This is a REWRITE of the existing `BeatCounter.tsx`. Read the existing file first, then replace all inline styles with Tailwind. The `text-shadow` for locked stars can use arbitrary Tailwind: `[text-shadow:0_0_8px_rgba(245,158,11,0.4)]`.

---

### Task 3.5: EnergySelector Component

**Files to modify:**
- `src/renderer/components/EnergySelector.tsx`

**Depends on:** Group 1 (Tailwind config)

**Acceptance criteria:**
- [ ] Component accepts props: `onSelect: (level: EnergyLevel) => void`
- [ ] Renders a 2x2 grid (`grid grid-cols-2 gap-3`) of four energy buttons
- [ ] Each button has: emoji (text-2xl), label (font-semibold text-sm, colored), sublabel (text-xs text-txt-muted)
- [ ] Energy data matches design.md Section 3.11 table: High (lightning, amber), Medium (sun, green), Low (moon, blue), Recovery (bed, purple)
- [ ] Each button has unique bg/border/hover colors at low opacity per design.md
- [ ] Framer Motion: staggered slideUp entrance (delay: 0, 0.08, 0.16, 0.24)
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Component matches design.md Section 3.11

**Notes:** This is a REWRITE of the existing `EnergySelector.tsx`. Read the existing file first. The button colors use arbitrary Tailwind values for the low-opacity backgrounds: `bg-[rgba(245,158,11,0.06)]`.

---

## Group 4: Core Views

Each view is a separate task. These are the main screens of the app. Tasks 4.1-4.3 can be parallelized (they are independent new views). Tasks 4.4-4.10 depend on Group 3 components and should be done in roughly the order listed, but most can be parallelized if the agent has Group 3 complete.

### Task 4.1: DarkStudioView

**Files to create:**
- `src/renderer/views/DarkStudioView.tsx`

**Depends on:** Group 1, Task 2.1 (`enterWritersRoom` action)

**Acceptance criteria:**
- [ ] Component reads `enterWritersRoom` from `showStore`
- [ ] Renders full-screen view with `min-h-screen bg-studio-bg` and centered content
- [ ] Radial spotlight gradient: `radial-gradient(ellipse 400px 350px at 50% 35%, rgba(217,119,87,0.06) 0%, transparent 70%)` as absolute positioned overlay
- [ ] Heading: "Tonight's show hasn't been written yet." in `font-body text-2xl font-light text-txt-primary tracking-tight`
- [ ] Subtext below heading in `text-sm text-txt-muted`
- [ ] CTA button "Enter the Writer's Room" styled with `accent` variant from Button
- [ ] `spotlightFadeIn` animation: container enters with `initial={{ opacity: 0, filter: 'blur(8px)' }}`, `animate={{ opacity: 1, filter: 'blur(0px)' }}`, spring transition (stiffness: 80, damping: 20)
- [ ] CTA button entrance: delayed by 1.2s, slides up from y:12
- [ ] Outer container has `data-clui-ui` attribute for click-through system
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Matches `docs/mockups/direction-4-the-show.html` Dark Studio section

**Notes:** This is a NEW file. Follow design.md Section 3.1 exactly. The spotlight is a CSS gradient on an absolute-positioned div with `pointer-events-none`.

---

### Task 4.2: GoingLiveTransition

**Files to create:**
- `src/renderer/views/GoingLiveTransition.tsx`

**Depends on:** Task 3.2 (OnAirIndicator), Task 2.1 (store fields)

**Acceptance criteria:**
- [ ] Component accepts props: `onComplete: () => void`
- [ ] Renders fixed fullscreen overlay: `fixed inset-0 bg-studio-bg z-50`
- [ ] ON AIR indicator (live state) scales in from 0 with spring animation (delay: 0.3s)
- [ ] Headline: "Live from your desk, it's {formattedDate}!" in `font-body text-3xl font-extrabold text-txt-primary tracking-tight`
- [ ] Date formatted as locale-appropriate long date (e.g., "Friday, March 20th")
- [ ] Headline fades up with spring animation (delay: 0.8s)
- [ ] Spotlight gradient: `radial-gradient(ellipse 600px 400px at 50% 50%, rgba(217,119,87,0.08) 0%, transparent 70%)`
- [ ] Auto-dismisses after 2500ms by calling `onComplete()`
- [ ] Cleanup: timeout cleared on unmount
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Component matches design.md Section 3.3

**Notes:** This is a NEW file. The `useEffect` with `setTimeout(onComplete, 2500)` handles auto-dismiss. Use `return () => clearTimeout(timer)` for cleanup.

---

### Task 4.3: IntermissionView (replaces RestAffirmation)

**Files to create:**
- `src/renderer/components/IntermissionView.tsx`

**Files to delete:**
- `src/renderer/components/RestAffirmation.tsx`

**Depends on:** Task 3.4 (BeatCounter), Task 2.1 (store)

**Acceptance criteria:**
- [ ] Component reads `exitIntermission` from `showStore`
- [ ] Renders centered card with `max-w-[380px] p-8 rounded-xl bg-surface border border-[#2a2a2e]`
- [ ] Section label: "INTERMISSION" in `font-mono text-xs tracking-[0.15em] uppercase text-txt-muted`
- [ ] Main text: "WE'LL BE RIGHT BACK" in `font-body text-2xl font-light text-txt-primary`
- [ ] Rotating affirmation from AFFIRMATIONS array (randomly selected on mount)
- [ ] Affirmation text has `animate-breathe` animation (Framer Motion: `opacity: [0.6, 1, 0.6]`, 4s repeat infinite)
- [ ] BeatCounter rendered with `dimmed={true}` (opacity-35)
- [ ] "Back to the show" button styled with `accent` variant
- [ ] NO timer, NO countdown, NO pressure language
- [ ] `RestAffirmation.tsx` deleted
- [ ] All imports of `RestAffirmation` updated to `IntermissionView`
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Component matches design.md Section 3.12

**Notes:** The affirmation library is defined in design.md Section 3.12. Use `useState` with a random index set on mount via `useEffect`. This component renders INSIDE ExpandedView when phase is intermission.

---

### Task 4.4: ShowVerdict Component

**Files to modify:**
- `src/renderer/components/ShowVerdict.tsx`

**Depends on:** Task 3.4 (BeatCounter)

**Acceptance criteria:**
- [ ] Component accepts props: `verdict: ShowVerdict`, `beatsLocked: number`, `beatThreshold: number`
- [ ] Renders verdict headline, message, color, and animation per design.md Section 3.14 table:
  - `DAY_WON`: headline in `#f59e0b` with `animate-golden-glow`, message "Standing ovation. You showed up and you were present."
  - `SOLID_SHOW`: headline in `#d97757`, message "Not every sketch lands. The show was still great."
  - `GOOD_EFFORT`: headline in `#60a5fa`, message "You got on stage. That's the hardest part."
  - `SHOW_CALLED_EARLY`: headline in `#9a9890`, message "Sometimes the show is short. The audience still came."
- [ ] Headline: `font-body text-5xl font-black tracking-wide`
- [ ] Message: `font-body text-sm text-txt-secondary mt-4`
- [ ] BeatCounter rendered with `size="xl"` below verdict
- [ ] DAY_WON includes golden spotlight gradient
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Matches `docs/mockups/direction-4-the-show.html` Strike section

**Notes:** REWRITE of existing file. Read current ShowVerdict.tsx first. Replace all inline styles with the Tailwind classes from design.md Section 3.14.

---

### Task 4.5: DirectorMode Component

**Files to modify:**
- `src/renderer/components/DirectorMode.tsx`

**Depends on:** Task 2.1 (store actions)

**Acceptance criteria:**
- [ ] Component reads from showStore: `exitDirector`, `skipAct`, `currentActId`, `callShowEarly`, `enterIntermission`, `startBreathingPause`
- [ ] Renders as modal overlay: `fixed inset-0 bg-black/80 backdrop-blur-[12px] z-50`
- [ ] Card: `w-[420px] p-8 rounded-2xl bg-surface border border-[#2a2a2e]`
- [ ] Heading: "The Director is here." in `font-body text-xl font-semibold text-txt-primary`
- [ ] Subtext: "What's the call?" in `font-body text-sm text-txt-secondary`
- [ ] Four option buttons matching design.md Section 3.13 table with label + description
- [ ] Each option executes IMMEDIATELY on click — NO confirmation dialogs
- [ ] "Skip to next Act" calls `skipAct(currentActId); exitDirector()`
- [ ] "Call the show early" calls `callShowEarly()`
- [ ] "Take a longer break" calls `enterIntermission(); exitDirector()`
- [ ] "I just need a moment" calls `startBreathingPause(); exitDirector()`
- [ ] Framer Motion: card enters with `scale: 0.95 -> 1`, spring transition
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Matches `docs/mockups/direction-4-the-show.html` Director Mode section

**Notes:** REWRITE of existing file. Read the current DirectorMode.tsx first. The four options are rendered as styled button elements, not shadcn Dialog actions.

---

### Task 4.6: BeatCheckModal Component

**Files to modify:**
- `src/renderer/components/BeatCheckModal.tsx`

**Depends on:** Task 3.3 (ClapperboardBadge), Task 3.4 (BeatCounter), Task 2.1 (store)

**Acceptance criteria:**
- [ ] Component reads `beatCheckPending`, `lockBeat`, `skipBeat` from showStore
- [ ] Only renders when `beatCheckPending` is true
- [ ] Scrim overlay: `fixed inset-0 bg-black/75 backdrop-blur-[8px] z-50`
- [ ] Card: `w-[380px] p-8 rounded-2xl bg-surface border border-[#2a2a2e]`
- [ ] Spotlight gradient on card: golden `radial-gradient(ellipse 300px 250px at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 70%)`
- [ ] Displays completed Act name and ClapperboardBadge
- [ ] Question: "Did you have a moment of presence?" in `text-sm text-txt-secondary`
- [ ] "Yes — Lock the Beat" button: `beat-large` variant, full width
- [ ] "Not this time" link: `text-sm text-txt-muted hover:text-txt-secondary`
- [ ] On "Lock the Beat": shows "That moment was real." text for 1 second, then auto-dismisses
- [ ] On "Not this time": dismisses immediately, advances to next Act
- [ ] Framer Motion: card enters with `scale: 0.9 -> 1, y: 20 -> 0`, spring transition
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses shadcn/ui Dialog for accessible modal pattern
- [ ] Matches `docs/mockups/direction-4-the-show.html` Beat Check section

**Notes:** REWRITE of existing file. The "That moment was real." confirmation text uses a brief local state timeout before calling `lockBeat()` and dismissing.

---

### Task 4.7: TimerPanel

**Files to modify:**
- `src/renderer/panels/TimerPanel.tsx`

**Depends on:** Task 3.3 (ClapperboardBadge), Task 2.1 (store), Group 1 (Tailwind)

**Acceptance criteria:**
- [ ] Component reads from showStore: `selectCurrentAct`, `completeAct`, `extendAct`, `enterIntermission`
- [ ] Uses `useTimer()` hook for `minutes`, `seconds`, `isRunning`, `progress`
- [ ] ClapperboardBadge displayed with current act's sketch category and number
- [ ] Act name: `font-body text-lg font-bold text-txt-primary mt-3`
- [ ] Timer digits: `font-mono text-[64px] font-bold text-txt-primary leading-none tracking-tight tabular-nums`
- [ ] Timer turns amber (`text-beat animate-warm-pulse`) when < 5 minutes remaining
- [ ] Progress bar: `h-1 bg-surface-hover rounded-full` track with category-colored fill
- [ ] Progress fill width is percentage of time elapsed
- [ ] Three action buttons: "+15m" (neutral), "End Act" (accent), "Rest" (deep work purple tint)
- [ ] "+15m" calls `extendAct()`, "End Act" calls `completeAct()`, "Rest" calls `enterIntermission()`
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Matches `docs/mockups/direction-4-the-show.html` Timer section

**Notes:** REWRITE of existing file. The progress bar fill color should match the current act's category. Use arbitrary Tailwind values if needed for dynamic category colors.

---

### Task 4.8: LineupPanel & ActCard

**Files to modify:**
- `src/renderer/panels/LineupPanel.tsx`
- `src/renderer/components/ActCard.tsx`

**Depends on:** Task 3.3 (ClapperboardBadge), Task 1.4 (category utility), Task 2.1 (store)

**Acceptance criteria:**
- [ ] LineupPanel accepts `variant: 'full' | 'sidebar'` prop
- [ ] LineupPanel reads `acts`, `currentActId`, `reorderAct`, `removeAct` from showStore
- [ ] Full variant: `flex flex-col gap-3` with full ActCard rendering
- [ ] Sidebar variant: `flex flex-col gap-1` with section label "TONIGHT'S LINEUP" in `font-mono text-[11px] tracking-[0.15em] uppercase text-txt-muted`
- [ ] Staggered Framer Motion entrance on full variant cards (delay: `i * 0.08`)
- [ ] ActCard accepts: `act: Act`, `variant: 'full' | 'sidebar'`, `onReorder?`, `onRemove?`
- [ ] Full variant ActCard: category stripe, act name, ClapperboardBadge, duration, reorder arrows, remove button
- [ ] Sidebar variant ActCard: compact row with status-aware styling (active/completed/completed+beat/skipped/upcoming) per design.md Section 3.8 table
- [ ] Active sidebar row has category-colored bg at 8% opacity with border
- [ ] Completed row shows green tint, with gold star if beat was locked
- [ ] Skipped row shows `line-through text-txt-muted`
- [ ] Upcoming row shows `text-txt-muted opacity-60`
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Both components match `docs/mockups/direction-4-the-show.html`

**Notes:** REWRITE of both existing files. These are tightly coupled so they are a single task. Read both files first. The sidebar variant renders within ExpandedView's 200px right column.

---

### Task 4.9: PillView

**Files to modify:**
- `src/renderer/views/PillView.tsx`

**Depends on:** Task 3.1 (TallyLight), Task 3.4 (BeatCounter), Task 2.1 (store)

**Acceptance criteria:**
- [ ] Component reads from showStore: `phase`, `selectCurrentAct`, `beatsLocked`, `beatThreshold`, `toggleExpanded`
- [ ] Uses `useTimer()` hook for time display
- [ ] Pill container: `w-80 h-12 rounded-full flex items-center gap-3 py-2.5 px-4 bg-surface/85 backdrop-blur-[20px] border border-white/[0.06] shadow-[0_8px_32px_rgba(0,0,0,0.4)] cursor-pointer select-none`
- [ ] Container has `data-clui-ui` attribute
- [ ] Live state displays: TallyLight (live, lg), act name (truncated), timer MM:SS in monospaced font, BeatCounter (sm)
- [ ] Timer turns amber when < 5 minutes (`text-beat animate-warm-pulse`)
- [ ] Intermission state: TallyLight (off), "Intermission" label, "no rush" text
- [ ] Strike state: "Show complete!" with `animate-golden-glow`, final Beat count
- [ ] Clicking pill calls `toggleExpanded()`
- [ ] Framer Motion: pill enters with `scale: 0.8 -> 1`, spring transition
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Matches `docs/mockups/direction-4-the-show.html` Pill section

**Notes:** REWRITE of existing file. The pill is positioned at bottom center of the transparent window. The CSS handles the sizing — the native window stays at 1040x720.

---

### Task 4.10: ExpandedView

**Files to modify:**
- `src/renderer/views/ExpandedView.tsx`

**Depends on:** Task 4.7 (TimerPanel), Task 4.8 (LineupPanel), Task 3.2 (OnAirIndicator), Task 3.4 (BeatCounter), Task 4.3 (IntermissionView), Task 4.5 (DirectorMode)

**Acceptance criteria:**
- [ ] Renders 560x620 two-column layout matching design.md Section 3.5 ASCII diagram
- [ ] Outer container: `w-[560px] min-h-[620px] bg-surface rounded-xl overflow-hidden flex flex-col` with `data-clui-ui`
- [ ] Title bar: `bg-[#151517] px-5 py-3 flex items-center justify-between [-webkit-app-region:drag] border-b border-[#242428]`
- [ ] "SHOWTIME" in `font-mono text-xs tracking-widest uppercase text-txt-muted`
- [ ] Director Mode button: `[-webkit-app-region:no-drag]` with icon, calls `enterDirector()`
- [ ] Collapse button: `[-webkit-app-region:no-drag]`, calls `toggleExpanded()`
- [ ] Main content area: `flex flex-1 overflow-hidden` with TimerPanel (flex-1) and LineupPanel sidebar (`w-[200px] border-l border-[#242428]`)
- [ ] Bottom bar: `bg-[#151517] px-5 py-3 flex items-center justify-between border-t border-[#242428]` with OnAirIndicator and BeatCounter
- [ ] OnAirIndicator: `isLive={phase === 'live'}` — lit when live, dark during intermission/director/strike
- [ ] Conditionally renders IntermissionView when `phase === 'intermission'` (replaces timer hero)
- [ ] Conditionally renders DirectorMode when `phase === 'director'` (as overlay)
- [ ] Framer Motion: expands from pill with `scale: 0.9 -> 1, y: 20 -> 0`, spring transition
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Matches `docs/mockups/direction-4-the-show.html` Expanded View section

**Notes:** REWRITE of existing file. This is the most complex view — it composes TimerPanel, LineupPanel (sidebar variant), OnAirIndicator, BeatCounter, IntermissionView, and DirectorMode. Read the existing ExpandedView.tsx first.

---

### Task 4.11: WritersRoomView

**Files to modify:**
- `src/renderer/views/WritersRoomView.tsx`

**Depends on:** Task 3.5 (EnergySelector), Task 4.8 (LineupPanel/ActCard), Task 2.1 (store), Task 1.2 (shadcn Button, Card)

**Acceptance criteria:**
- [ ] Component reads from showStore: `energy`, `writersRoomStep`, `acts`, `setEnergy`, `setWritersRoomStep`, `setLineup`, `triggerGoingLive`, `writersRoomEnteredAt`
- [ ] Three-step flow with AnimatePresence for step transitions
- [ ] Step 1 — Energy Check: renders EnergySelector, on select stores energy and advances to step 2
- [ ] Step 2 — Plan Dump: textarea with notepad styling (`bg-[#13130f] border border-[#2a2a24] rounded-lg font-body text-sm text-[#c8c6b8]`), placeholder "What's on tonight's show?", submit button that sends plan to Claude
- [ ] Step 3 — Lineup Preview: renders LineupPanel (full variant) with act cards, reorder/remove controls, and "WE'RE LIVE!" CTA button (primary variant)
- [ ] Claude integration: on step 2 submit, sends message via sessionStore to Claude subprocess with energy level and plan text
- [ ] Parses `showtime-lineup` JSON from Claude response to populate acts
- [ ] "Planning..." loading state on submit button while Claude processes
- [ ] 20-minute nudge: displays "The Writer's Room has a clock. Ready to go live?" after 20 minutes in `text-xs text-txt-muted animate-breathe`
- [ ] Title bar: `bg-[#151517] px-5 py-3 [-webkit-app-region:drag]` with "SHOWTIME" label
- [ ] Step transitions use spring Framer Motion (`y: 12 -> 0`, `stiffness: 300, damping: 30`)
- [ ] Outer container: `w-[560px] min-h-[680px] bg-surface rounded-xl` with `data-clui-ui`
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Matches `docs/mockups/direction-4-the-show.html` Writer's Room section

**Notes:** REWRITE of existing file. This is the most complex flow. The Claude integration uses the existing `sessionStore.sendMessage()` and listens for the structured JSON response. Read the existing WritersRoomView.tsx and sessionStore.ts to understand the current Claude communication pattern.

---

### Task 4.12: StrikeView

**Files to modify:**
- `src/renderer/views/StrikeView.tsx`

**Depends on:** Task 4.4 (ShowVerdict), Task 3.4 (BeatCounter), Task 3.2 (OnAirIndicator), Task 2.1 (store)

**Acceptance criteria:**
- [ ] Component reads from showStore: `verdict`, `acts`, `beatsLocked`, `beatThreshold`, `resetShow`, `setExpanded`
- [ ] Derives computed values: `completedActs`, `skippedActs` using selectors
- [ ] Outer container: `w-[560px] bg-surface rounded-xl overflow-hidden flex flex-col` with `data-clui-ui`
- [ ] Title bar with OnAirIndicator in OFF state and `[-webkit-app-region:drag]`
- [ ] ShowVerdict component renders verdict headline, message, stars
- [ ] Stats row: three stats (Acts Completed, Acts Cut, Beats Locked) in `font-mono text-3xl font-bold` numbers with `text-[11px] tracking-[0.15em] uppercase text-txt-muted` labels
- [ ] Act recap panel: `bg-[#151517] rounded-lg p-4` with scrollable list of all acts showing status and beat indicator, styled like end credits
- [ ] "New Show" button (accent variant) calls `resetShow()`
- [ ] "Close" button (neutral variant) collapses to pill via `setExpanded(false)`
- [ ] Staggered Framer Motion entrance for stats (delay 0.2 each) and recap rows (delay 0.05 each)
- [ ] ALL existing inline styles removed, replaced with Tailwind classes
- [ ] Uses Tailwind utility classes, NOT inline styles
- [ ] Matches `docs/mockups/direction-4-the-show.html` Strike section

**Notes:** REWRITE of existing file. Read the existing StrikeView.tsx first. The recap list shows each act with: category color bar, name, status badge (completed/cut/skipped), and gold star if beat was locked.

---

## Group 5: App Shell & Integration

Updates to the app shell (App.tsx), IPC bridge, and main process. Must complete after Groups 3-4 since it wires everything together.

### Task 5.1: App.tsx — View Router & Tailwind Migration

**Files to modify:**
- `src/renderer/App.tsx`

**Depends on:** All Group 4 tasks (all views must exist)

**Acceptance criteria:**
- [ ] View routing matches Appendix A of design.md:
  - `goingLiveActive` → `GoingLiveTransition`
  - `!isExpanded` → `PillView`
  - `phase === 'no_show'` → `DarkStudioView`
  - `phase === 'writers_room'` → `WritersRoomView`
  - `phase === 'strike'` → `StrikeView`
  - `phase === 'live' | 'intermission' | 'director'` → `ExpandedView`
- [ ] Root `<div>` uses Tailwind: `className="w-full h-full relative bg-transparent"` (NO inline styles)
- [ ] `AnimatePresence` wraps view transitions with `mode="wait"`
- [ ] BeatCheckModal renders as a global overlay (outside the view switch, always present when `beatCheckPending`)
- [ ] Click-through system (`data-clui-ui` + `setIgnoreMouseEvents`) remains functional
- [ ] All view imports updated to new file paths
- [ ] ALL existing inline styles on App.tsx root elements replaced with Tailwind classes
- [ ] Unused CLUI component imports removed (ConversationView, InputBar, etc.)
- [ ] App compiles and launches without errors

**Notes:** This is the central wiring task. Read the current App.tsx carefully before modifying. The click-through system using `document.elementFromPoint()` and `data-clui-ui` must remain intact. The GoingLiveTransition check happens BEFORE the pill/expanded check since it overlays everything.

---

### Task 5.2: IPC Bridge Updates (Preload + Main)

**Files to modify:**
- `src/preload/index.ts`
- `src/main/index.ts`

**Depends on:** Task 2.2 (IPC channel constants)

**Acceptance criteria:**
- [ ] `src/preload/index.ts` `CluiAPI` interface adds: `setViewMode(mode: 'pill' | 'expanded' | 'full'): void`, `onDayBoundary(callback: () => void): () => void`, `onToggleExpanded(callback: () => void): () => void`
- [ ] Preload implementations use `ipcRenderer.send()` for `setViewMode` and `ipcRenderer.on()` for listeners
- [ ] Listener methods return cleanup functions (removeListener)
- [ ] `src/main/index.ts` adds `setViewMode` handler (minimal — the transparent window approach means no native resize needed per design.md Section 4.3)
- [ ] `src/main/index.ts` adds `startDayBoundaryCheck()` function: checks every 60 seconds for date change, broadcasts `DAY_BOUNDARY` on change
- [ ] `src/main/index.ts` verifies/adds notification handlers for `NOTIFY_ACT_COMPLETE`, `NOTIFY_BEAT_CHECK`, `NOTIFY_VERDICT`
- [ ] `src/main/index.ts` registers global hotkey `Alt+Space` to broadcast `showtime:toggle-expanded`
- [ ] Main process adds `vibrancy: 'under-window'` and `visualEffectState: 'active'` to BrowserWindow config
- [ ] All existing IPC functionality remains intact
- [ ] TypeScript compiles across main, preload, and renderer

**Notes:** Follow design.md Sections 4.1-4.6. The day boundary check starts in `app.whenReady()`. The global hotkey uses Electron's `globalShortcut.register()`. Be careful not to break existing IPC channels.

---

## Group 6: CLUI Cleanup

Remove dead weight CLUI files and simplify sessionStore. Must happen AFTER Group 5 (App.tsx must be updated first so deleted files are no longer imported).

### Task 6.1: Delete CLUI Dead Weight Files

**Files to delete:**
- `src/renderer/components/ConversationView.tsx`
- `src/renderer/components/InputBar.tsx`
- `src/renderer/components/AttachmentChips.tsx`
- `src/renderer/components/SlashCommandMenu.tsx`
- `src/renderer/components/PopoverLayer.tsx`
- `src/renderer/components/PermissionDeniedCard.tsx`
- `src/renderer/panels/CalendarPanel.tsx`

**Depends on:** Task 5.1 (App.tsx no longer imports these)

**Acceptance criteria:**
- [ ] All seven files listed above are deleted from the filesystem
- [ ] No remaining imports of deleted files exist anywhere in the codebase (grep for each filename)
- [ ] `PermissionCard.tsx` is KEPT (not deleted — it's still used for Claude tool approval)
- [ ] Application compiles without errors after deletion: `npm run build` succeeds
- [ ] Claude subprocess communication (RunManager, ControlPlane, StreamParser, IPC bridge) remains fully functional

**Notes:** Before deleting, grep the entire codebase for imports of each file. If any remaining file imports a deleted component, update that import or remove the usage. The `HistoryPicker.tsx`, `MarketplacePanel.tsx`, `SettingsPopover.tsx`, `StatusBar.tsx`, and `TabStrip.tsx` are already deleted per git status.

---

### Task 6.2: Simplify sessionStore to Single Session

**Files to modify:**
- `src/renderer/stores/sessionStore.ts`

**Depends on:** Task 6.1 (CLUI files deleted)

**Acceptance criteria:**
- [ ] Tab array management removed: no `tabs[]` array, no `activeTabId`, no `addTab`, no `closeTab`, no `switchTab`
- [ ] Single session: store holds one `session` object (or equivalent) instead of an array of tabs
- [ ] `sendMessage()` works without tab selection — sends to the single active session
- [ ] Claude subprocess communication remains fully functional: messages send, responses stream back
- [ ] All references to tabs in other files updated (WritersRoomView, ChatPanel, etc.)
- [ ] TypeScript compiles without errors
- [ ] Existing Claude communication tested: can send a message and receive structured response

**Notes:** Read the current sessionStore.ts carefully before modifying. The core functionality to KEEP is: session creation, `sendMessage()`, stream response handling, and subprocess lifecycle. The tab abstraction (multiple concurrent sessions, tab switching) is what gets removed. Verify by testing the Writer's Room plan submission flow still works after simplification.

---

### Task 6.3: Simplify theme.ts

**Files to modify:**
- `src/renderer/theme.ts`

**Depends on:** Task 1.1 (Tailwind handles all tokens)

**Acceptance criteria:**
- [ ] `theme.ts` simplified to only contain runtime-needed values (if any) that Tailwind cannot handle
- [ ] All color constants that are now defined as Tailwind `@theme` tokens are removed from theme.ts
- [ ] If theme.ts is used by any remaining component for non-CSS purposes (e.g., programmatic color access), those values remain
- [ ] If theme.ts becomes empty/unused, it can be deleted entirely
- [ ] No runtime references to deleted theme constants remain
- [ ] TypeScript compiles without errors

**Notes:** Read the current theme.ts and grep for all its imports. If components only use theme.ts values for inline styles that are now converted to Tailwind classes, those imports can be removed. The `getCategoryHex()` utility in `src/renderer/lib/category.ts` replaces any programmatic category color lookups.

---

## Group 7: Testing

E2E tests and remaining unit tests. These validate the complete implementation. Can start as soon as Groups 1-6 are substantially complete.

### Task 7.1: Vitest Component Unit Tests

**Files to create:**
- `src/__tests__/components/BeatCounter.test.ts`
- `src/__tests__/components/ClapperboardBadge.test.ts`
- `src/__tests__/components/OnAirIndicator.test.ts`
- `src/__tests__/utils/verdictLogic.test.ts`

**Depends on:** Groups 3-4 (components must exist)

**Acceptance criteria:**
- [ ] BeatCounter tests: correct star rendering for various locked/threshold combos, dimmed state applies opacity, label text format
- [ ] ClapperboardBadge tests: category color mapping for all 5 categories, fallback to accent for unknown, content pattern formatting
- [ ] OnAirIndicator tests: live state has correct classes (text-onair, animate-onair-glow), off state has gray classes
- [ ] Verdict logic tests: all four verdict thresholds computed correctly with edge cases (0 beats, equal to threshold, threshold - 1, 50% boundary)
- [ ] All tests use Vitest with jsdom environment
- [ ] All tests pass: `npx vitest run src/__tests__/components/ src/__tests__/utils/`

**Notes:** Use `@testing-library/react` `render` and `screen` for component tests. For verdict logic, test the pure computation function directly if extracted, or test through the store.

---

### Task 7.2: Playwright E2E — App Launch & Dark Studio

**Files to create:**
- `e2e/app-launch.spec.ts`
- `e2e/dark-studio.spec.ts`

**Depends on:** Task 5.1 (App.tsx wired), Task 4.1 (DarkStudioView)

**Acceptance criteria:**
- [ ] `app-launch.spec.ts`: Electron app launches via `electron.launch()`, first window is visible, no console errors
- [ ] `dark-studio.spec.ts`: On fresh launch (no persisted state), Dark Studio view is displayed
- [ ] Dark Studio shows "Tonight's show hasn't been written yet." text
- [ ] "Enter the Writer's Room" button is visible and clickable
- [ ] Clicking "Enter the Writer's Room" transitions to Writer's Room view
- [ ] Tests use Playwright Electron: `import { _electron as electron } from 'playwright'`
- [ ] All tests pass: `npx playwright test e2e/app-launch.spec.ts e2e/dark-studio.spec.ts`

**Notes:** Use Playwright's Electron testing support. Launch with `electron.launch({ args: ['.'] })`. May need to clear localStorage before tests to ensure fresh state. Add any needed test helpers for state reset.

---

### Task 7.3: Playwright E2E — Writer's Room Flow

**Files to create:**
- `e2e/writers-room.spec.ts`

**Depends on:** Task 4.11 (WritersRoomView), Task 7.2 (can navigate to Writer's Room)

**Acceptance criteria:**
- [ ] Test navigates from Dark Studio to Writer's Room
- [ ] Energy selection: clicking "High Energy" advances to Plan Dump step
- [ ] Plan Dump: textarea accepts input, submit button is present
- [ ] Plan submission triggers Claude processing (or mock if Claude unavailable in CI)
- [ ] Lineup Preview: after Claude response, acts appear as cards
- [ ] Act reordering: up/down arrows change act position
- [ ] Act removal: skip button removes act from lineup
- [ ] "WE'RE LIVE!" button is visible after lineup is populated
- [ ] Clicking "WE'RE LIVE!" triggers Going Live transition
- [ ] All tests pass: `npx playwright test e2e/writers-room.spec.ts`

**Notes:** Claude subprocess may not be available in CI. If needed, mock the Claude response by injecting state directly via `page.evaluate()` to set acts on the store. Test the UI flow regardless of Claude availability.

---

### Task 7.4: Playwright E2E — Live Show & Beat Check

**Files to create:**
- `e2e/act-timer.spec.ts`
- `e2e/beat-check.spec.ts`
- `e2e/pill-expanded-toggle.spec.ts`

**Depends on:** Tasks 4.6-4.10 (live show views)

**Acceptance criteria:**
- [ ] `act-timer.spec.ts`: Timer displays and counts down, "+15m" extends time, "End Act" completes act
- [ ] `beat-check.spec.ts`: Beat Check modal appears after act completion, "Lock the Beat" increments beat counter and shows confirmation, "Not this time" dismisses without incrementing
- [ ] `pill-expanded-toggle.spec.ts`: Clicking pill expands to full view, clicking collapse button returns to pill, view content matches expected state
- [ ] Tests set up state programmatically (inject a show with acts via `page.evaluate()`) to avoid Claude dependency
- [ ] All tests pass: `npx playwright test e2e/act-timer.spec.ts e2e/beat-check.spec.ts e2e/pill-expanded-toggle.spec.ts`

**Notes:** For timer tests, use short durations (e.g., 5-second acts) set via store manipulation. For pill/expanded toggle, verify the view content changes between compact (pill) and full (expanded) layouts.

---

### Task 7.5: Playwright E2E — Intermission, Director & Strike

**Files to create:**
- `e2e/intermission.spec.ts`
- `e2e/director-mode.spec.ts`
- `e2e/strike.spec.ts`

**Depends on:** Tasks 4.3, 4.5, 4.12 (Intermission, Director, Strike views)

**Acceptance criteria:**
- [ ] `intermission.spec.ts`: Clicking "Rest" during live act shows "WE'LL BE RIGHT BACK", affirmation text is visible, "Back to the show" resumes the act
- [ ] `director-mode.spec.ts`: Director Mode button opens overlay, all four options are visible, "Skip to next Act" advances to next act, "Call the show early" triggers Strike with correct verdict
- [ ] `strike.spec.ts`: Tests all four verdict states:
  - DAY_WON (beats >= threshold): golden headline
  - SOLID_SHOW (beats = threshold - 1): amber headline
  - GOOD_EFFORT (beats >= 50% threshold): blue headline
  - SHOW_CALLED_EARLY (beats < 50%): neutral headline
- [ ] Strike shows stats (Acts Completed, Acts Cut, Beats Locked) and act recap list
- [ ] "New Show" button resets to Dark Studio
- [ ] Tests set up state programmatically for each scenario
- [ ] All tests pass: `npx playwright test e2e/intermission.spec.ts e2e/director-mode.spec.ts e2e/strike.spec.ts`

**Notes:** For verdict tests, set store state directly with specific beat counts to trigger each verdict type. Use `page.evaluate(() => useShowStore.getState().strikeTheStage())` or equivalent to trigger strike programmatically with controlled state.
