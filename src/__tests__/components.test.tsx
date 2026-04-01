import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import { getPhaseFromState } from '../renderer/machines/showMachine'
import type { Act, ShowLineup, ShowVerdict as ShowVerdictType } from '../shared/types'

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

/** Navigate actor to live phase with optional lineup config */
function goLive(options?: {
  acts?: Array<{ name: string; sketch: string; durationMinutes: number }>
  beatThreshold?: number
}) {
  const lineup: ShowLineup = {
    acts: options?.acts ?? [{ name: 'Test', sketch: 'Deep Work', durationMinutes: 30 }],
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

/** Navigate to beat_check: live with act completed, beatCheckPending=true */
function goToBeatCheck(options?: Parameters<typeof goLive>[0]) {
  goLive(options)
  const actId = showActor.getSnapshot().context.currentActId!
  showActor.send({ type: 'COMPLETE_ACT', actId })
}

/** Navigate to celebrating: live with beat locked, celebrationActive=true */
function goToCelebrating(options?: Parameters<typeof goLive>[0]) {
  goToBeatCheck(options)
  showActor.send({ type: 'LOCK_BEAT' })
}

// Reset store between tests
function resetStore() {
  resetShowActor()
}

beforeEach(() => {
  resetStore()
  cleanup()
})

// ─── BeatCheckModal Tests ───

describe('BeatCheckModal', () => {
  let BeatCheckModal: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/BeatCheckModal')
    BeatCheckModal = mod.BeatCheckModal
  })

  it('does not render when beatCheckPending is false', () => {
    // Default state: beatCheckPending is false
    const { container } = render(<BeatCheckModal />)
    expect(container.textContent).toBe('')
  })

  it('renders modal when beatCheckPending is true', () => {
    goToBeatCheck()
    render(<BeatCheckModal />)
    expect(screen.getByText(/Did you have a moment of presence/)).toBeInTheDocument()
    expect(screen.getByText('Not this time')).toBeInTheDocument()
  })

  it('calls lockBeat when lock button clicked', () => {
    goToBeatCheck()
    render(<BeatCheckModal />)
    fireEvent.click(screen.getByText(/Lock the Beat/))
    expect(showActor.getSnapshot().context.beatsLocked).toBe(1)
    expect(showActor.getSnapshot().context.celebrationActive).toBe(true)
  })

  it('calls skipBeat when "Not this time" clicked', () => {
    goToBeatCheck()
    render(<BeatCheckModal />)
    fireEvent.click(screen.getByText('Not this time'))
    expect(showActor.getSnapshot().context.beatsLocked).toBe(0)
    expect(showActor.getSnapshot().context.beatCheckPending).toBe(false)
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

// ─── BeatCheckModal Celebration Display Tests ───

describe('BeatCheckModal — celebration display', () => {
  let BeatCheckModal: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/BeatCheckModal')
    BeatCheckModal = mod.BeatCheckModal
  })

  it('shows celebration text when celebrationActive is true', () => {
    goToCelebrating()
    render(<BeatCheckModal />)
    expect(screen.getByText('That moment was real.')).toBeInTheDocument()
  })

  it('hides lock/skip buttons during celebration', () => {
    goToCelebrating()
    render(<BeatCheckModal />)
    expect(screen.queryByText(/Lock the Beat/)).not.toBeInTheDocument()
    expect(screen.queryByText('Not this time')).not.toBeInTheDocument()
  })

  it('celebration text has animate-beat-ignite class', () => {
    goToCelebrating()
    render(<BeatCheckModal />)
    const celebrationEl = screen.getByText('That moment was real.')
    expect(celebrationEl.className).toContain('animate-beat-ignite')
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

// ─── DirectorMode Tests ───

describe('DirectorMode', () => {
  let DirectorMode: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/DirectorMode')
    DirectorMode = mod.DirectorMode
  })

  function goToDirector() {
    goLive()
    showActor.send({ type: 'ENTER_DIRECTOR' })
  }

  it('renders the four compassionate options', () => {
    goToDirector()
    render(<DirectorMode />)
    expect(screen.getByText('The Director is here.')).toBeInTheDocument()
    expect(screen.getByText("What's the call?")).toBeInTheDocument()
    expect(screen.getByText('Skip this act, move on')).toBeInTheDocument()
    expect(screen.getByText('Call the show early')).toBeInTheDocument()
    expect(screen.getByText('Take a longer break')).toBeInTheDocument()
    expect(screen.getByText('Just a moment')).toBeInTheDocument()
  })

  it('renders reset show button', () => {
    goToDirector()
    render(<DirectorMode />)
    expect(screen.getByText(/Reset .* show/)).toBeInTheDocument()
  })

  it('CALL_SHOW_EARLY transitions to strike', () => {
    goToDirector()
    render(<DirectorMode />)
    fireEvent.click(screen.getByText('Call the show early'))
    const snap = showActor.getSnapshot()
    const phase = getPhaseFromState(snap.value as Record<string, unknown>)
    expect(phase).toBe('strike')
  })
})

// ─── RundownBar Tests ───

describe('RundownBar', () => {
  let RundownBar: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/RundownBar')
    RundownBar = mod.RundownBar
  })

  it('renders nothing when not live', () => {
    const { container } = render(<RundownBar />)
    expect(container.querySelector('[data-testid="rundown-bar"]')).toBeNull()
  })

  it('renders the rundown bar when live with acts', () => {
    goLive()
    render(<RundownBar />)
    expect(screen.getByTestId('rundown-bar')).toBeInTheDocument()
  })

  it('renders in compact variant', () => {
    goLive()
    render(<RundownBar variant="compact" />)
    expect(screen.getByTestId('rundown-bar')).toBeInTheDocument()
  })
})
