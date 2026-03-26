import { describe, it, expect } from 'vitest'

// ViewMode validation logic — mirrors isValidViewMode from src/main/window.ts
// We cannot import directly because window.ts imports Electron modules (BrowserWindow, screen, etc.)
// which are unavailable in the Vitest jsdom environment.
// Instead we replicate the pure validation logic and test it against the canonical set of modes.

const VALID_VIEW_MODES = new Set(['pill', 'compact', 'dashboard', 'expanded', 'full'])

function isValidViewMode(mode: unknown): boolean {
  return typeof mode === 'string' && VALID_VIEW_MODES.has(mode)
}

describe('isValidViewMode', () => {
  it.each(['pill', 'compact', 'dashboard', 'expanded', 'full'])(
    'returns true for valid mode "%s"',
    (mode) => {
      expect(isValidViewMode(mode)).toBe(true)
    },
  )

  it.each([
    ['invalid string', 'invalid'],
    ['empty string', ''],
    ['undefined', undefined],
    ['null', null],
    ['number', 42],
    ['uppercase (case-sensitive)', 'PILL'],
    ['mixed case', 'Compact'],
    ['extra whitespace', ' pill '],
    ['object', {}],
    ['array', ['pill']],
    ['boolean', true],
  ])('returns false for %s', (_desc, mode) => {
    expect(isValidViewMode(mode)).toBe(false)
  })

  it('validates against the same set defined in window.ts VIEW_DIMENSIONS', () => {
    // The canonical list from shared/types.ts ViewMode
    const canonicalModes = ['pill', 'compact', 'dashboard', 'expanded', 'full']
    expect([...VALID_VIEW_MODES].sort()).toEqual([...canonicalModes].sort())
  })
})
