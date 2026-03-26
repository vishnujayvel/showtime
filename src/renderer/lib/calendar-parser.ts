import type { CalendarEvent } from '../../shared/types'

function isCalendarEvent(obj: unknown): obj is CalendarEvent {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return typeof o.title === 'string' && typeof o.start === 'string' && typeof o.end === 'string'
}

/**
 * Parse calendar events from Claude's response text.
 * Expects a JSON array of CalendarEvent objects, optionally wrapped in markdown fences.
 */
export function tryParseCalendarEvents(text: string): CalendarEvent[] | null {
  // Try fenced JSON blocks first
  const fenced = text.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (fenced) {
    try {
      const parsed = JSON.parse(fenced[1])
      if (Array.isArray(parsed) && (parsed.length === 0 || parsed.every(isCalendarEvent))) {
        return parsed
      }
    } catch {}
  }

  // Try bare JSON array
  const bareArray = text.match(/\[[\s\S]*\]/)
  if (bareArray) {
    try {
      const parsed = JSON.parse(bareArray[0])
      if (Array.isArray(parsed) && (parsed.length === 0 || parsed.every(isCalendarEvent))) {
        return parsed
      }
    } catch {}
  }

  return null
}
