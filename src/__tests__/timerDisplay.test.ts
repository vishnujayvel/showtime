import { describe, it, expect, beforeEach } from 'vitest'
import { useUIStore } from '../renderer/stores/uiStore'

describe('timerDisplay store', () => {
  beforeEach(() => {
    // Reset store to defaults
    useUIStore.setState({
      timerDisplay: 'pill',
    })
    localStorage.clear()
  })

  it('defaults to pill', () => {
    expect(useUIStore.getState().timerDisplay).toBe('pill')
  })

  it('setTimerDisplay updates to menubar', () => {
    useUIStore.getState().setTimerDisplay('menubar')
    expect(useUIStore.getState().timerDisplay).toBe('menubar')
  })

  it('setTimerDisplay updates to pill', () => {
    useUIStore.getState().setTimerDisplay('menubar')
    useUIStore.getState().setTimerDisplay('pill')
    expect(useUIStore.getState().timerDisplay).toBe('pill')
  })

  it('toggleTimerDisplay toggles from pill to menubar', () => {
    expect(useUIStore.getState().timerDisplay).toBe('pill')
    useUIStore.getState().toggleTimerDisplay()
    expect(useUIStore.getState().timerDisplay).toBe('menubar')
  })

  it('toggleTimerDisplay toggles from menubar to pill', () => {
    useUIStore.getState().setTimerDisplay('menubar')
    useUIStore.getState().toggleTimerDisplay()
    expect(useUIStore.getState().timerDisplay).toBe('pill')
  })

  it('toggleTimerDisplay round-trips correctly', () => {
    expect(useUIStore.getState().timerDisplay).toBe('pill')
    useUIStore.getState().toggleTimerDisplay()
    expect(useUIStore.getState().timerDisplay).toBe('menubar')
    useUIStore.getState().toggleTimerDisplay()
    expect(useUIStore.getState().timerDisplay).toBe('pill')
  })

  it('setTimerDisplay persists to localStorage', () => {
    useUIStore.getState().setTimerDisplay('menubar')
    expect(localStorage.getItem('showtime-timer-display')).toBe('menubar')
  })

  it('toggleTimerDisplay persists to localStorage', () => {
    useUIStore.getState().toggleTimerDisplay()
    expect(localStorage.getItem('showtime-timer-display')).toBe('menubar')

    useUIStore.getState().toggleTimerDisplay()
    expect(localStorage.getItem('showtime-timer-display')).toBe('pill')
  })

  it('setTimerDisplay overwrites previous localStorage value', () => {
    useUIStore.getState().setTimerDisplay('menubar')
    expect(localStorage.getItem('showtime-timer-display')).toBe('menubar')

    useUIStore.getState().setTimerDisplay('pill')
    expect(localStorage.getItem('showtime-timer-display')).toBe('pill')
  })
})
