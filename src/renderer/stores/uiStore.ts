/**
 * UI Store — non-phase state that doesn't belong in the XState machine.
 *
 * Calendar state, Claude session ID, and other UI-only concerns.
 * Phase state (energy, acts, timer, etc.) is managed by the showActor.
 */
import { create } from 'zustand'
import type { CalendarEvent, CalendarFetchStatus } from '../../shared/types'

/** Where the countdown timer is rendered: floating pill or macOS menu bar. */
export type TimerDisplay = 'pill' | 'menubar'

interface UIStoreState {
  calendarAvailable: boolean
  calendarEnabled: boolean
  calendarEvents: CalendarEvent[]
  calendarFetchStatus: CalendarFetchStatus
  calendarFetchedAt: number | null
  claudeSessionId: string | null
  timerDisplay: TimerDisplay
}

interface UIStoreActions {
  setCalendarAvailable: (available: boolean) => void
  setCalendarEnabled: (enabled: boolean) => void
  setCalendarEvents: (events: CalendarEvent[]) => void
  setCalendarFetchStatus: (status: CalendarFetchStatus) => void
  clearCalendarCache: () => void
  setClaudeSessionId: (id: string | null) => void
  setTimerDisplay: (mode: TimerDisplay) => void
  toggleTimerDisplay: () => void
}

/** Combined state and actions type for the UI Zustand store. */
export type UIStore = UIStoreState & UIStoreActions

/** Zustand store for non-phase UI state like calendar cache, Claude session, and timer display. */
export const useUIStore = create<UIStore>()((set) => ({
  calendarAvailable: typeof localStorage !== 'undefined' && localStorage.getItem('showtime-gcal-connected') === 'true',
  calendarEnabled: typeof localStorage !== 'undefined' && localStorage.getItem('showtime-calendar-enabled') === 'true',
  calendarEvents: [],
  calendarFetchStatus: 'idle',
  calendarFetchedAt: null,
  claudeSessionId: null,
  timerDisplay: (typeof localStorage !== 'undefined' && localStorage.getItem('showtime-timer-display') as TimerDisplay) || 'pill',

  setCalendarAvailable: (available) => set({ calendarAvailable: available }),

  setCalendarEnabled: (enabled) => {
    try {
      localStorage.setItem('showtime-calendar-enabled', String(enabled))
    } catch { /* ignore storage errors */ }
    set({ calendarEnabled: enabled })
  },

  setCalendarEvents: (events) => set({
    calendarEvents: events,
    calendarFetchStatus: 'ready',
    calendarFetchedAt: Date.now(),
  }),

  setCalendarFetchStatus: (status) => set({ calendarFetchStatus: status }),

  clearCalendarCache: () => set({
    calendarEvents: [],
    calendarFetchStatus: 'idle',
    calendarFetchedAt: null,
  }),

  setClaudeSessionId: (id) => set({ claudeSessionId: id }),

  setTimerDisplay: (mode) => {
    try { localStorage.setItem('showtime-timer-display', mode) } catch { /* ignore */ }
    set({ timerDisplay: mode })
  },

  toggleTimerDisplay: () => set((state) => {
    const next = state.timerDisplay === 'pill' ? 'menubar' as const : 'pill' as const
    try { localStorage.setItem('showtime-timer-display', next) } catch { /* ignore */ }
    return { timerDisplay: next }
  }),
}))
