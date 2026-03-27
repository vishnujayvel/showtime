import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import type { ShowLineup } from '../shared/types'

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
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

beforeEach(() => {
  cleanup()
})

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Morning Focus', sketch: 'Deep Work', durationMinutes: 45 },
    { name: 'Team Standup', sketch: 'Admin', durationMinutes: 15 },
    { name: 'Gym Session', sketch: 'Exercise', durationMinutes: 60 },
  ],
  beatThreshold: 3,
  openingNote: 'You got this!',
}

describe('LineupCard', () => {
  let LineupCard: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/LineupCard')
    LineupCard = mod.LineupCard
  })

  it('renders all acts', () => {
    render(<LineupCard lineup={sampleLineup} onEdit={() => {}} />)
    expect(screen.getByText('Morning Focus')).toBeInTheDocument()
    expect(screen.getByText('Team Standup')).toBeInTheDocument()
    expect(screen.getByText('Gym Session')).toBeInTheDocument()
  })

  it('renders opening note', () => {
    render(<LineupCard lineup={sampleLineup} onEdit={() => {}} />)
    expect(screen.getByText('You got this!')).toBeInTheDocument()
  })

  it('renders DRAFT badge', () => {
    render(<LineupCard lineup={sampleLineup} onEdit={() => {}} />)
    expect(screen.getByText('DRAFT')).toBeInTheDocument()
  })

  it('renders total time and act count', () => {
    render(<LineupCard lineup={sampleLineup} onEdit={() => {}} />)
    // 45 + 15 + 60 = 120m = 2h 0m
    expect(screen.getByText(/2h 0m/)).toBeInTheDocument()
    expect(screen.getByText(/3 acts/)).toBeInTheDocument()
  })

  it('renders category badges for each act', () => {
    render(<LineupCard lineup={sampleLineup} onEdit={() => {}} />)
    expect(screen.getByTestId('act-category-0')).toHaveTextContent('Deep Work')
    expect(screen.getByTestId('act-category-1')).toHaveTextContent('Admin')
    expect(screen.getByTestId('act-category-2')).toHaveTextContent('Exercise')
  })

  it('renders duration for each act', () => {
    render(<LineupCard lineup={sampleLineup} onEdit={() => {}} />)
    expect(screen.getByTestId('act-duration-0')).toHaveTextContent('45m')
    expect(screen.getByTestId('act-duration-1')).toHaveTextContent('15m')
    expect(screen.getByTestId('act-duration-2')).toHaveTextContent('60m')
  })

  it('allows editing act name', () => {
    const onEdit = vi.fn()
    render(<LineupCard lineup={sampleLineup} onEdit={onEdit} />)

    // Click act name to enter edit mode
    fireEvent.click(screen.getByTestId('act-name-0'))
    const input = screen.getByTestId('act-name-input-0')
    expect(input).toBeInTheDocument()

    // Change the value and blur to commit
    fireEvent.change(input, { target: { value: 'Deep Code Review' } })
    fireEvent.blur(input)

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        acts: expect.arrayContaining([
          expect.objectContaining({ name: 'Deep Code Review' }),
        ]),
      })
    )
  })

  it('allows editing act duration', () => {
    const onEdit = vi.fn()
    render(<LineupCard lineup={sampleLineup} onEdit={onEdit} />)

    // Click duration to enter edit mode
    fireEvent.click(screen.getByTestId('act-duration-0'))
    const input = screen.getByTestId('act-duration-input-0')
    expect(input).toBeInTheDocument()

    // Change the value and blur
    fireEvent.change(input, { target: { value: '90' } })
    fireEvent.blur(input)

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        acts: expect.arrayContaining([
          expect.objectContaining({ durationMinutes: 90 }),
        ]),
      })
    )
  })

  it('allows changing act category', () => {
    const onEdit = vi.fn()
    render(<LineupCard lineup={sampleLineup} onEdit={onEdit} />)

    // Click category badge to open picker
    fireEvent.click(screen.getByTestId('act-category-0'))

    // Select "Creative"
    fireEvent.click(screen.getByText('Creative'))

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        acts: expect.arrayContaining([
          expect.objectContaining({ sketch: 'Creative' }),
        ]),
      })
    )
  })

  it('allows removing an act', () => {
    const onEdit = vi.fn()
    render(<LineupCard lineup={sampleLineup} onEdit={onEdit} />)

    fireEvent.click(screen.getByTestId('act-remove-1'))

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        acts: expect.not.arrayContaining([
          expect.objectContaining({ name: 'Team Standup' }),
        ]),
      })
    )
    // Should have 2 acts left
    const call = onEdit.mock.calls[0][0]
    expect(call.acts).toHaveLength(2)
  })

  it('allows adding a new act', () => {
    const onEdit = vi.fn()
    render(<LineupCard lineup={sampleLineup} onEdit={onEdit} />)

    fireEvent.click(screen.getByTestId('lineup-add-act'))

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        acts: expect.arrayContaining([
          expect.objectContaining({ name: 'New Act' }),
        ]),
      })
    )
    const call = onEdit.mock.calls[0][0]
    expect(call.acts).toHaveLength(4)
  })

  it('cancels name edit on Escape', () => {
    const onEdit = vi.fn()
    render(<LineupCard lineup={sampleLineup} onEdit={onEdit} />)

    fireEvent.click(screen.getByTestId('act-name-0'))
    const input = screen.getByTestId('act-name-input-0')
    fireEvent.change(input, { target: { value: 'Something else' } })
    fireEvent.keyDown(input, { key: 'Escape' })

    // Should not have called onEdit
    expect(onEdit).not.toHaveBeenCalled()
    // Should show original name again
    expect(screen.getByTestId('act-name-0')).toHaveTextContent('Morning Focus')
  })

  it('commits name edit on Enter', () => {
    const onEdit = vi.fn()
    render(<LineupCard lineup={sampleLineup} onEdit={onEdit} />)

    fireEvent.click(screen.getByTestId('act-name-0'))
    const input = screen.getByTestId('act-name-input-0')
    fireEvent.change(input, { target: { value: 'New Name' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onEdit).toHaveBeenCalledWith(
      expect.objectContaining({
        acts: expect.arrayContaining([
          expect.objectContaining({ name: 'New Name' }),
        ]),
      })
    )
  })
})
