# SNL Day Framework -- Combined Reference

This document combines the SNL Day Framework specification from two sources:
1. The original Google Doc specification (v2)
2. The daily-copilot skill implementation (SKILL.md, journal/snl_day.md, ref/gamification.md, ref/snl-day-format.md)

It serves as the canonical reference for building the Showtime product context document.

---

# PART 1: Google Doc Specification (SNL DAY FRAMEWORK v2)

*Source: Google Doc "SNL Day Framework" -- extracted via Google Docs API*

---

## SNL DAY FRAMEWORK -- SPECIFICATION v2

A lifestyle design system inspired by Saturday Night Live -- optimized for ADHD and neurodivergent brains.

### 1. Core Concept

The day is not a to-do list. The day is a show. You are the performer. Your life is the stage.

The goal is not to push through the day -- but to inhabit it. The show must go on -- regardless of whether you feel ready.

A day is won if:
- You execute at least **n** Acts with intention,
- and those Acts include **Beats** (moments of presence/immersion).

Where n is user-defined and flexible, depending on individual capacity and season of life.

### 2. Core Entities

| Entity | What it means | Notes |
|--------|---------------|-------|
| **Day** | The full 24h personal container. | We no longer call it an Episode. |
| **Act** | A block of execution -- when you are doing the thing. | All Acts count toward the Day Capacity. |
| **Beat** (optional) | A moment of presence inside an Act. | Strongly recommended for ADHD brain grounding. |
| **Sketch** | A discrete theme or category of work inside an Act. | Example: "Leetcode", "emails", "PT workout", "cooking", "job search call". |
| **Writer's Room** | Separate planning block (not an Act). | Max 20 minutes. You decide the Acts and Sketches for the day. |
| **Rest** | Active recovery. | Does not count toward Act capacity (and should not cause guilt). |

### 3. Roles in the System

| Role | Personification | Purpose |
|------|-----------------|---------|
| **Performer** | The self in execution mode. | Completes Acts. |
| **Head Writer** | The self in planning mode. | Defines Sketches and Acts. |
| **Director** | The self in reflective mode. | Assesses pacing, overwhelm, and reshuffles capacity. |

These are modes, not identities. You switch roles, you don't become them.

### 4. The Daily Sequence

