import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const MESSAGES = [
  { text: 'Checking your calendar...', delay: 0 },
  { text: 'The writers are reading your schedule...', delay: 1000 },
  { text: "Drafting tonight's lineup...", delay: 3000 },
]

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

interface ProgressiveLoaderProps {
  active: boolean
}

export function ProgressiveLoader({ active }: ProgressiveLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    if (!active) {
      setMessageIndex(0)
      return
    }

    const timers: ReturnType<typeof setTimeout>[] = []

    for (let i = 1; i < MESSAGES.length; i++) {
      timers.push(
        setTimeout(() => setMessageIndex(i), MESSAGES[i].delay)
      )
    }

    return () => timers.forEach(clearTimeout)
  }, [active])

  if (!active) return null

  return (
    <div className="flex justify-start">
      <AnimatePresence mode="wait">
        <motion.div
          key={messageIndex}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={springTransition}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-hover/50 border border-card-border/50"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-1" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-2" />
          <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-3" />
          <span className="text-xs text-txt-muted ml-1">
            {MESSAGES[messageIndex].text}
          </span>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
