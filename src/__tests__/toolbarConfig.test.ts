import { describe, it, expect } from 'vitest'
import {
  getToolbarConfig,
  getOverlayToolbarConfig,
  deriveViewMenuView,
} from '../renderer/machines/toolbarConfig'
import type { ToolbarConfig } from '../renderer/machines/toolbarConfig'
import type { ShowPhase, ViewTier } from '../shared/types'

/** Extract sorted list of truthy config keys for compact assertions. */
function activeButtons(config: ToolbarConfig): string[] {
  return Object.entries(config)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .sort()
}

describe('getToolbarConfig', () => {
  describe('no_show (Dark Studio)', () => {
    it('returns empty config regardless of viewTier', () => {
      const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
      for (const tier of tiers) {
        expect(activeButtons(getToolbarConfig('no_show', tier))).toEqual([])
      }
    })
  })

  describe('writers_room (full-screen)', () => {
    it('shows close + viewMenu + mute regardless of tier', () => {
      const expected = ['showClose', 'showMute', 'showViewMenu']
      const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
      for (const tier of tiers) {
        expect(activeButtons(getToolbarConfig('writers_room', tier))).toEqual(expected)
      }
    })

    it('does not show director or collapse', () => {
      const config = getToolbarConfig('writers_room', 'expanded')
      expect(config.showDirector).toBe(false)
      expect(config.showCollapse).toBe(false)
    })
  })

  describe('strike (full-screen)', () => {
    it('shows close + viewMenu + mute + collapse', () => {
      const expected = ['showClose', 'showCollapse', 'showMute', 'showViewMenu']
      expect(activeButtons(getToolbarConfig('strike', 'expanded'))).toEqual(expected)
    })

    it('does not show director', () => {
      expect(getToolbarConfig('strike', 'expanded').showDirector).toBe(false)
    })
  })

  describe('live phase — tier-based', () => {
    it('pill (micro): minimize + viewMenu only', () => {
      const config = getToolbarConfig('live', 'micro')
      expect(activeButtons(config)).toEqual(['showMinimize', 'showViewMenu'])
    })

    it('compact: close + viewMenu + mute + collapse (no director)', () => {
      const config = getToolbarConfig('live', 'compact')
      expect(activeButtons(config)).toEqual([
        'showClose', 'showCollapse', 'showMute', 'showViewMenu',
      ])
      expect(config.showDirector).toBe(false)
    })

    it('dashboard: close + viewMenu + mute + director + collapse', () => {
      const config = getToolbarConfig('live', 'dashboard')
      expect(activeButtons(config)).toEqual([
        'showClose', 'showCollapse', 'showDirector', 'showMute', 'showViewMenu',
      ])
    })

    it('expanded: same as dashboard', () => {
      expect(activeButtons(getToolbarConfig('live', 'expanded')))
        .toEqual(activeButtons(getToolbarConfig('live', 'dashboard')))
    })
  })

  describe('intermission — same tier behavior as live', () => {
    it('micro: minimize + viewMenu', () => {
      expect(activeButtons(getToolbarConfig('intermission', 'micro')))
        .toEqual(activeButtons(getToolbarConfig('live', 'micro')))
    })

    it('expanded: includes director', () => {
      expect(getToolbarConfig('intermission', 'expanded').showDirector).toBe(true)
    })
  })

  describe('director phase — same tier behavior', () => {
    it('expanded: includes director button', () => {
      expect(getToolbarConfig('director', 'expanded').showDirector).toBe(true)
    })

    it('compact: no director', () => {
      expect(getToolbarConfig('director', 'compact').showDirector).toBe(false)
    })
  })

  describe('no config ever has both close and minimize', () => {
    const phases: ShowPhase[] = ['no_show', 'writers_room', 'live', 'intermission', 'director', 'strike']
    const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
    for (const phase of phases) {
      for (const tier of tiers) {
        it(`${phase}/${tier}`, () => {
          const config = getToolbarConfig(phase, tier)
          expect(config.showClose && config.showMinimize).toBe(false)
        })
      }
    }
  })

  describe('no config ever has showBack', () => {
    const phases: ShowPhase[] = ['no_show', 'writers_room', 'live', 'intermission', 'director', 'strike']
    const tiers: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']
    for (const phase of phases) {
      for (const tier of tiers) {
        it(`${phase}/${tier}`, () => {
          expect(getToolbarConfig(phase, tier).showBack).toBe(false)
        })
      }
    }
  })
})

describe('getOverlayToolbarConfig', () => {
  it('returns back only', () => {
    expect(activeButtons(getOverlayToolbarConfig())).toEqual(['showBack'])
  })

  it('has no close, minimize, or other buttons', () => {
    const config = getOverlayToolbarConfig()
    expect(config.showClose).toBe(false)
    expect(config.showMinimize).toBe(false)
    expect(config.showDirector).toBe(false)
  })
})

describe('deriveViewMenuView', () => {
  it('returns writers_room for writers_room phase', () => {
    expect(deriveViewMenuView('writers_room', 'expanded')).toBe('writers_room')
  })

  it('returns strike for strike phase', () => {
    expect(deriveViewMenuView('strike', 'expanded')).toBe('strike')
  })

  it('maps viewTier to view for live phases', () => {
    expect(deriveViewMenuView('live', 'micro')).toBe('pill')
    expect(deriveViewMenuView('live', 'compact')).toBe('compact')
    expect(deriveViewMenuView('live', 'dashboard')).toBe('dashboard')
    expect(deriveViewMenuView('live', 'expanded')).toBe('expanded')
  })

  it('maps viewTier for intermission', () => {
    expect(deriveViewMenuView('intermission', 'compact')).toBe('compact')
  })
})
