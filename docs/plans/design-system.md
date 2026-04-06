---
title: "Showtime Design System"
status: current
last-verified: 2026-04-06
---
# Showtime Design System

Extracted from **Direction 4: The Show** mockup (`docs/mockups/direction-4-the-show.html`).
This is the definitive design reference for implementation.

---

## 1. Color Palette

### Backgrounds

| Semantic Name     | Hex       | Usage                                   |
|-------------------|-----------|-----------------------------------------|
| Body background   | `#0a0a0c` | `<body>` background                     |
| Studio background | `#0d0d0f` | Dark studio view, modal scrims, primary BG for full-screen views |
| Title bar         | `#151517` | Window chrome title bars, bottom bars, recap panel BG |
| Surface           | `#1a1a1e` | Cards, panels, expanded view BG, component containers |
| Surface hover     | `#242428` | Hovered/active act cards, neutral button BG, progress bar track, borders between sections |
| Notepad BG        | `#13130f` | Writer's Room notepad textarea background |
| Notepad header    | `#1a1a14` | Notepad header bar background           |
| Notepad border    | `#2a2a24` | Notepad border and dividers             |
| Intermission warm | `#1e1c1a` | Intermission gradient end (warm tint)   |

### Text

| Semantic Name  | Hex       | Usage                                         |
|----------------|-----------|-----------------------------------------------|
| Primary        | `#e8e6e0` | Headings, act names, timer digits, primary content |
| Secondary      | `#9a9890` | Descriptions, completed act names, sub-labels |
| Muted          | `#5a5855` | Section labels, dimmed beat stars, placeholder text, timestamps |
| Notepad text   | `#c8c6b8` | Writer's Room notepad body text              |

### Accents

| Semantic Name     | Hex       | Usage                                         |
|-------------------|-----------|-----------------------------------------------|
| Accent (primary)  | `#d97757` | Stage lighting, primary CTA gradient start, secondary button text, warm accent throughout |
| Accent (dark)     | `#c4613e` | Primary CTA gradient end                      |
| ON AIR red        | `#ef4444` | ON AIR light box, tally light dot             |
| Beat gold         | `#f59e0b` | Locked beat stars, beat actions, "DAY WON" verdict, amber timer warning |
| Beat gold (light) | `#fbbf24` | Mid-point of beat ignite animation            |

### Status / State Colors

| Semantic Name        | Hex       | Usage                                   |
|----------------------|-----------|-----------------------------------------|
| Off / inactive       | `#3a3a3e` | OFF state for ON AIR box, inactive tally dot, dimmed traffic lights |
| Border default       | `#333333` | Neutral button borders, generic borders |
| Divider              | `#242428` | Section dividers, border between title bar and content |
| Recap divider        | `#1e1e22` | Divider between act recap rows          |
| Card border          | `#2a2a2e` | Modal card borders, verdict card borders |
| Scrollbar thumb      | `#333333` | Custom webkit scrollbar thumb           |

### Category Colors

| Category    | Hex       | Tailwind Token  |
|-------------|-----------|-----------------|
| Deep Work   | `#8b5cf6` | `cat-deep`      |
| Exercise    | `#22c55e` | `cat-exercise`  |
| Admin       | `#60a5fa` | `cat-admin`     |
| Creative    | `#f59e0b` | `cat-creative`  |
| Social      | `#ec4899` | `cat-social`    |

Each category color is used at multiple opacity levels:
- **Solid** (`1.0`) -- category stripe (w-1 bar), clapperboard badge text
- **Border** (`0.25-0.5`) -- badge border, active act card border
- **Background tint** (`0.05-0.08`) -- completed act row BG, active act card BG, energy selector buttons

### Energy Level Colors

| Energy Level | Color Hex | Used For                |
|--------------|-----------|-------------------------|
| High         | `#f59e0b` | Button text and border  |
| Medium       | `#22c55e` | Button text and border  |
| Low          | `#60a5fa` | Button text and border  |
| Recovery     | `#8b5cf6` | Button text and border  |

