# Manual Smoke Test Checklist

Run these 5 flows after every merge to main. Each takes ~30 seconds.
These catch layout, animation, and UX bugs that automated tests miss.

## Flow 1: Fresh Start (Dark Studio -> Live)

- [ ] Launch app -> Dark Studio loads (spotlight visible)
- [ ] Click to enter Writer's Room
- [ ] Select energy level
- [ ] Type a plan in chat -> Claude returns lineup
- [ ] Lineup card appears with acts
- [ ] Click "Finalize Lineup" -> confirmation panel
- [ ] Click "Confirm & Go Live" -> GoingLive transition -> live phase

## Flow 2: Resume Existing Lineup

- [ ] Launch app with an existing day's lineup in SQLite
- [ ] App auto-resumes into live phase (not Writer's Room)
- [ ] Acts visible in lineup panel

## Flow 3: Live Show Cycle

- [ ] Active act timer counts down
- [ ] Complete act -> Beat Check modal appears
- [ ] Lock or skip beat -> next act starts
- [ ] Verify act card status updates in lineup

## Flow 4: Intermission

- [ ] Trigger intermission (via Director Mode or natural break)
- [ ] "WE'LL BE RIGHT BACK" card visible
- [ ] Resume from intermission -> returns to live phase

## Flow 5: Strike the Stage

- [ ] Complete all acts (or strike early via Director Mode)
- [ ] Strike view shows stats + verdict
- [ ] Beat count and act recap visible
- [ ] Reset -> returns to Dark Studio

## Quick Checks (visual)

- [ ] Pill view: timer readable, tally light visible, not collapsed
- [ ] Expanded view: no overflow, ON AIR bar visible
- [ ] Settings accessible from all views (gear icon)
- [ ] Theme toggle works (dark -> light -> dark)
