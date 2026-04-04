import { useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useShowPhase, useShowContext, useShowSend, useShowSelector, showSelectors } from '../machines/ShowMachineProvider'
import { expandTier, collapseTier } from '../../shared/types'
import type { ViewTier } from '../../shared/types'
import { useTimer } from '../hooks/useTimer'
import { TallyLight } from '../components/TallyLight'
import { BeatCounter } from '../components/BeatCounter'
import { MiniRundownStrip } from '../components/MiniRundownStrip'
import { Popover, PopoverTrigger, PopoverContent } from '../ui/popover'
import { cn } from '../lib/utils'

const PHASE_INFO: Record<string, { label: string; description: string }> = {
  live: { label: 'ON AIR', description: 'An act is running. Stay present.' },
  intermission: { label: 'Intermission', description: 'Take a breather. No rush.' },
  strike: { label: 'Strike', description: 'Show complete. Review your day.' },
  director: { label: 'Director Mode', description: 'Deciding what happens next.' },
  writers_room: { label: "Writer's Room", description: 'Planning the show lineup.' },
  no_show: { label: 'Dark Studio', description: 'No show running yet.' },
}

export function PillView() {
  const phase = useShowPhase()
  const viewTier = useShowContext((ctx) => ctx.viewTier)
  const send = useShowSend()
  const expandViewTier = useCallback(() => send({ type: 'SET_VIEW_TIER', tier: expandTier(viewTier) }), [send, viewTier])
  const collapseViewTier = useCallback(() => send({ type: 'SET_VIEW_TIER', tier: collapseTier(viewTier) }), [send, viewTier])
  const setViewTier = useCallback((tier: ViewTier) => send({ type: 'SET_VIEW_TIER', tier }), [send])
  const currentAct = useShowSelector(showSelectors.currentAct)
  const { minutes, seconds, isRunning } = useTimer()

  const isUrgent = minutes < 5 && isRunning

  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  const showStrip = phase === 'live' || phase === 'intermission'

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
                  'font-mono text-sm font-semibold tabular-nums shrink-0 whitespace-nowrap',
                  isUrgent ? 'text-beat animate-warm-pulse' : 'text-txt-primary'
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

        {/* Minimize to tray button */}
        <button
          className="shrink-0 w-5 h-5 rounded-full border border-white/10 text-txt-muted hover:text-txt-secondary hover:border-white/20 transition-colors flex items-center justify-center text-[10px] font-mono leading-none no-drag"
          aria-label="Minimize to menu bar"
          data-testid="pill-minimize-btn"
          onClick={() => window.showtime.minimizeToTray()}
        >
          −
        </button>

        {/* Help button */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="shrink-0 w-5 h-5 rounded-full border border-white/10 text-txt-muted hover:text-txt-secondary hover:border-white/20 transition-colors flex items-center justify-center text-[10px] font-mono no-drag"
              data-testid="pill-help-btn"
            >
              ?
            </button>
          </PopoverTrigger>
          <PopoverContent side="top" align="end" sideOffset={8} className="w-56">
            <div className="space-y-3">
              <div>
                <span className="font-mono text-[10px] tracking-widest uppercase text-txt-muted">
                  {PHASE_INFO[phase]?.label ?? 'Showtime'}
                </span>
                <p className="text-xs text-txt-secondary mt-0.5">
                  {PHASE_INFO[phase]?.description ?? 'Your ADHD-friendly day planner.'}
                </p>
              </div>
              <div className="border-t border-card-border pt-2 space-y-1.5">
                <p className="font-mono text-[9px] tracking-widest uppercase text-txt-muted">Actions</p>
                <button
                  onClick={() => expandViewTier()}
                  className="block text-xs text-txt-secondary hover:text-accent transition-colors"
                >
                  Expand view
                </button>
                <button
                  onClick={() => setViewTier('expanded')}
                  className="block text-xs text-txt-secondary hover:text-accent transition-colors"
                >
                  Settings &amp; History
                </button>
              </div>
            </div>
          </PopoverContent>
        </Popover>
      </div>
      {showStrip && <MiniRundownStrip />}
    </motion.div>
  )
}