---

## 2. Typography

### Font Families

| Family          | Import                                      | CSS Token    | Usage                                      |
|-----------------|---------------------------------------------|--------------|---------------------------------------------|
| JetBrains Mono  | Google Fonts, weights: 400, 500, 600, 700   | `font-mono`  | Timers, clapperboard badges, section labels, data values, ON AIR box, timestamps |
| Inter           | Google Fonts, weights: 300-900              | `font-body`  | Body text, headings, descriptions, buttons, verdicts |

### Type Scale

| Context                | Font Family    | Size   | Weight    | Extra                                        |
|------------------------|----------------|--------|-----------|----------------------------------------------|
| Countdown timer (hero) | JetBrains Mono | `64px` | Bold (700) | `line-height: 1`, `letter-spacing: -0.02em` |
| Verdict headline       | Inter          | `text-5xl` (~48px) | Black (900) | `letter-spacing: 0.02em`            |
| Going Live headline    | Inter          | `text-3xl` (~30px) | Extra Bold (800) | `letter-spacing: -0.01em`       |
| Page title (mockup)    | Inter          | `text-4xl` (~36px) | Black (900) | `tracking-tight`                    |
| View heading           | Inter          | `text-2xl` (~24px) | Light (300) | For poetic "dark studio" text       |
| Writer's Room heading  | Inter          | `text-xl` (~20px) | Semi Bold (600) |                                  |
| Act name (expanded)    | Inter          | `text-lg` (~18px) | Bold (700) |                                     |
| Act name (card)        | Inter          | `text-sm` (14px) | Medium (500) | `truncate`                        |
| Body text              | Inter          | `text-sm` (14px) | Regular (400) |                                  |
| Small body             | Inter          | `text-xs` (12px) | Regular (400) |                                  |
| Timer (pill)           | JetBrains Mono | `text-sm` (14px) | Semi Bold (600) |                              |
| Timer (sidebar)        | JetBrains Mono | `10px`   | Regular (400) |                                  |
| Section label          | JetBrains Mono | `11px`   | Regular (400) | `letter-spacing: 0.15em`, `uppercase` |
| Clapperboard badge     | JetBrains Mono | `11px`   | Semi Bold (600) | `letter-spacing: 0.08em`, `uppercase` |
| Clapperboard (small)   | JetBrains Mono | `10px`   | Semi Bold (600) | Used in act cards and sidebar   |
| ON AIR box text        | JetBrains Mono | `10px`   | Bold (700) | `letter-spacing: 0.12em`            |
| App name in title bar  | JetBrains Mono | `text-xs` (12px) | Regular (400) | `tracking-widest`, `uppercase` |
| Stats numbers (strike) | JetBrains Mono | `text-3xl` (~30px) | Bold (700) |                               |

---

## 3. Spacing & Layout

### View Dimensions

| View                  | Size              | Notes                          |
|-----------------------|-------------------|--------------------------------|
| Dark Studio           | Full screen       | `height: 520px` in mockup      |
| Writer's Room         | `560 x 680px`     | Windowed                        |
| Going Live transition | Full screen       | `height: 400px`, 2-3s duration  |
| Pill view             | `320 x 48px`      | Floating, always-on-top         |
| Expanded view         | `~560 x 620px`    | Windowed, `min-height: 540px` content area |
| Beat Check modal      | `~380px` card     | Centered in overlay             |
| Director Mode         | `~420px` card     | Centered in overlay             |
| Intermission          | `~560 x 500px`    | Windowed, `min-height: 420px` content area |
| Strike the Stage      | `~560 x variable` | Windowed                        |

### Pill View Layout

