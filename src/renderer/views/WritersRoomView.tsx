import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useShowContext, useShowSend } from '../machines/ShowMachineProvider'
import { useUIStore } from '../stores/uiStore'
import { useSessionStore } from '../stores/sessionStore'
import { tryParseLineup } from '../lib/lineup-parser'
import { buildRefinementPrompt } from '../lib/refinement-prompt'
import { ChatMessage } from '../components/ChatMessage'
import { EnergyPicker } from '../components/EnergyPicker'
import { LineupDraftPreview, LineupConfirmation } from '../components/LineupPreview'
import { ChatInput } from '../components/ChatInput'
import { Toolbar } from '../components/Toolbar'
import { ProgressiveLoader } from '../components/ProgressiveLoader'
import { motion } from 'framer-motion'
import { formatDateLabel } from '../lib/utils'
import type { Act, EnergyLevel, ShowLineup } from '../../shared/types'

import { springDefault as springTransition } from '../constants/animations'

// ─── Time-of-day contextual prompts ───

/** Greeting and sub-text tailored to the current time of day. */
export interface TimeOfDayPrompt {
  greeting: string
  sub: string
  period: 'morning' | 'midday' | 'late' | 'evening'
}

/** Return a contextual greeting and subtitle based on the current hour of the day. */
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

/** Definition for a quick-start template button in the Writer's Room empty state. */
export interface QuickStartTemplate {
  id: string
  label: string
  description: string
  available: boolean
}

/** Build the list of quick-start template options based on existing show and lineup state. */
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

