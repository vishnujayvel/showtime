# Design System

Showtime's visual language is built around the live TV production metaphor. Everything looks like a broadcast control room: dark surfaces, warm accent lighting, red tally indicators, and gold highlights for moments of presence.

## Color Palette

### Core Colors

| Token | Hex | Usage |
|-------|-----|-------|
| `studio-bg` | `#0d0d0f` | Primary background (the dark studio) |
| `surface` | `#1a1a1e` | Cards, panels, elevated surfaces |
| `surface-hover` | `#242428` | Hover states, subtle borders |
| `accent` | `#d97757` | Stage lighting, primary CTAs |
| `onair` | `#ef4444` | ON AIR indicator, tally light |
| `beat` | `#f59e0b` | Beat stars, DAY WON verdict glow |
| `txt-primary` | `#e8e6e0` | Primary text |
| `txt-secondary` | `#9a9890` | Secondary text, labels |
| `txt-muted` | `#5a5855` | Muted text, disabled states |

### Category Colors

Each Act category has a distinct color used in clapperboard badges and card accents:

| Category | Token | Hex |
|----------|-------|-----|
| Deep Work | `cat-deep` | `#8b5cf6` |
| Exercise | `cat-exercise` | `#22c55e` |
| Admin | `cat-admin` | `#60a5fa` |
| Creative | `cat-creative` | `#f59e0b` |
| Social | `cat-social` | `#ec4899` |

### Using Colors in Code

All colors are defined as Tailwind CSS v4 theme tokens via `@theme` in CSS. Use them with standard Tailwind utility classes:

```css
/* In your CSS (already configured in the app) */
@theme {
  --color-studio-bg: #0d0d0f;
  --color-surface: #1a1a1e;
  --color-accent: #d97757;
  /* ... */
}
```

```tsx
// In components — use Tailwind classes, never inline styles
<div className="bg-studio-bg text-txt-primary">
  <span className="text-accent">Stage directions</span>
</div>
```

## Typography

Showtime uses two typefaces:

### JetBrains Mono

The broadcast typeface. Used for anything that belongs on a control room monitor:

- **Timers** — 64px hero countdown, 14px pill timer
- **Clapperboard badges** — `DEEP WORK | ACT 3` in uppercase with wide letter-spacing
- **ON AIR text** — 10px bold, all-caps
- **Section labels** — All-caps with wide tracking

```tsx
<span className="font-mono text-xs uppercase tracking-widest text-txt-secondary">
  ON AIR
</span>
```

### Inter

The body typeface. Used for everything humans read at length:

- Body text, headings, buttons
- Act titles and descriptions
- Strike verdicts and stats
- Weights 300 (light) through 900 (black)

```tsx
<h2 className="font-body text-2xl font-bold text-txt-primary">
  Writer's Room
</h2>
```

## Animations

All animations use **Framer Motion with spring physics**. Linear transitions are not allowed. Springs feel alive and physical, which reinforces the live-production metaphor.

| Animation | Duration / Config | Description |
|-----------|------------------|-------------|
| `tallyPulse` | 2s cycle | Red dot glow pulse on the ON AIR tally light |
| `onairGlow` | continuous | Box-shadow pulse on the ON AIR indicator box |
| `beatIgnite` | ~0.6s | Gray-to-gold transition when a Beat is locked |
| `spotlightFadeIn` | ~0.4s | Blur-to-sharp reveal for the Dark Studio entrance |
| `goldenGlow` | continuous | Text-shadow pulse on the DAY WON verdict |
| `slideUp` | staggered | Staggered upward entrance for Act cards in the lineup |

### Spring Physics Examples

```tsx
// Standard interactive spring
<motion.div
  transition={{ type: "spring", stiffness: 300, damping: 30 }}
/>

// Gentle entrance spring
<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ type: "spring", stiffness: 200, damping: 25 }}
/>

// NEVER do this — no linear/tween transitions
<motion.div transition={{ duration: 0.3 }} />  // WRONG
```

## View Dimensions

Each Showtime view has a specific window size. The main process resizes the Electron `BrowserWindow` to match the active view.

| View | Size | Notes |
|------|------|-------|
| Dark Studio | Full window | Empty stage with spotlight effect. Shown when no show is planned. |
| Writer's Room | 560 x 680px | Chat-first day planning with Claude. Energy chip + chat + lineup card. |
| Pill | 320 x variable | Floating, always-on-top, rounded-full. ~40px base height + optional MiniRundownStrip below. |
| Compact | 320 x variable | One step up from Pill — timer + progress + beat count. |
| Dashboard | 560 x variable | Control room — lineup sidebar + current act detail. |
| Expanded | 560 x 620px | Timer hero + lineup sidebar + ON AIR status bar. |
| Beat Check | 380px card | Centered modal with spotlight overlay. |
| Intermission | 560 x 500px | "WE'LL BE RIGHT BACK" card. Rest costs zero. |
| Director Mode | 420px card | Four compassionate options for when things go sideways. |
| Strike | 560 x variable | Stats, verdict, and Act recap. Height varies with content. |

See [View System](/contributing/view-system) for the full view routing and tier state machine.

### Key UI Components

- **ON AIR light** — Red bordered box with JetBrains Mono 10px bold text. Pulsing glow when live, dark gray when off.
- **Tally light** — 10px red pulsing dot in Pill view, 8px in sidebar.
- **Clapperboard badge** — Monospaced uppercase label like `DEEP WORK | ACT 3`, with a category-colored left border.
- **Studio clock** — 64px monospaced countdown. Shifts to amber when under 5 minutes remain.
- **Beat stars** — Gold filled star when locked, gray outline when empty. Plays the `beatIgnite` animation on lock.
- **MiniRundownStrip** — Horizontal timeline bar below the Pill view. Each act is a colored segment proportional to its duration. A red NOW marker tracks real-time position. Only visible during `live` and `intermission`.
- **LineupCard** — Interactive lineup editor rendered inside chat messages. Supports inline editing of act name, duration, and category. See [Components](/contributing/components).

See [Key Components](/contributing/components) for the full component reference.
