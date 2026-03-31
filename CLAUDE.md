# Showtime — CLAUDE.md

Showtime is an ADHD-friendly macOS day planner built on the SNL Day Framework.
Your day is a Show. Tasks are Acts. Presence moments are Beats. Rest costs zero.

This file is the source of truth for ALL agents working in this codebase.

## Active Specification

- **Spec:** `.claude/specs/showtime-v2/` (active)
- **Superseded:** `.claude/specs/showtime-snl-planner/` (v1 — archived, do not use)

## Product Context

Read `docs-internal/product-context.md` for the full product vision. Key points:

- The user IS the performer on a live variety show — not an employee filing task reports
- Every app state maps to a live TV production moment (Dark Studio → Going Live → ON AIR → Intermission → Strike)
- No guilt language, ever. "That Act got cut from tonight's show" — never "You failed to complete..."
- Rest is free. Always has been. Intermission costs zero capacity.
- The framework generates novelty through daily variation, not feature bloat
- "File created ≠ feature works" — every feature must be run, seen, and tested

## Architecture

```
Showtime (Electron App, macOS only)
├── Main Process (Node.js)
│   ├── claude/              ← KEEP: subprocess management (RunManager, ControlPlane, StreamParser)
│   ├── window management    ← NSPanel, always-on-top, content-tight sizing
│   └── IPC handlers         ← KEEP: notification triggers, theme sync
├── Preload (contextBridge)
│   └── window.clui API      ← KEEP: typed IPC bridge, strict process isolation
├── Renderer (React 19)
│   ├── views/               ← 12 views: DarkStudioView, WritersRoomView, PillView, CompactView, DashboardView, ExpandedView, StrikeView, SettingsView, HistoryView, OnboardingView, GoingLiveTransition, ColdOpenTransition
│   ├── panels/              ← TimerPanel, LineupPanel, ChatPanel
│   ├── components/          ← ActCard, BeatCheckModal, BeatCounter, DirectorMode, etc.
│   ├── machines/            ← showMachine (XState v5), showActor (singleton), ShowMachineProvider (React)
│   ├── stores/              ← uiStore (calendar/session UI state), sessionStore (Claude subprocess)
│   ├── hooks/               ← useTimer
│   └── ui/                  ← shadcn/ui components (Button, Dialog, Card, etc.)
└── Skills
    └── src/skills/showtime/SKILL.md
```

## Mandatory Rules

### 1. NO INLINE STYLES

**NEVER use React `style={{}}` objects.** This is the single most important rule.

```tsx
// ❌ WRONG — this is what the old CLUI code does
<div style={{ display: 'flex', padding: '16px', background: '#1a1a1e' }}>

// ✅ RIGHT — use Tailwind utility classes
<div className="flex p-4 bg-surface">
```

All styling must use Tailwind CSS utility classes. The old CLUI codebase uses inline styles everywhere — this is technical debt, not a pattern to follow.

### 2. Use shadcn/ui + Radix UI for Interactive Components

Buttons, modals, dialogs, selects, popovers, tooltips — use shadcn/ui headless primitives styled with Tailwind. Do not hand-roll accessible interactive components.

```bash
# Add components via CLI
npx shadcn@latest add button dialog card
```

### 3. Tailwind CSS v4 — CSS-First Configuration

Use `@tailwindcss/vite` plugin (already configured). No `tailwind.config.js`.
Define custom design tokens via `@theme` in CSS:

```css
@import "tailwindcss";

@theme {
  --color-studio-bg: #0d0d0f;
  --color-surface: #1a1a1e;
  --color-surface-hover: #242428;
  --color-accent: #d97757;
  --color-onair: #ef4444;
  --color-beat: #f59e0b;
  --color-txt-primary: #e8e6e0;
  --color-txt-secondary: #9a9890;
  --color-txt-muted: #5a5855;
  --color-cat-deep: #8b5cf6;
  --color-cat-exercise: #22c55e;
  --color-cat-admin: #60a5fa;
  --color-cat-creative: #f59e0b;
  --color-cat-social: #ec4899;
  --font-mono: 'JetBrains Mono', monospace;
  --font-body: 'Inter', sans-serif;
}
```

### 4. macOS Native Feel

These BrowserWindow settings are **mandatory**:

```typescript
const win = new BrowserWindow({
  backgroundColor: '#00000000',
  frame: false,
  hasShadow: true,
  // Do NOT use vibrancy — it creates a native NSVisualEffectView that bleeds
  // through as a visible gray border around content. Paint backgrounds in CSS.
  // Do NOT use titleBarStyle: 'hiddenInset' — conflicts with frame: false
  // ... other settings
});
```

