import { useState, useEffect, useRef, useCallback } from 'react'
import { useShowStore } from '../stores/showStore'
import { useSessionStore } from '../stores/sessionStore'
import { tryParseLineup } from '../lib/lineup-parser'
import { buildRefinementPrompt } from '../lib/refinement-prompt'
import { tryParseCalendarEvents } from '../lib/calendar-parser'
import { ChatMessage } from '../components/ChatMessage'
import { CalendarToggle } from '../components/CalendarToggle'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { formatDateLabel } from '../lib/utils'
import { cn } from '../lib/utils'
import type { EnergyLevel } from '../../shared/types'

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

const ENERGY_OPTIONS: { level: EnergyLevel; emoji: string; label: string }[] = [
  { level: 'high', emoji: '⚡', label: 'High' },
  { level: 'medium', emoji: '☀️', label: 'Medium' },
  { level: 'low', emoji: '🌙', label: 'Low' },
  { level: 'recovery', emoji: '🛋️', label: 'Recovery' },
]

export function WritersRoomView() {
  const energy = useShowStore((s) => s.energy)
  const acts = useShowStore((s) => s.acts)
  const setEnergy = useShowStore((s) => s.setEnergy)
  const setLineup = useShowStore((s) => s.setLineup)
  const triggerGoingLive = useShowStore((s) => s.triggerGoingLive)
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
      window.clui.recordMetricTiming('claude.lineup_generation', Date.now() - lineupStartRef.current)
      lineupStartRef.current = null
    }

    const oldActCount = acts.length
    if (oldActCount > 0) {
      window.clui.logEvent('INFO', 'claude.refinement_parsed', {
        oldActCount,
        newActCount: lineup.acts.length,
      })
    } else {
      window.clui.logEvent('INFO', 'claude.lineup_parsed', {
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
      window.clui.logEvent('INFO', 'claude.refinement_sent', {
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
            onClick={() => window.clui.quit()}
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
        {/* Empty state */}
        {messages.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springTransition}
            className="flex flex-col items-center justify-center h-full text-center"
          >
            <div className="spotlight-warm absolute inset-0 pointer-events-none" />
            <p className="text-txt-secondary text-sm mb-1">
              What&apos;s on the schedule?
            </p>
            <p className="text-txt-muted text-xs">
              Tell me about your day and I&apos;ll build your lineup.
            </p>
          </motion.div>
        )}

        {/* Messages */}
        {messages.map((msg) => (
          <ChatMessage key={msg.id} message={msg} />
        ))}

        {/* Activity indicator */}
        {isRunning && currentActivity && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={springTransition}
            className="flex justify-start"
          >
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-surface-hover/50 border border-card-border/50">
              <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-1" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-2" />
              <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-3" />
              <span className="text-xs text-txt-muted ml-1">{currentActivity}</span>
            </div>
          </motion.div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Footer: input + action buttons */}
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

          {/* Finalize Lineup — visible when lineup exists */}
          {hasLineup && (
            <Button
              variant="primary"
              className="flex-1"
              onClick={() => {
                window.clui.logEvent('INFO', 'go_live_clicked', { actCount: acts.length })
                triggerGoingLive()
              }}
              data-testid="go-live-btn"
            >
              Finalize Lineup
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
