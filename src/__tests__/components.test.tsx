import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { useShowStore } from '../renderer/stores/showStore'
import type { Act, ShowVerdict as ShowVerdictType } from '../shared/types'

// ─── Mock framer-motion to avoid animation issues in tests ───
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => <div ref={ref} {...stripMotionProps(props)} />),
    button: React.forwardRef((props: any, ref: any) => <button ref={ref} {...stripMotionProps(props)} />),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Strip framer-motion specific props
function stripMotionProps(props: any) {
  const {
    initial, animate, exit, transition, whileHover, whileTap, whileFocus,
    layout, layoutId, variants, onAnimationStart, onAnimationComplete,
    ...rest
  } = props
  return rest
}

// ─── Mock theme ───
vi.mock('../renderer/theme', () => ({
  useColors: () => ({
    text: '#fff',
    textPrimary: '#fff',
    textSecondary: '#999',
    textTertiary: '#666',
    border: '#333',
    cardBg: '#222',
    pillBg: '#111',
    containerBg: '#222',
    containerBgCollapsed: '#111',
    containerBorder: '#333',
    accent: '#8b5cf6',
  }),
}))

// ─── Mock Phosphor icons ───
vi.mock('@phosphor-icons/react', () => {
  const Icon = ({ children, ...props }: any) => <span data-testid="icon" {...props}>{children}</span>
  return {
    Lightning: Icon,
    Sun: Icon,
    CloudSun: Icon,
    Moon: Icon,
    Star: Icon,
    X: Icon,
    Trophy: Icon,
    ThumbsUp: Icon,
    Heart: Icon,
    Play: Icon,
    Check: Icon,
    SkipForward: Icon,
    ArrowUp: Icon,
    ArrowDown: Icon,
    Timer: Icon,
    FilmSlate: Icon,
    Coffee: Icon,
    PaperPlaneRight: Icon,
  }
})

// Reset store between tests
function resetStore() {
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
    verdict: null,
    isExpanded: true,
    beatCheckPending: false,
  })
}

beforeEach(() => {
  resetStore()
  cleanup()
})

// ─── EnergySelector Tests ───

describe('EnergySelector', () => {
  let EnergySelector: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/EnergySelector')
    EnergySelector = mod.EnergySelector
  })

  it('renders all four energy options', () => {
    render(<EnergySelector />)
    expect(screen.getByText('High')).toBeInTheDocument()
    expect(screen.getByText('Medium')).toBeInTheDocument()
    expect(screen.getByText('Low')).toBeInTheDocument()
    expect(screen.getByText('Recovery')).toBeInTheDocument()
  })

  it('dispatches setEnergy on click', () => {
    render(<EnergySelector />)
    fireEvent.click(screen.getByText('High'))
    expect(useShowStore.getState().energy).toBe('high')
  })

  it('updates selection when clicked', () => {
    render(<EnergySelector />)
    fireEvent.click(screen.getByText('Low'))
    expect(useShowStore.getState().energy).toBe('low')
    fireEvent.click(screen.getByText('Medium'))
    expect(useShowStore.getState().energy).toBe('medium')
  })
})

// ─── BeatCheckModal Tests ───

describe('BeatCheckModal', () => {
  let BeatCheckModal: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/BeatCheckModal')
    BeatCheckModal = mod.BeatCheckModal
  })

  it('does not render when beatCheckPending is false', () => {
    useShowStore.setState({ beatCheckPending: false })
    const { container } = render(<BeatCheckModal />)
    expect(container.textContent).toBe('')
  })

  it('renders modal when beatCheckPending is true', () => {
    useShowStore.setState({ beatCheckPending: true })
    render(<BeatCheckModal />)
    expect(screen.getByText('Yes, lock it')).toBeInTheDocument()
    expect(screen.getByText('Not this time')).toBeInTheDocument()
  })

  it('calls lockBeat when "Yes" clicked', () => {
    useShowStore.setState({
      beatCheckPending: true,
      beatsLocked: 0,
      acts: [{ id: 'a1', name: 'Test', sketch: 'Test', durationMinutes: 30, status: 'completed', beatLocked: false, order: 0 }],
      currentActId: 'a1',
      phase: 'live',
    })
    render(<BeatCheckModal />)
    fireEvent.click(screen.getByText('Yes, lock it'))
    expect(useShowStore.getState().beatsLocked).toBe(1)
    expect(useShowStore.getState().beatCheckPending).toBe(false)
  })

  it('calls skipBeat when "Not this time" clicked', () => {
    useShowStore.setState({
      beatCheckPending: true,
      beatsLocked: 0,
      acts: [{ id: 'a1', name: 'Test', sketch: 'Test', durationMinutes: 30, status: 'completed', beatLocked: false, order: 0 }],
      currentActId: 'a1',
      phase: 'live',
    })
    render(<BeatCheckModal />)
    fireEvent.click(screen.getByText('Not this time'))
    expect(useShowStore.getState().beatsLocked).toBe(0)
    expect(useShowStore.getState().beatCheckPending).toBe(false)
  })
})

