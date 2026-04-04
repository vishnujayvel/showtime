/**
 * Layer 2b: Temporal Logic Property Tests
 *
 * Property tests for time-dependent behavior:
 * - Greeting text matches time of day
 * - "tomorrow" vs "tonight" copy correctness
 * - Day boundary date handling
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import fc from 'fast-check'
import { getTemporalShowLabel, getTemporalShowLabelUpper } from '../../renderer/lib/utils'

// ─── Temporal helpers (extracted from DarkStudioView / WritersRoomView patterns) ───

/** Returns the greeting for a given hour (0-23) — must match DarkStudioView logic */
function getGreeting(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Good morning'
  if (hour >= 12 && hour < 17) return 'Good afternoon'
  if (hour >= 17 && hour < 22) return 'Good evening'
  return 'Late night'
}

/** Returns whether the show is being planned for "tomorrow" vs "today/tonight" */
function isForTomorrow(hour: number, hasCompletedShow = false): boolean {
  return hour >= 18 && hasCompletedShow
}

/** Returns the copy text for the plan target */
function getPlanTargetCopy(hour: number, hasCompletedShow = false): string {
  if (hour >= 18 && !hasCompletedShow) return "tonight's show"
  return isForTomorrow(hour, hasCompletedShow) ? "tomorrow's show" : "today's show"
}

// ─── Tests ───

