import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { motion } from 'framer-motion'
import { LineupCard } from './LineupCard'
import { tryParseLineup } from '../lib/lineup-parser'
import { useShowStore } from '../stores/showStore'
import { cn } from '../lib/utils'
import type { Message, ShowLineup } from '../../shared/types'
import type { Components } from 'react-markdown'

const springTransition = { type: 'spring' as const, stiffness: 400, damping: 30 }

function ToolIndicator({ message }: { message: Message }) {
  const isRunning = message.toolStatus === 'running'
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={springTransition}
      className="flex items-center gap-2 py-1.5 px-3 text-xs text-txt-muted"
      data-testid="tool-indicator"
    >
      {isRunning ? (
        <span className="w-3 h-3 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
      ) : (
        <span className="text-cat-exercise">✓</span>
      )}
      <span className="font-mono">{message.toolName}</span>
      {isRunning && <span className="text-txt-muted/60">running...</span>}
    </motion.div>
  )
}

function SystemMessage({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={springTransition}
      className="text-center py-2"
    >
      <span className="text-xs text-txt-muted italic">{message.content}</span>
    </motion.div>
  )
}

function UserBubble({ message }: { message: Message }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className="flex justify-end"
    >
      <div className="px-4 py-2.5 max-w-[85%] text-sm bg-surface-hover rounded-xl rounded-br-sm text-txt-primary">
        {message.content}
      </div>
    </motion.div>
  )
}

function AssistantBubble({ message }: { message: Message }) {
  const setLineup = useShowStore((s) => s.setLineup)

  const handleLineupEdit = (updated: ShowLineup) => {
    setLineup(updated)
  }

  const components: Components = {
    code: ({ className, children }) => {
      if (className === 'language-showtime-lineup') {
        const raw = String(children).trim()
        try {
          const json = JSON.parse(raw)
          if (json.acts && typeof json.beatThreshold === 'number') {
            return <LineupCard lineup={json} onEdit={handleLineupEdit} />
          }
        } catch {
          // Fall through to default rendering
        }
      }
      return (
        <code className={cn('bg-studio-bg rounded px-1.5 py-0.5 text-xs font-mono', className)}>
          {children}
        </code>
      )
    },
    pre: ({ children }) => (
      <pre className="bg-studio-bg rounded-lg p-3 overflow-x-auto text-sm my-2">
        {children}
      </pre>
    ),
    a: ({ href, children }) => (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-accent underline hover:text-accent-dark transition-colors cursor-pointer"
      >
        {children}
      </a>
    ),
    p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
    ul: ({ children }) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
    ol: ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
    h1: ({ children }) => <h1 className="text-lg font-semibold mb-2">{children}</h1>,
    h2: ({ children }) => <h2 className="text-base font-semibold mb-1.5">{children}</h2>,
    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1">{children}</h3>,
    blockquote: ({ children }) => (
      <blockquote className="border-l-2 border-accent/40 pl-3 text-txt-secondary italic my-2">
        {children}
      </blockquote>
    ),
    table: ({ children }) => (
      <div className="overflow-x-auto my-2">
        <table className="text-xs border-collapse w-full">{children}</table>
      </div>
    ),
    th: ({ children }) => (
      <th className="border border-card-border px-2 py-1 text-left font-semibold bg-surface-hover">
        {children}
      </th>
    ),
    td: ({ children }) => (
      <td className="border border-card-border px-2 py-1">{children}</td>
    ),
  }

  // Also check for lineup in the raw content — the parser supports fenced and bare JSON
  const parsedLineup = tryParseLineup(message.content)
  const hasInlineLineup = message.content.includes('```showtime-lineup')

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className="flex justify-start"
    >
      <div className="max-w-[90%] text-sm text-txt-primary" data-testid="assistant-message">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
          {message.content}
        </ReactMarkdown>

        {/* Fallback: if lineup was found by parser but not via fenced block, render card */}
        {parsedLineup && !hasInlineLineup && (
          <LineupCard lineup={parsedLineup} onEdit={handleLineupEdit} />
        )}
      </div>
    </motion.div>
  )
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  switch (message.role) {
    case 'user':
      return <UserBubble message={message} />
    case 'assistant':
      return message.toolName ? <ToolIndicator message={message} /> : <AssistantBubble message={message} />
    case 'tool':
      return <ToolIndicator message={message} />
    case 'system':
      return <SystemMessage message={message} />
    default:
      return null
  }
}
