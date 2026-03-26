import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

interface Conversation {
  role: 'user' | 'writer'
  text: string
}

interface LineupChatInputProps {
  onSend: (message: string) => void
  disabled: boolean
  conversations: Conversation[]
  hasLineup?: boolean
}

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function LineupChatInput({ onSend, disabled, conversations, hasLineup = true }: LineupChatInputProps) {
  const [text, setText] = useState('')

  const handleSubmit = () => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className="mt-4"
      data-testid="lineup-chat"
    >
      {/* Conversation history is rendered by WritersRoomView — not duplicated here */}

      {/* Input row */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={hasLineup
            ? (conversations.length > 1 ? 'Anything else to change?' : 'Tell the writers to change something...')
            : 'Reply to the writer...'
          }
          className="flex-1 rounded-lg bg-[#151517] border border-[#242428] px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent/50 disabled:opacity-50"
          data-testid="lineup-chat-input"
        />
        <button
          onClick={handleSubmit}
          disabled={disabled || !text.trim()}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-medium transition-colors',
            text.trim() && !disabled
              ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
              : 'bg-surface-hover text-txt-muted border border-[#242428]',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          data-testid="lineup-chat-send"
        >
          Send
        </button>
      </div>

      {/* Refining indicator */}
      {disabled && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={springTransition}
          className="mt-2 flex items-center gap-2"
        >
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-1" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-2" />
            <span className="w-1.5 h-1.5 rounded-full bg-accent writers-dot-3" />
          </div>
          <span className="text-xs text-txt-muted">Rewriting the lineup...</span>
        </motion.div>
      )}
    </motion.div>
  )
}
