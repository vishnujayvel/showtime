import { useCallback } from 'react'
import { motion } from 'framer-motion'
import { useShowPhase, useShowContext, useShowSend, useShowSelector, showSelectors } from '../machines/ShowMachineProvider'
import { expandTier, collapseTier } from '../../shared/types'
import { useTimer } from '../hooks/useTimer'
import { TallyLight } from '../components/TallyLight'
import { BeatCounter } from '../components/BeatCounter'
import { OnAirIndicator } from '../components/OnAirIndicator'
import { RundownBar } from '../components/RundownBar'
import { ViewMenu } from '../components/ViewMenu'
import { MuteToggle } from '../components/MuteToggle'
import { cn } from '../lib/utils'

function formatStartTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Condensed single-row view showing the current act name, timer, and rundown bar. */
export function CompactView() {
  const phase = useShowPhase()
  const verdict = useShowContext((ctx) => ctx.verdict)
  const currentAct = useShowSelector(showSelectors.currentAct)
  const viewTier = useShowContext((ctx) => ctx.viewTier)
  const send = useShowSend()
  const collapseViewTier = useCallback(() => send({ type: 'SET_VIEW_TIER', tier: collapseTier(viewTier) }), [send, viewTier])
  const expandViewTier = useCallback(() => send({ type: 'SET_VIEW_TIER', tier: expandTier(viewTier) }), [send, viewTier])
  const showStartedAt = useShowContext((ctx) => ctx.showStartedAt)
  const { minutes, seconds, isRunning } = useTimer()

  const isUrgent = minutes < 5 && isRunning
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  return (
    <motion.div
      className={cn(
        'w-full h-full rounded-2xl flex flex-col overflow-hidden',
        'bg-surface/90 backdrop-blur-[20px]',
        'border border-white/[0.06]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'select-none'
      )}
      initial={{ scale: 0.9, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0, y: -5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Header Row (32px) — drag region */}
      <div className="flex items-center gap-2 px-3 py-2 drag-region">
        <TallyLight isLive={phase === 'live'} size="sm" />
        <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-txt-muted">
          SHOWTIME
        </span>
        <div
          className="flex items-center gap-2 flex-1 cursor-pointer no-drag min-w-0"
          onClick={expandViewTier}
        >
          {phase === 'live' && (
            <>
              <span className="font-body text-[13px] font-semibold text-txt-primary truncate flex-1">
                {currentAct?.name}
              </span>
              <span
                className={cn(
                  'font-mono text-sm font-semibold tabular-nums shrink-0',
                  isUrgent ? 'text-beat animate-warm-pulse' : 'text-txt-primary'
                )}
              >
                {timerText}
              </span>
            </>
          )}
          {phase === 'intermission' && (
            <>
              <span className="font-body text-[13px] text-txt-secondary flex-1">
                Intermission
              </span>
              <span className="font-body text-xs text-txt-muted shrink-0">no rush</span>
            </>
          )}
          {phase === 'strike' && (
            <>
              <span className="font-body text-[13px] text-txt-primary flex-1">
                Show complete!
              </span>
              <BeatCounter size="sm" />
            </>
          )}
        </div>
        <MuteToggle />
        <ViewMenu
          view="compact"
        />
        <button
          onClick={collapseViewTier}
          className="px-1 py-0.5 text-txt-muted hover:text-txt-secondary transition-colors no-drag text-xs"
        >
          ▼
        </button>
        <button
          onClick={() => window.showtime.quit()}
          className="px-1 py-0.5 text-txt-muted hover:text-onair transition-colors text-xs no-drag"
          title="Quit Showtime"
        >
          ✕
        </button>
      </div>

      {/* RundownBar section */}
      <div className="px-2">
        <RundownBar variant="compact" />
      </div>

      {/* Status Bar (bottom) */}
      <div className="flex items-center justify-between px-3 py-1.5 mt-auto">
        <div className="flex items-center gap-2">
          <BeatCounter size="sm" showLabel />
        </div>
        <div className="flex items-center gap-2">
          {phase === 'live' && <OnAirIndicator isLive />}
          {showStartedAt && (
            <span className="font-mono text-[10px] text-txt-muted">
              Started {formatStartTime(showStartedAt)}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  )
}