**1. Cold Open (mandatory Act #1)**
- First Act of the day.
- Purpose: enter presence before you enter tasks.
- Suggested formats (flexible):
  - Scripted self-talk (e.g., "We're live in 5...").
  - Music cue / sensory cue.
  - 5-minute micro-ritual (coffee, sunlight, breath, etc.).

**2. Writer's Room (max 20 minutes -- not an Act)**
- Draft the day.
- Select Acts and Sketches.
- Improvisation is allowed, but planning must stop at 20 minutes.

**3. Acts**
- You execute what the Writer's Room selected.
- Acts may include: Work, Fitness, Cooking, Calls / appointments, Errands, Learning, Personal projects, Cleaning.
- Acts define the usable capacity of the day.
- The day is won if >= n Acts include Beats.

**4. Rest**
- Intermission between Acts.
- No guilt -- rest costs 0 capacity.
- Rest must not be traded for self-criticism.

**5. Day End**
- No formal ritual required.
- A short "strike the stage" (clean up space / close tabs) is recommended.

### 5. Capacity

The framework supports all schedules: 6-hour workday, 8-hour workday, 10-hour workday, 12-hour workday.

You define your Act Capacity for the day.

**Example (Vishnu):**
- Total Act capacity: 8 hours
- Allocation: 6 hours interview prep + 2 hours exercise / cooking / logistics
- If workout takes 90 minutes -> cooking is optional.
- If recruiter calls take longer -> workout is optional.
- Acts shift -- winning the day stays stable.

### 6. Beats (optional but powerful)

A Beat is not productivity -- it's presence.

A Beat happens when:
- You notice what you're doing,
- You're grounded in the moment,
- You feel alive, proud, or immersed.

Examples:
- "I am here, doing the hard thing."
- "This rep matters."
- "I'm actually enjoying this soup coming together."
- "This Leetcode solution is clicking."

Beats transform an Act from completion to fulfillment.

### 7. How a Real Day Example Might Look (Vishnu)

| Time | Activity |
|------|----------|
| 07:30 | Cold Open (Act 1) -- Coffee + music cue + quick self-talk ("Live in 5") |
| 07:45 | Writer's Room (20 min) -- Define 6 hours of interview prep. Sketches: Leetcode, System Design, Behaviorals, Recruiter emails. Plan workout as Act 3. |
| 08:05 | Act 2 (Sketch: Leetcode) |
| 10:05 | Rest |
| 10:30 | Act 3 (Sketch: Recruiter Emails + LinkedIn messaging) |
| 11:30 | Rest |
| 12:00 | Act 4 (Sketch: Workout) -> Beat locked (reps felt alive) |
| 13:15 | Rest + Lunch |
| 14:00 | Act 5 (Sketch: System Design video + notes) |
| 16:00 | Rest |
| 16:30 | Act 6 (Sketch: Behavioral writing reflection) |
| 17:30 | Strike the stage (close laptop, clear desk) |

**Day is WON because:**
- Minimum Acts with Beats (n) = 3
- Beats happened during: Leetcode problem breakthrough, Workout peak set, Behavioral reflection clarity moment
- Cooking was skipped -> no guilt. The show was still a success.

### 8. Principles the Framework Protects

- No shame for adjustments.
- Neurodivergent pacing is allowed.
- A skipped Act doesn't break the day.
- A finished Act without a Beat is still valid -- just not counted toward n.
- Writer's Room can never exceed 20 minutes.
- Cold Open always happens.

### 9. Optional Tools for ADHD Brains

These are NOT required -- they simply help.

| Tool | Benefit |
|------|---------|
| Beats | Ground presence + dopamine |
| Music / lighting cues | Faster context switching |
| Costuming | "Work hoodie" to trigger execution |
| Spatial separation | Bedroom != laptop != gym != kitchen |
| Dialogue narration | "The protagonist is pushing through the last rep..." |

---

# PART 2: Daily Copilot Skill Implementation

*Source: `/Users/vishnu/workplace/daily-copilot/SKILL.md` and related files*

---

## SNL Day in the Daily Copilot Skill

The daily-copilot skill is the Claude Code implementation of the SNL Day Framework. It implements the framework as a unified ADHD-friendly personal planning skill combining coding prep, scheduling, and journaling.

**Core Philosophy:** "4 LC = 1 Act. 2 Acts with Beats = day won. No guilt for missed days."

### Routing Rules

ALL day planning uses the SNL Day workflow (`journal/snl_day.md`). No exceptions. No alternatives.

Trigger phrases that invoke SNL Day:
- "plan my day"
- "start my day"
- "what's my schedule"
- "morning check-in"
- "what should I do today?"
- "Writer's room"
- "SNL mode"
- "how's my day?"
- "let's plan today"

### Anti-Patterns (NEVER DO THESE)

| Anti-Pattern | Why It's Wrong |
|--------------|----------------|
| Create ad-hoc day schedules | SNL framework exists! |
| Invent time-block tables outside SNL format | Use Acts/Beats/Sketches |
| Skip SNL phases | Must complete Writer's Room before Acts |
| Blend SNL with other formats | One framework, used consistently |
| Ignore Acts/Beats/Sketches structure | Core of the system |
| Plan day without checking interviews | 48h lookahead is mandatory |
| List admin tasks first | Interview prep is ALWAYS the core focus |

---

## SNL Framework Concepts (Detailed)

*Source: `/Users/vishnu/workplace/daily-copilot/journal/snl_day.md`*

### Complete Terminology Guide

| SNL Term | Meaning | Duration | Counts Toward Capacity? |
|----------|---------|----------|------------------------|
| **Show** | Your entire day - the 24h container | Full day | N/A |
| **Act** | A block of focused execution | 45-90 min | YES |
| **Beat** | A moment of presence/immersion within an Act | Seconds to minutes | NO (but tracked for wins!) |
| **Sketch** | A category/type of activity | N/A | N/A |
| **Writer's Room** | Morning planning session | Max 20 min | NO |
| **Cold Open** | Morning presence ritual before diving in | 5-10 min | YES (Act 1) |
| **Rest** | Active recovery between Acts | Variable | NO - costs 0 capacity |
| **Intermission** | Longer break between major Acts | 15-30 min | NO |
| **Strike the Stage** | End-of-day cleanup ritual | 10-15 min | Optional (can be Act) |

### Roles (Modes, Not Identities)

| Role | Mode | When Used | Purpose |
|------|------|-----------|---------|
| **Performer** | Execution | During Acts | Complete Acts, lock Beats |
| **Head Writer** | Planning | Writer's Room | Design Sketches and Acts |
| **Director** | Reflection | When overwhelmed or pivoting | Assess pacing, reshuffle capacity |

### Act Structure

- A 45-90 minute block of focused work
- Has a clear Sketch (category): Leetcode, System Design, Interview, Workout, etc.
- Counts toward daily capacity
- May or may not contain a Beat (that's okay!)

**Act Lifecycle**: `Planned -> Current -> Complete -> Beat Check`

### Beat Philosophy

A Beat is:
- A moment of presence or immersion
- "I'm actually doing this" feeling
- A concept clicking
- A flow state moment
- A satisfying sense of understanding

**NOT Beats**: Completing a task mechanically, grinding through without presence, finishing just to finish.

**Win Threshold**: Default 3 Beats = day won. Adjustable based on capacity and energy.

### Energy-Aware Scheduling

| Energy State | Capacity Adjustment | Act Selection | Beat Expectation |
|--------------|-------------------|---------------|------------------|
| **High Energy** | 8+ hours | Technical work, interviews, intense prep | 3-4 Beats possible |
| **Medium Energy** | 6-8 hours | Mix of technical and admin | 2-3 Beats realistic |
| **Low Energy** | 4-6 hours | Admin, light prep, review | 1-2 Beats is great |
| **Recovery** | 2-4 hours | Gentle activities only | 1 Beat = win |

---

## Workflow Phases

*Source: `/Users/vishnu/workplace/daily-copilot/journal/snl_day.md`*

### Phase 0: Session Continuity Check
Always check for existing day state at session start (query Mem0 for today's SNL state). If state exists, resume the show with a progress summary. If no state, proceed to Writer's Room.

### Phase 1: Writer's Room (Max 20 Minutes)
1. **Context Gathering** -- Query calendar for fixed events, memory for patterns
2. **Interview Type Detection** -- 48-hour lookahead for interviews (System Design, Coding, Behavioral)
3. **Capacity Check** -- Ask energy level, map to hours
4. **Sketch Allocation** -- Suggest Acts based on fixed events, energy, and goals
5. **Focus Gap Integration** -- Show ONE priority gap from Mem0
6. **Set Win Condition** -- Recommend 60% of Acts; options: recommended / stretch / survival mode
7. **Persist** -- Store to Mem0 + write SNL section to Obsidian daily note

### Phase 2: Cold Open (Act 1)
Enter presence before tasks. Not productivity -- ritual. Options: coffee ceremony, music cue, meditation, sunlight, scripted self-talk, custom ritual.

### Phase 3: Act Execution
- During each Act, provide support and Beat tracking
- After completion, always ask for Beat check
- Update progress, store to Mem0, patch daily note

### Phase 4: Progress Updates
Display progress status (Acts complete/total, Beats locked/threshold). Proactively check for missed Beats. If Beats >= win threshold, declare DAY WON.

### Phase 5: Rest Affirmation (Intermission)
Rest costs ZERO capacity. Affirm the break. No guilt. Resume easily with progress shown.

### Phase 6: Adjustments & Pivots (No Guilt)
"The show adapts. No guilt." Show updated lineup with skipped Act marked. Calculate capacity freed. Offer options.

### Phase 7: Director Mode (Overwhelm Handling)
Triggered by: user says "overwhelmed", skips 2+ Acts in a row, expresses anxiety, asks "what should I do?"
Flow: Display state -> Assess real issue -> Offer 3-4 options (including "call it") -> Affirm choice -> Update state

### Phase 8: Strike the Stage (Day End)
1. Strike Checklist (physical transition): close tabs, clear desk, check tomorrow's calendar, set out tomorrow's costume
2. Final Show Summary: Acts completed, Beats locked, verdict, highlights, what got cut, capacity used
3. Persist final state to Mem0 + daily note

### Phase 9: Weekly Reflection (Sunday Night)
Review the week's shows: per-day table, week stats, top Sketches by Beat count, patterns observed, Director's Note, next week preview.

---

## Day Verdict Logic

*Source: `/Users/vishnu/workplace/daily-copilot/ref/snl-day-format.md`*

| Verdict | Condition |
|---------|-----------|
| **DAY WON** | Beats >= win threshold |
| **SOLID SHOW** | Beats = threshold - 1 |
| **GOOD EFFORT** | Beats >= 50% of threshold |
| **SHOW CALLED EARLY** | < 50% threshold but valid reasons (rest day, pivot) |

---

## Gamification System

*Source: `/Users/vishnu/workplace/daily-copilot/ref/gamification.md`*

### Acts and Beats
- **4 LeetCode questions = 1 Act** (SNL Day terminology)
- **Pattern walkthrough = 1 Beat**
- **Concept review = 1 Beat**
- **Additional 2 LC = 1 Beat**
- **2 Beats = Day Won**

### XP System

| Activity | XP |
|----------|-----|
| Easy question | 10 |
| Medium question | 25 |
| Hard question | 50 |
| Pattern walkthrough | 15 |
| Mock interview | 100 |
| Stress inoculation (cold interviewer) | 50 |

### Momentum System
- +10% per active day (max 100%)
- -5% per inactive day (minimum 10% floor -- never zero)
- +5% bonus per Beat
- Momentum is NOT a streak -- it recovers quickly

### Urgency Tags (ADHD Motivation)

| Tag | Criteria | Motivation |
|-----|----------|------------|
| `[!!!]` | Unsolved + 2+ companies + rank <=20 | "This WILL be asked" |
| `[REFRESH]` | Solved >90 days ago | "You knew this once" |
| `[DECAY]` | Solved 60-90 days ago | "Starting to forget" |
| `[GAP]` | Pattern <30% coverage + unsolved | "Weak spot exposed" |
| `[BLIND]` | Never seen company's #1-10 | "Haven't touched basics" |

---

## Sketch Library

*Source: `/Users/vishnu/workplace/daily-copilot/ref/snl-day-format.md`*

| Sketch | Typical Duration | Energy Required | Best Time of Day |
|--------|------------------|-----------------|------------------|
| Leetcode / Coding | 1-2h | High | Morning |
| System Design Prep | 1.5-2h | High | Morning |
| Behavioral Prep | 1h | Medium | Afternoon |
| Interview (actual) | 1h | High | Varies (fixed) |
| Mock Interview | 1h | Medium-High | Evening (8 PM) |
| Admin / Email | 0.5-1h | Low | Afternoon |
| Workout / Movement | 1-1.5h | Medium | Morning or afternoon |
| Cooking | 0.5-1h | Low | Evening |
| Reading / Learning | 1h | Medium | Afternoon |
| Side project | 2h | High | Avoid list item! |

---

## SNL Language Reference

*Source: `/Users/vishnu/workplace/daily-copilot/ref/snl-day-format.md`*

| Traditional Language | SNL Language |
|---------------------|--------------|
| "You failed to complete..." | "That Act got cut from tonight's show" |
| "You should have..." | "The Director notes for next time..." |
| "You're behind" | "Let's check the show's pacing" |
| "Task" | "Act" or "Sketch" |
| "Break" | "Rest" or "Intermission" |
| "Done for the day" | "Strike the stage" |
| "Good job" | "Beat locked!" or "Nailed that Act" |
| "To-do list" | "Show lineup" or "Act schedule" |
| "Procrastinating" | "The Act hasn't started yet" |
| "Gave up" | "Called the show" or "Struck early" |
| "Productive day" | "Day won" or "Show was a success" |

### Tone Guidelines

**Always**:
- Use "the show adapts" when plans change
- Say "no guilt" when Acts are skipped
- Affirm rest: "costs zero capacity"
- Celebrate Beats: "locked!" with enthusiasm

**Never**:
- Shame or guilt about skipped Acts
- Treat rest as failure
- Compare days (no "you did better yesterday")
- Call a day "wasted" (even 1 Beat is valid)

---

## ADHD Guardrails

*Source: `/Users/vishnu/workplace/daily-copilot/SKILL.md` and `journal/snl_day.md`*

### Always
- Quick energy check (not long questionnaire)
- One clear focus pattern
- Single target number
- Forward-looking language ("Fresh show today")
- Rest = ZERO capacity (permission to rest)
- Celebrate any progress ("You showed up. That's the win.")
- Offer alternatives ("Want to switch patterns?")
- Momentum scores over streaks (relapse-forgiveness)

### Never
- Mention missed days or yesterday's results
- Set unrealistic targets
- Compare to previous performance negatively
- Use guilt-inducing language
- Make intention mandatory
- Reset pattern mastery (only momentum resets)

---

## State Schema (Mem0)

*Source: `/Users/vishnu/workplace/daily-copilot/ref/snl-day-format.md`*

```python
{
    "date": "2025-12-06",
    "capacity": 8,  # hours
    "energy_level": "medium",  # high, medium, low, recovery
    "win_threshold": 3,  # number of Beats
    "cold_open": True,  # completed?
    "acts": [
        {
            "number": 1,
            "sketch": "Cold Open",
            "duration": 0.25,
            "time_slot": "8:00 AM",
            "status": "complete",  # planned, current, complete, skipped
            "beat": False
        },
        {
            "number": 2,
            "sketch": "System Design Prep",
            "duration": 2,
            "time_slot": "8:30-10:30 AM",
            "status": "complete",
            "beat": True  # Beat locked!
        }
    ],
    "beats_locked": 2,
    "status": "ON_TRACK",  # PLANNED, ON_TRACK, AHEAD, WON, CALLED_EARLY
    "skipped_acts": ["Admin/Email"],
    "director_mode_activations": 1,
    "rest_periods": [
        {"start": "12:30 PM", "end": "1:30 PM", "type": "lunch"},
        {"start": "3:45 PM", "end": "4:00 PM", "type": "intermission"}
    ]
}
```

### Mem0 Metadata Schema

```python
{
    "domain": "productivity",
    "context_type": "event",
    "source_agent": "daily-copilot",
    "event_type": "snl_day_state",
    "show_date": "YYYY-MM-DD",
    "beats_locked": int,
    "day_won": bool,
    "energy_level": str
}
```

---

## Output Formats

*Source: `/Users/vishnu/workplace/daily-copilot/ref/snl-day-format.md`*

### SNL Section in Daily Note

```markdown
## SNL Day -- Show Lineup

**Energy:** {energy_level}
**Win Threshold:** {win_threshold} Beats
**Theme:** {theme_description}

### Acts

| Act | Sketch | Time | Status | Beat |
|-----|--------|------|--------|------|
| 1 | {sketch_name} | {time_slot} | Done / Current / Later / Skipped | locked / -- |

### Show Notes

- {contextual notes, morning recap, mood, key events}
```

### Strike the Stage Summary

```
FINAL SHOW SUMMARY - {Date}

Acts Completed: {n}/{total}
Acts Skipped: {n} ({names})
Beats Locked: {n}/{threshold}

Verdict: {DAY WON / SOLID SHOW / GOOD EFFORT / SHOW CALLED EARLY}

Show Highlights:
- {sketch}: {beat description}

What Got Cut:
- {sketch} ({reason} - no guilt)

Capacity Used: {used} / {planned} hours ({energy_level} confirmed)
Win Threshold: {threshold} Beats ({pct}% achieved)

Tomorrow's First Act (from Calendar):
- {time}: {description}

Director's Note:
{Personalized daily reflection}
```

### Weekly Wrap

```
Weekly Wrap - Week of {Start Date} to {End Date}

This Week's Shows:
| Day | Acts | Beats | Verdict |
|-----|------|-------|---------|

Week Stats:
- Days won: {n}/5 ({pct}%)
- Total Acts: {n} completed
- Total Beats: {n} locked

Top Sketches This Week:
1. {sketch} - {n} Acts, {n} Beats

Patterns Observed:
- {pattern observation}

Director's Note:
{Personalized weekly reflection}
```

---

## Persistent Data Storage

*Source: `/Users/vishnu/workplace/daily-copilot/SKILL.md`*

Location: `~/.local/share/daily-copilot/`

| File | Purpose | Created By |
|------|---------|------------|
| `momentum.json` | Current momentum score, last active date | journal/momentum.md |
| `sessions.log` | Session history for recap workflow | journal/recap.md |
| `snl-state.json` | Current day's SNL show state (acts, beats) | journal/snl_day.md |
| `last-reflection.json` | Last evening reflection date/summary | journal/evening_reflection.md |

### Dual Persistence Rule
Every SNL state change MUST be persisted to BOTH Mem0 AND the Obsidian daily note.
- Mem0 is primary (searchable, cross-session continuity)
- Obsidian is secondary cache (human-readable, part of PARA system)
- Write to Mem0 first, then delegate Obsidian write

---

## Future Enhancements

*Source: `/Users/vishnu/workplace/daily-copilot/journal/snl_day.md`*

- **P1: Multi-Day Show Planning** -- Plan a "season" (week) of shows with theme days
- **P2: Show Templates** -- Save successful show lineups as reusable templates
- **P3: Beat Analytics** -- Track which Sketches yield most Beats, identify "Beat-rich" conditions
- **P4: Multi-Agent Show Integration** -- Life Coach as "Show Producer", Job Viz as "Network Executive"
- **P5: Journaling-Agent Delegation** -- Deeper Socratic questioning for morning intention and evening reflection
