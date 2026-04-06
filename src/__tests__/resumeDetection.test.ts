/**
 * Tests for DarkStudioView resume detection (getTodayPersistedShow).
 * Runs in jsdom environment for localStorage access.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getTodayPersistedShow } from '../renderer/views/DarkStudioView'
import { localToday } from '../shared/date-utils'

describe('getTodayPersistedShow', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('detects today\'s show from localStorage', () => {
    const today = localToday()
    localStorage.setItem('showtime-show-state', JSON.stringify({
      stateValue: { phase: 'live', animation: 'idle' },
      context: {
        showDate: today,
        acts: [
          { id: '1', status: 'completed', name: 'Act 1' },
          { id: '2', status: 'active', name: 'Act 2' },
          { id: '3', status: 'upcoming', name: 'Act 3' },
        ],
        verdict: null,
      },
      savedAt: Date.now(),
    }))

    const result = getTodayPersistedShow()
    expect(result).not.toBeNull()
    expect(result!.actCount).toBe(3)
    expect(result!.completedCount).toBe(1)
    expect(result!.phase).toBe('live')
    expect(result!.isStrike).toBe(false)
  })

  it('returns null for yesterday\'s show', () => {
    const d = new Date(); d.setDate(d.getDate() - 1)
    const yesterday = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    localStorage.setItem('showtime-show-state', JSON.stringify({
      stateValue: { phase: 'live', animation: 'idle' },
      context: {
        showDate: yesterday,
        acts: [{ id: '1', status: 'active' }],
        verdict: null,
      },
      savedAt: Date.now() - 86400000,
    }))

    const result = getTodayPersistedShow()
    expect(result).toBeNull()
  })

  it('detects strike phase', () => {
    const today = localToday()
    localStorage.setItem('showtime-show-state', JSON.stringify({
      stateValue: { phase: 'strike', animation: 'idle' },
      context: {
        showDate: today,
        acts: [
          { id: '1', status: 'completed' },
          { id: '2', status: 'completed' },
        ],
        verdict: 'DAY_WON',
      },
      savedAt: Date.now(),
    }))

    const result = getTodayPersistedShow()
    expect(result).not.toBeNull()
    expect(result!.isStrike).toBe(true)
    expect(result!.completedCount).toBe(2)
  })

  it('returns null when no data stored', () => {
    const result = getTodayPersistedShow()
    expect(result).toBeNull()
  })

  it('returns null for corrupt JSON', () => {
    localStorage.setItem('showtime-show-state', 'not valid json{{{')
    const result = getTodayPersistedShow()
    expect(result).toBeNull()
  })

  it('identifies writers_room phase (acts exist but none active)', () => {
    const today = localToday()
    localStorage.setItem('showtime-show-state', JSON.stringify({
      stateValue: { phase: 'writers_room', animation: 'idle' },
      context: {
        showDate: today,
        acts: [
          { id: '1', status: 'upcoming' },
          { id: '2', status: 'upcoming' },
        ],
        verdict: null,
      },
      savedAt: Date.now(),
    }))

    const result = getTodayPersistedShow()
    expect(result).not.toBeNull()
    expect(result!.phase).toBe('writers_room')
    expect(result!.completedCount).toBe(0)
  })
})