/** Chat-driven planning view where the user collaborates with Claude to build the day's lineup. */
export function WritersRoomView() {
  const energy = useShowContext((ctx) => ctx.energy)
  const acts = useShowContext((ctx) => ctx.acts)
  const writersRoomStep = useShowContext((ctx) => ctx.writersRoomStep)
  const lineupStatus = useShowContext((ctx) => ctx.lineupStatus)
  const editingMidShow = useShowContext((ctx) => ctx.editingMidShow)
  const timerPausedRemaining = useShowContext((ctx) => ctx.timerPausedRemaining)
  const send = useShowSend()
  const setEnergy = useCallback((level: EnergyLevel) => send({ type: 'SET_ENERGY', level }), [send])
  const setLineup = useCallback((lineup: ShowLineup) => send({ type: 'SET_LINEUP', lineup }), [send])
  const finalizeLineup = useCallback(() => send({ type: 'FINALIZE_LINEUP' }), [send])
  const triggerGoingLive = useCallback(() => send({ type: 'TRIGGER_GOING_LIVE' }), [send])
  const refineLineup = useCallback(() => send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' }), [send])
  const confirmLineupEdit = useCallback(() => send({ type: 'CONFIRM_LINEUP_EDIT', acts }), [send, acts])
  const calendarEnabled = useUIStore((s) => s.calendarEnabled)
  const calendarEvents = useUIStore((s) => s.calendarEvents)

  const sendMessage = useSessionStore((s) => s.sendMessage)
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)

  const [chatInput, setChatInput] = useState('')
  const [energyPickerOpen, setEnergyPickerOpen] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const lineupStartRef = useRef<number | null>(null)
  const lastLineupHashRef = useRef<string | null>(null)

  const hasLineup = acts.length > 0
  const tab = tabs.find((t) => t.id === activeTabId)
  const messages = tab?.messages ?? []
  const isRunning = tab?.status === 'running' || tab?.status === 'connecting'
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

  // Default energy to medium if not set (mount-only — deps would reset on every XState cycle)
  useEffect(() => {
    if (!energy) setEnergy('medium')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pre-warm Claude subprocess when Writer's Room mounts
  useEffect(() => {
    window.showtime.prewarmSubprocess()
  }, [])

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
      sendMessage(prompt, { displayText: trimmed })
    } else {
      sendMessage(trimmed)
    }
  }

  // ─── Build my lineup prompt ───
  const handleBuildLineup = () => {
    lineupStartRef.current = Date.now()

    const calendarContext = calendarEnabled && calendarEvents.length > 0
      ? `\nToday's calendar events:\n${JSON.stringify(calendarEvents, null, 2)}\n`
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
      ? `Plan my day. Energy: ${energy ?? 'medium'}.${calendarContext}\nHere's what I want to work on:\n${recentUserMessages}`
      : `I want to plan my day. Energy: ${energy ?? 'medium'}.${calendarContext}\nWhat should I work on?`

    sendMessage(prompt, {
      displayText: hasUserContext ? '✨ Build my lineup' : '✨ What should we work on?',
      maxTurns: hasUserContext ? 3 : undefined,
    })
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
          <EnergyPicker
            energy={energy}
            open={energyPickerOpen}
            onToggle={() => setEnergyPickerOpen(!energyPickerOpen)}
            onSelect={(level) => {
              setEnergy(level)
              setEnergyPickerOpen(false)
            }}
          />

          <Toolbar />
        </div>
      </div>

      {/* Mid-show editing banner */}
      {editingMidShow && (
        <div className="px-5 py-2.5 bg-accent/10 border-b border-accent/20 flex items-center justify-between shrink-0" data-testid="mid-show-edit-banner">
          <div className="flex items-center gap-2">
            <span className="text-sm text-accent font-medium">✏️ Editing Lineup — Show Paused</span>
            {timerPausedRemaining != null && (
              <span className="font-mono text-xs text-txt-muted">
                Timer paused at {Math.floor(timerPausedRemaining / 60000)}:{String(Math.floor((timerPausedRemaining % 60000) / 1000)).padStart(2, '0')}
              </span>
            )}
          </div>
        </div>
      )}

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
        <LineupDraftPreview
          acts={acts}
          onReorder={(actId, direction) => send({ type: 'REORDER_ACT', actId, direction })}
          onRemove={(actId) => send({ type: 'REMOVE_ACT', actId })}
          onUpdateName={(actId, name) => send({ type: 'UPDATE_ACT', actId, name })}
          onUpdateDuration={(actId, durationMinutes) => send({ type: 'UPDATE_ACT', actId, durationMinutes })}
        />
      )}

      {/* Lineup confirmation panel — distinct UX when in lineup_ready step */}
      {hasLineup && writersRoomStep === 'lineup_ready' && (
        <LineupConfirmation
          acts={acts}
          writersRoomStep={writersRoomStep}
          lineupStatus={lineupStatus}
          editingMidShow={editingMidShow}
          chatInput={chatInput}
          onChatInputChange={setChatInput}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
          onReorder={(actId, direction) => send({ type: 'REORDER_ACT', actId, direction })}
          onRemove={(actId) => send({ type: 'REMOVE_ACT', actId })}
          onUpdateName={(actId, name) => send({ type: 'UPDATE_ACT', actId, name })}
          onUpdateDuration={(actId, durationMinutes) => send({ type: 'UPDATE_ACT', actId, durationMinutes })}
          onAddAct={() => send({ type: 'ADD_ACT', name: 'New Act', sketch: 'deep-work', durationMinutes: 25 })}
          onRefine={refineLineup}
          onFinalize={finalizeLineup}
          onGoLive={triggerGoingLive}
          onConfirmEdit={confirmLineupEdit}
        />
      )}

      {/* Footer: input + action buttons (hidden during lineup confirmation) */}
      {writersRoomStep !== 'lineup_ready' && (
        <ChatInput
          chatInput={chatInput}
          hasLineup={hasLineup}
          editingMidShow={editingMidShow}
          actCount={acts.length}
          onChatInputChange={setChatInput}
          onKeyDown={handleKeyDown}
          onSend={handleSend}
          onBuildLineup={handleBuildLineup}
          onFinalize={finalizeLineup}
          onConfirmEdit={confirmLineupEdit}
        />
      )}
    </div>
  )
}
