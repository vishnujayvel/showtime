import { useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useShowPhase, useShowContext, useShowSend, useShowSelector, showSelectors } from '../machines/ShowMachineProvider'
import { expandTier } from '../../shared/types'
import { useTimer } from '../hooks/useTimer'
import { TallyLight } from '../components/TallyLight'
import { BeatCounter } from '../components/BeatCounter'
import { BurningFuse, getFuseUrgencyClass } from '../components/BurningFuse'
import { Toolbar } from '../components/Toolbar'
import { cn } from '../lib/utils'

const PHASE_INFO: Record<string, { label: string; description: string }> = {
  live: { label: 'ON AIR', description: 'An act is running. Stay present.' },
  intermission: { label: 'Intermission', description: 'Take a breather. No rush.' },
  strike: { label: 'Strike', description: 'Show complete. Review your day.' },
  director: { label: 'Director Mode', description: 'Deciding what happens next.' },
  writers_room: { label: "Writer's Room", description: 'Planning the show lineup.' },
  no_show: { label: 'Dark Studio', description: 'No show running yet.' },
}

/** Minimal always-on-top floating pill showing the current act, timer, and phase status. */
export function PillView() {
  const phase = useShowPhase()
  const viewTier = useShowContext((ctx) => ctx.viewTier)
  const send = useShowSend()
  const expandViewTier = useCallback(() => send({ type: 'SET_VIEW_TIER', tier: expandTier(viewTier) }), [send, viewTier])
  const currentAct = useShowSelector(showSelectors.currentAct)
  const { minutes, seconds, isRunning, progress } = useTimer()

  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
  const timerUrgencyClass = isRunning ? getFuseUrgencyClass(progress) : 'text-txt-primary'

  // Stuck pill detection: if content isn't rendering after 3s, request force-repaint
  useEffect(() => {
    const timeout = setTimeout(() => {
      const el = document.querySelector('[data-pill-content]')
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.width === 0 || rect.height === 0) {
          window.showtime.forceRepaint()
        }
      }
    }, 3000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <motion.div
      data-pill-content
      className={cn(
        'min-w-[320px] w-auto max-w-[320px] min-h-12 rounded-full flex flex-col',
        'bg-surface/85 backdrop-blur-[20px]',
        'border border-white/[0.06]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'select-none'
      )}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      <div className="flex items-center gap-1.5 py-2 px-2.5">
        {/* Left: drag handle with tally light */}
        <div className="shrink-0 flex items-center drag-region cursor-grab">
          {phase === 'live' ? (
            <TallyLight isLive={true} size="lg" />
          ) : phase === 'intermission' ? (
            <TallyLight isLive={false} />
          ) : null}
        </div>
        {/* Rest: click to expand */}
        <div
          className="flex items-center gap-1.5 flex-1 cursor-pointer no-drag"
          onClick={expandViewTier}
        >
          {phase === 'live' && (
            <>
              <span className="font-body text-sm font-medium text-txt-primary truncate flex-1">
                {currentAct?.name}
              </span>
              <span
                className={cn(
                  'font-mono text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap transition-colors duration-500',
                  timerUrgencyClass
                )}
              >
                {timerText}
              </span>
              <div className="shrink-0">
                <BeatCounter size="sm" />
              </div>
            </>
          )}
          {phase === 'intermission' && (
            <>
              <span className="font-body text-sm text-txt-secondary flex-1">
                Intermission
              </span>
              <span className="font-body text-xs text-txt-muted">
                no rush
              </span>
            </>
          )}
          {phase === 'strike' && (
            <>
              <span className="font-body text-sm text-txt-primary flex-1 animate-golden-glow">
                Show complete!
              </span>
              <BeatCounter size="sm" />
            </>
          )}
          {phase !== 'live' && phase !== 'intermission' && phase !== 'strike' && (
            <>
              <span className="font-body text-sm text-txt-secondary flex-1">
                {PHASE_INFO[phase]?.label ?? 'Showtime'}
              </span>
              <span className="font-body text-xs text-txt-muted">
                Tap to expand
              </span>
            </>
          )}
        </div>

        <Toolbar />
      </div>
      {phase === 'live' && isRunning && (
        <div className="mx-3 mb-1.5">
          <BurningFuse size="pill" progress={progress} />
        </div>
      )}
    </motion.div>
  )
}
