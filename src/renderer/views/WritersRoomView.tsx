import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useShowContext, useShowSend } from '../machines/ShowMachineProvider'
import { useUIStore } from '../stores/uiStore'
import { useSessionStore } from '../stores/sessionStore'
import { tryParseLineup } from '../lib/lineup-parser'
import { buildRefinementPrompt } from '../lib/refinement-prompt'
import { tryParseCalendarEvents } from '../lib/calendar-parser'
import { ChatMessage } from '../components/ChatMessage'
import { ActCard } from '../components/ActCard'
import { CalendarToggle } from '../components/CalendarToggle'
import { ProgressiveLoader } from '../components/ProgressiveLoader'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDateLabel } from '../lib/utils'
import { cn } from '../lib/utils'
import type { EnergyLevel, ShowLineup } from '../../shared/types'

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

// ─── Time-of-day contextual prompts ───

export interface TimeOfDayPrompt {
  greeting: string
  sub: string
  period: 'morning' | 'midday' | 'late' | 'evening'
}

export function getTimeOfDayPrompt(hour?: number): TimeOfDayPrompt {
  const h = hour ?? new Date().getHours()
  if (h < 10) {
    return { greeting: "Fresh start! Let's build today's show.", sub: 'The morning is prime time.', period: 'morning' }
  }
  if (h < 14) {
    return { greeting: "Afternoon \u2014 here's what's left.", sub: 'Midday momentum.', period: 'midday' }
  }
  if (h < 18) {
    return { greeting: 'Evening wind-down.', sub: 'Focus on what matters most.', period: 'late' }
  }
  return { greeting: "Show's wrapping up.", sub: 'Strike or encore?', period: 'evening' }
}

// ─── Quick-start template definitions ───

export interface QuickStartTemplate {
  id: string
  label: string
  description: string
  available: boolean
}

export function getQuickStartTemplates(opts: {
  hasTodayShow: boolean
  hasYesterdayLineup: boolean
}): QuickStartTemplate[] {
  return [
    {
      id: 'resume',
      label: "Resume today's show",
      description: 'Pick up where you left off',
      available: opts.hasTodayShow,
    },
    {
      id: 'yesterday',
      label: 'Same lineup as yesterday',
      description: 'Repeat what worked',
      available: opts.hasYesterdayLineup,
    },
    {
      id: 'light',
      label: 'Light day',
      description: '2\u20133 gentle acts, low pressure',
      available: true,
    },
    {
      id: 'deep-focus',
      label: 'Deep focus day',
      description: 'Long deep work blocks, minimal switching',
      available: true,
    },
  ]
}

const ENERGY_OPTIONS: { level: EnergyLevel; emoji: string; label: string }[] = [
  { level: 'high', emoji: '⚡', label: 'High' },
  { level: 'medium', emoji: '☀️', label: 'Medium' },
  { level: 'low', emoji: '🌙', label: 'Low' },
  { level: 'recovery', emoji: '🛋️', label: 'Recovery' },
]

