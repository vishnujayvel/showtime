import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { ShowPhase, EnergyLevel, Act, ActStatus, ShowVerdict, ShowLineup, WritersRoomStep, ViewTier, CalendarEvent, CalendarFetchStatus } from '../../shared/types'
import { nextViewTier, expandTier, collapseTier } from '../../shared/types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const VERDICT_MESSAGES: Record<ShowVerdict, string> = {
  DAY_WON: 'You showed up and you were present.',
  SOLID_SHOW: 'Not every sketch lands. The show was still great.',
  GOOD_EFFORT: 'You got on stage. That\'s the hardest part.',
  SHOW_CALLED_EARLY: 'Sometimes the show is short. The audience still came.',
}

interface ShowActions {
  // Writer's Room
  enterWritersRoom: () => void
  setWritersRoomStep: (step: WritersRoomStep) => void
  setEnergy: (level: EnergyLevel) => void
  setLineup: (lineup: ShowLineup) => void
  startShow: () => void

  // Cold Open transition (Dark Studio → Writer's Room)
  triggerColdOpen: () => void
  completeColdOpen: () => void

  // Going Live transition
  triggerGoingLive: () => void
  completeGoingLive: () => void

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
  skipToNextAct: () => void
  callShowEarly: () => void
  startBreathingPause: (durationMs?: number) => void
  endBreathingPause: () => void

  // Lineup editing
  reorderAct: (actId: string, direction: 'up' | 'down') => void
  removeAct: (actId: string) => void
  addAct: (name: string, sketch: string, durationMinutes: number) => void

  // Strike
  strikeTheStage: () => void

  // Navigation (view tier)
  cycleViewTier: () => void
  expandViewTier: () => void
  collapseViewTier: () => void
  setViewTier: (tier: ViewTier) => void
  // Backward compat — maps to viewTier
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void

  // Reset
  resetShow: () => void

  // Calendar
  calendarAvailable: boolean
  calendarEnabled: boolean
  calendarEvents: CalendarEvent[]
  calendarFetchStatus: CalendarFetchStatus
  calendarFetchedAt: number | null
  setCalendarAvailable: (available: boolean) => void
  setCalendarEnabled: (enabled: boolean) => void
  setCalendarEvents: (events: CalendarEvent[]) => void
  setCalendarFetchStatus: (status: CalendarFetchStatus) => void
  clearCalendarCache: () => void

  // Session
  setClaudeSessionId: (id: string) => void

  // SQLite hydration
  hydrateFromSQLite: () => Promise<void>
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
  showStartedAt: number | null
  verdict: ShowVerdict | null
  viewTier: ViewTier
  beatCheckPending: boolean
  celebrationActive: boolean
  coldOpenActive: boolean
  goingLiveActive: boolean
  writersRoomStep: WritersRoomStep
  writersRoomEnteredAt: number | null
  breathingPauseEndAt: number | null
  calendarAvailable: boolean
  calendarEnabled: boolean
  calendarEvents: CalendarEvent[]
  calendarFetchStatus: CalendarFetchStatus
  calendarFetchedAt: number | null
}

export type ShowStore = ShowStoreState & ShowActions

// Module-level timeout tracker for beat celebration (outside store to avoid serialization)
let celebrationTimeout: ReturnType<typeof setTimeout> | null = null

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
  showStartedAt: null,
  verdict: null,
  viewTier: 'expanded' as ViewTier,
  beatCheckPending: false,
  celebrationActive: false,
  coldOpenActive: false,
  goingLiveActive: false,
  writersRoomStep: 'energy',
  writersRoomEnteredAt: null,
  breathingPauseEndAt: null,
  calendarAvailable: typeof localStorage !== 'undefined' && localStorage.getItem('showtime-gcal-connected') === 'true',
  calendarEnabled: typeof localStorage !== 'undefined' && localStorage.getItem('showtime-calendar-enabled') === 'true',
  calendarEvents: [],
  calendarFetchStatus: 'idle',
  calendarFetchedAt: null,
}

// ─── SQLite sync helpers ───

