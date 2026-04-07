import { useCallback } from 'react'
import { useShowPhase, useShowContext, useShowSend, useOverlay } from '../machines/ShowMachineProvider'
import { collapseTier } from '../../shared/types'
import {
  getToolbarConfig,
  getOverlayToolbarConfig,
  deriveViewMenuView,
} from '../machines/toolbarConfig'
import { ViewMenu } from './ViewMenu'
import { MuteToggle } from './MuteToggle'

interface ToolbarProps {
  /** Handler for the back button (overlay views). */
  onBack?: () => void
  /** Additional CSS classes for the container. */
  className?: string
}

/** Shared toolbar that derives visible buttons from XState machine state. */
export function Toolbar({ onBack, className }: ToolbarProps) {
  const phase = useShowPhase()
  const viewTier = useShowContext((ctx) => ctx.viewTier)
  const overlay = useOverlay()
  const send = useShowSend()

  const config = overlay !== 'none'
    ? getOverlayToolbarConfig()
    : getToolbarConfig(phase, viewTier)

  const collapseViewTier = useCallback(
    () => send({ type: 'SET_VIEW_TIER', tier: collapseTier(viewTier) }),
    [send, viewTier],
  )
  const enterDirector = useCallback(
    () => send({ type: 'ENTER_DIRECTOR' }),
    [send],
  )

  const menuView = deriveViewMenuView(phase, viewTier)

  return (
    <div className={className ?? 'flex items-center gap-1 no-drag'}>
      {config.showBack && onBack && (
        <button
          onClick={onBack}
          className="text-txt-muted hover:text-txt-secondary text-sm no-drag transition-colors"
          data-testid="toolbar-back-btn"
        >
          Back
        </button>
      )}
      {config.showMute && <MuteToggle />}
      {config.showDirector && (
        <button
          onClick={enterDirector}
          className="px-2 py-1 rounded-md bg-surface-hover text-txt-secondary text-sm font-medium hover:text-txt-primary transition-colors no-drag"
          data-testid="toolbar-director-btn"
        >
          Director
        </button>
      )}
      {config.showViewMenu && <ViewMenu view={menuView} />}
      {config.showCollapse && (
        <button
          onClick={collapseViewTier}
          className="px-1 py-0.5 text-txt-muted hover:text-txt-secondary transition-colors no-drag text-xs"
          data-testid="toolbar-collapse-btn"
        >
          ▼
        </button>
      )}
      {config.showMinimize && (
        <button
          className="shrink-0 w-5 h-5 rounded-full border border-white/10 text-txt-muted hover:text-txt-secondary hover:border-white/20 transition-colors flex items-center justify-center text-[10px] font-mono leading-none no-drag"
          aria-label="Minimize to menu bar"
          data-testid="pill-minimize-btn"
          onClick={() => window.showtime.minimizeToTray()}
        >
          −
        </button>
      )}
      {config.showClose && (
        <button
          onClick={() => window.showtime.quit()}
          className="px-1 py-0.5 text-txt-muted hover:text-onair transition-colors text-sm no-drag"
          title="Quit Showtime"
          data-testid="toolbar-quit-btn"
        >
          ✕
        </button>
      )}
    </div>
  )
}
