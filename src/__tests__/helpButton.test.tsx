import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'

// ─── Mock framer-motion to avoid animation issues in tests ───
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => <div ref={ref} {...props} />),
    button: React.forwardRef((props: any, ref: any) => <button ref={ref} {...props} />),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

const DOCS_BASE = 'https://vishnujayvel.github.io/showtime'

describe('HelpButton', () => {
  let HelpButton: any

  beforeEach(async () => {
    cleanup()
    vi.clearAllMocks()
    const mod = await import('../renderer/components/HelpButton')
    HelpButton = mod.HelpButton
  })

  it('renders a ? button', () => {
    render(<HelpButton phase="no_show" />)
    const btn = screen.getByTestId('help-button')
    expect(btn).toBeInTheDocument()
    expect(btn.textContent).toBe('?')
  })

  it('has title "Help"', () => {
    render(<HelpButton phase="no_show" />)
    const btn = screen.getByTitle('Help')
    expect(btn).toBeInTheDocument()
  })

  it('calls openExternal with getting-started URL for no_show phase', () => {
    render(<HelpButton phase="no_show" />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/getting-started`
    )
  })

  it('calls openExternal with writers-room URL for writers_room phase', () => {
    render(<HelpButton phase="writers_room" />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/writers-room`
    )
  })

  it('calls openExternal with live-show URL for live phase', () => {
    render(<HelpButton phase="live" />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/live-show`
    )
  })

  it('calls openExternal with framework#strike URL for strike phase', () => {
    render(<HelpButton phase="strike" />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/framework#strike`
    )
  })

  it('calls openExternal with settings URL for settings phase', () => {
    render(<HelpButton phase="settings" />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/settings`
    )
  })

  it('calls openExternal with live-show URL for intermission phase', () => {
    render(<HelpButton phase="intermission" />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/live-show`
    )
  })

  it('calls openExternal with live-show URL for director phase', () => {
    render(<HelpButton phase="director" />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/live-show`
    )
  })

  it('falls back to getting-started for unknown phase', () => {
    render(<HelpButton phase={'unknown_phase' as any} />)
    fireEvent.click(screen.getByTestId('help-button'))
    expect(window.showtime.openExternal).toHaveBeenCalledWith(
      `${DOCS_BASE}/guide/getting-started`
    )
  })

  it('applies custom className', () => {
    render(<HelpButton phase="no_show" className="ml-2" />)
    const btn = screen.getByTestId('help-button')
    expect(btn.className).toContain('ml-2')
  })
})