- Width: `320px`, Height: `48px`
- Border radius: `9999px` (fully rounded / `rounded-full`)
- Padding: `10px 16px` (`py-2.5 px-4`)
- Background: `rgba(26,26,30,0.85)` with `backdrop-filter: blur(20px)`
- Border: `1px solid rgba(255,255,255,0.06)`
- Shadow: `0 8px 32px rgba(0,0,0,0.4)`
- Tally light: `10px x 10px` (`w-2.5 h-2.5`)
- Inner gap: `12px` (`gap-3`)

### Card & Panel Dimensions

| Element              | Dimension           | Notes                         |
|----------------------|---------------------|-------------------------------|
| Act card (lineup)    | Full width, `p-3.5` | `rounded-lg` (8px)           |
| Category stripe      | `4px x 40px`        | `w-1 h-10 rounded-full`      |
| Sidebar              | `200px` wide        | In expanded view              |
| Sidebar act row      | `p-2`, `rounded-md` |                               |
| Sidebar color bar    | `24px x 2px`        | `w-6 h-0.5 rounded-full`     |
| Beat Check card      | `380px` wide, `p-8` | `rounded-2xl` (16px)         |
| Director Mode card   | `420px` wide, `p-8` | `rounded-2xl` (16px)         |
| Intermission card    | `max-width: 380px`, `p-8` | `rounded-xl` (12px)   |
| Energy selector btn  | `p-4`, grid 2-col   | `rounded-lg` (8px)           |
| Verdict recap panel  | Full width, `p-4`   | `rounded-lg` (8px)           |

### Border Radius Values

| Token          | Value  | Usage                                          |
|----------------|--------|-------------------------------------------------|
| `rounded-full` | 9999px | Pill view, tally dots, progress bars, category stripes |
| `rounded-2xl`  | 16px   | Modal cards (Beat Check, Director Mode)         |
| `rounded-xl`   | 12px   | macOS window chrome, WE'RE LIVE button, Intermission card, Lock the Beat button |
| `rounded-lg`   | 8px    | Act cards, action buttons, energy selectors, content panels |
| `rounded-md`   | 6px    | Sidebar act rows                                |
| `rounded`      | 4px    | Clapperboard badges, ON AIR box                 |
| `3px`          | 3px    | Scrollbar thumb                                 |

### Padding Patterns

