# Proposal: Animated SNL Day Timeline SVG

## Goal

Create an animated SVG diagram showing the Showtime SNL Day Framework timeline. This will be embedded in `docs/framework/snl-metaphor.md` and the repo README.

## Style Reference

**CRITICAL:** Match the exact visual style from `docs/plans/style-reference-swarm.svg`. This is the user's GitHub profile SVG. Key style rules:

### Color Palette (dark mode default)
```css
--bg: #0d1117;
--fg: #7ee787;
--fg-dim: #484f58;
--fg-muted: #30363d;
--red: #f85149;
--orange: #d29922;
--yellow: #e3b341;
--green: #7ee787;
--white: #c9d1d9;
```

### Must Include
- `@media (prefers-color-scheme: light)` with light palette
- `@media (prefers-reduced-motion: reduce)` that kills animations
- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial` for titles
- Font: `"SFMono-Regular", Consolas, "Liberation Mono", Menlo, monospace` for labels
- Title in uppercase with letter-spacing 0.12em
- CSS keyframe animations (no JavaScript)
- `role="img"` and `aria-label` on the root `<svg>`
- viewBox-based sizing, no hardcoded width/height in px

### Showtime-Specific Colors (map to the palette)
- Dark Studio: `--bg` (#0d1117)
- Writer's Room: `--orange` (#d29922)
- Going Live: `--yellow` (#e3b341)
- ON AIR: `--red` (#f85149)
- Intermission: `--fg-dim` (#484f58)
- Strike: `--green` (#7ee787)
- Beat stars: `--yellow` (#e3b341)

## Timeline Content

The SVG should show a horizontal timeline of a Showtime day, left to right:

### Phases (in order)
1. **DARK STUDIO** — Empty stage, spotlight circle, "The stage is empty" label
2. **WRITER'S ROOM** — Planning icon, "Design tonight's lineup" label, 20-min clock
3. **GOING LIVE** — Transition moment, countdown "3...2...1..."
4. **ON AIR** — The main block. Show 3 Act slots with:
   - Clapperboard badges ("DEEP WORK | ACT 1", "EXERCISE | ACT 2", "CREATIVE | ACT 3")
   - Beat stars (gold ★) that ignite with animation
   - A pulsing red tally dot (ON AIR indicator)
5. **INTERMISSION** — "WE'LL BE RIGHT BACK" card, rest icon
6. **STRIKE THE STAGE** — Verdict badge ("DAY WON" or "SOLID SHOW"), credits rolling

### Animations
- **Tally pulse** — red dot fades in/out continuously (2s cycle)
- **Beat ignite** — stars transition from gray to gold sequentially (staggered 0.5s delays)
- **Phase highlight** — a subtle glow sweeps left-to-right across the timeline, highlighting each phase in sequence (8-10s total cycle, then repeats)
- **Spotlight** — in Dark Studio, a subtle spotlight circle pulses

### Layout
- Horizontal timeline bar at center
- Phase blocks above the bar with icons/labels
- Phase names below the bar
- Title at top: "THE SNL DAY FRAMEWORK"
- Subtitle: "Your day is a live show. Every phase has a purpose."

## Output

- Single file: `docs/framework/snl-timeline.svg`
- Must render correctly on GitHub (no external resources, no JavaScript)
- Must look good in both dark and light GitHub themes
- Should be ~600-800 lines of SVG (similar complexity to the reference)

## Testing

- Open the SVG in a browser and verify animations play
- Verify it renders on GitHub by viewing the raw file
- Check that `prefers-reduced-motion` stops animations
- Verify light mode colors work
