import { useState, useEffect } from 'react'
import { useShowStore } from '../stores/showStore'
import { useSessionStore } from '../stores/sessionStore'
import { tryParseLineup } from '../lib/lineup-parser'
import { EnergySelector } from '../components/EnergySelector'
import { LineupPanel } from '../panels/LineupPanel'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'framer-motion'

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function WritersRoomView() {
  const energy = useShowStore((s) => s.energy)
  const writersRoomStep = useShowStore((s) => s.writersRoomStep)
  const acts = useShowStore((s) => s.acts)
  const setEnergy = useShowStore((s) => s.setEnergy)
  const setWritersRoomStep = useShowStore((s) => s.setWritersRoomStep)
  const setLineup = useShowStore((s) => s.setLineup)
  const triggerGoingLive = useShowStore((s) => s.triggerGoingLive)
  const writersRoomEnteredAt = useShowStore((s) => s.writersRoomEnteredAt)

  const sendMessage = useSessionStore((s) => s.sendMessage)
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)

  const [planText, setPlanText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // 20-minute nudge timer
  useEffect(() => {
    if (!writersRoomEnteredAt) return

    const check = () => {
      const elapsed = Date.now() - writersRoomEnteredAt
      if (elapsed > 20 * 60 * 1000) {
        setShowNudge(true)
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [writersRoomEnteredAt])

  const handleBuildLineup = () => {
    if (!planText.trim()) return
    setIsSubmitting(true)
    setError(null)

    const prompt = `You are Showtime, an ADHD-friendly day planner. The user has energy level "${energy}" and wants to plan their day. Based on their input below, create a show lineup.

Respond with a JSON block in this exact format:
\`\`\`showtime-lineup
{
  "acts": [
    { "name": "Task name", "sketch": "Deep Work", "durationMinutes": 45 }
  ],
  "beatThreshold": 3,
  "openingNote": "A brief encouraging note"
}
\`\`\`

Categories must be one of: "Deep Work", "Exercise", "Admin", "Creative", "Social"
Energy "${energy}" means: low=shorter acts, fewer total. medium=balanced. high=longer acts, more ambitious.

User's plan:
${planText}`

    sendMessage(prompt)
  }

  // Watch for Claude's response with lineup
  useEffect(() => {
    if (!isSubmitting) return

    const tab = tabs.find((t) => t.id === activeTabId)
    if (!tab) return

    const messages = tab.messages
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.toolName)

    if (lastAssistant) {
      const lineup = tryParseLineup(lastAssistant.content)
      if (lineup) {
        setLineup(lineup)
        setWritersRoomStep('lineup')
        setIsSubmitting(false)
        setError(null)
        return
      }
    }

    // Check for errors/completion without valid lineup
    if (tab.status === 'failed' || tab.status === 'dead') {
      setIsSubmitting(false)
      setError('Claude couldn\'t generate a lineup. Try again?')
      return
    }
  }, [tabs, activeTabId, isSubmitting, setLineup, setWritersRoomStep])

  // Timeout after 30 seconds
  useEffect(() => {
    if (!isSubmitting) return
    const timeout = setTimeout(() => {
      setIsSubmitting(false)
      setError('Took too long. Try again or edit your plan.')
    }, 30000)
    return () => clearTimeout(timeout)
  }, [isSubmitting])

  return (
    <div
      className="w-[560px] min-h-[680px] bg-surface rounded-xl overflow-hidden flex flex-col"
      data-clui-ui
    >
      {/* Title bar */}
      <div
        className="bg-[#151517] px-5 py-3 flex items-center border-b border-[#242428]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="font-mono text-xs tracking-widest uppercase text-txt-muted">
          SHOWTIME
        </span>
      </div>

      {/* Content */}
      <div className="px-8 py-8 flex-1 flex flex-col relative">
        {/* Spotlight gradient overlay */}
        <div className="absolute inset-0 pointer-events-none spotlight-warm" />

        <AnimatePresence mode="wait">
          {/* Step 1: Energy */}
          {writersRoomStep === 'energy' && (
            <motion.div
              key="energy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
            >
              <h2 className="font-body text-xl font-semibold text-txt-primary mb-6">
                How&apos;s your energy?
              </h2>
              <EnergySelector
                onSelect={(level) => {
                  setEnergy(level)
                  setWritersRoomStep('plan')
                }}
              />
            </motion.div>
          )}

          {/* Step 2: Plan Dump */}
          {writersRoomStep === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
            >
              <h2 className="font-body text-xl font-semibold text-txt-primary mb-2">
                What&apos;s on the schedule?
              </h2>
              <p className="text-sm text-txt-muted mb-6">
                Dump everything. Claude will organize it into tonight&apos;s lineup.
              </p>

              <div className="bg-notepad-bg border border-notepad-border rounded-lg p-4">
                <textarea
                  value={planText}
                  onChange={(e) => setPlanText(e.target.value)}
                  placeholder="meetings, tasks, errands, whatever..."
                  className="w-full h-[200px] resize-none bg-transparent font-body text-sm text-notepad-text placeholder:text-txt-muted focus:outline-none"
                  autoFocus
                />
              </div>

              <Button
                variant="accent"
                className="mt-4"
                disabled={isSubmitting || !planText.trim()}
                onClick={handleBuildLineup}
              >
                {isSubmitting ? 'Planning...' : 'Build my lineup'}
              </Button>

              {error && (
                <p className="text-xs text-onair mt-2">{error}</p>
              )}

              {showNudge && (
                <p className="text-xs text-txt-muted mt-4 animate-breathe">
                  Still writing? No rush — the show starts when you&apos;re ready.
                </p>
              )}
            </motion.div>
          )}

          {/* Step 3: Lineup Preview */}
          {writersRoomStep === 'lineup' && (
            <motion.div
              key="lineup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
            >
              <h2 className="font-body text-xl font-semibold text-txt-primary mb-6">
                Tonight&apos;s Lineup
              </h2>

              <LineupPanel variant="full" />

              <Button
                variant="primary"
                className="mt-8"
                onClick={() => triggerGoingLive()}
              >
                WE&apos;RE LIVE!
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
