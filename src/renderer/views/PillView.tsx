import React from 'react'
import { motion } from 'framer-motion'
import { useShowStore, selectCurrentAct } from '../stores/showStore'
import { useTimer } from '../hooks/useTimer'
import { TallyLight } from '../components/TallyLight'
import { BeatCounter } from '../components/BeatCounter'
import { cn } from '../lib/utils'

export function PillView() {
  const phase = useShowStore((s) => s.phase)
  const toggleExpanded = useShowStore((s) => s.toggleExpanded)
  const currentAct = useShowStore(selectCurrentAct)
  const beatsLocked = useShowStore((s) => s.beatsLocked)
  const beatThreshold = useShowStore((s) => s.beatThreshold)
  const { minutes, seconds, isRunning } = useTimer()

  const isUrgent = minutes < 5 && isRunning

  const timerText = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`

  let content: React.ReactNode

  if (phase === 'live') {
    content = (
      <>
        <TallyLight isLive={true} size="lg" />
        <span className="font-body text-sm font-medium text-txt-primary truncate flex-1">
          {currentAct?.name}
        </span>
        <span
          className={cn(
            'font-mono text-sm font-semibold tabular-nums',
            isUrgent ? 'text-beat animate-warm-pulse' : 'text-txt-primary'
          )}
        >
          {timerText}
        </span>
        <BeatCounter size="sm" />
      </>
    )
  } else if (phase === 'intermission') {
    content = (
      <>
        <TallyLight isLive={false} />
        <span className="font-body text-sm text-txt-secondary flex-1">
          Intermission
        </span>
        <span className="font-body text-xs text-txt-muted">
          no rush
        </span>
      </>
    )
  } else if (phase === 'strike') {
    content = (
      <>
        <span className="font-body text-sm text-txt-primary flex-1 animate-golden-glow">
          Show complete!
        </span>
        <BeatCounter size="sm" />
      </>
    )
  }

  return (
    <motion.div
      className={cn(
        'w-80 h-12 rounded-full flex items-center gap-3 py-2.5 px-4',
        'bg-surface/85 backdrop-blur-[20px]',
        'border border-white/[0.06]',
        'shadow-[0_8px_32px_rgba(0,0,0,0.4)]',
        'cursor-pointer select-none'
      )}
      onClick={toggleExpanded}
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.8, opacity: 0 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
    >
      {content}
    </motion.div>
  )
}
