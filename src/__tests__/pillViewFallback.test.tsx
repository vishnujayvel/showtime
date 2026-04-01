/**
 * Part A: PillView renders fallback content for unhandled phases (#131)
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PillView } from '../renderer/views/PillView'

// Mock the machine provider hooks
const mockPhase = vi.fn()
const mockViewTier = vi.fn().mockReturnValue('micro')
const mockSend = vi.fn()
const mockCurrentAct = vi.fn().mockReturnValue(null)

vi.mock('../renderer/machines/ShowMachineProvider', () => ({
  useShowPhase: () => mockPhase(),
  useShowContext: (selector: (ctx: Record<string, unknown>) => unknown) =>
    selector({ viewTier: mockViewTier(), acts: [], currentActId: null, showStartedAt: null }),
  useShowSend: () => mockSend,
  useShowSelector: () => mockCurrentAct(),
  showSelectors: { currentAct: () => null },
}))

vi.mock('../renderer/hooks/useTimer', () => ({
  useTimer: () => ({ minutes: 25, seconds: 0, isRunning: false }),
}))

vi.mock('../renderer/components/TallyLight', () => ({
  TallyLight: () => <div data-testid="tally" />,
}))

vi.mock('../renderer/components/BeatCounter', () => ({
  BeatCounter: () => <div data-testid="beat-counter" />,
}))

vi.mock('../renderer/components/MiniRundownStrip', () => ({
  MiniRundownStrip: () => null,
}))

describe('PillView fallback content', () => {
  it('renders "Dark Studio" + "Tap to expand" for no_show phase', () => {
    mockPhase.mockReturnValue('no_show')
    render(<PillView />)
    expect(screen.getByText('Dark Studio')).toBeInTheDocument()
    expect(screen.getByText('Tap to expand')).toBeInTheDocument()
  })

  it('renders "Writer\'s Room" + "Tap to expand" for writers_room phase', () => {
    mockPhase.mockReturnValue('writers_room')
    render(<PillView />)
    expect(screen.getByText("Writer's Room")).toBeInTheDocument()
    expect(screen.getByText('Tap to expand')).toBeInTheDocument()
  })

  it('renders "Director Mode" + "Tap to expand" for director phase', () => {
    mockPhase.mockReturnValue('director')
    render(<PillView />)
    expect(screen.getByText('Director Mode')).toBeInTheDocument()
    expect(screen.getByText('Tap to expand')).toBeInTheDocument()
  })

  it('does NOT render fallback for live phase', () => {
    mockPhase.mockReturnValue('live')
    mockCurrentAct.mockReturnValue({ name: 'Test Act', id: '1' })
    render(<PillView />)
    expect(screen.queryByText('Tap to expand')).not.toBeInTheDocument()
  })

  it('does NOT render fallback for intermission phase', () => {
    mockPhase.mockReturnValue('intermission')
    render(<PillView />)
    expect(screen.getByText('Intermission')).toBeInTheDocument()
    expect(screen.queryByText('Tap to expand')).not.toBeInTheDocument()
  })

  it('does NOT render fallback for strike phase', () => {
    mockPhase.mockReturnValue('strike')
    render(<PillView />)
    expect(screen.getByText('Show complete!')).toBeInTheDocument()
    expect(screen.queryByText('Tap to expand')).not.toBeInTheDocument()
  })
})
