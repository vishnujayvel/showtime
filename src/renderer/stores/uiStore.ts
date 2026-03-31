/**
 * UI Store — non-phase state that doesn't belong in the XState machine.
 *
 * Calendar state, Claude session ID, and other UI-only concerns.
 * Phase state (energy, acts, timer, etc.) is managed by the showActor.
 */
import { create } from 'zustand'
import type { CalendarEvent, CalendarFetchStatus } from '../../shared/types'

interface UIStoreState {
  calendarAvailable: boolean
  calendarEnabled: boolean
  calendarEvents: CalendarEvent[]
  calendarFetchStatus: CalendarFetchStatus
  calendarFetchedAt: number | null
  claudeSessionId: string | null
}

interface UIStoreActions {
  setCalendarAvailable: (available: boolean) => void
  setCalendarEnabled: (enabled: boolean) => void
  setCalendarEvents: (events: CalendarEvent[]) => void
  setCalendarFetchStatus: (status: CalendarFetchStatus) => void
  clearCalendarCache: () => void
  setClaudeSessionId: (id: string) => void
}

export type UIStore = UIStoreState & UIStoreActions

export const useUIStore = create<UIStore>()((set) => ({
  calendarAvailable: typeof localStorage !== 'undefined' && localStorage.getItem('showtime-gcal-connected') === 'true',
  calendarEnabled: typeof localStorage !== 'undefined' && localStorage.getItem('showtime-calendar-enabled') === 'true',
  calendarEvents: [],
  calendarFetchStatus: 'idle',
  calendarFetchedAt: null,
  claudeSessionId: null,

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
}))
