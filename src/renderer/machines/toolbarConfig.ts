import type { ShowPhase, ViewTier } from '../../shared/types'

/** Which toolbar buttons should be visible for a given app state. */
export interface ToolbarConfig {
  showClose: boolean
  showMinimize: boolean
  showViewMenu: boolean
  showMute: boolean
  showDirector: boolean
  showCollapse: boolean
  showBack: boolean
}

const EMPTY: ToolbarConfig = {
  showClose: false,
  showMinimize: false,
  showViewMenu: false,
  showMute: false,
  showDirector: false,
  showCollapse: false,
  showBack: false,
}

/**
 * Derive toolbar button visibility from current show phase and view tier.
 *
 * - no_show (DarkStudio): no toolbar
 * - writers_room: close + viewMenu + mute (always full-screen, no collapse/director)
 * - strike: close + viewMenu + mute + collapse
 * - live/intermission/director + expanded/dashboard: close + viewMenu + mute + director + collapse
 * - live/intermission/director + compact: close + viewMenu + mute + collapse (no director)
 * - live/intermission/director + micro (pill): minimize + viewMenu only
 */
export function getToolbarConfig(phase: ShowPhase, viewTier: ViewTier): ToolbarConfig {
  if (phase === 'no_show') {
    return EMPTY
  }

  if (phase === 'writers_room') {
    return {
      ...EMPTY,
      showClose: true,
      showViewMenu: true,
      showMute: true,
    }
  }

  if (phase === 'strike') {
    return {
      ...EMPTY,
      showClose: true,
      showViewMenu: true,
      showMute: true,
      showCollapse: true,
    }
  }

  // Tier-based views (live, intermission, director)
  if (viewTier === 'micro') {
    return {
      ...EMPTY,
      showMinimize: true,
      showViewMenu: true,
    }
  }

  if (viewTier === 'compact') {
    return {
      ...EMPTY,
      showClose: true,
      showViewMenu: true,
      showMute: true,
      showCollapse: true,
    }
  }

  // dashboard + expanded
  return {
    ...EMPTY,
    showClose: true,
    showViewMenu: true,
    showMute: true,
    showDirector: true,
    showCollapse: true,
  }
}

/** Toolbar config for overlay views (history, settings, onboarding). Back button only. */
export function getOverlayToolbarConfig(): ToolbarConfig {
  return { ...EMPTY, showBack: true }
}

/** Derive the ViewMenu `view` prop from machine state. */
export type ViewMenuView = 'pill' | 'compact' | 'dashboard' | 'expanded' | 'writers_room' | 'strike'

export function deriveViewMenuView(phase: ShowPhase, viewTier: ViewTier): ViewMenuView {
  if (phase === 'writers_room') return 'writers_room'
  if (phase === 'strike') return 'strike'
  const map: Record<ViewTier, ViewMenuView> = {
    micro: 'pill',
    compact: 'compact',
    dashboard: 'dashboard',
    expanded: 'expanded',
  }
  return map[viewTier]
}
