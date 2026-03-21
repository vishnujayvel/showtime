import { describe, it, expect } from 'vitest'
import {
  computeAnchorFromBounds,
  computeBoundsFromAnchor,
  clampToWorkArea,
} from '../main/window-geometry'

describe('window-geometry', () => {
  describe('computeAnchorFromBounds', () => {
    it('returns center-bottom point', () => {
      const anchor = computeAnchorFromBounds({ x: 640, y: 380, width: 560, height: 620 })
      expect(anchor).toEqual({ x: 920, y: 1000 })
    })

    it('works with pill-sized bounds', () => {
      const anchor = computeAnchorFromBounds({ x: 760, y: 1002, width: 320, height: 48 })
      expect(anchor).toEqual({ x: 920, y: 1050 })
    })
  })

  describe('computeBoundsFromAnchor', () => {
    it('computes full-size bounds from anchor', () => {
      const bounds = computeBoundsFromAnchor({ x: 800, y: 1050 }, { width: 560, height: 740 })
      expect(bounds).toEqual({ x: 520, y: 310, width: 560, height: 740 })
    })

    it('computes pill bounds from anchor', () => {
      const bounds = computeBoundsFromAnchor({ x: 800, y: 1050 }, { width: 320, height: 48 })
      expect(bounds).toEqual({ x: 640, y: 1002, width: 320, height: 48 })
    })

    it('preserves center-x across view transitions', () => {
      // Start with full-size window
      const fullBounds = { x: 520, y: 310, width: 560, height: 740 }
      const anchor = computeAnchorFromBounds(fullBounds)

      // Transition to pill
      const pillBounds = computeBoundsFromAnchor(anchor, { width: 320, height: 48 })
      expect(pillBounds.x + pillBounds.width / 2).toBe(anchor.x)

      // Transition back to expanded
      const expandedBounds = computeBoundsFromAnchor(anchor, { width: 560, height: 620 })
      expect(expandedBounds.x + expandedBounds.width / 2).toBe(anchor.x)
    })

    it('preserves bottom-y across view transitions', () => {
      const anchor = { x: 800, y: 1050 }
      const pill = computeBoundsFromAnchor(anchor, { width: 320, height: 48 })
      const full = computeBoundsFromAnchor(anchor, { width: 560, height: 740 })

      expect(pill.y + pill.height).toBe(1050)
      expect(full.y + full.height).toBe(1050)
    })
  })

  describe('clampToWorkArea', () => {
    const workArea = { x: 0, y: 25, width: 1920, height: 1055 }

    it('returns unchanged bounds when fully within work area', () => {
      const bounds = { x: 100, y: 100, width: 560, height: 740 }
      expect(clampToWorkArea(bounds, workArea)).toEqual(bounds)
    })

    it('clamps negative x to work area left edge', () => {
      const bounds = { x: -100, y: 100, width: 560, height: 740 }
      const clamped = clampToWorkArea(bounds, workArea)
      expect(clamped.x).toBe(0)
    })

    it('clamps overflow x to work area right edge', () => {
      const bounds = { x: 1500, y: 100, width: 560, height: 740 }
      const clamped = clampToWorkArea(bounds, workArea)
      expect(clamped.x).toBe(1360) // 1920 - 560
    })

    it('clamps above work area to top edge', () => {
      const bounds = { x: 100, y: 0, width: 560, height: 740 }
      const clamped = clampToWorkArea(bounds, workArea)
      expect(clamped.y).toBe(25)
    })

    it('clamps below work area to bottom edge', () => {
      const bounds = { x: 100, y: 500, width: 560, height: 740 }
      const clamped = clampToWorkArea(bounds, workArea)
      expect(clamped.y).toBe(340) // 25 + 1055 - 740
    })

    it('preserves dimensions', () => {
      const bounds = { x: -500, y: -500, width: 320, height: 48 }
      const clamped = clampToWorkArea(bounds, workArea)
      expect(clamped.width).toBe(320)
      expect(clamped.height).toBe(48)
    })
  })
})
