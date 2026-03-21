import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { PaperPlaneRight } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSessionStore } from '../stores/sessionStore'
import { useShowStore } from '../stores/showStore'
import { useColors } from '../theme'
import type { ShowLineup } from '../../shared/types'

function tryParseLineup(text: string): ShowLineup | null {
  // Look for ```showtime-lineup JSON blocks
  const match = text.match(/```showtime-lineup\s*\n([\s\S]*?)```/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    if (parsed.acts && Array.isArray(parsed.acts) && typeof parsed.beatThreshold === 'number') {
      return parsed as ShowLineup
    }
  } catch {}
  return null
}

export function ChatPanel() {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const setLineup = useShowStore((s) => s.setLineup)
  const phase = useShowStore((s) => s.phase)
  const energy = useShowStore((s) => s.energy)
  const acts = useShowStore((s) => s.acts)
  const colors = useColors()

  const tab = tabs.find((t) => t.id === activeTabId)
  const messages = tab?.messages || []
  const isRunning = tab?.status === 'running' || tab?.status === 'connecting'

  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

  // Watch for lineup in assistant messages
  const lastProcessedRef = useRef<string>('')
  useEffect(() => {
    const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant' && !m.toolName)
    if (!lastAssistant || lastAssistant.id === lastProcessedRef.current) return

    const lineup = tryParseLineup(lastAssistant.content)
    if (lineup) {
      lastProcessedRef.current = lastAssistant.id
      setLineup(lineup)
    }
  }, [messages, setLineup])

  const handleSend = useCallback(() => {
    const trimmed = input.trim()
    if (!trimmed || isRunning) return

    // Inject show context as system prompt prefix
    const showContext = buildShowContext()
    const fullPrompt = showContext ? `${showContext}\n\nUser message: ${trimmed}` : trimmed
    sendMessage(fullPrompt)
    setInput('')
  }, [input, isRunning, sendMessage, energy, acts, phase])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function buildShowContext(): string {
    const parts: string[] = []
    if (phase) parts.push(`[Show phase: ${phase}]`)
    if (energy) parts.push(`[Energy: ${energy}]`)
    if (acts.length > 0) {
      const summary = acts.map((a) => `${a.name} (${a.status})`).join(', ')
      parts.push(`[Acts: ${summary}]`)
    }
    return parts.length > 0 ? `[Showtime context: ${parts.join(' ')}]` : ''
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', borderRight: `1px solid ${colors.border}` }}>
      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.toolName)).map((msg) => (
          <div
            key={msg.id}
            style={{
              alignSelf: msg.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '85%',
              padding: '8px 12px',
              borderRadius: 12,
              background: msg.role === 'user' ? '#8b5cf620' : colors.cardBg,
              border: `1px solid ${msg.role === 'user' ? '#8b5cf630' : colors.border}`,
              fontSize: 13,
              lineHeight: 1.5,
              color: colors.text,
            }}
          >
            {msg.role === 'assistant' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content.replace(/```showtime-lineup[\s\S]*?```/g, '*(lineup received)*')}</ReactMarkdown>
            ) : (
              // Strip show context prefix for display
              msg.content.replace(/^\[Showtime context:.*?\]\s*\n*User message:\s*/s, '')
            )}
          </div>
        ))}
        {isRunning && (
          <div style={{ fontSize: 12, color: colors.textTertiary, padding: '4px 8px' }}>
            {tab?.currentActivity || 'Thinking...'}
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{ padding: '8px 12px', borderTop: `1px solid ${colors.border}`, display: 'flex', gap: 8, alignItems: 'flex-end' }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Talk to Claude..."
          rows={1}
          style={{
            flex: 1,
            resize: 'none',
            border: `1px solid ${colors.border}`,
            borderRadius: 10,
            padding: '8px 12px',
            fontSize: 13,
            color: colors.text,
            background: colors.cardBg,
            outline: 'none',
            fontFamily: 'inherit',
            maxHeight: 80,
          }}
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!input.trim() || isRunning}
          style={{
            width: 32,
            height: 32,
            borderRadius: 8,
            border: 'none',
            background: input.trim() && !isRunning ? '#8b5cf6' : colors.border,
            cursor: input.trim() && !isRunning ? 'pointer' : 'default',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <PaperPlaneRight size={16} weight="fill" color="#fff" />
        </motion.button>
      </div>
    </div>
  )
}
