import React, { useRef, useEffect, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { PaperPlaneRight } from '@phosphor-icons/react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useSessionStore } from '../stores/sessionStore'
import { useShowStore } from '../stores/showStore'
import { tryParseLineup } from '../lib/lineup-parser'

export function ChatPanel() {
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const setLineup = useShowStore((s) => s.setLineup)
  const phase = useShowStore((s) => s.phase)
  const energy = useShowStore((s) => s.energy)
  const acts = useShowStore((s) => s.acts)

  const tab = tabs.find((t) => t.id === activeTabId)
  const messages = tab?.messages || []
  const isRunning = tab?.status === 'running' || tab?.status === 'connecting'

  const scrollRef = useRef<HTMLDivElement>(null)
  const [input, setInput] = useState('')

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages.length])

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
    <div className="flex flex-col h-full border-r border-surface-hover">
      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 flex flex-col gap-2.5">
        {messages.filter((m) => m.role === 'user' || (m.role === 'assistant' && !m.toolName)).map((msg) => (
          <div
            key={msg.id}
            className={`max-w-[85%] px-3 py-2 rounded-xl text-[13px] leading-relaxed text-txt-primary border ${
              msg.role === 'user'
                ? 'self-end bg-cat-deep/10 border-cat-deep/20'
                : 'self-start bg-surface border-surface-hover'
            }`}
          >
            {msg.role === 'assistant' ? (
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content.replace(/```showtime-lineup[\s\S]*?```/g, '*(lineup received)*')}</ReactMarkdown>
            ) : (
              msg.content.replace(/^\[Showtime context:.*?\]\s*\n*User message:\s*/s, '')
            )}
          </div>
        ))}
        {isRunning && (
          <div className="text-xs text-txt-muted px-2 py-1">
            {tab?.currentActivity || 'Thinking...'}
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-2 px-3 border-t border-surface-hover flex gap-2 items-end">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Talk to Claude..."
          rows={1}
          className="flex-1 resize-none border border-surface-hover rounded-[10px] px-3 py-2 text-[13px] text-txt-primary bg-surface outline-none font-body max-h-20"
        />
        <motion.button
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleSend}
          disabled={!input.trim() || isRunning}
          className="w-8 h-8 rounded-lg border-none flex items-center justify-center bg-cat-deep disabled:bg-surface-hover disabled:cursor-default cursor-pointer"
        >
          <PaperPlaneRight size={16} weight="fill" color="#fff" />
        </motion.button>
      </div>
    </div>
  )
}
