import { describe, it, expect } from 'vitest'
import type { ShowLineup } from '../shared/types'

// Extract the parser function to test in isolation
// (same logic as ChatPanel.tryParseLineup)
function tryParseLineup(text: string): ShowLineup | null {
  const match = text.match(/```showtime-lineup\s*\n([\s\S]*?)```/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    if (parsed.acts && Array.isArray(parsed.acts) && typeof parsed.beatThreshold === 'number') {
      return parsed as ShowLineup
    }
  } catch {}
  return null
}

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
    const text = '```json\n{"acts": [], "beatThreshold": 3}\n```'
    expect(tryParseLineup(text)).toBeNull()
  })

  it('extracts first lineup when multiple blocks exist', () => {
    const text = `\`\`\`showtime-lineup
{"acts": [{"name": "First", "sketch": "A", "durationMinutes": 30}], "beatThreshold": 1, "openingNote": "first"}
\`\`\`
Some text
\`\`\`showtime-lineup
{"acts": [{"name": "Second", "sketch": "B", "durationMinutes": 60}], "beatThreshold": 2, "openingNote": "second"}
\`\`\``

    const result = tryParseLineup(text)
    expect(result!.acts[0].name).toBe('First')
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
})
