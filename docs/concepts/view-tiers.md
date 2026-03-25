# View Tiers

Showtime doesn't have one fixed window. It has four view tiers that adapt to what you need in the moment -- from a tiny floating pill that stays out of your way to a full dashboard that puts you in the control room.

## Pill View

**Size:** 320 x 48px | **Always on top** | **Rounded floating pill**

The Pill is Showtime at its most minimal. A small rounded capsule floating above your other windows, showing just three things:

- **Act name** -- what you're performing right now
- **Timer** -- the studio clock counting down in monospaced numerals
- **Tally light** -- a small red dot pulsing to confirm the show is live

This is the view for when you're in the zone. You're deep in your code editor or your design tool or your document, and all you need is a quiet reminder that the clock is running and the show is on. The Pill stays on top of everything, taking up almost no screen space.

Click the Pill to expand into a larger view. It's always one click away from more detail.

## Compact View

A step up from the Pill. Compact View shows:

- Current Act with timer
- Act progress through the lineup
- Beat count -- how many golden stars you've locked so far

Good for quick glances when you want a bit more context than the Pill provides but don't need the full production dashboard. You can see where you are in the show without losing focus on your work.

## Dashboard View

The control room. Dashboard View gives you the full picture:

- **Lineup sidebar** -- every Act in today's show, with status indicators (completed, current, upcoming)
- **Current Act detail** -- the active Act with its Sketch category, timer, and clapperboard badge
- **ON AIR bar** -- the red ON AIR light confirming the show is live
- **Coming up** -- a preview of what's next in the lineup
- **Beat count** -- your progress toward the win threshold

This is the view for when you want to feel the full weight of the production. The lineup is visible. The clock is ticking. The ON AIR light is glowing. You're not just working -- you're running a show, and the control room proves it.

## Expanded View

**Size:** 560 x 620px

The full stage experience. Expanded View features:

- **Hero timer** -- the studio clock rendered at 64px in JetBrains Mono. Big, bold, impossible to ignore. The countdown shifts to amber when less than 5 minutes remain.
- **Full lineup sidebar** -- every Act with completion status, category color, and Beat indicator
- **ON AIR bar** -- pulsing red glow when live, dark gray during intermission
- **Act details** -- the current Act's Sketch, duration, and clapperboard badge
- **Beat stars** -- your gold and gray stars for the day

This view is for the moments when you want to lean into the metaphor. The hero timer dominates the window like a broadcast clock in a real control room. The lineup sidebar shows the full shape of today's show. Everything is visible, nothing is hidden.

## Switching between views

Transitions between views use spring physics animation -- smooth, weighted motion that feels physical rather than digital. Nothing snaps or teleports. The window breathes between sizes.

| Action | Result |
|--------|--------|
| **Click the Pill** | Expands to your last-used larger view |
| **Press Escape** | Collapses back to the Pill |
| **Drag the window** | Works from any view -- the entire window is draggable |

The Pill is your home base during focused work. Expand when you want more context. Collapse when you want to disappear back into the zone. The show is always running either way -- the view tier just controls how much of the production you can see.

::: tip Find your rhythm
Most people settle into a pattern: Pill View during deep focus, Expanded View during transitions and planning moments, and a quick glance at the Dashboard between Acts. But there's no "right" way to use the tiers. Use whatever keeps you in the show.
:::

---

**Previous:** [Director Mode](./director-mode) | **Back to:** [Show Phases](./show-phases)
