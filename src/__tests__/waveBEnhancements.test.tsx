import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'
import { showActor, resetShowActor } from '../renderer/machines/showActor'

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

// ─── Set up window.showtime mock ───
beforeAll(() => {
  ;(window as any).showtime = {
    quit: vi.fn(),
    setViewMode: vi.fn(),
    forceRepaint: vi.fn(),
    dataSync: vi.fn(),
    dataFlush: vi.fn(),
    timelineRecord: vi.fn(),
    getTimelineDrift: vi.fn().mockResolvedValue(0),
  }
})

/** Navigate actor to live phase with optional lineup config */
function goLive(options?: {
  acts?: Array<{ name: string; sketch: string; durationMinutes: number }>
  beatThreshold?: number
}) {
  const lineup = {
    acts: options?.acts ?? [{ name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30 }],
    beatThreshold: options?.beatThreshold ?? 3,
    openingNote: 'Test',
  }
  showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  showActor.send({ type: 'SET_ENERGY', level: 'high' })
  showActor.send({ type: 'SET_LINEUP', lineup })
  showActor.send({ type: 'FINALIZE_LINEUP' })
  showActor.send({ type: 'START_SHOW' })
}

beforeEach(() => {
  resetShowActor()
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

// ─── Issue #117 → #201: PillView Menu Button (was help button, now ViewMenu) ───

describe('PillView menu button (Issue #201, replaces #117)', () => {
  let PillView: any

  beforeEach(async () => {
    const mod = await import('../renderer/views/PillView')
    PillView = mod.PillView
  })

  it('renders a menu button with data-testid="view-menu-trigger"', () => {
    goLive({ acts: [{ name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30 }] })

    render(<PillView />)
    const menuBtn = screen.getByTestId('view-menu-trigger')
    expect(menuBtn).toBeInTheDocument()
  })

  it('menu button displays "⋮" text', () => {
    goLive({ acts: [{ name: 'Focus Time', sketch: 'Deep Work', durationMinutes: 25 }] })

    render(<PillView />)
    const menuBtn = screen.getByTestId('view-menu-trigger')
    expect(menuBtn).toHaveTextContent('\u22EE')
  })

  it('menu button renders during intermission phase', () => {
    goLive({ acts: [{ name: 'Break', sketch: 'Personal', durationMinutes: 15 }] })
    showActor.send({ type: 'SET_VIEW_TIER', tier: 'micro' })
    showActor.send({ type: 'ENTER_INTERMISSION' })

    render(<PillView />)
    const menuBtn = screen.getByTestId('view-menu-trigger')
    expect(menuBtn).toBeInTheDocument()
  })

  it('menu button renders during strike phase', () => {
    goLive({ acts: [{ name: 'Done', sketch: 'Admin', durationMinutes: 30 }], beatThreshold: 3 })
    showActor.send({ type: 'STRIKE' })
    showActor.send({ type: 'SET_VIEW_TIER', tier: 'micro' })

    render(<PillView />)
    const menuBtn = screen.getByTestId('view-menu-trigger')
    expect(menuBtn).toBeInTheDocument()
  })
})