function buildSnapshot(state: ShowStoreState) {
  return {
    showId: state.showDate,
    phase: state.phase,
    energy: state.energy,
    verdict: state.verdict,
    beatsLocked: state.beatsLocked,
    beatThreshold: state.beatThreshold,
    startedAt: state.showStartedAt,
    planText: null as string | null,
    acts: state.acts.map((a) => ({
      id: a.id,
      name: a.name,
      sketch: a.sketch,
      category: null as string | null,
      plannedDurationMs: a.durationMinutes * 60 * 1000,
      actualDurationMs: a.completedAt && a.startedAt ? a.completedAt - a.startedAt : null,
      sortOrder: a.order,
      status: a.status === 'upcoming' ? 'pending' : a.status,
      beatLocked: a.beatLocked ? 1 : 0,
      plannedStartAt: null as number | null,
      actualStartAt: a.startedAt ?? null,
      actualEndAt: a.completedAt ?? null,
    })),
  }
}

function syncToSQLite(state: ShowStoreState): void {
  try {
    window.clui.dataSync(buildSnapshot(state))
  } catch { /* ignore if clui not ready */ }
}

function flushToSQLite(state: ShowStoreState): void {
  try {
    window.clui.dataFlush(buildSnapshot(state))
  } catch { /* ignore if clui not ready */ }
}

function logEvent(event: string, data?: Record<string, unknown>): void {
  try {
    window.clui.logEvent('INFO', event, data)
  } catch { /* ignore if clui not ready */ }
}

function recordTimeline(eventType: string, showId: string, actId?: string | null, extra?: Record<string, unknown>): void {
  try {
    window.clui.timelineRecord({
      showId,
      actId: actId ?? null,
      eventType,
      actualStart: (extra?.actualStart as number | null) ?? null,
      actualEnd: (extra?.actualEnd as number | null) ?? null,
      plannedStart: (extra?.plannedStart as number | null) ?? null,
      plannedEnd: (extra?.plannedEnd as number | null) ?? null,
      driftSeconds: (extra?.driftSeconds as number | null) ?? null,
      metadata: (extra?.metadata as Record<string, unknown> | null) ?? null,
    })
  } catch { /* ignore if clui not ready */ }
}

