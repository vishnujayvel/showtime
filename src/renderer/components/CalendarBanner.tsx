import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function CalendarBanner() {
  const [dismissed, setDismissed] = useState(false)

  if (dismissed) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={springTransition}
        className="bg-blue-500/10 border border-blue-500/20 rounded-lg px-4 py-3 mb-4 flex items-start gap-3"
        data-testid="calendar-banner"
      >
        <span className="text-base leading-none mt-0.5" aria-hidden="true">
          📅
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-body text-txt-primary font-medium">
            Connect Google Calendar
          </p>
          <p className="text-xs text-txt-secondary mt-0.5">
            Add the Google Calendar MCP in Claude Code settings to auto-populate your lineup.
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-txt-muted hover:text-txt-secondary transition-colors text-sm shrink-0"
          aria-label="Dismiss calendar banner"
          data-testid="calendar-banner-dismiss"
        >
          ✕
        </button>
      </motion.div>
    </AnimatePresence>
  )
}
