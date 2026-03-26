import { describe, it, expect } from 'vitest'
import { tryParseLineup } from '../renderer/lib/lineup-parser'

describe('tryParseLineup', () => {
  it('parses valid showtime-lineup JSON block', () => {
    const text = `Here's your lineup:

\`\`\`showtime-lineup
{
  "acts": [
    { "name": "Deep Work", "sketch": "Deep Work", "durationMinutes": 60 },
    { "name": "Exercise", "sketch": "Exercise", "durationMinutes": 45 }
  ],
  "beatThreshold": 2,
  "openingNote": "Let's go!"
}
\`\`\`

Good luck today!`

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts).toHaveLength(2)
    expect(result!.acts[0].name).toBe('Deep Work')
    expect(result!.acts[1].durationMinutes).toBe(45)
    expect(result!.beatThreshold).toBe(2)
    expect(result!.openingNote).toBe("Let's go!")
  })

  it('returns null for text without lineup block', () => {
    expect(tryParseLineup('Just regular text here')).toBeNull()
  })

  it('returns null for empty lineup block', () => {
    expect(tryParseLineup('```showtime-lineup\n\n```')).toBeNull()
  })

  it('returns null for invalid JSON', () => {
    const text = '```showtime-lineup\n{invalid json}\n```'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('returns null when acts array is missing', () => {
    const text = '```showtime-lineup\n{"beatThreshold": 3}\n```'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('returns null when beatThreshold is missing', () => {
    const text = '```showtime-lineup\n{"acts": [{"name": "test", "sketch": "test", "durationMinutes": 30}]}\n```'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('returns null when acts is not an array', () => {
    const text = '```showtime-lineup\n{"acts": "not array", "beatThreshold": 3}\n```'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('returns null when beatThreshold is not a number', () => {
    const text = '```showtime-lineup\n{"acts": [], "beatThreshold": "three"}\n```'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('ignores other code blocks', () => {
    const text = '```python\nprint("hello")\n```'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('prefers the last lineup block when multiple exist', () => {
    const text = `\`\`\`showtime-lineup
{"acts": [{"name": "First", "sketch": "A", "durationMinutes": 30}], "beatThreshold": 1, "openingNote": "first"}
\`\`\`
Some text
\`\`\`showtime-lineup
{"acts": [{"name": "Second", "sketch": "B", "durationMinutes": 60}], "beatThreshold": 2, "openingNote": "second"}
\`\`\``

    const result = tryParseLineup(text)
    expect(result!.acts[0].name).toBe('Second')
  })

  it('handles lineup with optional act fields', () => {
    const text = `\`\`\`showtime-lineup
{
  "acts": [
    { "name": "Focus Time", "sketch": "Deep Work", "durationMinutes": 90, "reason": "Most alert in morning" }
  ],
  "beatThreshold": 1,
  "openingNote": "One act show"
}
\`\`\``

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts[0].name).toBe('Focus Time')
  })

  it('handles multiline JSON with varied whitespace', () => {
    const text = "```showtime-lineup\n  {\n    \"acts\" : [ ] ,\n    \"beatThreshold\" : 0 ,\n    \"openingNote\" : \"empty\"\n  }\n```"
    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts).toHaveLength(0)
    expect(result!.beatThreshold).toBe(0)
  })

  // ─── Resilience: tool call stripping ───

  it('strips tool_use blocks before parsing lineup', () => {
    const text = `I'll check your calendar first.

\`\`\`tool_use
{"name": "gcal_list_events", "input": {"date": "2026-03-25"}}
\`\`\`

Here are your events. Now let me build the lineup:

\`\`\`showtime-lineup
{
  "acts": [
    { "name": "Standup", "sketch": "Admin", "durationMinutes": 15 },
    { "name": "Deep Focus", "sketch": "Deep Work", "durationMinutes": 90 }
  ],
  "beatThreshold": 2,
  "openingNote": "Calendar synced!"
}
\`\`\``

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts).toHaveLength(2)
    expect(result!.acts[0].name).toBe('Standup')
    expect(result!.openingNote).toBe('Calendar synced!')
  })

  it('strips tool_result blocks before parsing lineup', () => {
    const text = `\`\`\`tool_result
{"events": [{"summary": "Team standup", "start": "09:00"}]}
\`\`\`

Based on your calendar:

\`\`\`showtime-lineup
{
  "acts": [{ "name": "Team standup", "sketch": "Admin", "durationMinutes": 30 }],
  "beatThreshold": 1,
  "openingNote": "One meeting day"
}
\`\`\``

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts[0].name).toBe('Team standup')
  })

  it('strips tool_call blocks before parsing lineup', () => {
    const text = `\`\`\`tool_call
{"function": "calendar_search"}
\`\`\`

\`\`\`showtime-lineup
{
  "acts": [{ "name": "Focus", "sketch": "Deep Work", "durationMinutes": 60 }],
  "beatThreshold": 1,
  "openingNote": "Focused day"
}
\`\`\``

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts[0].name).toBe('Focus')
  })

  // ─── Resilience: fallback JSON parsing ───

  it('falls back to json code block when no showtime-lineup fence', () => {
    const text = `Here's your lineup:

\`\`\`json
{
  "acts": [
    { "name": "Workout", "sketch": "Exercise", "durationMinutes": 45 }
  ],
  "beatThreshold": 1,
  "openingNote": "Get moving!"
}
\`\`\``

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts[0].name).toBe('Workout')
  })

  it('falls back to bare JSON object with acts array', () => {
    const text = `Here's your lineup for today:

{
  "acts": [
    { "name": "Email triage", "sketch": "Admin", "durationMinutes": 30 }
  ],
  "beatThreshold": 1,
  "openingNote": "Quick start"
}`

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts[0].name).toBe('Email triage')
  })

  it('prefers showtime-lineup block over json fallback', () => {
    const text = `\`\`\`json
{"acts": [{"name": "Wrong", "sketch": "A", "durationMinutes": 10}], "beatThreshold": 1, "openingNote": "wrong"}
\`\`\`

Actually, let me format that properly:

\`\`\`showtime-lineup
{"acts": [{"name": "Right", "sketch": "B", "durationMinutes": 20}], "beatThreshold": 2, "openingNote": "right"}
\`\`\``

    const result = tryParseLineup(text)
    expect(result!.acts[0].name).toBe('Right')
  })

  it('handles tool error followed by retry with valid lineup', () => {
    const text = `I'll check your calendar.

\`\`\`tool_use
{"name": "gcal_list_events", "input": {"date": "2026-03-25"}}
\`\`\`

\`\`\`tool_result
{"error": "Calendar MCP tool not available"}
\`\`\`

No worries, I'll build the lineup from your text input:

\`\`\`showtime-lineup
{
  "acts": [
    { "name": "Morning Focus", "sketch": "Deep Work", "durationMinutes": 90 }
  ],
  "beatThreshold": 1,
  "openingNote": "No calendar needed"
}
\`\`\``

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts[0].name).toBe('Morning Focus')
  })

  it('returns null when bare JSON does not have acts array', () => {
    const text = '{"foo": "bar", "baz": [1, 2, 3]}'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('falls back to unfenced code block', () => {
    const text = `Here's your lineup:

\`\`\`
{
  "acts": [
    { "name": "Reading", "sketch": "Deep Work", "durationMinutes": 60 }
  ],
  "beatThreshold": 1,
  "openingNote": "Quiet morning"
}
\`\`\``

    const result = tryParseLineup(text)
    expect(result).not.toBeNull()
    expect(result!.acts[0].name).toBe('Reading')
  })
})
