import { useState, useEffect, useRef } from 'react'
import { useShowStore } from '../stores/showStore'
import { useSessionStore } from '../stores/sessionStore'
import { tryParseLineup } from '../lib/lineup-parser'
import { EnergySelector } from '../components/EnergySelector'
import { CalendarBanner } from '../components/CalendarBanner'
import { CalendarToggle } from '../components/CalendarToggle'
import { LineupChatInput } from '../components/LineupChatInput'
import { LineupPanel } from '../panels/LineupPanel'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDateLabel, getTemporalShowLabel } from '../lib/utils'

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
  const calendarAvailable = useShowStore((s) => s.calendarAvailable)
  const calendarEnabled = useShowStore((s) => s.calendarEnabled)
  const setCalendarEnabled = useShowStore((s) => s.setCalendarEnabled)

  const sendMessage = useSessionStore((s) => s.sendMessage)
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)

  const [planText, setPlanText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNudge, setShowNudge] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadingPhase, setLoadingPhase] = useState<'initial' | 'extended' | 'timeout'>('initial')
  const lineupStartRef = useRef<number | null>(null)
  const [refinementConversations, setRefinementConversations] = useState<Array<{ role: 'user' | 'writer'; text: string }>>([])
  const [isRefining, setIsRefining] = useState(false)

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

    const calendarInstruction = calendarEnabled && calendarAvailable
      ? `IMPORTANT: First, check the user's Google Calendar for today's events using your calendar tools.
Incorporate calendar events as acts in the lineup.
For calendar events: use event title as act name, event duration as planned duration.
Categorize: meetings/1:1s → "Admin", focus blocks → "Deep Work", gym → "Exercise", creative → "Creative", social → "Social".
Add "(from calendar)" to the sketch field for calendar-sourced acts.
Fill gaps with tasks appropriate for the energy level.

`
      : ''

    const prompt = `You are Showtime, an ADHD-friendly day planner. The user has energy level "${energy}" and wants to plan their day.
${calendarInstruction}Based on their input below, create a show lineup.

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

    lineupStartRef.current = Date.now()
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
        if (lineupStartRef.current) {
          window.clui.recordMetricTiming('claude.lineup_generation', Date.now() - lineupStartRef.current)
          lineupStartRef.current = null
        }
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

  // Loading phase progression: initial → extended (10s) → timeout (30s)
  useEffect(() => {
    if (!isSubmitting) {
      setLoadingPhase('initial')
      return
    }

    const extendedTimer = setTimeout(() => setLoadingPhase('extended'), 10000)
    const timeoutTimer = setTimeout(() => {
      setLoadingPhase('timeout')
      setIsSubmitting(false)
      setError('The writers need a coffee break. Try again?')
    }, 30000)

    return () => {
      clearTimeout(extendedTimer)
      clearTimeout(timeoutTimer)
    }
  }, [isSubmitting])

  // ─── Lineup Refinement ───

  const handleRefinement = (message: string) => {
    setRefinementConversations((prev) => [...prev, { role: 'user', text: message }])
    setIsRefining(true)

    const prompt = `The user wants to change the lineup: "${message}"

Respond with the complete updated lineup as a showtime-lineup JSON block.
Keep the same format as before. Only modify what the user asked for.`

    sendMessage(prompt)
  }

  // Watch for refined lineup response
  useEffect(() => {
    if (!isRefining) return

    const tab = tabs.find((t) => t.id === activeTabId)
    if (!tab) return

    const messages = tab.messages
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.toolName)

    if (lastAssistant) {
      const lineup = tryParseLineup(lastAssistant.content)
      if (lineup) {
        setLineup(lineup)
        setRefinementConversations((prev) => [...prev, { role: 'writer', text: 'Done \u2014 lineup updated.' }])
        setIsRefining(false)
        return
      }

      // No lineup in response — show as clarification
      if (tab.status === 'completed' || tab.status === 'idle') {
        const writerText = lastAssistant.content.slice(0, 200)
        setRefinementConversations((prev) => [...prev, { role: 'writer', text: writerText }])
        setIsRefining(false)
      }
    }

    if (tab.status === 'failed' || tab.status === 'dead') {
      setRefinementConversations((prev) => [...prev, { role: 'writer', text: 'Something went wrong. Try again?' }])
      setIsRefining(false)
    }
  }, [tabs, activeTabId, isRefining, setLineup])

  return (
    <div
      className="w-full h-full bg-surface overflow-hidden flex flex-col"
    >
      {/* Title bar */}
      <div
        className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428] drag-region"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tracking-widest uppercase text-txt-muted">
            SHOWTIME
          </span>
          <span className="font-mono text-[10px] tracking-wider text-txt-muted/60" data-testid="date-label">
            {formatDateLabel()}
          </span>
        </div>
        <button
          onClick={() => window.clui.quit()}
          className="text-txt-muted hover:text-onair transition-colors text-sm no-drag"
          title="Quit Showtime"
        >
          ✕
        </button>
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

          {/* Step 2: Plan Dump / Loading Overlay */}
          {writersRoomStep === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
            >
              <AnimatePresence mode="wait">
                {isSubmitting ? (
                  <motion.div
                    key="loading"
                    className="flex flex-col items-center justify-center py-20 relative"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={springTransition}
                  >
                    {/* Spotlight sweep background */}
                    <div className="absolute inset-0 spotlight-sweep rounded-lg" />

                    <p className="font-body text-lg text-txt-secondary mb-4 relative z-10">
                      {loadingPhase === 'extended'
                        ? 'Still writing... almost there'
                        : 'The writers are working...'}
                    </p>

                    {/* Pulsing dots */}
                    <div className="flex gap-2 relative z-10">
                      <span className="w-2 h-2 rounded-full bg-accent writers-dot-1" />
                      <span className="w-2 h-2 rounded-full bg-accent writers-dot-2" />
                      <span className="w-2 h-2 rounded-full bg-accent writers-dot-3" />
                    </div>
                  </motion.div>
                ) : (
                  <motion.div
                    key="form"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={springTransition}
                  >
                    <h2 className="font-body text-xl font-semibold text-txt-primary mb-2">
                      What&apos;s on the schedule?
                    </h2>
                    <p className="text-sm text-txt-muted mb-6">
                      Dump everything. Claude will organize it into {getTemporalShowLabel()} lineup.
                    </p>

                    {!calendarAvailable && <CalendarBanner />}
                    {calendarAvailable && (
                      <CalendarToggle
                        checked={calendarEnabled}
                        onChange={setCalendarEnabled}
                      />
                    )}

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
                      disabled={!planText.trim()}
                      onClick={handleBuildLineup}
                    >
                      Build my lineup
                    </Button>

                    {error && (
                      <div className="flex items-center gap-2 mt-2">
                        <p className="text-xs text-onair">{error}</p>
                        <button
                          onClick={handleBuildLineup}
                          className="text-xs text-accent hover:text-accent-dark underline"
                        >
                          Try again
                        </button>
                      </div>
                    )}

                    {showNudge && (
                      <p className="text-xs text-txt-muted mt-4 animate-breathe">
                        Still writing? No rush — the show starts when you&apos;re ready.
                      </p>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
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
                {getTemporalShowLabel().replace(/^./, c => c.toUpperCase())} Lineup
              </h2>

              <LineupPanel variant="full" />

              {/* Refinement chat */}
              <LineupChatInput
                onSend={handleRefinement}
                disabled={isRefining}
                conversations={refinementConversations}
              />

              <Button
                variant="primary"
                className="mt-6"
                disabled={isRefining}
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
