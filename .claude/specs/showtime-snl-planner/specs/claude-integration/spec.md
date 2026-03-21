# Claude Integration

## ADDED Requirements

### Requirement: SNL Skill
Standalone SKILL.md providing Claude with SNL framework knowledge, ShowLineup JSON schema, energy-aware scheduling, ADHD guardrails, and verdict messages.

**Scenarios:**
- GIVEN Claude receives a day plan with energy level WHEN structuring the lineup THEN output a ```showtime-lineup JSON block matching ShowLineup schema
- GIVEN the user is overwhelmed WHEN Director Mode is active THEN respond with guilt-free SNL-language support
- GIVEN a Beat check WHEN prompting the user THEN use varied presence-focused questions (not productivity questions)

### Requirement: ShowLineup Parsing
ChatPanel extracts structured lineup from Claude's response.

**Scenarios:**
- GIVEN Claude's response contains ```showtime-lineup JSON WHEN the ChatPanel processes it THEN parse and dispatch to showStore.setLineup()
- GIVEN Claude's response has no lineup JSON WHEN the ChatPanel processes it THEN render normally as markdown

### Requirement: Showtime Notifications
macOS notifications via Electron Notification API for Act completion, Beat checks, and verdicts.

**Scenarios:**
- GIVEN an Act completes WHEN notifyActComplete fires THEN show macOS notification with Act name
- GIVEN a verdict is computed WHEN notifyVerdict fires THEN show macOS notification with verdict message

## MODIFIED Requirements

### Requirement: System Prompt Context
(Previously: no show-specific context injected into Claude prompts)

All prompts now include current Show state (phase, energy, acts) so Claude has full context for SNL-aware responses.

**Scenarios:**
- GIVEN a live Show WHEN user sends a chat message THEN prepend [Showtime context: phase, energy, acts] to the prompt
