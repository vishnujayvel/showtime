import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { useShowStore, selectCurrentAct } from '../stores/showStore'
import { useTimer } from '../hooks/useTimer'
import { TallyLight } from '../components/TallyLight'
import { BeatCounter } from '../components/BeatCounter'
import { MiniRundownStrip } from '../components/MiniRundownStrip'
import { cn } from '../lib/utils'

export function PillView() {
  const phase = useShowStore((s) => s.phase)
  const expandViewTier = useShowStore((s) => s.expandViewTier)
  const currentAct = useShowStore(selectCurrentAct)
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
          window.clui.forceRepaint()
        }
      }
    }, 3000)
    return () => clearTimeout(timeout)
  }, [])

  return (
    <motion.div
      data-pill-content
      className={cn(
        'w-80 min-h-14 rounded-full flex flex-col',
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
      <div className="flex items-center gap-3 py-2.5 px-4">
        {/* Left: drag handle with tally + label */}
        <div className="shrink-0 flex items-center gap-1.5 drag-region cursor-grab">
          {phase === 'live' ? (
            <TallyLight isLive={true} size="lg" />
          ) : phase === 'intermission' ? (
            <TallyLight isLive={false} />
          ) : null}
          <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-txt-muted">
            SHOWTIME
          </span>
        </div>
        {/* Rest: click to expand */}
        <div
          className="flex items-center gap-3 flex-1 cursor-pointer no-drag"
          onClick={expandViewTier}
        >
          {phase === 'live' && (
            <>
              <span className="font-body text-sm font-medium text-txt-primary truncate flex-1">
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
        </div>
      </div>
      {showStrip && <MiniRundownStrip />}
    </motion.div>
  )
}