// ─── ActCard Tests ───

describe('ActCard', () => {
  let ActCard: any

  const baseAct: Act = {
    id: 'act-1',
    name: 'Morning Focus',
    sketch: 'Deep Work',
    durationMinutes: 60,
    status: 'upcoming',
    beatLocked: false,
    order: 0,
  }

  beforeEach(async () => {
    const mod = await import('../renderer/components/ActCard')
    ActCard = mod.ActCard
  })

  it('renders act name and details', () => {
    render(<ActCard act={baseAct} isActive={false} onSkip={() => {}} />)
    expect(screen.getByText('Morning Focus')).toBeInTheDocument()
    expect(screen.getByText('Deep Work')).toBeInTheDocument()
    expect(screen.getByText('60m')).toBeInTheDocument()
  })

  it('shows skip button for upcoming acts', () => {
    render(<ActCard act={baseAct} isActive={false} onSkip={() => {}} />)
    expect(screen.getByTitle('Cut this act')).toBeInTheDocument()
  })

  it('hides skip button for completed acts', () => {
    render(<ActCard act={{ ...baseAct, status: 'completed' }} isActive={false} onSkip={() => {}} />)
    expect(screen.queryByTitle('Cut this act')).not.toBeInTheDocument()
  })

  it('calls onSkip handler', () => {
    const onSkip = vi.fn()
    render(<ActCard act={baseAct} isActive={false} onSkip={onSkip} />)
    fireEvent.click(screen.getByTitle('Cut this act'))
    expect(onSkip).toHaveBeenCalledOnce()
  })

  it('shows reorder buttons when showReorder is true', () => {
    const onUp = vi.fn()
    const onDown = vi.fn()
    render(
      <ActCard act={baseAct} isActive={false} onSkip={() => {}} showReorder onMoveUp={onUp} onMoveDown={onDown} />
    )
    // Should have arrow buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(1)
  })
})

// ─── ShowVerdict Tests ───

describe('ShowVerdict', () => {
  let ShowVerdict: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/ShowVerdict')
    ShowVerdict = mod.ShowVerdict
  })

  const verdicts: Array<{ type: ShowVerdictType; title: string }> = [
    { type: 'DAY_WON', title: 'DAY WON' },
    { type: 'SOLID_SHOW', title: 'SOLID SHOW' },
    { type: 'GOOD_EFFORT', title: 'GOOD EFFORT' },
    { type: 'SHOW_CALLED_EARLY', title: 'SHOW CALLED EARLY' },
  ]

  verdicts.forEach(({ type, title }) => {
    it(`renders ${type} verdict with correct title`, () => {
      render(<ShowVerdict verdict={type} />)
      expect(screen.getByText(title)).toBeInTheDocument()
    })
  })

  it('shows celebration message for DAY_WON', () => {
    render(<ShowVerdict verdict="DAY_WON" />)
    expect(screen.getByText(/Standing ovation/)).toBeInTheDocument()
  })

  it('shows appropriate message for SHOW_CALLED_EARLY', () => {
    render(<ShowVerdict verdict="SHOW_CALLED_EARLY" />)
    expect(screen.getByText(/knowing when to wrap/)).toBeInTheDocument()
  })
})
