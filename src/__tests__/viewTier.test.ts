import { describe, it, expect } from 'vitest'
import { nextViewTier, expandTier, collapseTier } from '../shared/types'
import type { ViewTier } from '../shared/types'

describe('ViewTier helpers', () => {
  describe('nextViewTier', () => {
    it('cycles micro → compact → dashboard → expanded → micro', () => {
      expect(nextViewTier('micro')).toBe('compact')
      expect(nextViewTier('compact')).toBe('dashboard')
      expect(nextViewTier('dashboard')).toBe('expanded')
      expect(nextViewTier('expanded')).toBe('micro')
    })
  })

  describe('expandTier', () => {
    it('goes up one tier', () => {
      expect(expandTier('micro')).toBe('compact')
      expect(expandTier('compact')).toBe('dashboard')
      expect(expandTier('dashboard')).toBe('expanded')
    })

    it('clamps at expanded', () => {
      expect(expandTier('expanded')).toBe('expanded')
    })
  })

  describe('collapseTier', () => {
    it('goes down one tier', () => {
      expect(collapseTier('expanded')).toBe('dashboard')
      expect(collapseTier('dashboard')).toBe('compact')
      expect(collapseTier('compact')).toBe('micro')
    })

    it('clamps at micro', () => {
      expect(collapseTier('micro')).toBe('micro')
    })
  })
})
