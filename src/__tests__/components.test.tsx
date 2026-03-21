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
    h1: React.forwardRef((props: any, ref: any) => <h1 ref={ref} {...stripMotionProps(props)} />),
    h2: React.forwardRef((props: any, ref: any) => <h2 ref={ref} {...stripMotionProps(props)} />),
    span: React.forwardRef((props: any, ref: any) => <span ref={ref} {...stripMotionProps(props)} />),
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

// ─── EnergySelector Tests ───

describe('EnergySelector', () => {
  let EnergySelector: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/EnergySelector')
    EnergySelector = mod.EnergySelector
  })

  it('renders all four energy options', () => {
    render(<EnergySelector onSelect={() => {}} />)
    expect(screen.getByText('High Energy')).toBeInTheDocument()
    expect(screen.getByText('Medium Energy')).toBeInTheDocument()
    expect(screen.getByText('Low Energy')).toBeInTheDocument()
    expect(screen.getByText('Recovery Day')).toBeInTheDocument()
  })

  it('calls onSelect with correct level on click', () => {
    const onSelect = vi.fn()
    render(<EnergySelector onSelect={onSelect} />)
    fireEvent.click(screen.getByText('High Energy'))
    expect(onSelect).toHaveBeenCalledWith('high')
  })

  it('calls onSelect for different energy levels', () => {
    const onSelect = vi.fn()
    render(<EnergySelector onSelect={onSelect} />)
    fireEvent.click(screen.getByText('Low Energy'))
    expect(onSelect).toHaveBeenCalledWith('low')
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
    useShowStore.setState({
      beatCheckPending: true,
      acts: [{ id: 'a1', name: 'Test', sketch: 'Deep Work', durationMinutes: 30, status: 'completed', beatLocked: false, order: 0 }],
      currentActId: 'a1',
    })
    render(<BeatCheckModal />)
    expect(screen.getByText(/Did you have a moment of presence/)).toBeInTheDocument()
    expect(screen.getByText('Not this time')).toBeInTheDocument()
  })

  it('calls lockBeat when lock button clicked', () => {
    useShowStore.setState({
      beatCheckPending: true,
      beatsLocked: 0,
      acts: [{ id: 'a1', name: 'Test', sketch: 'Deep Work', durationMinutes: 30, status: 'completed', beatLocked: false, order: 0 }],
      currentActId: 'a1',
      phase: 'live',
    })
    render(<BeatCheckModal />)
    fireEvent.click(screen.getByText(/Lock the Beat/))
    expect(useShowStore.getState().beatsLocked).toBe(1)
  })

  it('calls skipBeat when "Not this time" clicked', () => {
    useShowStore.setState({
      beatCheckPending: true,
      beatsLocked: 0,
      acts: [{ id: 'a1', name: 'Test', sketch: 'Deep Work', durationMinutes: 30, status: 'completed', beatLocked: false, order: 0 }],
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

  it('renders act name in full variant', () => {
    render(<ActCard act={baseAct} variant="full" actNumber={1} />)
    expect(screen.getByText('Morning Focus')).toBeInTheDocument()
  })

  it('renders act name in sidebar variant', () => {
    render(<ActCard act={baseAct} variant="sidebar" actNumber={1} />)
    expect(screen.getByText('Morning Focus')).toBeInTheDocument()
  })

  it('shows remove button when onRemove provided in full variant', () => {
    const onRemove = vi.fn()
    render(<ActCard act={baseAct} variant="full" actNumber={1} onRemove={onRemove} />)
    const removeBtn = screen.getByText('×')
    expect(removeBtn).toBeInTheDocument()
    fireEvent.click(removeBtn)
    expect(onRemove).toHaveBeenCalledOnce()
  })

  it('shows reorder buttons when onReorder provided in full variant', () => {
    const onReorder = vi.fn()
    render(<ActCard act={baseAct} variant="full" actNumber={1} onReorder={onReorder} />)
    const upBtn = screen.getByText('↑')
    const downBtn = screen.getByText('↓')
    expect(upBtn).toBeInTheDocument()
    expect(downBtn).toBeInTheDocument()
    fireEvent.click(upBtn)
    expect(onReorder).toHaveBeenCalledWith('up')
  })

  it('shows beat star for beat-locked acts in sidebar variant', () => {
    render(<ActCard act={{ ...baseAct, status: 'completed', beatLocked: true }} variant="sidebar" actNumber={1} />)
    expect(screen.getByText('★')).toBeInTheDocument()
  })

  it('applies line-through for skipped acts in sidebar variant', () => {
    render(<ActCard act={{ ...baseAct, status: 'skipped' }} variant="sidebar" actNumber={1} />)
    const name = screen.getByText('Morning Focus')
    expect(name.className).toContain('line-through')
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
      render(<ShowVerdict verdict={type} beatsLocked={2} beatThreshold={3} />)
      expect(screen.getByText(title)).toBeInTheDocument()
    })
  })

  it('shows correct message for DAY_WON', () => {
    render(<ShowVerdict verdict="DAY_WON" beatsLocked={3} beatThreshold={3} />)
    expect(screen.getByText(/You showed up and you were present/)).toBeInTheDocument()
  })

  it('shows correct message for SHOW_CALLED_EARLY', () => {
    render(<ShowVerdict verdict="SHOW_CALLED_EARLY" beatsLocked={0} beatThreshold={3} />)
    expect(screen.getByText(/Sometimes the show is short/)).toBeInTheDocument()
  })
})