> **Note:** `transparent: true` is retained in the actual code for pill rounded corners and resize smoothness, but is an implementation detail — not a mandatory rule for contributors.

- HTML, body, and React root: `background-color: transparent`
- **All views must use `w-full h-full`** to fill the window edge-to-edge. Never use hardcoded `w-[560px]`. The window IS the content — no gaps.
- Draggable regions: Use CSS classes `.drag-region` and `.no-drag` (defined in `index.css`). **Never** use inline `style={{ WebkitAppRegion: 'drag' }}`.
- **Do NOT use `setIgnoreMouseEvents`**. Content-tight window sizing eliminates the need for click-through.
- **Do NOT use Electron `vibrancy`**. It creates visible borders. Use CSS backgrounds instead.
- Dark mode sync: Listen to `nativeTheme.on('updated')`, broadcast to renderer via IPC
- System font fallback: `-apple-system, BlinkMacSystemFont` at root CSS level

### 5. Framer Motion — Spring Physics Only

All animations use spring physics, never linear transitions:

```tsx
// ✅ Spring physics
<motion.div transition={{ type: "spring", stiffness: 300, damping: 30 }}>

// ❌ Never linear
<motion.div transition={{ duration: 0.3 }}>
```

Key animations defined in the design system:
- `tallyPulse` — 2s red dot glow (ON AIR)
- `onairGlow` — box-shadow pulse on ON AIR box
- `beatIgnite` — 0.6s gray → golden transition when Beat locks
- `spotlightFadeIn` — blur-to-sharp for Dark Studio entrance
- `goldenGlow` — text-shadow pulse on DAY WON verdict
- `slideUp` — staggered entrance for Act cards

### 6. Testing — Playwright E2E is Mandatory

Every feature MUST have E2E test coverage using Playwright.

```bash
npm run test        # Vitest unit/component tests
npm run test:e2e    # Playwright E2E tests
```

Test structure:
- `src/__tests__/` — Vitest unit tests (stores, hooks, pure functions)
- `e2e/` — Playwright E2E tests (full app launch, user flows)

E2E tests must cover:
- App launches successfully
- Dark Studio → Writer's Room transition
- Energy selection → plan dump → lineup preview → "We're live!"
- Act timer counts down
- Beat Check modal appears and Beat can be locked
- Intermission flow
- Strike the Stage with verdict
- Pill ↔ Expanded transitions

### 7. IPC Bridge — Strict Typing

The renderer communicates with main ONLY through the typed `window.clui` API defined in `preload/index.ts`. Never import Node.js modules in the renderer.

### 8. State Management — XState v5 (Phase State) + Zustand (UI State)

Show phase lifecycle is managed by an XState v5 machine (`showMachine.ts`). The singleton `showActor` is the sole source of truth for all phase state. Components read state via React hooks from `ShowMachineProvider.tsx` and dispatch events via `useShowSend()`. Non-phase UI state (calendar cache, Claude session ID) lives in Zustand (`uiStore.ts`).

- `showMachine.ts` — XState v5 machine: 6 top-level phases, nested substates, guarded transitions, parallel animation region
- `showActor.ts` — Singleton actor instance + side effects (SQLite sync, notifications, celebration timeout)
- `ShowMachineProvider.tsx` — React context + hooks (`useShowPhase`, `useShowContext`, `useShowSend`, `useShowSelector`)
- `uiStore.ts` — Non-phase Zustand state (calendar, Claude session)
- `sessionStore.ts` — Claude subprocess session (simplified to single session)

**How to read phase state in components:**
```tsx
import { useShowPhase, useShowContext, useShowSend } from '../machines/ShowMachineProvider'
const phase = useShowPhase()
const acts = useShowContext(ctx => ctx.acts)
const send = useShowSend()
send({ type: 'START_SHOW' })
```

**How to read calendar/session state:**
```tsx
import { useUIStore } from '../stores/uiStore'
const calendarEvents = useUIStore(s => s.calendarEvents)
```

## Design System

Full reference: `docs/plans/design-system.md`

### Color Palette (Quick Reference)

| Token | Hex | Usage |
|-------|-----|-------|
| `studio-bg` | `#0d0d0f` | Primary background |
| `surface` | `#1a1a1e` | Cards, panels |
| `surface-hover` | `#242428` | Hover states, borders |
| `accent` | `#d97757` | Stage lighting, CTAs |
| `onair` | `#ef4444` | ON AIR light, tally |
| `beat` | `#f59e0b` | Beat stars, DAY WON |
| `txt-primary` | `#e8e6e0` | Primary text |
| `txt-secondary` | `#9a9890` | Secondary text |
| `txt-muted` | `#5a5855` | Muted text |

