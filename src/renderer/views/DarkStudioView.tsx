import { useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useShowSend } from '../machines/ShowMachineProvider'
import { Button } from '../ui/button'

const PERSIST_KEY = 'showtime-show-state'

interface PersistedShowInfo {
  phase: string
  actCount: number
  completedCount: number
  isStrike: boolean
}

/** Check localStorage for today's persisted show state */
export function getTodayPersistedShow(): PersistedShowInfo | null {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return null
    const { context } = JSON.parse(raw)
    if (!context) return null
    const today = new Date().toISOString().slice(0, 10)
    if (context.showDate !== today) return null

    const acts = context.acts ?? []
    const completedCount = acts.filter((a: { status: string }) =>
      a.status === 'completed'
    ).length

    // Determine phase from the persisted state
    const phase = context.verdict ? 'strike' : (acts.some((a: { status: string }) => a.status === 'active') ? 'live' : 'writers_room')

    return {
      phase,
      actCount: acts.length,
      completedCount,
      isStrike: !!context.verdict,
    }
  } catch {
    return null
  }
}

function getTemporalGreeting(hasShow: boolean): { heading: string; sub: string } {
  const hour = new Date().getHours()

  if (hasShow) {
    if (hour < 12) return { heading: "Your show is waiting.", sub: 'Pick up where you left off.' }
    if (hour < 18) return { heading: "The show must go on.", sub: 'Resume your lineup and keep the momentum.' }
    return { heading: "Tonight's show has a history.", sub: 'Review or wrap up.' }
  }

  if (hour < 12) {
    return {
      heading: "Today's show hasn't been written yet.",
      sub: 'The morning stage is yours.',
    }
  }
  if (hour < 18) {
    return {
      heading: "Today's show hasn't been written yet.",
      sub: 'There\u2019s still time to make it a great one.',
    }
  }
  return {
    heading: "Tomorrow's show hasn't been written yet.",
    sub: 'Plan ahead — the best shows are written the night before.',
  }
}

interface DarkStudioViewProps {
  onShowHistory?: () => void
}

export function DarkStudioView({ onShowHistory }: DarkStudioViewProps) {
  const send = useShowSend()
  const triggerColdOpen = useCallback(() => send({ type: 'TRIGGER_COLD_OPEN' }), [send])
  const todayShow = useMemo(getTodayPersistedShow, [])
  const greeting = useMemo(() => getTemporalGreeting(!!todayShow), [todayShow])

  // Pre-warm Claude subprocess for faster Writer's Room startup
  useEffect(() => {
    window.clui.prewarmSubprocess()
  }, [])

  const handleResumeShow = useCallback(() => {
    // ENTER_WRITERS_ROOM will hydrate from localStorage (showActor already does this)
    // The persisted snapshot is already loaded by showActor on app start
    // Just trigger the cold open which transitions to writers_room
    send({ type: 'TRIGGER_COLD_OPEN' })
  }, [send])

  return (
    <div
      className="w-full h-full bg-studio-bg flex flex-col items-center justify-center relative"
    >
      {/* Invisible drag handle */}
      <div className="absolute top-0 left-0 right-0 h-8 drag-region" />

      {/* Spotlight overlay */}
      <div className="absolute inset-0 pointer-events-none spotlight-accent" />

      <motion.div
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      >
        <h1 className="font-body text-2xl font-light text-txt-primary tracking-tight">
          {greeting.heading}
        </h1>
        <p className="font-body text-sm text-txt-muted mt-3">
          {greeting.sub}
        </p>

        {/* Show summary when resuming */}
        {todayShow && !todayShow.isStrike && (
          <motion.p
            className="font-mono text-xs text-txt-secondary mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.6 }}
            data-testid="resume-summary"
          >
            {todayShow.completedCount}/{todayShow.actCount} acts done
            {todayShow.phase === 'live' && ' — show in progress'}
          </motion.p>
        )}

        {todayShow && todayShow.isStrike && (
          <motion.p
            className="font-mono text-xs text-beat mt-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.6 }}
            data-testid="strike-summary"
          >
            Show complete — {todayShow.completedCount} acts wrapped
          </motion.p>
        )}

        <motion.div
          className="mt-8 flex items-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 1.2 }}
        >
          {todayShow && !todayShow.isStrike ? (
            <Button variant="accent" onClick={handleResumeShow} data-testid="resume-show-btn">
              Resume Today&apos;s Show
            </Button>
          ) : (
            <Button variant="accent" onClick={triggerColdOpen} data-testid="enter-writers-room">
              Enter the Writer&apos;s Room
            </Button>
          )}
          {onShowHistory && (
            <Button variant="ghost_muted" onClick={onShowHistory}>
              Past Shows
            </Button>
          )}
        </motion.div>
      </motion.div>
    </div>
  )
}
