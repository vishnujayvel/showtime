/**
 * Show Store — backward-compatible Zustand bridge over the XState show machine.
 *
 * MIGRATION LAYER: This store delegates all phase transitions to the XState
 * show machine actor. After each send(), state is synchronously synced from
 * the actor snapshot into Zustand so existing consumers see updates immediately.
 *
 * New code should use:
 *   import { showActor } from '../machines/showActor'
 *   import { useShowSelector, useShowPhase } from '../machines/ShowMachineProvider'
 *
 * This bridge will be removed once all consumers are migrated.
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { showActor, resetShowActor } from '../machines/showActor'
import {
  getPhaseFromState,
  type ShowMachineContext,
  type ShowMachineEvent,
} from '../machines/showMachine'
import { useUIStore } from './uiStore'
import type {
  ShowPhase,
  EnergyLevel,
  Act,
  ActStatus,
  ShowVerdict,
  ShowLineup,
  WritersRoomStep,
  ViewTier,
  CalendarEvent,
  CalendarFetchStatus,
} from '../../shared/types'
import { nextViewTier, expandTier, collapseTier } from '../../shared/types'

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

// ─── Celebration Timer ───
let celebrationTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleCelebration() {
  if (celebrationTimeout) {
    clearTimeout(celebrationTimeout)
    celebrationTimeout = null
  }
  celebrationTimeout = setTimeout(() => {
    celebrationTimeout = null
    sendAndSync({ type: 'CELEBRATION_DONE' })
  }, 1800)
}

// ─── Types ───

interface ShowActions {
  enterWritersRoom: () => void
  setWritersRoomStep: (step: WritersRoomStep) => void
  setEnergy: (level: EnergyLevel) => void
  setLineup: (lineup: ShowLineup) => void
  startShow: () => void
  triggerColdOpen: () => void
  completeColdOpen: () => void
  triggerGoingLive: () => void
  completeGoingLive: () => void
  startAct: (actId: string) => void
  completeAct: (actId: string) => void
  skipAct: (actId: string) => void
  extendAct: (minutes: number) => void
  lockBeat: () => void
  skipBeat: () => void
  enterIntermission: () => void
  exitIntermission: () => void
  enterDirector: () => void
  exitDirector: () => void
  skipToNextAct: () => void
  callShowEarly: () => void
  startBreathingPause: (durationMs?: number) => void
  endBreathingPause: () => void
  reorderAct: (actId: string, direction: 'up' | 'down') => void
  removeAct: (actId: string) => void
  addAct: (name: string, sketch: string, durationMinutes: number) => void
  strikeTheStage: () => void
  cycleViewTier: () => void
  expandViewTier: () => void
  collapseViewTier: () => void
  setViewTier: (tier: ViewTier) => void
  toggleExpanded: () => void
  setExpanded: (expanded: boolean) => void
  resetShow: () => void
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
  setClaudeSessionId: (id: string) => void
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

// ─── Sync helper: send event to XState, then sync snapshot to Zustand ───

function readActorState(): Omit<ShowStoreState, 'calendarAvailable' | 'calendarEnabled' | 'calendarEvents' | 'calendarFetchStatus' | 'calendarFetchedAt' | 'claudeSessionId'> {
  const snap = showActor.getSnapshot()
  const ctx = snap.context
  const sv = snap.value as Record<string, unknown>
  return {
    phase: getPhaseFromState(sv),
    energy: ctx.energy,
    acts: ctx.acts,
    currentActId: ctx.currentActId,
    beatsLocked: ctx.beatsLocked,
    beatThreshold: ctx.beatThreshold,
    timerEndAt: ctx.timerEndAt,
    timerPausedRemaining: ctx.timerPausedRemaining,
    showDate: ctx.showDate,
    showStartedAt: ctx.showStartedAt,
    verdict: ctx.verdict,
    viewTier: ctx.viewTier,
    beatCheckPending: ctx.beatCheckPending,
    celebrationActive: ctx.celebrationActive,
    coldOpenActive: (sv as { animation: string }).animation === 'cold_open',
    goingLiveActive: (sv as { animation: string }).animation === 'going_live',
    writersRoomStep: ctx.writersRoomStep,
    writersRoomEnteredAt: ctx.writersRoomEnteredAt,
    breathingPauseEndAt: ctx.breathingPauseEndAt,
  }
}

/** Send event to XState actor and synchronously update Zustand with new state */
function sendAndSync(event: ShowMachineEvent): void {
  showActor.send(event)
  useShowStore.setState(readActorState())
}

