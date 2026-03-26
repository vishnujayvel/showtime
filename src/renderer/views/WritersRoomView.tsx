import { useState, useEffect, useRef } from 'react'
import { useShowStore } from '../stores/showStore'
import { useSessionStore } from '../stores/sessionStore'
import { tryParseLineup } from '../lib/lineup-parser'
import { tryParseCalendarEvents } from '../lib/calendar-parser'
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
  const calendarEvents = useShowStore((s) => s.calendarEvents)
  const calendarFetchStatus = useShowStore((s) => s.calendarFetchStatus)
  const setCalendarEvents = useShowStore((s) => s.setCalendarEvents)
  const setCalendarFetchStatus = useShowStore((s) => s.setCalendarFetchStatus)

  const sendMessage = useSessionStore((s) => s.sendMessage)
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)

  const [planText, setPlanText] = useState('')
  const [showNudge, setShowNudge] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const lineupStartRef = useRef<number | null>(null)
  const calendarFetchMsgCountRef = useRef<number | null>(null)

  // Unified conversation state (replaces separate refinementConversations + loading)
  const [writerConversations, setWriterConversations] = useState<Array<{ role: 'user' | 'writer'; text: string }>>([])
  const [isWaiting, setIsWaiting] = useState(false)
  const hasLineup = acts.length > 0

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

  // ─── Calendar Prefetch ───
  useEffect(() => {
    if (!calendarAvailable || calendarFetchStatus !== 'idle') return

    const tab = tabs.find((t) => t.id === activeTabId)
    if (!tab) return

    calendarFetchMsgCountRef.current = tab.messages.length
    setCalendarFetchStatus('fetching')

    const prompt = `List all of today's Google Calendar events as a JSON array.
Each event: {"title": "...", "start": "HH:MM", "end": "HH:MM", "allDay": false}.
If no calendar access or no events, return: []
Return ONLY the JSON array, nothing else.`

    sendMessage(prompt)
  }, [calendarAvailable, calendarFetchStatus, tabs, activeTabId, sendMessage, setCalendarFetchStatus])

  // Watch for calendar prefetch response
  useEffect(() => {
    if (calendarFetchStatus !== 'fetching') return
    if (calendarFetchMsgCountRef.current === null) return

    const tab = tabs.find((t) => t.id === activeTabId)
    if (!tab) return

    const newMessages = tab.messages.slice(calendarFetchMsgCountRef.current)
    const assistantMsg = newMessages.find((m) => m.role === 'assistant' && !m.toolName)

    if (assistantMsg) {
      const events = tryParseCalendarEvents(assistantMsg.content)
      if (events !== null) {
        setCalendarEvents(events)
        calendarFetchMsgCountRef.current = null
        return
      }
    }

    if (tab.status === 'completed' || tab.status === 'idle') {
      const hasNewAssistant = newMessages.some((m) => m.role === 'assistant' && !m.toolName)
      if (hasNewAssistant) {
        setCalendarFetchStatus('unavailable')
        calendarFetchMsgCountRef.current = null
      }
    }

    if (tab.status === 'failed' || tab.status === 'dead') {
      setCalendarFetchStatus('error')
      calendarFetchMsgCountRef.current = null
    }
  }, [tabs, activeTabId, calendarFetchStatus, setCalendarEvents, setCalendarFetchStatus])

  // ─── Build Lineup (first message in conversation) ───

  const handleBuildLineup = (overrideCalendar?: boolean) => {
    if (!planText.trim()) return
    setError(null)

    const useCalendar = overrideCalendar ?? calendarEnabled
    const calendarInstruction = useCalendar && calendarEvents.length > 0
      ? `Here are today's calendar events (already fetched):
${JSON.stringify(calendarEvents, null, 2)}
Incorporate these as acts in the lineup. Use event title as act name, event duration for planned duration.
Categorize: meetings/1:1s → "Admin", focus blocks → "Deep Work", gym → "Exercise", creative → "Creative", social → "Social".
Add "(from calendar)" to the sketch field for calendar-sourced acts.
Fill remaining time with tasks from the user's text input.

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

    // Add plan text as first user message and transition to conversation
    setWriterConversations([{ role: 'user', text: planText }])
    setIsWaiting(true)
    lineupStartRef.current = Date.now()
    setWritersRoomStep('conversation')
    sendMessage(prompt)
  }

  // ─── Watch for Claude's response (both initial and refinement) ───

  useEffect(() => {
    if (!isWaiting) return

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
        setWriterConversations((prev) => [...prev, { role: 'writer', text: 'Done \u2014 lineup updated.' }])
        setIsWaiting(false)
        setError(null)
        return
      }

      // Claude responded but no lineup — show what Claude said
      if (tab.status === 'completed' || tab.status === 'idle') {
        const writerText = lastAssistant.content.slice(0, 300)
        setWriterConversations((prev) => [...prev, { role: 'writer', text: writerText }])
        setIsWaiting(false)
        // No error — user can continue the conversation
        return
      }
    }

    if (tab.status === 'failed' || tab.status === 'dead') {
      setWriterConversations((prev) => [...prev, { role: 'writer', text: 'The writer stepped out. Try again?' }])
      setIsWaiting(false)
      setError('subprocess')
    }
  }, [tabs, activeTabId, isWaiting, setLineup])

  // ─── Conversation timeout ───

  useEffect(() => {
    if (!isWaiting) return

    const timeoutTimer = setTimeout(() => {
      setIsWaiting(false)
      setWriterConversations((prev) => [...prev, { role: 'writer', text: 'The writers need a coffee break. Try again?' }])
      setError('timeout')
    }, 30000)

    return () => clearTimeout(timeoutTimer)
  }, [isWaiting])

  // ─── Refinement (subsequent messages in conversation) ───

  const handleRefinement = (message: string) => {
    setWriterConversations((prev) => [...prev, { role: 'user', text: message }])
    setIsWaiting(true)

    const prompt = `The user wants to change the lineup: "${message}"

Respond with the complete updated lineup as a showtime-lineup JSON block.
Keep the same format as before. Only modify what the user asked for.`

    sendMessage(prompt)
  }

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
          &#10005;
        </button>
      </div>

      {/* Content */}
      <div className="px-8 py-8 flex-1 flex flex-col relative overflow-y-auto">
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
                Dump everything. Claude will organize it into {getTemporalShowLabel()} lineup.
              </p>

              {!calendarAvailable && <CalendarBanner />}
              {calendarAvailable && (
                <CalendarToggle
                  checked={calendarEnabled}
                  onChange={setCalendarEnabled}
                  fetchStatus={calendarFetchStatus}
                  eventCount={calendarEvents.length}
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
                onClick={() => handleBuildLineup()}
              >
                Build my lineup
              </Button>

              {showNudge && (
                <p className="text-xs text-txt-muted mt-4 animate-breathe">
                  Still writing? No rush — the show starts when you&apos;re ready.
                </p>
              )}
            </motion.div>
          )}

          {/* Step 3: Conversation (replaces old loading + lineup steps) */}
          {writersRoomStep === 'conversation' && (
            <motion.div
              key="conversation"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
              className="flex flex-col flex-1"
            >
              {/* Compact header with energy badge */}
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-body text-xl font-semibold text-txt-primary">
                    {hasLineup
                      ? `${getTemporalShowLabel().replace(/^./, (c: string) => c.toUpperCase())} Lineup`
                      : 'Building your lineup...'}
                  </h2>
                  {energy && (
                    <span className="text-xs text-txt-muted font-mono uppercase tracking-wider">
                      Energy: {energy}
                      {calendarEnabled && calendarEvents.length > 0 && (
                        <> &middot; {calendarEvents.length} calendar event{calendarEvents.length !== 1 ? 's' : ''}</>
                      )}
                    </span>
                  )}
                </div>
                {hasLineup && (
                  <span className="font-mono text-xs text-txt-muted">
                    {acts.length} ACT{acts.length !== 1 ? 'S' : ''}
                  </span>
                )}
              </div>

              {/* Lineup preview (appears when lineup exists) */}
              {hasLineup && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={springTransition}
                  className={isWaiting ? 'opacity-50' : ''}
                >
                  <LineupPanel variant="full" />
                </motion.div>
              )}

              {/* Conversation thread */}
              <div className="mt-4 border-t border-surface-hover pt-4 space-y-3" data-testid="writer-conversation">
                <AnimatePresence initial={false}>
                  {writerConversations.map((msg, i) => (
                    <motion.div
                      key={`conv-${i}-${msg.role}`}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                      className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`px-4 py-2.5 max-w-[85%] text-sm ${
                          msg.role === 'user'
                            ? 'bg-accent/10 border border-accent/20 rounded-xl rounded-br-sm text-txt-primary'
                            : 'bg-txt-secondary/[0.08] border border-txt-secondary/[0.12] rounded-xl rounded-bl-sm text-txt-secondary'
                        }`}
                      >
                        {msg.text}
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Writers typing indicator */}
                {isWaiting && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={springTransition}
                    className="flex justify-start"
                  >
                    <div className="bg-txt-secondary/[0.08] border border-txt-secondary/[0.12] rounded-xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
                      <span className="text-xs text-txt-secondary mr-1">The writers are revising</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-1" />
                      <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-2" />
                      <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-3" />
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Chat input for refinement / follow-up */}
              <LineupChatInput
                onSend={handleRefinement}
                disabled={isWaiting}
                conversations={writerConversations}
                hasLineup={hasLineup}
              />

              {/* "We're live!" button (only when lineup exists) */}
              {hasLineup && (
                <Button
                  variant="primary"
                  className="mt-6"
                  disabled={isWaiting}
                  onClick={() => triggerGoingLive()}
                >
                  WE&apos;RE LIVE!
                </Button>
              )}

              {/* Subprocess error — retry option */}
              {error === 'subprocess' && (
                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => {
                      setError(null)
                      setIsWaiting(true)
                      lineupStartRef.current = Date.now()
                      sendMessage(planText)
                    }}
                    className="text-xs text-accent hover:text-accent-dark underline"
                  >
                    Retry
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
