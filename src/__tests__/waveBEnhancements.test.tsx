import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { useShowStore } from '../renderer/stores/showStore'
import { resetShowActor } from '../renderer/machines/showActor'

// ─── Mock framer-motion ───
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => <div ref={ref} {...stripMotionProps(props)} />),
    button: React.forwardRef((props: any, ref: any) => <button ref={ref} {...stripMotionProps(props)} />),
    h1: React.forwardRef((props: any, ref: any) => <h1 ref={ref} {...stripMotionProps(props)} />),
    h2: React.forwardRef((props: any, ref: any) => <h2 ref={ref} {...stripMotionProps(props)} />),
    p: React.forwardRef((props: any, ref: any) => <p ref={ref} {...stripMotionProps(props)} />),
    span: React.forwardRef((props: any, ref: any) => <span ref={ref} {...stripMotionProps(props)} />),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// ─── Mock @radix-ui/react-popover (needs browser environment) ───
vi.mock('@radix-ui/react-popover', () => ({
  Root: ({ children }: any) => <div>{children}</div>,
  Trigger: ({ children, asChild }: any) => asChild ? children : <button>{children}</button>,
  Portal: ({ children }: any) => <div>{children}</div>,
  Content: React.forwardRef(({ children, ...props }: any, ref: any) => <div ref={ref} {...props}>{children}</div>),
}))

// ─── Mock useAudio to prevent Web Audio API calls ───
vi.mock('../renderer/hooks/useAudio', () => ({
  playAudioCue: vi.fn(),
  isMuted: vi.fn(() => false),
  setMuted: vi.fn(),
  useAudio: () => ({
    play: vi.fn(),
    resetTimerWarning: vi.fn(),
    playTimerWarningOnce: vi.fn(),
  }),
}))

function stripMotionProps(props: any) {
  const {
    initial, animate, exit, transition, whileHover, whileTap, whileFocus,
    layout, layoutId, variants, onAnimationStart, onAnimationComplete,
    ...rest
  } = props
  return rest
}

// ─── Set up window.clui mock ───
beforeAll(() => {
  ;(window as any).clui = {
    quit: vi.fn(),
    setViewMode: vi.fn(),
    forceRepaint: vi.fn(),
    dataSync: vi.fn(),
    dataFlush: vi.fn(),
    timelineRecord: vi.fn(),
    getTimelineDrift: vi.fn().mockResolvedValue(0),
  }
})

function resetStore() {
  resetShowActor()
  useShowStore.setState({
    phase: 'no_show',
    energy: null,
    acts: [],
    currentActId: null,
    beatsLocked: 0,
    beatThreshold: 3,
    timerEndAt: null,
    timerPausedRemaining: null,
    claudeSessionId: null,
    showDate: new Date().toISOString().slice(0, 10),
    showStartedAt: null,
    verdict: null,
    viewTier: 'expanded',
    beatCheckPending: false,
    celebrationActive: false,
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

afterEach(() => {
  cleanup()
})

// ─── Issue #115: Personal Category ───

describe('Personal category (Issue #115)', () => {
  it('getCategoryClasses returns teal-themed classes for Personal', async () => {
    const { getCategoryClasses } = await import('../renderer/lib/category-colors')
    const classes = getCategoryClasses('Personal')

    expect(classes.text).toBe('text-cat-personal')
    expect(classes.bg).toBe('bg-cat-personal')
    expect(classes.border).toBe('border-cat-personal')
    expect(classes.bgTint).toBe('bg-cat-personal/5')
    expect(classes.borderTint).toBe('border-cat-personal/25')
  })

  it('SKETCH_CATEGORIES includes Personal and has 6 total categories', async () => {
    const { SKETCH_CATEGORIES } = await import('../renderer/lib/category-colors')

    expect(SKETCH_CATEGORIES).toContain('Personal')
    expect(SKETCH_CATEGORIES).toHaveLength(6)
  })

  it('getCategoryClasses returns default for unknown category', async () => {
    const { getCategoryClasses } = await import('../renderer/lib/category-colors')
    const classes = getCategoryClasses('NonExistent')

    expect(classes.text).toBe('text-zinc-400')
    expect(classes.bg).toBe('bg-zinc-400')
  })

  it('SKETCH_CATEGORIES contains all expected categories', async () => {
    const { SKETCH_CATEGORIES } = await import('../renderer/lib/category-colors')

    expect(SKETCH_CATEGORIES).toEqual([
      'Deep Work',
      'Exercise',
      'Admin',
      'Creative',
      'Social',
      'Personal',
    ])
  })
})

// ─── Issue #117: PillView Help Button ───

describe('PillView help button (Issue #117)', () => {
  let PillView: any

  beforeEach(async () => {
    const mod = await import('../renderer/views/PillView')
    PillView = mod.PillView
  })

  it('renders a help button with data-testid="pill-help-btn"', () => {
    useShowStore.setState({
      phase: 'live',
      acts: [
        {
          id: 'a1',
          name: 'Deep Work',
          sketch: 'Deep Work',
          durationMinutes: 30,
          status: 'active',
          beatLocked: false,
          order: 0,
          startedAt: Date.now(),
        },
      ],
      currentActId: 'a1',
      timerEndAt: Date.now() + 30 * 60 * 1000,
      viewTier: 'micro',
    })

    render(<PillView />)
    const helpBtn = screen.getByTestId('pill-help-btn')
    expect(helpBtn).toBeInTheDocument()
  })

  it('help button displays "?" text', () => {
    useShowStore.setState({
      phase: 'live',
      acts: [
        {
          id: 'a1',
          name: 'Focus Time',
          sketch: 'Deep Work',
          durationMinutes: 25,
          status: 'active',
          beatLocked: false,
          order: 0,
          startedAt: Date.now(),
        },
      ],
      currentActId: 'a1',
      timerEndAt: Date.now() + 25 * 60 * 1000,
      viewTier: 'micro',
    })

    render(<PillView />)
    const helpBtn = screen.getByTestId('pill-help-btn')
    expect(helpBtn).toHaveTextContent('?')
  })

  it('help button renders during intermission phase', () => {
    useShowStore.setState({
      phase: 'intermission',
      acts: [
        {
          id: 'a1',
          name: 'Break',
          sketch: 'Personal',
          durationMinutes: 15,
          status: 'completed',
          beatLocked: true,
          order: 0,
          startedAt: Date.now() - 15 * 60 * 1000,
          completedAt: Date.now(),
        },
      ],
      currentActId: null,
      timerEndAt: null,
      viewTier: 'micro',
    })

    render(<PillView />)
    const helpBtn = screen.getByTestId('pill-help-btn')
    expect(helpBtn).toBeInTheDocument()
  })

  it('help button renders during strike phase', () => {
    useShowStore.setState({
      phase: 'strike',
      acts: [
        {
          id: 'a1',
          name: 'Done',
          sketch: 'Admin',
          durationMinutes: 30,
          status: 'completed',
          beatLocked: true,
          order: 0,
          startedAt: Date.now() - 30 * 60 * 1000,
          completedAt: Date.now(),
        },
      ],
      currentActId: null,
      timerEndAt: null,
      viewTier: 'micro',
      beatsLocked: 1,
      beatThreshold: 3,
    })

    render(<PillView />)
    const helpBtn = screen.getByTestId('pill-help-btn')
    expect(helpBtn).toBeInTheDocument()
  })
})
