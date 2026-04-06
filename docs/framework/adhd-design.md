---
title: "ADHD Design Decisions"
status: current
last-verified: 2026-04-06
---
# ADHD Design Decisions

Showtime isn't a general productivity app that happens to mention ADHD in its marketing. It's built from the ground up for brains that crave novelty, resist rigidity, struggle with task initiation, and have been burned by every tool they've ever tried.

This page documents the specific design decisions made *for* ADHD, and the patterns Showtime deliberately avoids.

## What ADHD Tools Get Wrong

Most tools designed for "focus" or "productivity" make some combination of these mistakes:

**They weaponize consistency.** Streaks, daily chains, damage meters, dead trees. These systems assume that the threat of losing progress will motivate you. For neurotypical brains, this sometimes works. For ADHD brains, it's catastrophic. The moment the streak breaks (and it will, because ADHD is a neurological condition, not a character flaw) the entire system collapses. The broken streak becomes proof that you can't sustain anything. The tool becomes a monument to failure. You stop opening it.

**They measure completion, not engagement.** Task checked? Good. Task unchecked? Bad. This binary misses the entire texture of working with ADHD. You might have spent 90 minutes in deep, immersive flow on a project and not "completed" any discrete task. You might have checked 12 tasks off a list while completely dissociated. Completion is a poor proxy for a good day.

**They assume stable energy.** Most planners let you schedule tasks at fixed times as if every Tuesday at 2 PM will feel the same. ADHD energy fluctuates dramatically, between days, within days, sometimes within hours. A system that doesn't account for this sets you up for failure before the day begins.

**They treat rest as a reward.** "Complete 4 Pomodoros, earn a 15-minute break." This frames rest as something you have to *deserve*. Not resting feels like theft and resting feels like weakness. For ADHD brains already prone to guilt about productivity, this is poison.

**They never end.** Tasks roll over. Overdue counters grow. Yesterday's failures become today's backlog. There's no clean break. Every day begins with the accumulated weight of everything you didn't finish.

## How Showtime Does It Differently

### Novelty Through Daily Variation

The ADHD brain habituates fast. A new app is exciting for two weeks. Then the dopamine fades and the app becomes invisible. Most tools respond by shipping more features: new themes, new integrations, new gamification layers. Treadmill.

Showtime generates novelty from *within* the framework. The production structure is the same every day (Writer's Room, Going Live, Acts, Intermission, Strike) but the content is always different because your life is always different. Different energy levels produce different lineups. Beats land in unexpected places. Tuesday's GOOD EFFORT feels nothing like Friday's DAY WON. The framework runs on the natural variation of your own experience.

### No Streaks, No Damage Meters, No Dead Trees

Nothing in Showtime accumulates across days. No streak counter. No weekly score. No garden that withers when you miss a day. Every Show stands alone. Tomorrow's stage is empty regardless of what happened today.

When you open Showtime after three days away, you don't see a broken streak or a dead garden. You see a Dark Studio, an empty stage with a warm spotlight, waiting for tonight's show. "Tonight's show hasn't been written yet. What will you put on stage?" The emotional difference between this and "You have 47 overdue tasks" is the difference between anticipation and dread.

### Spring Physics Animations

Every animation in Showtime uses spring physics. Bouncy, organic, alive. The golden star ignites when a Beat is locked. The ON AIR light pulses with a warm glow. Act cards slide up with staggered entrances. The tally light breathes.

This isn't aesthetic indulgence. ADHD brains are dopamine-seeking. Small, satisfying visual moments (a star that *ignites* rather than simply appears, a transition that *bounces* rather than fades) provide micro-doses of reward that keep the brain engaged. Linear, mechanical animations feel dead. Spring physics feel alive. The difference is subtle but it adds up. It's the difference between an app that feels like a spreadsheet and an app that feels like a *performance*.

### Time-Boxing Prevents Hyperfocus Spirals

Hyperfocus is often celebrated as an "ADHD superpower." Sometimes it is. More often, it's a trap. Four hours disappear. Meetings are missed. Other tasks are neglected. You surface exhausted and disoriented.

Acts are time-boxed to 45-90 minutes. When the timer ends, the Act ends. Not because your work doesn't matter, but because the show has more Acts, and you're the star of all of them. The time-box is a boundary, not a punishment. It protects you from the hyperfocus spiral by giving you a graceful exit point and a reason to take it.

### Beat Checks as Mindfulness Anchors

After each Act, Showtime asks: "Did you have a moment of presence?" This is a mindfulness anchor, a structured moment of meta-awareness built into the day's flow.

For ADHD, this does two things. First, it interrupts the autopilot. ADHD brains can grind through tasks mechanically, dissociated from the experience. The Beat Check invites you back into your body. Second, it reframes success. You don't have to have completed everything. You don't have to have been perfectly focused. You just have to have *noticed*. One moment where you were present, engaged, alive inside the work. That's enough. That's a Beat.

### Director Mode as Escape Hatch

When productivity tools detect that you're struggling, they typically do one of two things: ignore it (leaving you to spiral alone) or scold you (marking tasks as overdue, sending guilt-trip notifications). Neither helps.

Director Mode is the third option. When things go off the rails, the Director steps in with four choices:

- **Skip to the next Act.** This one isn't working. Move on. No penalty.
- **Take a longer break.** Rest is free. Always has been.
- **Restructure the lineup.** The plan was wrong. Change it. That's what directors do.
- **Call the show early.** A short show is still a show.

Every option carries equal weight. None is framed as giving up. The Director is compassionate, not judgmental. The message: "You have choices, and all of them are valid." This preserves autonomy at the moment when most systems strip it away.

### Energy Check Before Planning

The very first thing Showtime asks in the Writer's Room is: "How's your energy?" The answer shapes the entire lineup. High energy days get deep work and technical challenges. Recovery days get gentle activities and a lower Beat threshold.

For ADHD, energy assessment is the single most impactful planning input. A lineup built for high energy on a recovery day isn't ambitious. It's a setup for failure. By making energy the *first* question, the mismatch gets caught before it happens.

## The Underlying Principle

Every design decision comes back to one question: **does this make you feel like the star of your day, or does it make you feel like you're failing?**

If a feature could trigger shame, it doesn't ship. If a notification could feel like a guilt trip, it doesn't send. If a metric could become a measure of personal worth, it doesn't exist. The bar isn't "is this useful." The bar is "does this protect the user's relationship with themselves."

I've spent a lifetime being told I'm not trying hard enough, not organized enough, not consistent enough. Showtime doesn't add to that pile. It builds a stage, hands you a microphone, and says: the show is yours. What do you want to put on tonight?
