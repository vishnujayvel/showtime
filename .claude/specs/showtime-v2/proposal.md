# Showtime v2 — SNL Day Planner

## Why

ADHD-first day planning is broken. Existing tools — Todoist, Things, Notion, Forest, Centered — all fail the same way: they weaponize consistency against brains that are neurologically incapable of it. Streaks, shame metrics, overdue badges, and dead trees confirm failure instead of supporting the user. Showtime reframes daily planning as a live performance using the SNL Day Framework: your day is a Show, tasks are Acts, presence moments are Beats. Rest costs zero. The show adapts to the performer.

The theatrical framework generates sustainable novelty because every day is a new show — different lineup, different energy, different verdict. There is no streak to protect, no tree to kill, no badge to lose. The user opens the app because they want to see what tonight's show looks like.

**Full product context:** `docs/plans/product-context.md`

## What Changes

Transform the CLUI CC Electron fork from an inline-styled general-purpose wrapper into a production-grade macOS day planner with the Direction 4 "The Show" aesthetic:

- **Replace** all inline `style={{}}` with Tailwind CSS utility classes + shadcn/ui components
- **Replace** multi-tab session UI with single-Show-per-day theatrical views
- **Add** 9 theatrical views: Dark Studio, Writer's Room, Going Live, Pill, Expanded, Beat Check, Intermission, Director Mode, Strike
- **Add** ON AIR indicator, tally lights, clapperboard badges, studio clock (design system components)
- **Add** macOS vibrancy, hiddenInset titlebar, traffic light positioning
- **Add** Playwright E2E tests for every user flow
- **Keep** Claude subprocess management (RunManager, ControlPlane, StreamParser, IPC bridge)
- **Keep** electron-vite build pipeline, Zustand state management
- **Remove** ConversationView, InputBar, TabStrip, MarketplacePanel, StatusBar, HistoryPicker, SettingsPopover, voice input

## Capabilities

### New
- Dark Studio view (empty stage with warm spotlight, "Tonight's show hasn't been written yet")
- Going Live transition (ON AIR light ignites, "Live from your desk, it's [date]!")
- ON AIR indicator component (live: red glow, off: dark gray)
- Tally light component (pulsing red dot for live sessions)
- Clapperboard badge component (SKETCH | ACT N | DURATION)
- Director Mode overlay (4 compassionate options, no confirmation dialogs)
- Intermission "WE'LL BE RIGHT BACK" card with breathing affirmation
- Four verdict presentations (DAY WON, SOLID SHOW, GOOD EFFORT, SHOW CALLED EARLY) with distinct emotional tones
- Beat ignite animation (golden star transition on presence lock)
- Tailwind @theme configuration with all Direction 4 design tokens
- Playwright E2E tests covering full show lifecycle

### Modified
- All existing views (PillView, WritersRoomView, ExpandedView, StrikeView) — rewritten with Tailwind classes and shadcn/ui
- All existing components (ActCard, BeatCounter, EnergySelector, etc.) — migrated from inline styles
- showStore.ts — add Dark Studio state, Going Live transition, Director Mode actions
- theme.ts — replace JS token system with Tailwind @theme CSS custom properties
- main/index.ts — add vibrancy, hiddenInset, traffic light positioning
- preload/index.ts — add notification IPC channels
- App.tsx — add Dark Studio and Going Live routing

### Removed
- ConversationView.tsx, InputBar.tsx, TabStrip.tsx, MarketplacePanel.tsx, StatusBar.tsx, HistoryPicker.tsx, SettingsPopover.tsx, AttachmentChips.tsx, SlashCommandMenu.tsx, PopoverLayer.tsx
- Multi-tab session logic in sessionStore.ts
- All inline style objects throughout the codebase
- JS-first theme system (useColors hook, syncTokensToCss)

## Impact

- **User experience:** Complete visual overhaul with theatrical production aesthetic. Every state transition is a production moment.
- **Data model:** showStore expanded with Dark Studio state, Going Live flag, Director Mode phase. sessionStore simplified to single session.
- **Build:** No changes to electron-vite pipeline. Add shadcn/ui CLI, JetBrains Mono + Inter fonts.
- **Dependencies:** Add shadcn/ui, @radix-ui/*, class-variance-authority, clsx, tailwind-merge. Remove unused CLUI deps.
- **Testing:** Full Playwright E2E coverage for show lifecycle. Vitest for stores and hooks.
- **Removed surface:** ~3,000 lines of CLUI dead weight. All inline style objects replaced.

## Design System Reference

See `docs/plans/design-system.md` for complete token reference (colors, typography, spacing, components, animations).

## Mockup Reference

See `docs/mockups/direction-4-the-show.html` for definitive visual reference (9 views).
