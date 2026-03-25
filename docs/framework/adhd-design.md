# ADHD Design Decisions

Showtime is not a general productivity app that happens to mention ADHD in its marketing. It is designed from the ground up for brains that crave novelty, resist rigidity, struggle with task initiation, and have been burned by every tool they have ever tried.

This page documents the specific design decisions made *for* ADHD -- and the common patterns Showtime deliberately avoids.

## What ADHD Tools Get Wrong

Most tools designed for "focus" or "productivity" make one or more of these mistakes:

**They weaponize consistency.** Streaks, daily chains, damage meters, dead trees. These systems assume that the threat of losing progress will motivate you to show up. For neurotypical brains, this sometimes works. For ADHD brains, it is catastrophic. The moment the streak breaks -- and it will break, because ADHD is a neurological condition, not a character flaw -- the entire system collapses. The broken streak becomes proof that you cannot sustain anything. The tool becomes a monument to failure. You stop opening it.

**They measure completion, not engagement.** Task checked? Good. Task unchecked? Bad. This binary misses the entire texture of what it means to work with ADHD. You might have spent 90 minutes in deep, immersive flow on a project and not "completed" any discrete task. You might have checked 12 tasks off a list while completely dissociated. Completion is a poor proxy for a good day.

**They assume stable energy.** Most planners let you schedule tasks at fixed times as if every Tuesday at 2 PM will feel the same. ADHD energy fluctuates dramatically -- between days, within days, sometimes within hours. A system that does not account for this sets you up for failure before the day begins.

**They treat rest as a reward.** "Complete 4 Pomodoros, earn a 15-minute break." This frames rest as something you have to *deserve*, which means not resting feels like theft and resting feels like weakness. For ADHD brains already prone to guilt about productivity, this is poison.

**They never end.** Tasks roll over. Overdue counters grow. Yesterday's failures become today's backlog. There is no clean break, no fresh start. Every day begins with the accumulated weight of everything you did not finish.

## How Showtime Does It Differently

### Novelty Through Daily Variation, Not Feature Bloat

The ADHD brain habituates fast. A new app is exciting for two weeks. Then the dopamine fades and the app becomes invisible. Most tools respond by shipping more features -- new themes, new integrations, new gamification layers. This is a treadmill. The novelty comes from outside the system and has to be constantly replenished.

Showtime generates novelty from *within* the framework. The production structure is the same every day -- Writer's Room, Going Live, Acts, Intermission, Strike -- but the content is always different because your life is always different. Different energy levels produce different lineups. Beats land in unexpected places. Tuesday's GOOD EFFORT feels nothing like Friday's DAY WON. The framework is a novelty engine that runs on the natural variation of your own experience.

### No Streaks, No Damage Meters, No Dead Trees

There is nothing in Showtime that accumulates across days. No streak counter. No weekly score. No garden that withers when you miss a day. Every Show stands alone. Tomorrow's stage is empty regardless of what happened today. This is not a limitation. It is the most important design decision in the entire app.

When you open Showtime after three days away, you do not see a broken streak or a dead garden. You see a Dark Studio -- an empty stage with a warm spotlight, waiting for tonight's show. "Tonight's show hasn't been written yet. What will you put on stage?" The emotional difference between this and "You have 47 overdue tasks" is the difference between anticipation and dread.

### Spring Physics Animations as Micro-Rewards

Every animation in Showtime uses spring physics -- bouncy, organic, alive. The golden star ignites when a Beat is locked. The ON AIR light pulses with a warm glow. Act cards slide up with staggered entrances. The tally light breathes.

This is not aesthetic indulgence. ADHD brains are dopamine-seeking. Small, satisfying visual moments -- a star that *ignites* rather than simply appears, a transition that *bounces* rather than fades -- provide micro-doses of the reward signal that keeps the brain engaged. Linear, mechanical animations feel dead. Spring physics feel alive. The difference is subtle but cumulative: it is the difference between an app that feels like a spreadsheet and an app that feels like a *performance*.

### Time-Boxing Prevents Hyperfocus Spirals

Hyperfocus is often celebrated as an "ADHD superpower." Sometimes it is. More often, it is a trap. Four hours disappear. Meetings are missed. Other tasks are neglected. You surface exhausted, disoriented, and behind on everything else.

Acts in Showtime are time-boxed to 45-90 minutes. When the timer ends, the Act ends. Not because your work does not matter, but because the show has more Acts, and you are the star of all of them. The time-box is a boundary, not a punishment. It protects you from the hyperfocus spiral by giving you a graceful exit point and a reason to take it: the next Act is coming up.

### Beat Checks as Mindfulness Anchors

After each Act, Showtime asks: "Did you have a moment of presence?" This is a mindfulness anchor -- a structured moment of meta-awareness built directly into the day's flow.

For ADHD, this serves two purposes. First, it interrupts the autopilot. ADHD brains can grind through tasks mechanically, dissociated from the experience. The Beat Check invites you back into your body. Second, it reframes success. You do not have to have completed everything. You do not have to have been perfectly focused. You just have to have *noticed* -- one moment where you were present, engaged, alive inside the work. That is enough. That is a Beat.

### Director Mode as an Escape Hatch, Not a Punishment

When productivity tools detect that you are struggling, they typically respond in one of two ways: they ignore it (leaving you to spiral alone) or they scold you (marking tasks as overdue, sending guilt-trip notifications). Neither helps.

Director Mode is Showtime's third option. When things go off the rails -- you are overwhelmed, anxious, exhausted, or stuck -- the Director steps in with four options:

- **Skip to the next Act.** This one is not working. Move on. No penalty.
- **Take a longer break.** Rest is free. Always has been.
- **Restructure the lineup.** The plan was wrong. Change it. That is what directors do.
- **Call the show early.** A short show is still a show.

Every option is presented with equal weight. None is framed as giving up. The Director is compassionate, not judgmental. The message is: "You have choices, and all of them are valid." This preserves autonomy at the exact moment when most systems strip it away.

### Energy Check Before Planning

The very first thing Showtime asks in the Writer's Room is: "How's your energy?" The answer -- High, Medium, Low, or Recovery -- shapes the entire lineup. High energy days get deep work and technical challenges. Recovery days get gentle activities and a lower Beat threshold.

This is not a nice-to-have. For ADHD, energy assessment is the single most impactful planning input. A lineup designed for high energy on a recovery day is not ambitious -- it is a setup for failure. By making energy the *first* question, Showtime prevents the mismatch before it happens. The framework meets you where you are, not where you wish you were.

## The Underlying Principle

Every design decision in Showtime comes back to one question: **does this make the person feel like the star of their day, or does it make them feel like they are failing?**

If a feature could trigger shame, it does not ship. If a notification could feel like a guilt trip, it does not send. If a metric could become a measure of personal worth, it does not exist. The bar is not "is this useful." The bar is "does this protect the user's relationship with themselves."

ADHD brains have spent a lifetime being told they are not trying hard enough, not organized enough, not consistent enough. Showtime does not add to that pile. It builds a stage, hands you a microphone, and says: the show is yours. What do you want to put on tonight?
