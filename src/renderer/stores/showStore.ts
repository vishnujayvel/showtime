import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ShowPhase, EnergyLevel, Act, ActStatus, ShowVerdict, ShowLineup } from '../../shared/types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

interface ShowActions {
  // Writer's Room
  setEnergy: (level: EnergyLevel) => void
  setLineup: (lineup: ShowLineup) => void
  startShow: () => void

  // Act lifecycle
  startAct: (actId: string) => void
  completeAct: (actId: string) => void
  skipAct: (actId: string) => void
  extendAct: (minutes: number) => void

  // Beat tracking
  lockBeat: () => void
  skipBeat: () => void

  // Intermission
  enterIntermission: () => void
  exitIntermission: () => void

  // Director Mode
  enterDirector: () => void
  exitDirector: () => void
  callShowEarly: () => void

  // Lineup editing
  reorderAct: (actId: string, direction: 'up' | 'down') => void
  removeAct: (actId: string) => void
  addAct: (name: string, sketch: string, durationMinutes: number) => void

  // Strike
  strikeTheStage: () => void

  // Navigation
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void

  // Reset
  resetShow: () => void

  // Session
  setClaudeSessionId: (id: string) => void
}

interface ShowStoreState {
  phase: ShowPhase
  energy: EnergyLevel | null
  acts: Act[]
  currentActId: string | null
  beatsLocked: number
  beatThreshold: number
  timerEndAt: number | null
  timerPausedRemaining: number | null
  claudeSessionId: string | null
  showDate: string
  verdict: ShowVerdict | null
  isExpanded: boolean
  beatCheckPending: boolean
}

export type ShowStore = ShowStoreState & ShowActions

const initialState: ShowStoreState = {
  phase: 'no_show',
  energy: null,
  acts: [],
  currentActId: null,
  beatsLocked: 0,
  beatThreshold: 3,
  timerEndAt: null,
  timerPausedRemaining: null,
  claudeSessionId: null,
  showDate: today(),
  verdict: null,
  isExpanded: true,
  beatCheckPending: false,
}

