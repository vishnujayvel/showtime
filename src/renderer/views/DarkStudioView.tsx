import { useEffect, useMemo, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useShowSend } from '../machines/ShowMachineProvider'
import { Button } from '../ui/button'

function getTemporalGreeting(): { heading: string; sub: string } {
  const hour = new Date().getHours()
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
  const greeting = useMemo(getTemporalGreeting, [])

  // Pre-warm Claude subprocess for faster Writer's Room startup
  useEffect(() => {
    window.clui.prewarmSubprocess()
  }, [])

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

        <motion.div
          className="mt-8 flex items-center gap-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 1.2 }}
        >
          <Button variant="accent" onClick={triggerColdOpen} data-testid="enter-writers-room">
            Enter the Writer&apos;s Room
          </Button>
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
