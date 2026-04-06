# Burning Fuse Progress Bar (#202)

## Problem

The current flat progress bar across all views lacks personality and urgency signaling. The Burning Fuse design (validated via mockups) replaces it with a fuse that burns right-to-left with ember glow and color temperature shifts.

## Goals

1. Create a shared `<BurningFuse>` component with size prop (pill | compact | expanded)
2. Replace existing progress bars in PillView and TimerPanel
3. Implement color temperature shift: white → warm orange → amber → red
4. Add ember glow at burn point with wobble animation
5. Add spark particles in expanded view during critical phase (<15%)

## Scope

### In scope
- `src/renderer/components/BurningFuse.tsx` — NEW shared component
- `src/renderer/views/PillView.tsx` — Replace MiniRundownStrip progress with fuse
- `src/renderer/panels/TimerPanel.tsx` — Replace progress bar with fuse
- `src/renderer/index.css` — Fuse keyframe animations (ember wobble, glow pulse)

### Out of scope
- Canvas or SVG rendering — pure CSS with positioned divs
- Changes to timer logic or useTimer hook

## Design Reference

- `docs/mockups/progress-bar-fuse-complete-ui.html` — Complete UI with lineup, controls, fuse at all sizes
- `docs/mockups/progress-bar-fuse-all-sizes.html` — Fuse animation at 4 view sizes
- `docs/mockups/progress-bar-burning-fuse.html` — Fuse vs Color Temperature vs Hybrid comparison

## Specification

### Fuse dimensions
- Pill: 2px height
- Compact: 4px height
- Expanded: 8px height

### Color temperature phases
- Normal (>30%): white → warm orange gradient
- Warning (15-30%): amber, glow intensifies
- Critical (<15%): red, glow pulses, spark particles (expanded only)

### Animation requirements
- Spring physics only (Framer Motion) — no linear transitions
- Ember wobble: CSS keyframe, subtle side-to-side at burn point
- Glow pulse: CSS keyframe on box-shadow, intensifies at warning/critical
- Timer text color shifts to match fuse urgency

## Acceptance Criteria

- [ ] Fuse renders in pill view (2px)
- [ ] Fuse renders in expanded view (8px) with particles
- [ ] Color temperature shifts correctly at 30% and 15% thresholds
- [ ] Ember glow intensifies at warning/critical thresholds
- [ ] Timer text color shifts to match fuse urgency
- [ ] No performance regression (Electron always-on-top pill)
- [ ] Spring physics only (no linear transitions)
- [ ] E2E test coverage for fuse visibility

## Context (auto-generated)

### Relevant file paths
- `src/renderer/components/BurningFuse.tsx` — NEW component
- `src/renderer/views/PillView.tsx` — Contains MiniRundownStrip to replace
- `src/renderer/panels/TimerPanel.tsx` — Contains progress bar to replace
- `src/renderer/hooks/useTimer.ts` — Provides progress (0-1) value
- `src/renderer/index.css` — Add keyframe animations here
- `docs/mockups/progress-bar-fuse-complete-ui.html` — Primary mockup reference

### CLAUDE.md rules that apply
- Rule #1: NO INLINE STYLES — use Tailwind utility classes
- Rule #5: Framer Motion — spring physics only, never linear
- Rule #6: Testing — Playwright E2E mandatory
- Design system: accent=#d97757, onair=#ef4444, beat=#f59e0b

### Build/run/test commands
```
npm run build
npm run test
npm run test:e2e
npm run lint
```

### Tech stack
- React 19, Framer Motion 12, Tailwind CSS v4
- useTimer hook provides elapsed/remaining/progress values
