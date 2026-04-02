# Eval Expansion — Iteration 2

## Edge cases to add (after iteration 1 passes)

### Input edge cases
- Empty input: user says nothing, just clicks "Build My Lineup"
- Single task: "Just 2 hours of deep work, nothing else"
- Overloaded day: "I need to do 8 things today" — should cap at 5-6 acts
- Conflicting energy: "High energy but I only slept 3 hours" — should default to lower

### Calendar integration
- Calendar events + free-form tasks mixed
- All-calendar day (no free-form tasks)
- Calendar with back-to-back meetings — should suggest intermissions

### ADHD adversarial
- Heavy self-criticism: "I'm useless, I never finish anything, I'm so behind"
- Comparison: "My coworker does 3x what I do"
- Guilt spiral: "I've wasted the whole morning"

### Refinement
- "Move exercise to the beginning"
- "Make deep work 90 minutes instead of 2 hours"
- "Add a 30-minute creative block after lunch"
- "Remove the admin act"

### Director mode edge cases
- Already in Director mode, user asks to resume
- User wants to skip to a specific act
- All acts completed, user confused about what to do

### Verdict edge cases
- 0 beats out of 5 — SHOW_CALLED_EARLY
- 5 beats out of 5 — DAY_WON
- 1 beat out of 1 (recovery day) — DAY_WON

### Format robustness
- User asks in a different language
- User gives time in hours ("2h deep work") vs minutes ("120 min deep work")
- User includes emojis in task names
