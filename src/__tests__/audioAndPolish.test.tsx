import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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

// Mock audio module to prevent Web Audio API calls in tests
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

// Set up window.showtime mock (don't replace the whole window object)
beforeAll(() => {
  ;(window as any).showtime = {
    quit: vi.fn(),
    setViewMode: vi.fn(),
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
  showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
  showActor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
  showActor.send({ type: 'SET_LINEUP', lineup })
  showActor.send({ type: 'START_SHOW' })
}

function resetStore() {
  resetShowActor()
}

beforeEach(() => {
  resetStore()
  cleanup()
  localStorage.clear()
})

afterEach(() => {
  cleanup()
})

// ─── useAudio API Tests (non-mocked, test the module interface) ───

describe('useAudio module interface', () => {
  it('playAudioCue is callable', async () => {
    // Since we mock useAudio, verify the mock is callable
    const { playAudioCue } = await import('../renderer/hooks/useAudio')
    expect(typeof playAudioCue).toBe('function')
    expect(() => playAudioCue('going-live')).not.toThrow()
  })

  it('isMuted and setMuted are callable', async () => {
    const { isMuted, setMuted } = await import('../renderer/hooks/useAudio')
    expect(typeof isMuted).toBe('function')
    expect(typeof setMuted).toBe('function')
  })
})

// ─── MuteToggle Tests ───

describe('MuteToggle', () => {
  it('renders a toggle button', async () => {
    // MuteToggle uses the real isMuted/setMuted but those are mocked
    const { MuteToggle } = await import('../renderer/components/MuteToggle')
    render(<MuteToggle />)
    const btn = screen.getByTestId('mute-toggle')
    expect(btn).toBeInTheDocument()
  })
})

// ─── PillView Drag Zone Tests ───

describe('PillView drag zones', () => {
  let PillView: any

  beforeEach(async () => {
    const mod = await import('../renderer/views/PillView')
    PillView = mod.PillView
  })

  it('renders drag zone and click zone when live', () => {
    goLive({ acts: [{ name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30 }] })
    // START_SHOW sets viewTier to 'micro'
    const { container } = render(<PillView />)
    const dragZone = container.querySelector('.drag-region')
    const noDragZone = container.querySelector('.no-drag')
    expect(dragZone).toBeInTheDocument()
    expect(noDragZone).toBeInTheDocument()
  })

  it('click zone triggers expandViewTier', () => {
    goLive({ acts: [{ name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30 }] })
    // START_SHOW sets viewTier to 'micro'
    const { container } = render(<PillView />)
    const noDragZone = container.querySelector('.no-drag')
    expect(noDragZone).toBeInTheDocument()
    fireEvent.click(noDragZone!)
    // After expand, viewTier should no longer be 'micro'
    expect(showActor.getSnapshot().context.viewTier).not.toBe('micro')
  })
})

// ─── StrikeView Celebration Tests ───

describe('StrikeView celebration', () => {
  let StrikeView: any

  beforeEach(async () => {
    const mod = await import('../renderer/views/StrikeView')
    StrikeView = mod.StrikeView
  })

  it('renders celebration buttons', () => {
    // Navigate to strike: goLive → STRIKE
    goLive({ acts: [{ name: 'Work', sketch: 'Deep Work', durationMinutes: 30 }], beatThreshold: 3 })
    showActor.send({ type: 'STRIKE' })
    render(<StrikeView />)
    expect(screen.getByTestId('encore-btn')).toBeInTheDocument()
    expect(screen.getByTestId('plan-tomorrow-btn')).toBeInTheDocument()
    expect(screen.getByTestId('thats-a-wrap-btn')).toBeInTheDocument()
  })

  it('shows show duration stat', () => {
    vi.useFakeTimers()
    const twoHoursAgo = Date.now() - 2 * 60 * 60 * 1000
    vi.setSystemTime(twoHoursAgo)
    goLive({ acts: [{ name: 'Work', sketch: 'Deep Work', durationMinutes: 30 }] })
    vi.setSystemTime(twoHoursAgo + 2 * 60 * 60 * 1000)
    showActor.send({ type: 'STRIKE' })
    render(<StrikeView />)
    const duration = screen.getByTestId('show-duration')
    expect(duration).toBeInTheDocument()
    expect(duration.textContent).toContain('2h')
    vi.useRealTimers()
  })

  it('shows standing ovation for DAY_WON', () => {
    vi.useFakeTimers()
    // 3 acts, beatThreshold=3, lock all beats for DAY_WON
    goLive({
      acts: [
        { name: 'Act 1', sketch: 'Deep Work', durationMinutes: 30 },
        { name: 'Act 2', sketch: 'Exercise', durationMinutes: 25 },
        { name: 'Act 3', sketch: 'Admin', durationMinutes: 20 },
      ],
      beatThreshold: 3,
    })
    // Complete and lock beat for each act
    for (let i = 0; i < 3; i++) {
      const actId = showActor.getSnapshot().context.currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
      showActor.send({ type: 'LOCK_BEAT' })
      vi.advanceTimersByTime(1800) // CELEBRATION_DONE fires
    }
    // Now in strike with DAY_WON
    render(<StrikeView />)
    expect(screen.getByText('Standing ovation.')).toBeInTheDocument()
    vi.useRealTimers()
  })
})

// ─── Temporal Context Tests ───

describe('Temporal context', () => {
  it('ExpandedView shows date label', async () => {
    const { ExpandedView } = await import('../renderer/views/ExpandedView')
    goLive({ acts: [{ name: 'Work', sketch: 'Deep Work', durationMinutes: 30 }] })
    showActor.send({ type: 'SET_VIEW_TIER', tier: 'expanded' })
    render(<ExpandedView />)
    const dateLabel = screen.getByTestId('date-label')
    expect(dateLabel).toBeInTheDocument()
    // Format: "SAT, MAR 21" or "SAT MAR 21" — uppercase abbreviated date
    expect(dateLabel.textContent).toMatch(/^[A-Z]{3}/)
  }, 15_000)

  it('ExpandedView shows started-at time', async () => {
    const { ExpandedView } = await import('../renderer/views/ExpandedView')
    goLive({ acts: [{ name: 'Work', sketch: 'Deep Work', durationMinutes: 30 }] })
    showActor.send({ type: 'SET_VIEW_TIER', tier: 'expanded' })
    render(<ExpandedView />)
    const startedAt = screen.getByTestId('started-at')
    expect(startedAt).toBeInTheDocument()
    expect(startedAt.textContent).toContain('Started')
  }, 15_000)
})