| Context                    | Padding             |
|----------------------------|---------------------|
| Window content area        | `px-8 py-10` or `px-8 py-8` |
| Title bar                  | `px-5 py-3`         |
| Bottom bar                 | `px-5 py-3`         |
| Sidebar                    | `px-3 py-3`         |
| Act card (lineup)          | `p-3.5` (14px)      |
| Modal card                 | `p-8` (32px)        |
| Energy selector button     | `p-4` (16px)        |
| Primary CTA (WE'RE LIVE)   | `py-4`, full width  |
| Secondary button           | `px-5 py-2.5`       |
| Neutral / timer button     | `px-4 py-2`         |
| ON AIR box                 | `2px 8px`           |
| Clapperboard badge         | `3px 10px`          |

### Progress Bar

- Height: `4px` (`h-1`)
- Track: `#242428`, fully rounded
- Fill: `linear-gradient(90deg, #8b5cf6, #a78bfa)` (uses category color for gradient)
- Border radius: fully rounded

### macOS Window Chrome

- Outer: `border-radius: 12px`, `overflow: hidden`
- Traffic lights: `12px` circles, `8px` gap between them
- Active colors: close `#ff5f57`, minimize `#febc2e`, maximize `#28c840`
- Inactive colors: all `#3a3a3e`

---

## 4. Key UI Components

### ON AIR Light Box

A broadcast-style indicator showing whether the user is in an active work session.

**Structure:** JetBrains Mono, 10px, weight 700, `letter-spacing: 0.12em`. Contains a tally dot + "ON AIR" text. Bordered box with `border-radius: 4px`, `padding: 2px 8px`, `display: inline-flex`, `align-items: center`, `gap: 5px`.

**States:**

- **Live:** Color `#ef4444`, border `1.5px solid #ef4444`, animated with `onairGlow` (pulsing box-shadow). Tally dot inside also pulses via `tallyPulse`.
- **Off:** Color `#3a3a3e`, border-color `#3a3a3e`, no box-shadow. Text reads "ON AIR" or "OFF". Tally dot is static `#3a3a3e`.

### Tally Light

A pulsing red dot indicating a live session is in progress.

- Size: `10px x 10px` (`w-2.5 h-2.5`) in pill view; `8px x 8px` (`w-2 h-2`) in sidebar; `6px x 6px` (`w-1.5 h-1.5`) inside ON AIR box
- Color: `#ef4444` (bg-onair)
- Shape: fully rounded circle
- Animation: `tallyPulse` -- 2s ease-in-out infinite, fades between opacity 1 and 0.4 with glowing red box-shadow

### Clapperboard Badge

A category + act number label styled like a film clapperboard slate.

- Font: JetBrains Mono, 11px (or 10px in compact contexts), weight 600
- Letter spacing: `0.08em`, uppercase
- Padding: `3px 10px`
- Border: `1.5px solid` in category color at ~40-50% opacity
- Text color: category color at full saturation
- Border radius: `4px`
- Layout: `display: inline-flex`, `align-items: center`, `gap: 6px`
- Divider pipe `|` at `opacity: 0.4`
- Content pattern: `CATEGORY | ACT N` or `CATEGORY | ACT N | DURATION` or `CATEGORY | ACT N | COMPLETE`

### Studio Clock (Countdown Timer)

The hero countdown display in the expanded view.

- Font: JetBrains Mono, `64px`, Bold (700)
- Color: `#e8e6e0` (primary text)
- Line height: `1`
- Letter spacing: `-0.02em`
- Format: `MM:SS`
- Below the timer: a 4px-tall progress bar showing elapsed percentage

**Timer in pill view:** JetBrains Mono, 14px, Semi Bold (600), `#e8e6e0`. When under 5 minutes: color switches to `#f59e0b` (beat gold) with `warmPulse` animation.

### Beat Stars

A 3-star progress indicator representing "moments of presence" locked during the show.

- Character: filled star `U+2733` (&#9733;) for locked, outline star `U+2734` (&#9734;) for unlocked
- Size: `text-sm` (14px) in pill/bottom bar, `text-xl` (20px) in reference display, `text-2xl` (24px) in verdict cards, `text-3xl` (30px) in DAY WON view
- Letter spacing: `tracking-wider`
- Locked state (`.beat-lit`): color `#f59e0b`, `text-shadow: 0 0 8px rgba(245,158,11,0.4)`
- Unlocked state (`.beat-dim`): color `#5a5855`
- Ignite animation (`.beat-ignite`): 0.6s transition from dim to lit with a bright flash at 50% (`#fbbf24` with `text-shadow: 0 0 20px rgba(245,158,11,0.8)`)
- Displayed with count: `"1/3 Beats"`, `"2/3 Beats"`, etc. in JetBrains Mono, 12px, muted
- In intermission: dimmed at `opacity: 0.35`

### Act Cards

Items in the show lineup. Appear in both the Writer's Room (full cards) and expanded view sidebar (compact rows).

**Full card (Writer's Room lineup):**
- Background: `#242428`
- Padding: `p-3.5` (14px)
- Border radius: `rounded-lg` (8px)
- Layout: flex row with `gap-3` -- drag handle, category stripe, content, timer, reorder arrows
- Drag handle: `⁞⁞` character, `text-txt-muted`, `cursor-grab`
- Category stripe: `w-1 h-10 rounded-full`, solid category color
- Entrance animation: `slideUp` with staggered `animation-delay` (0s, 0.08s, 0.16s, 0.24s, 0.32s)

**Sidebar compact row (expanded view):**

| State     | Background                            | Border                                  | Icon    | Name style                      | Opacity |
|-----------|---------------------------------------|-----------------------------------------|---------|---------------------------------|---------|
| Completed | `rgba(34,197,94,0.05)`               | None                                    | checkmark | `text-xs font-medium text-txt-secondary` | 1.0 |
| Active    | `rgba(category,0.08)`                | `1px solid rgba(category,0.25)`         | Tally dot (pulsing) | `text-xs font-semibold text-txt-primary` | 1.0 |
| Upcoming  | None                                  | None                                    | hourglass | `text-xs font-medium text-txt-muted` | 0.6 |

### Energy Selector Buttons

Grid of 2x2 buttons for pre-show energy check.

- Layout: `grid grid-cols-2 gap-3`
- Each button: `text-left p-4 rounded-lg border`
- Background: category color at 6% opacity -- `rgba(color, 0.06)`
- Border: category color at 25% opacity -- `rgba(color, 0.25)`
- Emoji: `text-2xl`, block display, `mb-1`
- Label: `font-semibold text-sm`, colored with energy color
- Sublabel: `text-xs text-txt-muted mt-1`

### Action Buttons

**Primary CTA ("WE'RE LIVE!"):**
- Full width, `py-4`, `rounded-xl` (12px)
- Background: `linear-gradient(135deg, #d97757, #c4613e)`
- Text: `#fff`, `font-bold`, `text-base`, `tracking-wide`
- Shadow: `0 0 30px rgba(217,119,87,0.3), 0 4px 20px rgba(0,0,0,0.4)`
- Glossy overlay: `linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)`

**Secondary (accent-tinted):**
- `px-5 py-2.5`, `rounded-lg` (8px)
- Background: `rgba(217,119,87,0.15)`
- Text: `#d97757`, `font-medium`, `text-sm`
- Border: `1px solid rgba(217,119,87,0.3)`

**Beat Action:**
- Same shape as secondary
- Background: `rgba(245,158,11,0.15)`
- Text: `#f59e0b`
- Border: `1px solid rgba(245,158,11,0.3)`

**Category-tinted (e.g., Rest button):**
- `px-4 py-2`, `rounded-lg`
- Background: `rgba(139,92,246,0.1)`
- Text: `#8b5cf6`
- Border: `1px solid rgba(139,92,246,0.25)`

**Neutral:**
- `px-4 py-2`, `rounded-lg`, `font-mono`
- Background: `#242428`
- Text: `#9a9890`
- Border: `1px solid #333`

**Ghost / Text link:**
- No background, no border
- Text: `#5a5855` (muted), hover: `#9a9890` (secondary)
- `text-sm`

**Lock the Beat (large beat action):**
- Full width, `py-3.5`, `rounded-xl` (12px)
- Background: `linear-gradient(135deg, rgba(245,158,11,0.2), rgba(245,158,11,0.1))`
- Text: `#f59e0b`, `font-semibold`, `text-base`
- Border: `1.5px solid rgba(245,158,11,0.4)`
- Shadow: `0 0 20px rgba(245,158,11,0.1)`

---

## 5. CSS Animations

### tallyPulse
- **Duration:** 2s, ease-in-out, infinite
- **Used on:** Tally light dots (`.tally-live`)
- **Keyframes:**
  ```
  0%, 100% { opacity: 1; box-shadow: 0 0 6px 2px rgba(239,68,68,0.6); }
  50%      { opacity: 0.4; box-shadow: 0 0 2px 1px rgba(239,68,68,0.2); }
  ```

### onairGlow
- **Duration:** 2s, ease-in-out, infinite
- **Used on:** ON AIR light box in live state (`.onair-glow`, `.onair-box.live`)
- **Keyframes:**
  ```
  0%, 100% { box-shadow: 0 0 8px 2px rgba(239,68,68,0.5), inset 0 0 4px rgba(239,68,68,0.2); }
  50%      { box-shadow: 0 0 16px 4px rgba(239,68,68,0.8), inset 0 0 8px rgba(239,68,68,0.3); }
  ```

### spotlightFadeIn
- **Duration:** 2s, ease-out, forwards (plays once)
- **Used on:** Dark Studio center content (`.spotlight-in`)
- **Keyframes:**
  ```
  0%   { opacity: 0; filter: blur(8px); }
  100% { opacity: 1; filter: blur(0); }
  ```

### breathe
- **Duration:** 4s, ease-in-out, infinite
- **Used on:** Intermission quote text (`.breathe`)
- **Keyframes:**
  ```
  0%, 100% { opacity: 0.6; }
  50%      { opacity: 1; }
  ```

### beatIgnite
- **Duration:** 0.6s, ease-out, forwards (plays once)
- **Used on:** Beat star when freshly locked (`.beat-ignite`)
- **Keyframes:**
  ```
  0%   { color: #5a5855; text-shadow: none; }
  50%  { color: #fbbf24; text-shadow: 0 0 20px rgba(245,158,11,0.8); }
  100% { color: #f59e0b; text-shadow: 0 0 8px rgba(245,158,11,0.4); }
  ```

### warmPulse
- **Duration:** 2s, ease-in-out, infinite
- **Used on:** Timer text when under 5 minutes (`.warm-pulse`)
- **Keyframes:**
  ```
  0%, 100% { opacity: 0.8; }
  50%      { opacity: 1; }
  ```

### goldenGlow
- **Duration:** 3s, ease-in-out, infinite
- **Used on:** "DAY WON" verdict text and stars (`.golden-glow`)
- **Keyframes:**
  ```
  0%, 100% { text-shadow: 0 0 30px rgba(245,158,11,0.3); }
  50%      { text-shadow: 0 0 60px rgba(245,158,11,0.6), 0 0 100px rgba(245,158,11,0.2); }
  ```

### slideUp
- **Duration:** 0.5s, ease-out, forwards (plays once)
- **Used on:** Act cards entering the lineup (`.slide-up`), staggered with `animation-delay`
- **Keyframes:**
  ```
  0%   { opacity: 0; transform: translateY(12px); }
  100% { opacity: 1; transform: translateY(0); }
  ```

### Utility Classes Summary

| Class          | Animation     | Duration | Timing        | Iteration |
|----------------|---------------|----------|---------------|-----------|
| `.tally-live`  | tallyPulse    | 2s       | ease-in-out   | infinite  |
| `.onair-glow`  | onairGlow     | 2s       | ease-in-out   | infinite  |
| `.spotlight-in`| spotlightFadeIn | 2s     | ease-out      | once (forwards) |
| `.breathe`     | breathe       | 4s       | ease-in-out   | infinite  |
| `.beat-ignite` | beatIgnite    | 0.6s     | ease-out      | once (forwards) |
| `.warm-pulse`  | warmPulse     | 2s       | ease-in-out   | infinite  |
| `.golden-glow` | goldenGlow    | 3s       | ease-in-out   | infinite  |
| `.slide-up`    | slideUp       | 0.5s     | ease-out      | once (forwards) |

---

## 6. Theatrical State Map

| App State      | Production Moment           | Feeling             | View / Size                    |
|----------------|-----------------------------|----------------------|-------------------------------|
| Dark Studio    | Empty studio, lights off    | Quiet anticipation   | Full screen                   |
| Writer's Room  | Pre-show planning           | Creative, backstage  | ~560 x 680px windowed         |
| Going Live     | ON AIR light ignites        | Rush, excitement     | Full screen, 2-3s transition  |
| Live Act       | Performing a sketch         | Focused, professional| Pill (320x48) or Expanded (~560x620) |
| Beat Check     | Audience applause           | Did it land?         | Modal overlay, ~380px card    |
| Intermission   | Commercial break            | Permission to pause  | ~560 x 500px windowed         |
| Director Mode  | Director steps in           | Calm authority       | Overlay, ~420px card          |
| Strike         | Curtain call, credits       | Reflection, closure  | ~560 x variable windowed      |

### Show Verdicts (Strike the Stage)

| Beats Locked | Verdict            | Color     | Message                                              |
|--------------|--------------------|-----------|------------------------------------------------------|
| 3/3          | DAY WON.           | `#f59e0b` | "Standing ovation. You showed up and you were present." |
| 2/3          | SOLID SHOW.        | `#d97757` | "Not every sketch lands. The show was still great."  |
| 1/3          | GOOD EFFORT.       | `#60a5fa` | "You got on stage. That's the hardest part."         |
| 0/3          | SHOW CALLED EARLY. | `#9a9890` | "Sometimes the show is short. The audience still came." |

All verdicts use Inter Black (900), `text-4xl` to `text-5xl`, `letter-spacing: 0.02em`.

---

## 7. Design Principles

### The metaphor is the mechanic
Every UI state maps to a production moment. Not decoration -- the theatrical framing IS the information architecture.

### Warm, never cold
Amber-orange accent, warm white text, dark surfaces with just enough warmth. This is a theater, not a lab.

### Permission is built in
Intermission has no timer. Director Mode has no guilt. Beat Check has no judgment. The app never makes you feel bad.

### Glanceable, not demanding
The pill is 48px. The timer is the hero. The lineup is a sidebar. Nothing screams -- the show state is always clear at a glance.

---

## Appendix: Spotlight & Ambient Effects

These radial gradients create the "stage lighting" atmosphere throughout the app:

| Context              | Gradient                                                                 |
|----------------------|--------------------------------------------------------------------------|
| Dark Studio (subtle) | `radial-gradient(ellipse 400px 350px at 50% 35%, rgba(217,119,87,0.06) 0%, transparent 70%)` |
| Dark Studio (spot)   | `radial-gradient(ellipse at 50% 0%, rgba(217,119,87,0.08) 0%, transparent 70%)` -- 300x400px |
| Writer's Room (warm) | `radial-gradient(ellipse at 50% 0%, rgba(217,119,87,0.05) 0%, transparent 70%)` -- 300x200px |
| Going Live           | `radial-gradient(ellipse 600px 400px at 50% 50%, rgba(217,119,87,0.08) 0%, transparent 70%)` |
| Beat Check (gold)    | `radial-gradient(ellipse 300px 250px at 50% 0%, rgba(245,158,11,0.08) 0%, transparent 70%)` |
| Beat Locked (gold)   | `radial-gradient(ellipse 300px 200px at 50% 0%, rgba(245,158,11,0.12) 0%, transparent 70%)` |
| DAY WON (gold)       | `radial-gradient(ellipse 500px 300px at 50% 30%, rgba(245,158,11,0.06) 0%, transparent 70%)` |
| Intermission         | `linear-gradient(180deg, #1a1a1e 0%, #1e1c1a 100%)` -- warm gradient shift |
| Modal scrim          | `rgba(0,0,0,0.75)` with `backdrop-filter: blur(8px)` (Beat Check) or `rgba(0,0,0,0.8)` with `blur(12px)` (Director) |

## Appendix: Tailwind Config Tokens

```js
{
  theme: {
    extend: {
      colors: {
        studio: { bg: '#0d0d0f', surface: '#1a1a1e', hover: '#242428' },
        accent: '#d97757',
        onair: '#ef4444',
        beat: '#f59e0b',
        txt: { primary: '#e8e6e0', secondary: '#9a9890', muted: '#5a5855' },
        cat: {
          deep: '#8b5cf6',
          exercise: '#22c55e',
          admin: '#60a5fa',
          creative: '#f59e0b',
          social: '#ec4899'
        }
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'monospace'],
        body: ['Inter', 'sans-serif'],
      }
    }
  }
}
```
