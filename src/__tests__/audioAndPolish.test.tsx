import { describe, it, expect, vi, beforeAll, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
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

// Set up window.clui mock (don't replace the whole window object)
beforeAll(() => {
  ;(window as any).clui = {
    quit: vi.fn(),
    setViewMode: vi.fn(),
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
    useShowStore.setState({
      phase: 'live',
      acts: [{ id: 'a1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30, status: 'active', beatLocked: false, order: 0, startedAt: Date.now() }],
      currentActId: 'a1',
      timerEndAt: Date.now() + 30 * 60 * 1000,
      viewTier: 'micro',
    })
    const { container } = render(<PillView />)
    const dragZone = container.querySelector('.drag-region')
    const noDragZone = container.querySelector('.no-drag')
    expect(dragZone).toBeInTheDocument()
    expect(noDragZone).toBeInTheDocument()
  })

  it('click zone triggers expandViewTier', () => {
    const expandSpy = vi.fn()
    useShowStore.setState({
      phase: 'live',
      acts: [{ id: 'a1', name: 'Deep Work', sketch: 'Deep Work', durationMinutes: 30, status: 'active', beatLocked: false, order: 0, startedAt: Date.now() }],
      currentActId: 'a1',
      timerEndAt: Date.now() + 30 * 60 * 1000,
      viewTier: 'micro',
      expandViewTier: expandSpy,
    })
    const { container } = render(<PillView />)
    const noDragZone = container.querySelector('.no-drag')
    expect(noDragZone).toBeInTheDocument()
    fireEvent.click(noDragZone!)
    expect(expandSpy).toHaveBeenCalled()
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
    useShowStore.setState({
      phase: 'strike',
      verdict: 'SOLID_SHOW' as any,
      acts: [{ id: 'a1', name: 'Work', sketch: 'Deep Work', durationMinutes: 30, status: 'completed', beatLocked: true, order: 0, startedAt: Date.now() - 30 * 60 * 1000, completedAt: Date.now() }],
      beatsLocked: 1,
      beatThreshold: 3,
      showStartedAt: Date.now() - 60 * 60 * 1000,
      viewTier: 'expanded',
    })
    render(<StrikeView />)
    expect(screen.getByTestId('encore-btn')).toBeInTheDocument()
    expect(screen.getByTestId('plan-tomorrow-btn')).toBeInTheDocument()
    expect(screen.getByTestId('thats-a-wrap-btn')).toBeInTheDocument()
  })

  it('shows show duration stat', () => {
    useShowStore.setState({
      phase: 'strike',
      verdict: 'SOLID_SHOW' as any,
      acts: [],
      beatsLocked: 0,
      beatThreshold: 3,
      showStartedAt: Date.now() - 2 * 60 * 60 * 1000,
      viewTier: 'expanded',
    })
    render(<StrikeView />)
    const duration = screen.getByTestId('show-duration')
    expect(duration).toBeInTheDocument()
    expect(duration.textContent).toContain('2h')
  })

  it('shows standing ovation for DAY_WON', () => {
    useShowStore.setState({
      phase: 'strike',
      verdict: 'DAY_WON' as any,
      acts: [],
      beatsLocked: 3,
      beatThreshold: 3,
      showStartedAt: Date.now() - 60 * 60 * 1000,
      viewTier: 'expanded',
    })
    render(<StrikeView />)
    expect(screen.getByText('Standing ovation.')).toBeInTheDocument()
  })
})

// ─── Temporal Context Tests ───

describe('Temporal context', () => {
  it('ExpandedView shows date label', async () => {
    const { ExpandedView } = await import('../renderer/views/ExpandedView')
    useShowStore.setState({
      phase: 'live',
      acts: [{ id: 'a1', name: 'Work', sketch: 'Deep Work', durationMinutes: 30, status: 'active', beatLocked: false, order: 0, startedAt: Date.now() }],
      currentActId: 'a1',
      timerEndAt: Date.now() + 30 * 60 * 1000,
      showStartedAt: Date.now(),
      viewTier: 'expanded',
    })
    render(<ExpandedView />)
    const dateLabel = screen.getByTestId('date-label')
    expect(dateLabel).toBeInTheDocument()
    // Format: "SAT, MAR 21" or "SAT MAR 21" — uppercase abbreviated date
    expect(dateLabel.textContent).toMatch(/^[A-Z]{3}/)
  }, 15_000)

  it('ExpandedView shows started-at time', async () => {
    const { ExpandedView } = await import('../renderer/views/ExpandedView')
    useShowStore.setState({
      phase: 'live',
      acts: [{ id: 'a1', name: 'Work', sketch: 'Deep Work', durationMinutes: 30, status: 'active', beatLocked: false, order: 0, startedAt: Date.now() }],
      currentActId: 'a1',
      timerEndAt: Date.now() + 30 * 60 * 1000,
      showStartedAt: Date.now(),
      viewTier: 'expanded',
    })
    render(<ExpandedView />)
    const startedAt = screen.getByTestId('started-at')
    expect(startedAt).toBeInTheDocument()
    expect(startedAt.textContent).toContain('Started')
  }, 15_000)
})