export const useShowStore = create<ShowStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ─── Writer's Room ───

      setEnergy: (level) => set({ energy: level }),

      setLineup: (lineup) => {
        const acts: Act[] = lineup.acts.map((a, i) => ({
          id: generateId(),
          name: a.name,
          sketch: a.sketch,
          durationMinutes: a.durationMinutes,
          status: 'upcoming' as ActStatus,
          beatLocked: false,
          order: i,
        }))
        set({
          acts,
          beatThreshold: lineup.beatThreshold,
          phase: 'writers_room',
        })
      },

      startShow: () => {
        const { acts } = get()
        if (acts.length === 0) return

        const firstAct = acts[0]
        const now = Date.now()
        set({
          phase: 'live',
          isExpanded: false,
          currentActId: firstAct.id,
          timerEndAt: now + firstAct.durationMinutes * 60 * 1000,
          showDate: today(),
          acts: acts.map((a, i) =>
            i === 0 ? { ...a, status: 'active' as ActStatus, startedAt: now } : a
          ),
        })
      },

      // ─── Act Lifecycle ───

      startAct: (actId) => {
        const now = Date.now()
        const act = get().acts.find((a) => a.id === actId)
        if (!act) return

        set((s) => ({
          currentActId: actId,
          timerEndAt: now + act.durationMinutes * 60 * 1000,
          timerPausedRemaining: null,
          phase: 'live',
          acts: s.acts.map((a) =>
            a.id === actId ? { ...a, status: 'active' as ActStatus, startedAt: now } : a
          ),
        }))
      },

      completeAct: (actId) => {
        const act = get().acts.find((a) => a.id === actId)
        set((s) => ({
          acts: s.acts.map((a) =>
            a.id === actId ? { ...a, status: 'completed' as ActStatus, completedAt: Date.now() } : a
          ),
          timerEndAt: null,
          timerPausedRemaining: null,
          beatCheckPending: true,
        }))
        if (act) window.clui.notifyActComplete(act.name)
        window.clui.notifyBeatCheck()
      },

      skipAct: (actId) => {
        const state = get()
        const wasActive = state.currentActId === actId

        set((s) => {
          const newActs = s.acts.map((a) =>
            a.id === actId ? { ...a, status: 'skipped' as ActStatus, completedAt: Date.now() } : a
          )
          const nextAct = newActs.find((a) => a.status === 'upcoming')

          return {
            acts: newActs,
            currentActId: wasActive ? (nextAct?.id ?? null) : s.currentActId,
            timerEndAt: wasActive ? null : s.timerEndAt,
            timerPausedRemaining: wasActive ? null : s.timerPausedRemaining,
          }
        })

        // If was active and there's a next act, auto-start it
        const nextAct = get().acts.find((a) => a.status === 'upcoming')
        if (wasActive && nextAct) {
          get().startAct(nextAct.id)
        } else if (wasActive && !nextAct) {
          get().strikeTheStage()
        }
      },

      extendAct: (minutes) => {
        set((s) => ({
          timerEndAt: s.timerEndAt ? s.timerEndAt + minutes * 60 * 1000 : null,
        }))
      },

      // ─── Beat Tracking ───

      lockBeat: () => {
        const { currentActId } = get()
        set((s) => ({
          beatsLocked: s.beatsLocked + 1,
          beatCheckPending: false,
          acts: s.acts.map((a) =>
            a.id === currentActId ? { ...a, beatLocked: true } : a
          ),
        }))

        // Start next act or strike
        const state = get()
        const nextAct = state.acts.find((a) => a.status === 'upcoming')
        if (nextAct) {
          get().startAct(nextAct.id)
        } else {
          get().strikeTheStage()
        }
      },

      skipBeat: () => {
        set({ beatCheckPending: false })

        // Start next act or strike
        const state = get()
        const nextAct = state.acts.find((a) => a.status === 'upcoming')
        if (nextAct) {
          get().startAct(nextAct.id)
        } else {
          get().strikeTheStage()
        }
      },

      // ─── Intermission ───

      enterIntermission: () => {
        const { timerEndAt } = get()
        const remaining = timerEndAt ? Math.max(0, timerEndAt - Date.now()) : null

        set({
          phase: 'intermission',
          timerEndAt: null,
          timerPausedRemaining: remaining,
        })
      },

      exitIntermission: () => {
        const { timerPausedRemaining, currentActId } = get()

        if (timerPausedRemaining && currentActId) {
          set({
            phase: 'live',
            timerEndAt: Date.now() + timerPausedRemaining,
            timerPausedRemaining: null,
          })
        } else {
          // Between acts — start next
          const nextAct = get().acts.find((a) => a.status === 'upcoming')
          if (nextAct) {
            set({ phase: 'live' })
            get().startAct(nextAct.id)
          } else {
            get().strikeTheStage()
          }
        }
      },

      // ─── Director Mode ───

      enterDirector: () => set({ phase: 'director' }),

      exitDirector: () => {
        const { currentActId } = get()
        set({ phase: currentActId ? 'live' : 'no_show' })
      },

      callShowEarly: () => {
        set((s) => ({
          acts: s.acts.map((a) =>
            a.status === 'upcoming' || a.status === 'active'
              ? { ...a, status: 'skipped' as ActStatus, completedAt: Date.now() }
              : a
          ),
          currentActId: null,
          timerEndAt: null,
          timerPausedRemaining: null,
        }))
        get().strikeTheStage()
      },

      // ─── Lineup Editing ───

      reorderAct: (actId, direction) => {
        set((s) => {
          const sorted = [...s.acts].sort((a, b) => a.order - b.order)
          const idx = sorted.findIndex((a) => a.id === actId)
          if (idx < 0) return s
          const swapIdx = direction === 'up' ? idx - 1 : idx + 1
          if (swapIdx < 0 || swapIdx >= sorted.length) return s

          const newOrder = [...sorted]
          ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
          return {
            acts: newOrder.map((a, i) => ({ ...a, order: i })),
          }
        })
      },

      removeAct: (actId) => {
        set((s) => ({
          acts: s.acts.filter((a) => a.id !== actId).map((a, i) => ({ ...a, order: i })),
        }))
      },

      addAct: (name, sketch, durationMinutes) => {
        set((s) => ({
          acts: [
            ...s.acts,
            {
              id: generateId(),
              name,
              sketch,
              durationMinutes,
              status: 'upcoming' as ActStatus,
              beatLocked: false,
              order: s.acts.length,
            },
          ],
        }))
      },

      // ─── Strike the Stage ───

      strikeTheStage: () => {
        const { beatsLocked, beatThreshold } = get()
        let verdict: ShowVerdict

        if (beatsLocked >= beatThreshold) {
          verdict = 'DAY_WON'
        } else if (beatsLocked === beatThreshold - 1) {
          verdict = 'SOLID_SHOW'
        } else if (beatsLocked >= Math.ceil(beatThreshold / 2)) {
          verdict = 'GOOD_EFFORT'
        } else {
          verdict = 'SHOW_CALLED_EARLY'
        }

        set({
          phase: 'strike',
          verdict,
          currentActId: null,
          timerEndAt: null,
          timerPausedRemaining: null,
          isExpanded: true,
          beatCheckPending: false,
        })
        window.clui.notifyVerdict(verdict)
      },

      // ─── Navigation ───

      toggleExpanded: () => set((s) => ({ isExpanded: !s.isExpanded })),
      setExpanded: (expanded) => set({ isExpanded: expanded }),

      // ─── Reset ───

      resetShow: () => set({ ...initialState, showDate: today(), isExpanded: true }),

      // ─── Session ───

      setClaudeSessionId: (id) => set({ claudeSessionId: id }),
    }),
    {
      name: 'showtime-show-state',
      partialize: (state) => {
        // Don't persist transient UI state
        const { beatCheckPending: _bcp, ...rest } = state
        return rest
      },
      onRehydrateStorage: () => {
        return (rehydratedState) => {
          if (!rehydratedState) return
          // Day boundary: if show date isn't today, reset
          if (rehydratedState.showDate !== today()) {
            Object.assign(rehydratedState, { ...initialState, showDate: today(), isExpanded: true })
          }
        }
      },
    }
  )
)

// ─── Selectors ───

export const selectCurrentAct = (s: ShowStore): Act | undefined =>
  s.acts.find((a) => a.id === s.currentActId)

export const selectNextAct = (s: ShowStore): Act | undefined =>
  s.acts.find((a) => a.status === 'upcoming')

export const selectCompletedActs = (s: ShowStore): Act[] =>
  s.acts.filter((a) => a.status === 'completed')

export const selectSkippedActs = (s: ShowStore): Act[] =>
  s.acts.filter((a) => a.status === 'skipped')

export const selectBeatsRemaining = (s: ShowStore): number =>
  Math.max(0, s.beatThreshold - s.beatsLocked)
