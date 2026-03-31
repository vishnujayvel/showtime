import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { useShowStore } from '../renderer/stores/showStore'
import { resetShowActor } from '../renderer/machines/showActor'

// ─── Mock framer-motion ───
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, variants, ...rest } = props
      return <div ref={ref} {...rest} />
    }),
    button: React.forwardRef((props: any, ref: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, variants, ...rest } = props
      return <button ref={ref} {...rest} />
    }),
    span: React.forwardRef((props: any, ref: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, layout, layoutId, variants, ...rest } = props
      return <span ref={ref} {...rest} />
    }),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

function resetStore() {
  resetShowActor()
  useShowStore.setState({
    phase: 'writers_room',
    energy: 'medium',
    acts: [],
    currentActId: null,
    beatsLocked: 0,
    beatThreshold: 3,
    timerEndAt: null,
    timerPausedRemaining: null,
    claudeSessionId: null,
    showDate: new Date().toISOString().slice(0, 10),
    verdict: null,
    viewTier: 'expanded',
    beatCheckPending: false,
    goingLiveActive: false,
    writersRoomStep: 'energy',
    writersRoomEnteredAt: null,
    breathingPauseEndAt: null,
  })
}

beforeEach(() => {
  resetStore()
  cleanup()
})

describe('ChatMessage', () => {
  let ChatMessage: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/ChatMessage')
    ChatMessage = mod.ChatMessage
  })

  it('renders user message as right-aligned bubble', () => {
    render(
      <ChatMessage
        message={{ id: 'u1', role: 'user', content: 'Hello world', timestamp: Date.now() }}
      />
    )
    const bubble = screen.getByText('Hello world')
    expect(bubble).toBeInTheDocument()
    // Should be in a flex justify-end container
    const container = bubble.closest('[class*="justify-end"]')
    expect(container).not.toBeNull()
  })

  it('renders assistant message with markdown', () => {
    render(
      <ChatMessage
        message={{ id: 'a1', role: 'assistant', content: 'This is **bold** text', timestamp: Date.now() }}
      />
    )
    const bold = screen.getByText('bold')
    expect(bold.tagName).toBe('STRONG')
  })

  it('renders system message as centered italic', () => {
    render(
      <ChatMessage
        message={{ id: 's1', role: 'system', content: 'Session started', timestamp: Date.now() }}
      />
    )
    const text = screen.getByText('Session started')
    expect(text).toBeInTheDocument()
    expect(text.className).toContain('italic')
  })

  it('renders tool message as compact indicator', () => {
    render(
      <ChatMessage
        message={{ id: 't1', role: 'tool', content: '', toolName: 'Read', toolStatus: 'running', timestamp: Date.now() }}
      />
    )
    expect(screen.getByText('Read')).toBeInTheDocument()
    expect(screen.getByText('running...')).toBeInTheDocument()
  })

  it('renders tool message with checkmark when completed', () => {
    render(
      <ChatMessage
        message={{ id: 't2', role: 'tool', content: '', toolName: 'Write', toolStatus: 'completed', timestamp: Date.now() }}
      />
    )
    expect(screen.getByText('Write')).toBeInTheDocument()
    expect(screen.getByText('✓')).toBeInTheDocument()
  })

  it('renders assistant message with showtime-lineup as LineupCard', () => {
    const lineupJson = JSON.stringify({
      acts: [{ name: 'Focus Time', sketch: 'Deep Work', durationMinutes: 45 }],
      beatThreshold: 3,
      openingNote: 'Great day ahead!',
    })
    const content = `Here's your lineup:\n\n\`\`\`showtime-lineup\n${lineupJson}\n\`\`\``

    render(
      <ChatMessage
        message={{ id: 'a2', role: 'assistant', content, timestamp: Date.now() }}
      />
    )
    // LineupCard should render with the act
    expect(screen.getByTestId('lineup-card')).toBeInTheDocument()
    expect(screen.getByText('Focus Time')).toBeInTheDocument()
    expect(screen.getByText('Great day ahead!')).toBeInTheDocument()
  })

  it('renders inline code blocks for non-lineup code', () => {
    render(
      <ChatMessage
        message={{ id: 'a3', role: 'assistant', content: 'Run `npm install` to install', timestamp: Date.now() }}
      />
    )
    const code = screen.getByText('npm install')
    expect(code.tagName).toBe('CODE')
  })

  it('renders assistant markdown lists correctly', () => {
    render(
      <ChatMessage
        message={{ id: 'a4', role: 'assistant', content: '- Item one\n- Item two\n- Item three', timestamp: Date.now() }}
      />
    )
    expect(screen.getByText('Item one')).toBeInTheDocument()
    expect(screen.getByText('Item two')).toBeInTheDocument()
    expect(screen.getByText('Item three')).toBeInTheDocument()
  })
})
