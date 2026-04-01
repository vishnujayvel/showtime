/**
 * Tests for time-of-day prompt logic and quick-start templates.
 */
import { describe, it, expect } from 'vitest'
import { getTimeOfDayPrompt, getQuickStartTemplates } from '../renderer/views/WritersRoomView'

describe('getTimeOfDayPrompt', () => {
  it('returns morning prompt before 10am', () => {
    const result = getTimeOfDayPrompt(8)
    expect(result.period).toBe('morning')
    expect(result.greeting).toContain('Fresh start')
  })

  it('returns morning prompt at 0 (midnight)', () => {
    const result = getTimeOfDayPrompt(0)
    expect(result.period).toBe('morning')
  })

  it('returns morning prompt at 9', () => {
    const result = getTimeOfDayPrompt(9)
    expect(result.period).toBe('morning')
  })

  it('returns midday prompt at 10am', () => {
    const result = getTimeOfDayPrompt(10)
    expect(result.period).toBe('midday')
    expect(result.greeting).toContain('Afternoon')
  })

  it('returns midday prompt at 13 (1pm)', () => {
    const result = getTimeOfDayPrompt(13)
    expect(result.period).toBe('midday')
  })

  it('returns late prompt at 14 (2pm)', () => {
    const result = getTimeOfDayPrompt(14)
    expect(result.period).toBe('late')
    expect(result.greeting).toContain('wind-down')
  })

  it('returns late prompt at 17 (5pm)', () => {
    const result = getTimeOfDayPrompt(17)
    expect(result.period).toBe('late')
  })

  it('returns evening prompt at 18 (6pm)', () => {
    const result = getTimeOfDayPrompt(18)
    expect(result.period).toBe('evening')
    expect(result.greeting).toContain('wrapping up')
  })

  it('returns evening prompt at 23 (11pm)', () => {
    const result = getTimeOfDayPrompt(23)
    expect(result.period).toBe('evening')
  })

  it('always returns greeting and sub fields', () => {
    for (let h = 0; h < 24; h++) {
      const result = getTimeOfDayPrompt(h)
      expect(result.greeting).toBeTruthy()
      expect(result.sub).toBeTruthy()
      expect(['morning', 'midday', 'late', 'evening']).toContain(result.period)
    }
  })
})

describe('getQuickStartTemplates', () => {
  it('returns all 4 templates', () => {
    const templates = getQuickStartTemplates({ hasTodayShow: false, hasYesterdayLineup: false })
    expect(templates).toHaveLength(4)
  })

  it('resume template is available when hasTodayShow is true', () => {
    const templates = getQuickStartTemplates({ hasTodayShow: true, hasYesterdayLineup: false })
    const resume = templates.find(t => t.id === 'resume')
    expect(resume?.available).toBe(true)
  })

  it('resume template is unavailable when no today show', () => {
    const templates = getQuickStartTemplates({ hasTodayShow: false, hasYesterdayLineup: false })
    const resume = templates.find(t => t.id === 'resume')
    expect(resume?.available).toBe(false)
  })

  it('yesterday template is available when hasYesterdayLineup is true', () => {
    const templates = getQuickStartTemplates({ hasTodayShow: false, hasYesterdayLineup: true })
    const yesterday = templates.find(t => t.id === 'yesterday')
    expect(yesterday?.available).toBe(true)
  })

  it('light and deep-focus are always available', () => {
    const templates = getQuickStartTemplates({ hasTodayShow: false, hasYesterdayLineup: false })
    expect(templates.find(t => t.id === 'light')?.available).toBe(true)
    expect(templates.find(t => t.id === 'deep-focus')?.available).toBe(true)
  })

  it('each template has id, label, description', () => {
    const templates = getQuickStartTemplates({ hasTodayShow: true, hasYesterdayLineup: true })
    for (const t of templates) {
      expect(t.id).toBeTruthy()
      expect(t.label).toBeTruthy()
      expect(t.description).toBeTruthy()
    }
  })
})