export function WritersRoomView() {
  const energy = useShowContext((ctx) => ctx.energy)
  const acts = useShowContext((ctx) => ctx.acts)
  const writersRoomStep = useShowContext((ctx) => ctx.writersRoomStep)
  const send = useShowSend()
  const setEnergy = useCallback((level: EnergyLevel) => send({ type: 'SET_ENERGY', level }), [send])
  const setLineup = useCallback((lineup: ShowLineup) => send({ type: 'SET_LINEUP', lineup }), [send])
  const triggerGoingLive = useCallback(() => send({ type: 'TRIGGER_GOING_LIVE' }), [send])
  const refineLineup = useCallback(() => send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' }), [send])
  const calendarAvailable = useUIStore((s) => s.calendarAvailable)
  const calendarEnabled = useUIStore((s) => s.calendarEnabled)
  const setCalendarEnabled = useUIStore((s) => s.setCalendarEnabled)
  const calendarEvents = useUIStore((s) => s.calendarEvents)
  const calendarFetchStatus = useUIStore((s) => s.calendarFetchStatus)
  const setCalendarEvents = useUIStore((s) => s.setCalendarEvents)
  const setCalendarFetchStatus = useUIStore((s) => s.setCalendarFetchStatus)

  const sendMessage = useSessionStore((s) => s.sendMessage)
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)

  const [chatInput, setChatInput] = useState('')
  const [energyPickerOpen, setEnergyPickerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const calendarFetchMsgCountRef = useRef<number | null>(null)
  const lineupStartRef = useRef<number | null>(null)
  const lastLineupHashRef = useRef<string | null>(null)

  const hasLineup = acts.length > 0
  const tab = tabs.find((t) => t.id === activeTabId)
  const messages = tab?.messages ?? []
  const isRunning = tab?.status === 'running' || tab?.status === 'connecting'
  const currentActivity = tab?.currentActivity ?? ''
  const timePrompt = useMemo(() => getTimeOfDayPrompt(), [])

  // Auto-scroll: scroll to bottom when near bottom (<60px threshold)
  const scrollToBottom = useCallback(() => {
    const container = messagesContainerRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 60
    if (isNearBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages.length, scrollToBottom])

  // Default energy to medium if not set
  useEffect(() => {
    if (!energy) setEnergy('medium')
  }, [energy, setEnergy])

  const tabReady = useSessionStore((s) => s.tabReady)

  // Calendar prefetch DISABLED in chat-first mode.
  // Claude fetches calendar directly via MCP tools when the user asks.

  // ─── Watch for lineup in assistant messages ───
  useEffect(() => {
    if (!tab) return
    const assistantMessages = tab.messages.filter((m) => m.role === 'assistant' && !m.toolName)
    if (assistantMessages.length === 0) return

    const lastAssistant = assistantMessages[assistantMessages.length - 1]
    const lineup = tryParseLineup(lastAssistant.content)
    if (!lineup) return

    // Dedupe: don't re-set the same lineup
    const hash = JSON.stringify(lineup.acts.map((a) => `${a.name}|${a.sketch}|${a.durationMinutes}`))
    if (hash === lastLineupHashRef.current) return
    lastLineupHashRef.current = hash

    const elapsed = lineupStartRef.current ? Date.now() - lineupStartRef.current : undefined
    if (lineupStartRef.current) {
      window.showtime.recordMetricTiming('claude.lineup_generation', Date.now() - lineupStartRef.current)
      lineupStartRef.current = null
    }

    const oldActCount = acts.length
    if (oldActCount > 0) {
      window.showtime.logEvent('INFO', 'claude.refinement_parsed', {
        oldActCount,
        newActCount: lineup.acts.length,
      })
    } else {
      window.showtime.logEvent('INFO', 'claude.lineup_parsed', {
        actCount: lineup.acts.length,
        ...(elapsed !== undefined ? { durationMs: elapsed } : {}),
      })
    }

    setLineup(lineup)
  }, [tab, acts.length, setLineup])

  // ─── Send chat message ───
  const handleSend = () => {
    const trimmed = chatInput.trim()
    if (!trimmed || isRunning) return
    setChatInput('')

    // If we have a lineup, wrap in refinement prompt but show only user's text
    if (hasLineup) {
      lineupStartRef.current = Date.now()
      const prompt = buildRefinementPrompt(trimmed, energy ?? 'medium', acts)
      window.showtime.logEvent('INFO', 'claude.refinement_sent', {
        messageText: trimmed.slice(0, 100),
      })
      sendMessage(prompt, undefined, trimmed)
    } else {
      sendMessage(trimmed)
    }
  }

  // ─── Build my lineup prompt ───
  const handleBuildLineup = () => {
    lineupStartRef.current = Date.now()

    const calendarInstruction = calendarEnabled && calendarEvents.length > 0
      ? `Here are today's calendar events (already fetched):
${JSON.stringify(calendarEvents, null, 2)}
Incorporate these as acts in the lineup. Use event title as act name, event duration for planned duration.
Categorize: meetings/1:1s → "Admin", focus blocks → "Deep Work", gym → "Exercise", creative → "Creative", social → "Social", therapy/doctor/self-care → "Personal".
Add "(from calendar)" to the sketch field for calendar-sourced acts.
Fill remaining time with tasks from the user's text input.

`
      : ''

    // Gather recent user messages as context for the lineup
    const recentUserMessages = messages
      .filter((m) => m.role === 'user')
      .slice(-5)
      .map((m) => m.content)
      .join('\n')

    // If user hasn't told us what they want to do yet, ask first (don't generate a default lineup)
    const hasUserContext = recentUserMessages.trim().length > 0

    const prompt = hasUserContext
      ? `You are Showtime, an ADHD-friendly day planner. The user has energy level "${energy ?? 'medium'}" and wants to plan their day.
${calendarInstruction}Based on the conversation so far, create a show lineup.

Respond with a \`\`\`showtime-lineup JSON block in this exact format:
\`\`\`showtime-lineup
{
  "acts": [
    { "name": "Task name", "sketch": "Deep Work", "durationMinutes": 45 }
  ],
  "beatThreshold": 3,
  "openingNote": "A brief encouraging note"
}
\`\`\`

Categories must be one of: "Deep Work", "Exercise", "Admin", "Creative", "Social", "Personal"
Energy "${energy ?? 'medium'}" means: low=shorter acts, fewer total. medium=balanced. high=longer acts, more ambitious.

Context from conversation:
${recentUserMessages}`
      : `You are Showtime, an ADHD-friendly day planner. The user has energy level "${energy ?? 'medium'}" and wants to plan their day.
${calendarInstruction}The user hasn't told you what they want to work on yet. Ask them what's on their plate today before creating a lineup. Be brief and encouraging — one or two sentences max. Do NOT generate a lineup yet.`

    sendMessage(prompt, undefined, hasUserContext ? '✨ Build my lineup' : '✨ What should we work on?')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="w-full h-full bg-surface overflow-hidden flex flex-col">
      {/* Title bar */}
      <div className="bg-titlebar px-5 py-3 flex items-center justify-between border-b border-surface-hover drag-region shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tracking-widest uppercase text-txt-muted">
            SHOWTIME
          </span>
          <span className="font-mono text-[10px] tracking-wider text-txt-muted/60" data-testid="date-label">
            {formatDateLabel()}
          </span>
        </div>

        <div className="flex items-center gap-3 no-drag">
          {/* Energy chip */}
          <div className="relative">
            <button
              onClick={() => setEnergyPickerOpen(!energyPickerOpen)}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-hover/60 border border-card-border text-xs text-txt-secondary hover:text-txt-primary transition-colors"
              data-testid="energy-chip"
            >
              <span>{ENERGY_OPTIONS.find((o) => o.level === energy)?.emoji ?? '☀️'}</span>
              <span className="font-mono uppercase tracking-wider text-[10px]">
                {energy ?? 'medium'}
              </span>
            </button>
            <AnimatePresence>
              {energyPickerOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={springTransition}
                  className="absolute z-20 top-full right-0 mt-1 bg-surface border border-card-border rounded-lg shadow-lg py-1 min-w-[120px]"
                >
                  {ENERGY_OPTIONS.map((opt) => (
                    <button
                      key={opt.level}
                      onClick={() => {
                        setEnergy(opt.level)
                        setEnergyPickerOpen(false)
                      }}
                      className={cn(
                        'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-surface-hover transition-colors',
                        energy === opt.level && 'bg-surface-hover',
                      )}
                    >
                      <span>{opt.emoji}</span>
                      <span className="text-txt-primary">{opt.label}</span>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Calendar toggle hidden in chat-first mode — Claude handles calendar via MCP */}

          {/* Close button */}
          <button
            onClick={() => window.showtime.quit()}
            className="text-txt-muted hover:text-onair transition-colors text-sm"
            title="Quit Showtime"
          >
            &#10005;
          </button>
        </div>
      </div>

      {/* Chat messages */}
      <div
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto px-6 py-4 space-y-3"
        data-testid="chat-messages"
      >
        {/* Empty state with time-of-day prompt and quick-start templates */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springTransition}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="spotlight-warm absolute inset-0 pointer-events-none" />
            <p className="text-txt-secondary text-sm mb-1" data-testid="time-of-day-greeting">
              {timePrompt.greeting}
            </p>
            <p className="text-txt-muted text-xs">
              {timePrompt.sub}
            </p>

            {/* Quick-start templates */}
            <div className="mt-6 flex flex-col gap-2 w-full max-w-xs" data-testid="quick-start-templates">
              <button
                onClick={() => {
                  sendMessage(`I want a light day — 2-3 gentle acts, low pressure. Energy: ${energy ?? 'low'}`)
                }}
                className="text-left px-3 py-2 rounded-lg border border-surface-hover/60 text-xs text-txt-secondary hover:text-txt-primary hover:border-accent/30 hover:bg-surface-hover/40 transition-colors"
                data-testid="template-light"
              >
                <span className="font-medium text-txt-primary">Light day</span>
                <span className="text-txt-muted ml-2">2–3 gentle acts, low pressure</span>
              </button>
              <button
                onClick={() => {
                  sendMessage(`I want a deep focus day — long deep work blocks, minimal context switching. Energy: ${energy ?? 'high'}`)
                }}
                className="text-left px-3 py-2 rounded-lg border border-surface-hover/60 text-xs text-txt-secondary hover:text-txt-primary hover:border-accent/30 hover:bg-surface-hover/40 transition-colors"
                data-testid="template-deep-focus"
              >
                <span className="font-medium text-txt-primary">Deep focus day</span>
                <span className="text-txt-muted ml-2">Long deep work blocks</span>
              </button>
            </div>
          </motion.div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Progressive loading indicator — timed messages while Claude works */}
        <ProgressiveLoader active={isRunning && !hasLineup} />

        <div ref={messagesEndRef} />
      </div>

      {/* Lineup preview — visible when acts parsed but not yet in lineup_ready */}
      {hasLineup && writersRoomStep !== 'lineup_ready' && (
        <div className="px-6 py-3 border-t border-surface-hover shrink-0" data-testid="lineup-preview">
          <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted mb-2 block">
            LINEUP
          </span>
          <div className="flex flex-col gap-2">
            {[...acts].sort((a, b) => a.order - b.order).map((act, index) => (
              <ActCard
                key={act.id}
                act={act}
                variant="full"
                actNumber={index + 1}
                onReorder={(direction) => send({ type: 'REORDER_ACT', actId: act.id, direction })}
                onRemove={() => send({ type: 'REMOVE_ACT', actId: act.id })}
              />
            ))}
          </div>
        </div>
      )}

      {/* Lineup confirmation panel — distinct UX when in lineup_ready step */}
      {hasLineup && writersRoomStep === 'lineup_ready' && (
        <div className="px-6 py-4 border-t border-accent/20 bg-surface shrink-0" data-testid="lineup-confirmation">
          <div className="flex items-center justify-between mb-3">
            <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-accent">
              CONFIRM LINEUP
            </span>
            <span className="text-[10px] text-txt-muted">
              {acts.length} act{acts.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
            {[...acts].sort((a, b) => a.order - b.order).map((act, index) => (
              <ActCard
                key={act.id}
                act={act}
                variant="full"
                actNumber={index + 1}
                onReorder={(direction) => send({ type: 'REORDER_ACT', actId: act.id, direction })}
                onRemove={() => send({ type: 'REMOVE_ACT', actId: act.id })}
              />
            ))}
          </div>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={refineLineup}
              className="px-4 py-2.5 rounded-lg border border-surface-hover text-sm text-txt-secondary hover:text-txt-primary hover:border-txt-muted transition-colors"
              data-testid="refine-lineup-btn"
            >
              Refine
            </button>
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                window.showtime.logEvent('INFO', 'go_live_clicked', { actCount: acts.length })
                triggerGoingLive()
              }}
              data-testid="confirm-go-live-btn"
            >
              Confirm & Go Live
            </Button>
          </div>
        </div>
      )}

      {/* Footer: input + action buttons (hidden during lineup confirmation) */}
      {writersRoomStep !== 'lineup_ready' && (
        <div className="px-6 py-4 border-t border-surface-hover shrink-0">
          {/* Chat input */}
          <div className="flex items-end gap-2">
            <textarea
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                hasLineup
                  ? 'Tell the writers to change something...'
                  : 'What do you want to accomplish today?'
              }
              rows={1}
              className="flex-1 resize-none rounded-lg bg-titlebar border border-surface-hover px-3 py-2.5 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent/50 disabled:opacity-50"
              data-testid="chat-input"
            />
            <button
              onClick={handleSend}
              disabled={!chatInput.trim()}
              className={cn(
                'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors shrink-0',
                chatInput.trim()
                  ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
                  : 'bg-surface-hover text-txt-muted border border-surface-hover',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              )}
              data-testid="chat-send"
            >
              Send
            </button>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 mt-3">
            {/* BUILD MY LINEUP — visible when no lineup */}
            {!hasLineup && (
              <button
                onClick={handleBuildLineup}
                disabled={false}
                className="flex-1 py-2.5 rounded-lg border-2 border-dashed border-accent/30 text-sm text-accent font-medium hover:border-accent/50 hover:bg-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                data-testid="build-lineup-btn"
              >
                BUILD MY LINEUP
              </button>
            )}

            {/* Finalize Lineup — visible when lineup exists but not in confirmation step */}
            {hasLineup && (
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => {
                  window.showtime.logEvent('INFO', 'go_live_clicked', { actCount: acts.length })
                  triggerGoingLive()
                }}
                data-testid="go-live-btn"
              >
                Finalize Lineup
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