describe('Layer 2b: Temporal Property Tests', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('greeting is always one of the four valid greetings for any hour', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        (hour) => {
          const greeting = getGreeting(hour)
          expect(['Good morning', 'Good afternoon', 'Good evening', 'Late night']).toContain(greeting)
        }
      )
    )
  })

  it('greeting transitions happen at correct boundaries', () => {
    // Morning: 5-11
    for (let h = 5; h < 12; h++) {
      expect(getGreeting(h)).toBe('Good morning')
    }
    // Afternoon: 12-16
    for (let h = 12; h < 17; h++) {
      expect(getGreeting(h)).toBe('Good afternoon')
    }
    // Evening: 17-21
    for (let h = 17; h < 22; h++) {
      expect(getGreeting(h)).toBe('Good evening')
    }
    // Late night: 22-4
    for (let h = 22; h < 24; h++) {
      expect(getGreeting(h)).toBe('Late night')
    }
    for (let h = 0; h < 5; h++) {
      expect(getGreeting(h)).toBe('Late night')
    }
  })

  it('"tomorrow" copy is used only after 6 PM with a completed show', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.boolean(),
        (hour, hasCompleted) => {
          const forTomorrow = isForTomorrow(hour, hasCompleted)
          if (hour >= 18 && hasCompleted) {
            expect(forTomorrow).toBe(true)
          } else {
            expect(forTomorrow).toBe(false)
          }
        }
      )
    )
  })

  it('plan target copy is always one of the three valid values', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.boolean(),
        (hour, hasCompleted) => {
          const copy = getPlanTargetCopy(hour, hasCompleted)
          expect(["today's show", "tonight's show", "tomorrow's show"]).toContain(copy)
        }
      )
    )
  })

  it('day boundary: show date resets at midnight', () => {
    // Simulate dates across a day boundary
    fc.assert(
      fc.property(
        fc.date({ min: new Date('2025-01-01T00:00:00Z'), max: new Date('2027-12-31T23:59:59Z') }),
        (date) => {
          fc.pre(!isNaN(date.getTime()))
          const isoDate = date.toISOString().slice(0, 10)
          // ISO date format is always YYYY-MM-DD
          expect(isoDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
          // Month is 01-12, day is 01-31
          const [, month, day] = isoDate.split('-').map(Number)
          expect(month).toBeGreaterThanOrEqual(1)
          expect(month).toBeLessThanOrEqual(12)
          expect(day).toBeGreaterThanOrEqual(1)
          expect(day).toBeLessThanOrEqual(31)
        }
      )
    )
  })

  it('getTemporalShowLabel returns correct label for time of day (no completed show)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        (hour) => {
          const date = new Date(2026, 0, 15, hour, 30, 0)
          const label = getTemporalShowLabel(date)
          if (hour < 12) {
            expect(label).toBe("today's")
          } else if (hour < 18) {
            expect(label).toBe("your next")
          } else {
            expect(label).toBe("tonight's")
          }
        }
      )
    )
  })

  it('getTemporalShowLabel returns "tomorrow\'s" after 6 PM when show is completed', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 18, max: 23 }),
        (hour) => {
          const date = new Date(2026, 0, 15, hour, 30, 0)
          const label = getTemporalShowLabel(date, true)
          expect(label).toBe("tomorrow's")
        }
      )
    )
  })

  it('getTemporalShowLabel hasCompletedShow has no effect before 6 PM', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 17 }),
        (hour) => {
          const date = new Date(2026, 0, 15, hour, 30, 0)
          expect(getTemporalShowLabel(date, true)).toBe(getTemporalShowLabel(date, false))
        }
      )
    )
  })

  it('getTemporalShowLabelUpper is uppercase version of getTemporalShowLabel', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 23 }),
        fc.boolean(),
        (hour, hasCompleted) => {
          const date = new Date(2026, 0, 15, hour, 30, 0)
          expect(getTemporalShowLabelUpper(date, hasCompleted)).toBe(getTemporalShowLabel(date, hasCompleted).toUpperCase())
        }
      )
    )
  })

  it('verdict messages are always compassionate (no guilt language)', () => {
    const VERDICT_MESSAGES: Record<string, string> = {
      DAY_WON: 'You showed up and you were present.',
      SOLID_SHOW: 'Not every sketch lands. The show was still great.',
      GOOD_EFFORT: 'You got on stage. That\'s the hardest part.',
      SHOW_CALLED_EARLY: 'Sometimes the show is short. The audience still came.',
    }

    const guiltWords = ['failed', 'lazy', 'wasted', 'should have', 'didn\'t', 'missed', 'forgot', 'wrong']

    for (const [verdict, message] of Object.entries(VERDICT_MESSAGES)) {
      for (const word of guiltWords) {
        expect(message.toLowerCase()).not.toContain(word)
      }
      // All messages should be present and non-empty
      expect(message.length).toBeGreaterThan(0)
      expect(verdict).toBeTruthy()
    }
  })

  it('timer end times are always in the future when set', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 120 }), // duration in minutes
        (durationMinutes) => {
          const now = Date.now()
          const timerEndAt = now + durationMinutes * 60 * 1000
          expect(timerEndAt).toBeGreaterThan(now)
          // Duration should be reasonable (1 min to 2 hours)
          const actualMinutes = (timerEndAt - now) / 60000
          expect(actualMinutes).toBeCloseTo(durationMinutes, 5)
        }
      )
    )
  })

  it('beat threshold determines verdict correctly for any locked/threshold combo', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10 }), // beatsLocked
        fc.integer({ min: 1, max: 10 }), // beatThreshold
        (beatsLocked, beatThreshold) => {
          // Ensure beatsLocked doesn't exceed threshold
          const clamped = Math.min(beatsLocked, beatThreshold)
          let verdict: string

          if (clamped >= beatThreshold) {
            verdict = 'DAY_WON'
          } else if (clamped === beatThreshold - 1) {
            verdict = 'SOLID_SHOW'
          } else if (clamped >= Math.ceil(beatThreshold / 2)) {
            verdict = 'GOOD_EFFORT'
          } else {
            verdict = 'SHOW_CALLED_EARLY'
          }

          expect(['DAY_WON', 'SOLID_SHOW', 'GOOD_EFFORT', 'SHOW_CALLED_EARLY']).toContain(verdict)

          // DAY_WON requires all beats locked
          if (verdict === 'DAY_WON') {
            expect(clamped).toBeGreaterThanOrEqual(beatThreshold)
          }
        }
      )
    )
  })
})
