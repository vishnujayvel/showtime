import { describe, it, expect, beforeEach } from 'vitest'
import { tryParseCalendarEvents } from '../renderer/lib/calendar-parser'
import { useShowStore } from '../renderer/stores/showStore'

describe('tryParseCalendarEvents', () => {
  it('parses valid JSON array of events', () => {
    const text = `[
  {"title": "Standup", "start": "09:00", "end": "09:15", "allDay": false},
  {"title": "Lunch", "start": "12:00", "end": "13:00", "allDay": false}
]`
    const events = tryParseCalendarEvents(text)
    expect(events).not.toBeNull()
    expect(events).toHaveLength(2)
    expect(events![0].title).toBe('Standup')
    expect(events![1].start).toBe('12:00')
  })

  it('parses fenced JSON block', () => {
    const text = `Here are your events:

\`\`\`json
[
  {"title": "Team sync", "start": "10:00", "end": "10:30", "allDay": false}
]
\`\`\``
    const events = tryParseCalendarEvents(text)
    expect(events).not.toBeNull()
    expect(events).toHaveLength(1)
    expect(events![0].title).toBe('Team sync')
  })

  it('parses empty array', () => {
    const text = '[]'
    const events = tryParseCalendarEvents(text)
    expect(events).not.toBeNull()
    expect(events).toHaveLength(0)
  })

  it('parses empty array in fenced block', () => {
    const text = 'No events found.\n\n```json\n[]\n```'
    const events = tryParseCalendarEvents(text)
    expect(events).not.toBeNull()
    expect(events).toHaveLength(0)
  })

  it('returns null for invalid JSON', () => {
    expect(tryParseCalendarEvents('not json at all')).toBeNull()
  })

  it('returns null for JSON object (not array)', () => {
    expect(tryParseCalendarEvents('{"title": "test"}')).toBeNull()
  })

  it('returns null for array with invalid event shape', () => {
    // Missing required fields
    expect(tryParseCalendarEvents('[{"name": "test"}]')).toBeNull()
  })

  it('handles all-day events', () => {
    const text = '[{"title": "Holiday", "start": "00:00", "end": "23:59", "allDay": true}]'
    const events = tryParseCalendarEvents(text)
    expect(events).not.toBeNull()
    expect(events![0].allDay).toBe(true)
  })

  it('handles events with surrounding text', () => {
    const text = `I found 2 events on your calendar today:

[{"title": "1:1 with manager", "start": "14:00", "end": "14:30", "allDay": false}, {"title": "Gym", "start": "17:00", "end": "18:00", "allDay": false}]

Let me know if you need anything else.`
    const events = tryParseCalendarEvents(text)
    expect(events).not.toBeNull()
    expect(events).toHaveLength(2)
  })

  it('prefers fenced block over bare array', () => {
    const text = `Some context [1, 2, 3]

\`\`\`json
[{"title": "Meeting", "start": "09:00", "end": "10:00", "allDay": false}]
\`\`\``
    const events = tryParseCalendarEvents(text)
    expect(events).not.toBeNull()
    expect(events).toHaveLength(1)
    expect(events![0].title).toBe('Meeting')
  })
})

describe('showStore calendar state', () => {
  beforeEach(() => {
    useShowStore.getState().resetShow()
  })

  it('initializes with idle fetch status and empty events', () => {
    const state = useShowStore.getState()
    expect(state.calendarFetchStatus).toBe('idle')
    expect(state.calendarEvents).toEqual([])
    expect(state.calendarFetchedAt).toBeNull()
  })

  it('setCalendarEvents updates events and status', () => {
    const events = [
      { title: 'Meeting', start: '10:00', end: '11:00', allDay: false },
    ]
    useShowStore.getState().setCalendarEvents(events)

    const state = useShowStore.getState()
    expect(state.calendarEvents).toEqual(events)
    expect(state.calendarFetchStatus).toBe('ready')
    expect(state.calendarFetchedAt).toBeGreaterThan(0)
  })

  it('setCalendarEvents with empty array sets status to ready', () => {
    useShowStore.getState().setCalendarEvents([])

    const state = useShowStore.getState()
    expect(state.calendarEvents).toEqual([])
    expect(state.calendarFetchStatus).toBe('ready')
  })

  it('setCalendarFetchStatus updates status', () => {
    useShowStore.getState().setCalendarFetchStatus('fetching')
    expect(useShowStore.getState().calendarFetchStatus).toBe('fetching')

    useShowStore.getState().setCalendarFetchStatus('unavailable')
    expect(useShowStore.getState().calendarFetchStatus).toBe('unavailable')
  })

  it('clearCalendarCache resets all calendar state', () => {
    useShowStore.getState().setCalendarEvents([
      { title: 'Meeting', start: '10:00', end: '11:00', allDay: false },
    ])

    useShowStore.getState().clearCalendarCache()

    const state = useShowStore.getState()
    expect(state.calendarEvents).toEqual([])
    expect(state.calendarFetchStatus).toBe('idle')
    expect(state.calendarFetchedAt).toBeNull()
  })

  it('resetShow clears calendar state', () => {
    useShowStore.getState().setCalendarEvents([
      { title: 'Meeting', start: '10:00', end: '11:00', allDay: false },
    ])
    useShowStore.getState().setCalendarFetchStatus('ready')

    useShowStore.getState().resetShow()

    const state = useShowStore.getState()
    expect(state.calendarEvents).toEqual([])
    expect(state.calendarFetchStatus).toBe('idle')
    expect(state.calendarFetchedAt).toBeNull()
  })
})
