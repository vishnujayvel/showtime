import { describe, it, expect, vi, afterEach } from 'vitest'
import { localToday } from '../shared/date-utils'

describe('localToday', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns YYYY-MM-DD format', () => {
    const result = localToday()
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('uses local timezone, not UTC', () => {
    // Simulate 11 PM PDT on Jan 15 — UTC is already Jan 16
    // 2025-01-16T06:00:00Z === 2025-01-15T22:00:00 PST (UTC-8)
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2025-01-16T06:00:00Z'))

    const utcDate = new Date().toISOString().slice(0, 10) // '2025-01-16'
    const localDate = localToday()

    // If timezone offset is negative (west of UTC), localToday should
    // return the previous day, not the UTC day
    const offset = new Date().getTimezoneOffset() // minutes ahead of UTC (positive = west)
    if (offset > 0) {
      expect(localDate).toBe('2025-01-15')
      expect(utcDate).toBe('2025-01-16')
    } else {
      // In UTC or east-of-UTC timezones, both should match
      expect(localDate).toBe(utcDate)
    }
  })

  it('zero-pads month and day', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 0, 5, 12, 0, 0)) // Jan 5, 2025 noon local
    expect(localToday()).toBe('2025-01-05')
  })

  it('handles December 31 correctly', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2025, 11, 31, 23, 0, 0)) // Dec 31, 2025 11 PM local
    expect(localToday()).toBe('2025-12-31')
  })
})
