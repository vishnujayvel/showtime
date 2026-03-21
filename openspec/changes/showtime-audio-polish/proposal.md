# Showtime Audio Broadcast Package + UX Polish

## Why

The app does the work but doesn't give you a proper ending, temporal grounding, or audio presence. A real TV show has sound cues, a clock, and a proper sign-off. Showtime needs these to feel like a live production, not a silent task list.

Fixes GitHub issues: #17, #18, #19, #20, #21

## What Changes

### 1. Audio Broadcast Package (#19)

Add a sound design layer using Electron's `new Audio()` in the renderer. Short, tasteful audio cues at key production moments:

**Sound cues (6 total):**
- `going-live.mp3` — 1-2s broadcast stinger when "WE'RE LIVE!" plays (GoingLiveTransition)
- `beat-check.mp3` — Warm bell/chime when Beat Check modal appears
- `beat-locked.mp3` — Satisfying confirmation tone when user locks a Beat
- `timer-warning.mp3` — Subtle tick/pulse when act timer < 5 minutes
- `show-complete.mp3` — Fanfare/applause for Strike verdict (DAY WON gets the big version)
- `intermission.mp3` — Gentle transition tone when intermission starts

**Implementation approach:**
- Create `src/renderer/hooks/useAudio.ts` — preloads audio files, exposes `play(cue)` method
- Audio files in `resources/audio/` (small MP3s, 10-50KB each)
- Generate placeholder audio using Web Audio API oscillators (sine waves, filtered noise) — these are functional placeholders that sound intentional, not silence
- User can mute via a volume toggle in the title bar (persisted to localStorage)
- Sound plays are fire-and-forget, never block UI

**Generating audio programmatically (no external files needed for MVP):**
```typescript
// Use Web Audio API to synthesize broadcast-style tones
// going-live: ascending two-tone chime (C5 → G5, 200ms each)
// beat-check: single warm bell (A4, 500ms with reverb)
// beat-locked: confirmation chord (C4+E4+G4, 300ms)
// timer-warning: soft tick (filtered noise, 100ms)
// show-complete: ascending arpeggio (C4→E4→G4→C5, 150ms each)
// intermission: descending soft tone (G4→C4, 400ms)
```

This means zero external audio file dependencies. Everything is synthesized at runtime.

### 2. End-of-Show Celebration (#17, #20)

Fix the transparent screen bug AND add a proper ending:

**Fix #17:** The Strike view must render when phase === 'strike'. Debug the view routing in App.tsx — likely a race condition between `strikeTheStage()` setting phase and `isExpanded` state.

**Add celebration moment (#20):**
- After the verdict displays (DAY WON, SOLID SHOW, etc.), show 3 next-action buttons:
  - "Add an Encore" — adds more acts to today's show (returns to Writer's Room with existing lineup)
  - "Plan Tomorrow" — opens Writer's Room for the next day
  - "That's a Wrap" — closes the show, plays the show-complete audio, window collapses to pill
- The `show-complete.mp3` audio plays when the verdict appears
- For DAY WON: add a brief confetti/particle animation (CSS keyframes, no library)
- Language: theatrical, warm, earned. "The crowd is still here." / "Standing ovation."

### 3. Temporal Context (#21)

Add minimal time grounding to the UI:

**Title bar date label:**
- Show "SAT MAR 21" (abbreviated day + month + date) in JetBrains Mono, muted text
- Visible in ExpandedView and WritersRoomView title bars
- Uses `new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).toUpperCase()`

**Show duration:**
- In ExpandedView: "Started 9:15 AM" subtitle under the ON AIR indicator (computed from show's `startedAt` timestamp)
- In StrikeView: "Show ran for 4h 23m" in the stats section
- Computed from `showStore.startedAt` (already exists as `timerEndAt` logic, needs a `showStartedAt` field)

**Day boundary:**
- Add `showStartedAt` field to showStore (set when `startShow()` fires)
- The show is tied to a calendar date via the SQLite `shows` table (id = date string)
- At midnight, if a show is still running, it continues (no auto-strike)

### 4. Pill Drag Fix (#18)

Make the pill draggable without breaking the click-to-expand:

**Solution:** Split the pill into two zones:
- Left 48px (the tally light / icon area): `drag-region` class — draggable
- Rest of the pill: `no-drag` — clickable to expand

This gives a clear drag handle on the left and clickable area on the right. The tally light/icon area is a natural grip point.

### 5. Mute Toggle

- Small speaker icon in the ExpandedView title bar (next to Director/collapse buttons)
- Toggle between muted (speaker with X) and unmuted (speaker icon)
- State persisted to `localStorage.getItem('showtime-audio-muted')`
- Default: unmuted (audio on)
- The `useAudio` hook checks mute state before playing any cue

## Files to Create

| File | Purpose |
|------|---------|
| `src/renderer/hooks/useAudio.ts` | Audio synthesis + playback hook |
| `src/renderer/components/MuteToggle.tsx` | Speaker icon toggle button |

## Files to Modify

| File | Change |
|------|--------|
| `src/renderer/views/GoingLiveTransition.tsx` | Play `going-live` cue |
| `src/renderer/components/BeatCheckModal.tsx` | Play `beat-check` cue on appear, `beat-locked` on lock |
| `src/renderer/views/ExpandedView.tsx` | Add MuteToggle, add "Started X:XX AM" subtitle, add date label |
| `src/renderer/views/StrikeView.tsx` | Play `show-complete` cue, add celebration buttons (Encore/Plan Tomorrow/Wrap), show duration stat |
| `src/renderer/views/WritersRoomView.tsx` | Add date label to title bar |
| `src/renderer/views/PillView.tsx` | Split into drag zone (left 48px) + click zone (rest) |
| `src/renderer/components/IntermissionView.tsx` | Play `intermission` cue |
| `src/renderer/hooks/useTimer.ts` | Play `timer-warning` cue at < 5 min |
| `src/renderer/stores/showStore.ts` | Add `showStartedAt` field, fix Strike phase transition |
| `src/renderer/App.tsx` | Debug Strike view routing (fix #17) |

## Testing Strategy

### Unit Tests (Vitest)
- useAudio hook: synthesis, mute toggle, cue mapping
- showStore: showStartedAt field set on startShow(), strike phase transition
- PillView: drag zone vs click zone rendering

### E2E Tests (Playwright + Electron)
- Strike view renders after all acts complete (fix #17 verification)
- Encore button returns to Writer's Room with existing lineup
- "That's a Wrap" collapses to pill
- Date label shows current date in title bar
- Show duration displays in Strike view
- Pill drag zone allows repositioning (left 48px area)
- Pill click zone expands to ExpandedView (right area)

### Verification Commands
```bash
npm run build
npm run test
npm run test:e2e
npx tsc --noEmit
```

## Loop Configuration
autonomous: true
max_iterations: 3
issue_labels: ["bug", "enhancement"]
cooldown_minutes: 2
