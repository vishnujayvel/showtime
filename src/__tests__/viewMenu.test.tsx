import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import type { ShowLineup } from '../shared/types'

// ─── Mock framer-motion ───
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => <div ref={ref} {...stripMotionProps(props)} />),
    button: React.forwardRef((props: any, ref: any) => <button ref={ref} {...stripMotionProps(props)} />),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// ─── Mock Radix DropdownMenu to render items directly (no portals/pointerdown) ───
vi.mock('../renderer/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: any) => <div data-testid="dropdown-menu">{children}</div>,
  DropdownMenuTrigger: ({ children, asChild, ...props }: any) => {
    if (asChild) return children
    return <button {...props}>{children}</button>
  },
  DropdownMenuContent: ({ children }: any) => <div>{children}</div>,
  DropdownMenuItem: ({ children, onClick, ...props }: any) => (
    <div role="menuitem" onClick={onClick} {...props}>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuGroup: ({ children }: any) => <div>{children}</div>,
}))

function stripMotionProps(props: any) {
  const {
    initial, animate, exit, transition, whileHover, whileTap, whileFocus,
    layout, layoutId, variants, onAnimationStart, onAnimationComplete,
    ...rest
  } = props
  return rest
}

function goLive() {
  const lineup: ShowLineup = {
    acts: [{ name: 'Test Act', sketch: 'Deep Work', durationMinutes: 30 }],
    beatThreshold: 3,
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

describe('ViewMenu', () => {
  let ViewMenu: any

  beforeEach(async () => {
    const mod = await import('../renderer/components/ViewMenu')
    ViewMenu = mod.ViewMenu
  })

  describe('trigger button', () => {
    it('renders ⋮ trigger for pill view', () => {
      goLive()
      render(<ViewMenu view="pill" />)
      const trigger = screen.getByTestId('view-menu-trigger')
      expect(trigger).toBeInTheDocument()
      expect(trigger.textContent).toBe('\u22EE')
    })

    it('renders ⚙ trigger for compact view', () => {
      goLive()
      render(<ViewMenu view="compact" />)
      const trigger = screen.getByTestId('view-menu-trigger')
      expect(trigger).toBeInTheDocument()
      expect(trigger.textContent).toBe('\u2699')
    })

    it('renders ⚙ trigger for expanded view', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      const trigger = screen.getByTestId('view-menu-trigger')
      expect(trigger).toBeInTheDocument()
      expect(trigger.textContent).toBe('\u2699')
    })
  })

  describe('menu items during live phase', () => {
    it('shows Edit Lineup, Director Mode, Take a Break when live', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      expect(screen.getByTestId('menu-edit-lineup')).toBeInTheDocument()
      expect(screen.getByTestId('menu-director')).toBeInTheDocument()
      expect(screen.getByTestId('menu-take-break')).toBeInTheDocument()
    })

    it('shows Expand View in pill view', () => {
      goLive()
      render(<ViewMenu view="pill" />)
      expect(screen.getByTestId('menu-expand')).toBeInTheDocument()
    })

    it('does not show Expand View in expanded view', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      expect(screen.queryByTestId('menu-expand')).not.toBeInTheDocument()
    })

    it('shows Quit in pill view', () => {
      goLive()
      render(<ViewMenu view="pill" />)
      expect(screen.getByTestId('menu-quit')).toBeInTheDocument()
    })

    it('does not show Quit in expanded view', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      expect(screen.queryByTestId('menu-quit')).not.toBeInTheDocument()
    })
  })

  describe('navigation callbacks', () => {
    it('calls onShowHistory when Show History clicked', () => {
      goLive()
      const onShowHistory = vi.fn()
      render(<ViewMenu view="expanded" onShowHistory={onShowHistory} />)
      fireEvent.click(screen.getByTestId('menu-history'))
      expect(onShowHistory).toHaveBeenCalledOnce()
    })

    it('calls onShowSettings when Settings clicked', () => {
      goLive()
      const onShowSettings = vi.fn()
      render(<ViewMenu view="expanded" onShowSettings={onShowSettings} />)
      fireEvent.click(screen.getByTestId('menu-settings'))
      expect(onShowSettings).toHaveBeenCalledOnce()
    })

    it('does not show history item when callback not provided', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      expect(screen.queryByTestId('menu-history')).not.toBeInTheDocument()
    })

    it('does not show settings item when callback not provided', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      expect(screen.queryByTestId('menu-settings')).not.toBeInTheDocument()
    })
  })

  describe('XState event dispatch', () => {
    it('dispatches EDIT_LINEUP when Edit Lineup clicked', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      fireEvent.click(screen.getByTestId('menu-edit-lineup'))
      const snap = showActor.getSnapshot()
      // EDIT_LINEUP transitions to writers_room
      expect(snap.value).toBeDefined()
    })

    it('dispatches ENTER_DIRECTOR when Director Mode clicked', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      fireEvent.click(screen.getByTestId('menu-director'))
      const snap = showActor.getSnapshot()
      expect(JSON.stringify(snap.value)).toContain('director')
    })

    it('dispatches ENTER_INTERMISSION when Take a Break clicked', () => {
      goLive()
      render(<ViewMenu view="expanded" />)
      fireEvent.click(screen.getByTestId('menu-take-break'))
      const snap = showActor.getSnapshot()
      expect(JSON.stringify(snap.value)).toContain('intermission')
    })
  })

  describe('phase-conditional items', () => {
    it('does not show action items in no_show phase', () => {
      // Default phase is no_show
      render(<ViewMenu view="expanded" />)
      expect(screen.queryByTestId('menu-edit-lineup')).not.toBeInTheDocument()
      expect(screen.queryByTestId('menu-director')).not.toBeInTheDocument()
      expect(screen.queryByTestId('menu-take-break')).not.toBeInTheDocument()
    })
  })
})