/** Get current phase from actor */
function currentPhase(): string {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Auto-enter writers_room if in no_show (backward compat for old callers) */
function ensureWritersRoom(): void {
  if (currentPhase() === 'no_show') {
    showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  }
}

// ─── Initial state ───

const actorInit = readActorState()
const uiInit = useUIStore.getState()

const initialState: ShowStoreState = {
  ...actorInit,
  claudeSessionId: uiInit.claudeSessionId,
  calendarAvailable: uiInit.calendarAvailable,
  calendarEnabled: uiInit.calendarEnabled,
  calendarEvents: uiInit.calendarEvents,
  calendarFetchStatus: uiInit.calendarFetchStatus,
  calendarFetchedAt: uiInit.calendarFetchedAt,
}

// ─── Store ───

export const useShowStore = create<ShowStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      enterWritersRoom: () => sendAndSync({ type: 'ENTER_WRITERS_ROOM' }),
      setWritersRoomStep: (step) => {
        ensureWritersRoom()
        sendAndSync({ type: 'SET_WRITERS_ROOM_STEP', step })
      },
      setEnergy: (level) => {
        ensureWritersRoom()
        sendAndSync({ type: 'SET_ENERGY', level })
      },
      setLineup: (lineup) => {
        ensureWritersRoom()
        sendAndSync({ type: 'SET_LINEUP', lineup })
      },
      startShow: () => {
        ensureWritersRoom()
        sendAndSync({ type: 'START_SHOW' })
      },

      triggerColdOpen: () => sendAndSync({ type: 'TRIGGER_COLD_OPEN' }),
      completeColdOpen: () => sendAndSync({ type: 'COMPLETE_COLD_OPEN' }),
      triggerGoingLive: () => sendAndSync({ type: 'TRIGGER_GOING_LIVE' }),
      completeGoingLive: () => sendAndSync({ type: 'COMPLETE_GOING_LIVE' }),

      startAct: (actId) => sendAndSync({ type: 'START_ACT', actId }),

      completeAct: (actId) => {
        sendAndSync({ type: 'COMPLETE_ACT', actId })
        const ctx = showActor.getSnapshot().context
        const act = ctx.acts.find((a) => a.id === actId)
        if (act) {
          try {
            window.clui.notifyActComplete(act.name, act.sketch)
            window.clui.notifyBeatCheck(act.name)
          } catch { /* ignore */ }
        }
      },

      skipAct: (actId) => sendAndSync({ type: 'SKIP_ACT', actId }),
      extendAct: (minutes) => sendAndSync({ type: 'EXTEND_ACT', minutes }),

      lockBeat: () => {
        sendAndSync({ type: 'LOCK_BEAT' })
        scheduleCelebration()
      },

      skipBeat: () => sendAndSync({ type: 'SKIP_BEAT' }),

      enterIntermission: () => sendAndSync({ type: 'ENTER_INTERMISSION' }),
      exitIntermission: () => sendAndSync({ type: 'EXIT_INTERMISSION' }),

      enterDirector: () => sendAndSync({ type: 'ENTER_DIRECTOR' }),
      exitDirector: () => sendAndSync({ type: 'EXIT_DIRECTOR' }),
      skipToNextAct: () => sendAndSync({ type: 'SKIP_TO_NEXT' }),
      callShowEarly: () => sendAndSync({ type: 'CALL_SHOW_EARLY' }),
      startBreathingPause: (durationMs) => sendAndSync({ type: 'START_BREATHING_PAUSE', durationMs }),
      endBreathingPause: () => sendAndSync({ type: 'END_BREATHING_PAUSE' }),

      reorderAct: (actId, direction) => sendAndSync({ type: 'REORDER_ACT', actId, direction }),
      removeAct: (actId) => sendAndSync({ type: 'REMOVE_ACT', actId }),
      addAct: (name, sketch, durationMinutes) => sendAndSync({ type: 'ADD_ACT', name, sketch, durationMinutes }),

      strikeTheStage: () => sendAndSync({ type: 'STRIKE' }),

      cycleViewTier: () => {
        const current = showActor.getSnapshot().context.viewTier
        sendAndSync({ type: 'SET_VIEW_TIER', tier: nextViewTier(current) })
      },
      expandViewTier: () => {
        const current = showActor.getSnapshot().context.viewTier
        sendAndSync({ type: 'SET_VIEW_TIER', tier: expandTier(current) })
      },
      collapseViewTier: () => {
        const current = showActor.getSnapshot().context.viewTier
        sendAndSync({ type: 'SET_VIEW_TIER', tier: collapseTier(current) })
      },
      setViewTier: (tier) => sendAndSync({ type: 'SET_VIEW_TIER', tier }),
      toggleExpanded: () => {
        const current = showActor.getSnapshot().context.viewTier
        sendAndSync({ type: 'SET_VIEW_TIER', tier: current === 'micro' ? 'expanded' as ViewTier : 'micro' as ViewTier })
      },
      setExpanded: (expanded) => sendAndSync({ type: 'SET_VIEW_TIER', tier: (expanded ? 'expanded' : 'micro') as ViewTier }),

      resetShow: () => {
        if (celebrationTimeout) {
          clearTimeout(celebrationTimeout)
          celebrationTimeout = null
        }
        sendAndSync({ type: 'RESET' })
      },

      // Calendar (delegate to uiStore + mirror in Zustand for backward compat)
      setCalendarAvailable: (available) => {
        useUIStore.getState().setCalendarAvailable(available)
        set({ calendarAvailable: available })
      },
      setCalendarEnabled: (enabled) => {
        useUIStore.getState().setCalendarEnabled(enabled)
        set({ calendarEnabled: enabled })
      },
      setCalendarEvents: (events) => {
        useUIStore.getState().setCalendarEvents(events)
        set({ calendarEvents: events, calendarFetchStatus: 'ready', calendarFetchedAt: Date.now() })
      },
      setCalendarFetchStatus: (status) => {
        useUIStore.getState().setCalendarFetchStatus(status)
        set({ calendarFetchStatus: status })
      },
      clearCalendarCache: () => {
        useUIStore.getState().clearCalendarCache()
        set({ calendarEvents: [], calendarFetchStatus: 'idle', calendarFetchedAt: null })
      },

      setClaudeSessionId: (id) => {
        useUIStore.getState().setClaudeSessionId(id)
        set({ claudeSessionId: id })
      },

      hydrateFromSQLite: async () => {
        try {
          const payload = await window.clui.dataHydrate()
          if (!payload) return
          // TODO: Hydrate XState actor from SQLite snapshot
        } catch { /* SQLite not available */ }
      },
    }),
    {
      name: 'showtime-show-state',
      partialize: (state) => {
        const {
          beatCheckPending: _bcp, celebrationActive: _ca,
          coldOpenActive: _coa, goingLiveActive: _gla,
          calendarAvailable: _calA, calendarEnabled: _calE,
          calendarEvents: _calEvt, calendarFetchStatus: _calFs,
          calendarFetchedAt: _calFa,
          ...rest
        } = state
        return rest
      },
      onRehydrateStorage: () => {
        return (rehydratedState) => {
          if (!rehydratedState) return
          if (rehydratedState.showDate !== today()) {
            sendAndSync({ type: 'RESET' })
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
