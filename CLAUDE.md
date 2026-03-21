# Showtime — CLAUDE.md

Showtime is an ADHD-friendly macOS day planner built on the SNL Day Framework.
Your day is a Show. Tasks are Acts. Presence moments are Beats. Rest costs zero.

This file is the source of truth for ALL agents working in this codebase.

## Active Specification

- **Spec:** `.claude/specs/showtime-v2/` (active)
- **Superseded:** `.claude/specs/showtime-snl-planner/` (v1 — thin product context, do not use)

## Product Context

Read `docs/plans/product-context.md` for the full product vision. Key points:

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
│   ├── window management    ← KEEP: NSPanel, always-on-top, click-through
│   └── IPC handlers         ← KEEP: notification triggers, theme sync
├── Preload (contextBridge)
│   └── window.clui API      ← KEEP: typed IPC bridge, strict process isolation
├── Renderer (React 19)
│   ├── views/               ← PillView, WritersRoomView, ExpandedView, StrikeView, DarkStudioView
│   ├── panels/              ← TimerPanel, LineupPanel, ChatPanel
│   ├── components/          ← ActCard, BeatCheckModal, BeatCounter, DirectorMode, etc.
│   ├── stores/              ← showStore (Zustand), sessionStore (simplified)
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
  vibrancy: 'under-window',
  visualEffectState: 'active',
  backgroundColor: '#00000000',
  frame: false,
  // Do NOT use titleBarStyle: 'hiddenInset' — it conflicts with frame: false
  // and creates ghost native traffic lights behind custom UI
  hasShadow: true,
  transparent: true,
  // ... other settings
});
```

- HTML, body, and React root: `background-color: transparent`
- Draggable regions: Use CSS classes `.drag-region` and `.no-drag` (defined in `index.css`). **Never** use inline `style={{ WebkitAppRegion: 'drag' }}`.
- **Do NOT use `setIgnoreMouseEvents`**. Content-tight window sizing eliminates the need for click-through.
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

### 8. State Management — Zustand Only

Use Zustand for all global state. No React Context for state management.

- `showStore.ts` — Show state machine (phase, acts, beats, energy, timer)
- `sessionStore.ts` — Claude subprocess session (simplified to single session)

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
| Pill | 320 x 48px | Floating, always-on-top, rounded-full |
| Expanded | 560 x 620px | Timer hero + lineup sidebar + ON AIR bar |
| Beat Check | 380px card | Centered modal with spotlight |
| Intermission | 560 x 500px | "WE'LL BE RIGHT BACK" card |
| Director Mode | 420px card | Four compassionate options |
| Strike | 560 x variable | Stats + verdict + act recap |

## Mockup Reference

The definitive UI mockup is at `docs/mockups/direction-4-the-show.html`.
Open it in a browser to see all views. When implementing, match this mockup.

## Files to Delete (CLUI Dead Weight)

These CLUI-specific files should be removed:
- `src/renderer/components/ConversationView.tsx` — General chat rendering
- `src/renderer/components/InputBar.tsx` — Rich input (rebuild simplified for Showtime)
- `src/renderer/components/PermissionCard.tsx` — Keep but simplify
- `src/renderer/components/AttachmentChips.tsx` — Not needed
- `src/renderer/components/SlashCommandMenu.tsx` — Not needed
- `src/renderer/components/PopoverLayer.tsx` — Replace with shadcn/ui

## Git Workflow

- Commit at each working milestone
- Branch: `main` (no feature branches for MLP)
- Test before commit: `npm run test && npm run test:e2e`
- Never commit with failing tests