### Typography

- **JetBrains Mono** — Timers (64px hero, 14px pill), clapperboard badges, ON AIR text, section labels. All-caps + wide letter-spacing for labels.
- **Inter** — Body text, headings, buttons, verdicts. Weights 300-900.

### Key Components

- **ON AIR light** — Red bordered box, JetBrains Mono 10px bold, pulsing glow when live, dark gray when off
- **Tally light** — 10px red pulsing dot in pill view, 8px in sidebar
- **Clapperboard badge** — `DEEP WORK | ACT 3` in monospaced uppercase, category-colored border
- **Studio clock** — 64px monospaced countdown, amber shift at < 5 minutes
- **Beat stars** — Gold ★ when locked, gray ☆ when empty, ignite animation on lock

### View Dimensions

| View | Size | Notes |
|------|------|-------|
| Dark Studio | Full window | Empty stage with spotlight |
| Writer's Room | 560 x 680px | Energy → Plan → Lineup → "WE'RE LIVE!" |
| Pill | 320 x 64px | Floating, always-on-top, rounded-full |
| Expanded | 560 x 620px | Timer hero + lineup sidebar + ON AIR bar |
| Beat Check | 380px card | Centered modal with spotlight |
| Intermission | 560 x 500px | "WE'LL BE RIGHT BACK" card |
| Director Mode | 420px card | Four compassionate options |
| Strike | 560 x variable | Stats + verdict + act recap |

## Mockup Reference

The definitive UI mockup is at `docs/mockups/direction-4-the-show.html`.
Open it in a browser to see all views. When implementing, match this mockup.

## CLUI Legacy Notes

The original CLUI components (ConversationView, InputBar, PermissionCard, AttachmentChips, SlashCommandMenu, PopoverLayer) have been removed. If you find any remaining inline `style={{}}` patterns, they're CLUI leftovers — replace with Tailwind classes.

## Documentation Rules

- `docs/` is the PUBLIC documentation website (VitePress). Every file here is deployed to GitHub Pages.
- Internal session notes, retrospectives, and working docs go in `docs-internal/` (gitignored).
- Design docs for features go in `docs/plans/` (public, useful for contributors).
- Never put date-stamped session logs in `docs/`.
- Run `npm run docs:build --prefix docs` to verify docs build before committing doc changes.

## Git Workflow

**All changes go through pull requests. Never push directly to `main`.**

1. Create a feature branch from `main`: `git checkout -b feat/my-change`
2. Commit at each working milestone with clear messages
3. Test before pushing: `npm run test && npm run test:e2e`
4. Never push with failing tests
5. Open a PR against `main` — CodeRabbit will auto-review
6. Address CodeRabbit feedback before merging
7. Squash-merge PRs to keep `main` history clean

### Branch naming

| Prefix | Use |
|--------|-----|
| `feat/` | New features |
| `fix/` | Bug fixes |
| `docs/` | Documentation only |
| `chore/` | Build, CI, tooling |
| `refactor/` | Code restructuring (no behavior change) |

### CodeRabbit

CodeRabbit reviews every PR automatically. It checks for:
- Inline styles (must use Tailwind)
- Missing E2E test coverage
- IPC type safety
- Animation physics (spring only, no linear)
- CLAUDE.md rule violations

Fix CodeRabbit comments before merging. If a comment is a false positive, reply explaining why.

## Known Pitfalls (from prior runs)
<!-- Auto-injected by openspec-loki-loop. Do not edit manually. -->
- [electron] frame:false + titleBarStyle:'hiddenInset' are mutually exclusive — creates ghost native traffic lights
- [electron] setIgnoreMouseEvents prevents drag — use content-tight sizing instead
- [electron] better-sqlite3 requires electron-rebuild for native ABI compatibility
- [electron] Vitest runs under system Node, not Electron Node — test config needs node environment for native modules
- [ui] Spotlight overlays must have `pointer-events-none` — otherwise they block interactive elements beneath them (e.g., "Go Live" button)
- [ui] Pill view requires explicit min-width constraint (`w-80`) to prevent collapse below intended size
- [loki] Queue pending.json is permanently stale — trust git log for progress
- [workflow] Update CLAUDE.md BEFORE Loki runs, not as a task for Loki
- [workflow] Do NOT use titleBarStyle with frame:false
- [testing] Playwright E2E tests require full Electron app build before running
- [testing] Cassette replay tests (SHOWTIME_PLAYBACK=1) are primary tier — use before real Claude tests
