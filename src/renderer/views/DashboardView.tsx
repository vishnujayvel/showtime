import { useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useShowPhase, useShowContext, useShowSend, useShowSelector, showSelectors } from '../machines/ShowMachineProvider'
import { expandTier } from '../../shared/types'
import { useTimer } from '../hooks/useTimer'
import { TallyLight } from '../components/TallyLight'
import { BeatCounter } from '../components/BeatCounter'
import { OnAirIndicator } from '../components/OnAirIndicator'
import { ClapperboardBadge } from '../components/ClapperboardBadge'
import { Toolbar } from '../components/Toolbar'
import { cn } from '../lib/utils'
import { formatDateLabel } from '../lib/utils'
import { getCategoryClasses } from '../lib/category-colors'

function formatStartTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Mid-tier dashboard showing the current act timer, upcoming acts, and show status. */
export function DashboardView() {
  const phase = useShowPhase()
  const acts = useShowContext((ctx) => ctx.acts)
  const currentAct = useShowSelector(showSelectors.currentAct)
  const viewTier = useShowContext((ctx) => ctx.viewTier)
  const send = useShowSend()
  const expandViewTier = useCallback(() => send({ type: 'SET_VIEW_TIER', tier: expandTier(viewTier) }), [send, viewTier])
  const showStartedAt = useShowContext((ctx) => ctx.showStartedAt)
  const { minutes, seconds, isRunning, progress } = useTimer()

  const dateLabel = useMemo(formatDateLabel, [])

  const isUrgent = minutes < 5 && isRunning
  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  // Upcoming acts (next 2 after current)
  const upcomingActs = useMemo(() => {
    const sorted = [...acts].sort((a, b) => a.order - b.order)
    return sorted.filter((a) => a.status === 'upcoming').slice(0, 2)
  }, [acts])

  const currentActIndex = currentAct
    ? acts.sort((a, b) => a.order - b.order).findIndex((a) => a.id === currentAct.id)
    : -1

  return (
    <motion.div
      className={cn(
        'w-full h-full rounded-xl flex flex-col overflow-hidden',
        'bg-surface/95 backdrop-blur-[16px]',
        'border border-white/[0.06]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'select-none'
      )}
      initial={{ scale: 0.9, opacity: 0, y: 10 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.95, opacity: 0, y: -5 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {/* Title Bar (36px) — drag region */}
      <div className="flex items-center gap-2 px-3 py-2 drag-region border-b border-white/[0.04]">
        <TallyLight isLive={phase === 'live'} size="sm" />
        <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-txt-muted">
          SHOWTIME
        </span>
        <span className="font-mono text-[9px] tracking-wider text-txt-muted/60">
          {dateLabel}
        </span>
        <div className="flex-1" />
        <Toolbar />
      </div>

      {/* Timer Section — the hero area */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-4 cursor-pointer no-drag"
        onClick={expandViewTier}
      >
        {phase === 'live' && currentAct && (
          <>
            <ClapperboardBadge
              sketch={currentAct.sketch}
              actNumber={currentActIndex + 1}
              size="sm"
            />
            <p className="font-body text-base font-bold text-txt-primary mt-2 truncate max-w-full">
              {currentAct.name}
            </p>
            <p
              className={cn(
                'font-mono text-4xl font-bold tabular-nums mt-1',
                isUrgent ? 'text-beat animate-warm-pulse' : 'text-txt-primary'
              )}
            >
              {timerText}
            </p>
            {/* Progress bar */}
            <div className="w-full max-w-[280px] h-1 bg-surface-hover rounded-full mt-2 overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                // dynamic: progress bar width is computed from act timer state
                style={{ width: `${Math.round(progress * 100)}%` }}
              />
            </div>
          </>
        )}
        {phase === 'intermission' && (
          <p className="font-body text-lg text-txt-secondary font-medium">
            WE&apos;LL BE RIGHT BACK
          </p>
        )}
        {phase === 'strike' && (
          <p className="font-body text-lg text-beat font-medium animate-golden-glow">
            Show complete!
          </p>
        )}
      </div>

      {/* Coming Up Section */}
      {upcomingActs.length > 0 && phase !== 'strike' && (
        <div className="px-3 pb-1">
          <p className="font-mono text-[9px] tracking-[0.12em] uppercase text-txt-muted mb-1">
            COMING UP
          </p>
          {upcomingActs.map((act) => {
            const catClasses = getCategoryClasses(act.sketch)
            return (
              <div key={act.id} className="flex items-center gap-2 py-1">
                <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', catClasses.bg)} />
                <span className="font-body text-[13px] text-txt-secondary truncate flex-1">
                  {act.name}
                </span>
                <span className="font-mono text-[11px] text-txt-muted shrink-0">
                  {act.durationMinutes}m
                </span>
                <span className={cn('font-mono text-[10px] shrink-0', catClasses.text)}>
                  {act.sketch}
                </span>
              </div>
            )
          })}
          {upcomingActs.length === 0 && phase === 'live' && (
            <p className="font-body text-xs text-txt-muted py-1">Final act!</p>
          )}
        </div>
      )}

      {/* Status Bar (bottom) */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-white/[0.04]">
        <OnAirIndicator isLive={phase === 'live'} />
        <BeatCounter size="sm" showLabel />
        {showStartedAt && (
          <span className="font-mono text-[10px] text-txt-muted">
            Started {formatStartTime(showStartedAt)}
          </span>
        )}
      </div>
    </motion.div>
  )
}