export const useShowStore = create<ShowStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // ─── Writer's Room ───

      enterWritersRoom: () => {
        logEvent('phase_change', { from: get().phase, to: 'writers_room' })
        set({
          phase: 'writers_room',
          writersRoomStep: 'energy',
          writersRoomEnteredAt: Date.now(),
        })
      },

      setWritersRoomStep: (step) => set({ writersRoomStep: step }),

      setEnergy: (level) => {
        logEvent('energy_selected', { level })
        set({ energy: level })
      },

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
        logEvent('phase_change', { from: get().phase, to: 'live', actCount: acts.length })

        const firstAct = acts[0]
        const now = Date.now()
        set({
          phase: 'live',
          viewTier: 'micro' as ViewTier,
          currentActId: firstAct.id,
          timerEndAt: now + firstAct.durationMinutes * 60 * 1000,
          showDate: today(),
          showStartedAt: now,
          acts: acts.map((a, i) =>
            i === 0 ? { ...a, status: 'active' as ActStatus, startedAt: now } : a
          ),
        })
        const state = get()
        recordTimeline('show_started', state.showDate, null, { actualStart: now })
        recordTimeline('act_started', state.showDate, firstAct.id, { actualStart: now })
        flushToSQLite(state)
      },

      // ─── Cold Open Transition ───

      triggerColdOpen: () => set({ coldOpenActive: true }),

      completeColdOpen: () => {
        set({ coldOpenActive: false })
        get().enterWritersRoom()
      },

      // ─── Going Live Transition ───

      triggerGoingLive: () => set({ goingLiveActive: true }),

      completeGoingLive: () => {
        set({ goingLiveActive: false })
        get().startShow()
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
        recordTimeline('act_started', get().showDate, actId, { actualStart: now })
        flushToSQLite(get())
      },

      completeAct: (actId) => {
        const act = get().acts.find((a) => a.id === actId)
        const now = Date.now()
        set((s) => ({
          acts: s.acts.map((a) =>
            a.id === actId ? { ...a, status: 'completed' as ActStatus, completedAt: now } : a
          ),
          timerEndAt: null,
          timerPausedRemaining: null,
          beatCheckPending: true,
        }))
        if (act) {
          const actualMs = act.startedAt ? now - act.startedAt : 0
          const plannedMs = act.durationMinutes * 60 * 1000
          const driftSeconds = Math.round((actualMs - plannedMs) / 1000)
          recordTimeline('act_completed', get().showDate, actId, {
            actualStart: act.startedAt,
            actualEnd: now,
            driftSeconds,
          })
          window.clui.notifyActComplete(act.name, act.sketch)
          window.clui.notifyBeatCheck(act.name)
        }
        flushToSQLite(get())
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
        recordTimeline('act_cut', get().showDate, actId, { actualEnd: Date.now() })
        flushToSQLite(get())

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
        recordTimeline('act_extended', get().showDate, get().currentActId, {
          metadata: { extensionMinutes: minutes },
        })
        syncToSQLite(get())
      },

      // ─── Beat Tracking ───

      lockBeat: () => {
        logEvent('beat_locked', { beatsLocked: get().beatsLocked + 1 })
        // Clear any in-flight celebration timeout to prevent race conditions
        if (celebrationTimeout) {
          clearTimeout(celebrationTimeout)
          celebrationTimeout = null
        }

        const { currentActId } = get()
        set((s) => ({
          beatsLocked: s.beatsLocked + 1,
          celebrationActive: true,
          acts: s.acts.map((a) =>
            a.id === currentActId ? { ...a, beatLocked: true } : a
          ),
        }))

        // Capture phase at time of lock — if it changes, the callback is stale
        const lockPhase = get().phase

        // Celebration delay — show "That moment was real" for 1800ms before advancing
        celebrationTimeout = setTimeout(() => {
          celebrationTimeout = null

          // Guard: only advance if still in the same phase and celebration is active
          if (get().phase !== lockPhase || !get().celebrationActive) {
            set({ celebrationActive: false })
            return
          }

          set({ celebrationActive: false, beatCheckPending: false })

          // Start next act or strike
          const state = get()
          const nextAct = state.acts.find((a) => a.status === 'upcoming')
          if (nextAct) {
            get().startAct(nextAct.id)
          } else {
            get().strikeTheStage()
          }
        }, 1800)
      },

      skipBeat: () => {
        logEvent('beat_skipped')
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
        logEvent('phase_change', { from: get().phase, to: 'intermission' })
        const { timerEndAt } = get()
        const remaining = timerEndAt ? Math.max(0, timerEndAt - Date.now()) : null

        set({
          phase: 'intermission',
          timerEndAt: null,
          timerPausedRemaining: remaining,
        })
        recordTimeline('intermission_started', get().showDate, null, { actualStart: Date.now() })
        flushToSQLite(get())
      },

      exitIntermission: () => {
        const { timerPausedRemaining, currentActId } = get()
        recordTimeline('intermission_ended', get().showDate, null, { actualEnd: Date.now() })

        if (timerPausedRemaining && currentActId) {
          set({
            phase: 'live',
            timerEndAt: Date.now() + timerPausedRemaining,
            timerPausedRemaining: null,
          })
          flushToSQLite(get())
        } else {
          // Between acts — start next
          const nextAct = get().acts.find((a) => a.status === 'upcoming')
          if (nextAct) {
            set({ phase: 'live' })
            get().startAct(nextAct.id) // startAct handles its own flush
          } else {
            get().strikeTheStage()
          }
        }
      },

      // ─── Director Mode ───

      enterDirector: () => {
        logEvent('phase_change', { from: get().phase, to: 'director' })
        set({ phase: 'director' })
      },

      exitDirector: () => {
        const { currentActId } = get()
        set({ phase: currentActId ? 'live' : 'no_show' })
      },

      skipToNextAct: () => {
        const { currentActId } = get()
        if (!currentActId) return
        get().skipAct(currentActId)
        // exitDirector to return to live (skipAct already starts next act)
        const { phase } = get()
        if (phase === 'director') {
          const { currentActId: newActId } = get()
          set({ phase: newActId ? 'live' : 'no_show' })
        }
      },

      callShowEarly: () => {
        logEvent('phase_change', { from: get().phase, to: 'strike', reason: 'called_early' })
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
        // Force SHOW_CALLED_EARLY verdict
        set({
          phase: 'strike',
          verdict: 'SHOW_CALLED_EARLY',
          currentActId: null,
          timerEndAt: null,
          timerPausedRemaining: null,
          viewTier: 'expanded' as ViewTier,
          beatCheckPending: false,
        })
        window.clui.notifyVerdict('SHOW_CALLED_EARLY', VERDICT_MESSAGES.SHOW_CALLED_EARLY)
      },

      startBreathingPause: (durationMs) => {
        const endAt = Date.now() + (durationMs ?? 5 * 60 * 1000) // default 5 minutes
        const { timerEndAt } = get()
        const remaining = timerEndAt ? Math.max(0, timerEndAt - Date.now()) : null
        set({
          phase: 'intermission',
          breathingPauseEndAt: endAt,
          timerEndAt: null,
          timerPausedRemaining: remaining,
        })
      },

      endBreathingPause: () => set({
        breathingPauseEndAt: null,
      }),

      // ─── Lineup Editing ───

      reorderAct: (actId, direction) => {
        const oldOrder = get().acts.find((a) => a.id === actId)?.order
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
        const state = get()
        if (state.phase === 'live' || state.phase === 'intermission') {
          const newOrderVal = state.acts.find((a) => a.id === actId)?.order
          recordTimeline('act_reordered', state.showDate, actId, {
            metadata: { oldOrder: oldOrder, newOrder: newOrderVal, direction },
          })
          syncToSQLite(state)
        }
      },

      removeAct: (actId) => {
        const state = get()
        const isLive = state.phase === 'live' || state.phase === 'intermission'
        set((s) => ({
          acts: s.acts.filter((a) => a.id !== actId).map((a, i) => ({ ...a, order: i })),
        }))
        if (isLive) {
          recordTimeline('act_cut', get().showDate, actId, { actualEnd: Date.now() })
          syncToSQLite(get())
        }
      },

      addAct: (name, sketch, durationMinutes) => {
        const newId = generateId()
        set((s) => ({
          acts: [
            ...s.acts,
            {
              id: newId,
              name,
              sketch,
              durationMinutes,
              status: 'upcoming' as ActStatus,
              beatLocked: false,
              order: s.acts.length,
            },
          ],
        }))
        const state = get()
        if (state.phase === 'live' || state.phase === 'intermission') {
          recordTimeline('act_planned', state.showDate, newId)
          syncToSQLite(state)
        }
      },

      // ─── Strike the Stage ───

      strikeTheStage: () => {
        logEvent('phase_change', { from: get().phase, to: 'strike' })
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
          viewTier: 'expanded' as ViewTier,
          beatCheckPending: false,
        })
        recordTimeline('show_ended', get().showDate, null, { actualEnd: Date.now() })
        flushToSQLite(get())
        window.clui.notifyVerdict(verdict, VERDICT_MESSAGES[verdict])
      },

      // ─── Navigation (view tier) ───

      cycleViewTier: () => set((s) => ({ viewTier: nextViewTier(s.viewTier) })),
      expandViewTier: () => set((s) => ({ viewTier: expandTier(s.viewTier) })),
      collapseViewTier: () => set((s) => ({ viewTier: collapseTier(s.viewTier) })),
      setViewTier: (tier) => set({ viewTier: tier }),
      // Backward compat
      toggleExpanded: () => set((s) => ({ viewTier: s.viewTier === 'micro' ? 'expanded' as ViewTier : 'micro' as ViewTier })),
      setExpanded: (expanded) => set({ viewTier: (expanded ? 'expanded' : 'micro') as ViewTier }),

      // ─── Reset ───

      resetShow: () => {
        if (celebrationTimeout) {
          clearTimeout(celebrationTimeout)
          celebrationTimeout = null
        }
        set({ ...initialState, showDate: today(), showStartedAt: null, viewTier: 'expanded' as ViewTier })
      },

      // ─── Calendar ───

      setCalendarAvailable: (available) => set({ calendarAvailable: available }),

      setCalendarEnabled: (enabled) => {
        try {
          localStorage.setItem('showtime-calendar-enabled', String(enabled))
        } catch { /* ignore storage errors */ }
        set({ calendarEnabled: enabled })
      },

      setCalendarEvents: (events) => set({
        calendarEvents: events,
        calendarFetchStatus: events.length > 0 ? 'ready' : 'ready',
        calendarFetchedAt: Date.now(),
      }),

      setCalendarFetchStatus: (status) => set({ calendarFetchStatus: status }),

      clearCalendarCache: () => set({
        calendarEvents: [],
        calendarFetchStatus: 'idle',
        calendarFetchedAt: null,
      }),

      // ─── Session ───

      setClaudeSessionId: (id) => set({ claudeSessionId: id }),

      // ─── SQLite Hydration ───

      hydrateFromSQLite: async () => {
        try {
          const payload = await window.clui.dataHydrate()
          if (!payload) return
          // Reconstruct store state from SQLite snapshot
          interface ActSnapshot {
            id: string
            name: string
            sketch: string
            status: string
            plannedDurationMs: number
            beatLocked: number | boolean
            sortOrder: number
            actualStartAt?: number | null
            actualEndAt?: number | null
          }
          const activeAct = (payload.acts as ActSnapshot[] | undefined)?.find((a) => a.status === 'active')
          const actsRehydrated: Act[] = ((payload.acts || []) as ActSnapshot[]).map((a) => ({
            id: a.id,
            name: a.name,
            sketch: a.sketch,
            durationMinutes: Math.round(a.plannedDurationMs / 60000),
            status: a.status === 'pending' ? 'upcoming' as ActStatus : a.status as ActStatus,
            beatLocked: Boolean(a.beatLocked),
            order: a.sortOrder,
            startedAt: a.actualStartAt ?? undefined,
            completedAt: a.actualEndAt ?? undefined,
          }))
          // Reconstruct timer from active act
          let timerEndAt: number | null = null
          if (activeAct) {
            const elapsed = Date.now() - (activeAct.actualStartAt || Date.now())
            const remaining = activeAct.plannedDurationMs - elapsed
            timerEndAt = remaining > 0 ? Date.now() + remaining : null
          }
          set({
            phase: payload.phase as ShowPhase,
            energy: payload.energy as EnergyLevel | null,
            acts: actsRehydrated,
            currentActId: activeAct?.id ?? null,
            beatsLocked: payload.beatsLocked ?? 0,
            beatThreshold: payload.beatThreshold ?? 3,
            timerEndAt,
            verdict: payload.verdict as ShowVerdict | null,
            showDate: payload.showId,
            showStartedAt: payload.startedAt ?? null,
          })
        } catch { /* SQLite not available, proceed with localStorage state */ }
      },
    }),
    {
      name: 'showtime-show-state',
      partialize: (state) => {
        // Don't persist transient UI state
        const { beatCheckPending: _bcp, celebrationActive: _ca, coldOpenActive: _coa, goingLiveActive: _gla, calendarAvailable: _calA, calendarEnabled: _calE, calendarEvents: _calEvt, calendarFetchStatus: _calFs, calendarFetchedAt: _calFa, ...rest } = state
        return rest
      },
      onRehydrateStorage: () => {
        return (rehydratedState) => {
          if (!rehydratedState) return
          // Day boundary: if show date isn't today, reset
          if (rehydratedState.showDate !== today()) {
            Object.assign(rehydratedState, { ...initialState, showDate: today(), viewTier: 'expanded' as ViewTier })
          }
          // Stale conversation guard: if writersRoomStep is 'conversation' but
          // no acts exist (e.g. app restarted mid-flow), reset to 'energy'
          if (rehydratedState.writersRoomStep === 'conversation' && rehydratedState.acts.length === 0) {
            rehydratedState.writersRoomStep = 'energy'
          }
        }
      },
    }
  )
)

// ─── Selectors ───

export const selectCurrentAct = (s: ShowStore): Act | undefined =>
  s.acts.find((a) => a.id === s.currentActId)

export const selectIsExpanded = (s: ShowStore): boolean =>
  s.viewTier !== 'micro'

