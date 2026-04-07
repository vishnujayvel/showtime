/**
 * Show Machine Actions — assign callbacks and side-effect actions for the XState show machine.
 *
 * Extracted from showMachine.ts to keep the machine definition focused on state topology.
 * Each action is an XState assign() or plain action function used by transitions.
 */
import { assign } from 'xstate'
import {
  createInitialContext,
  computeVerdict,
  findNextUpcoming,
  generateId,
  today,
} from './showMachine.context'
import type { ShowMachineContext, ShowMachineEvent } from './showMachine.context'
import type { Act, ActStatus, ShowVerdict, WritersRoomStep, ViewTier } from '../../shared/types'

// Shorthand for typed callback args (used outside setup() inference)
type Args = { context: ShowMachineContext; event: ShowMachineEvent }

/** All named actions referenced by the show machine's transitions and state entries. */
export const showMachineActions = {
  assignEnergy: assign({
    energy: ({ event }: Args) => {
      if (event.type !== 'SET_ENERGY') return null
      return event.level
    },
  }),

  assignLineup: assign(({ context, event }: Args) => {
    if (event.type !== 'SET_LINEUP') return {}
    const acts: Act[] = event.lineup.acts.map((a, i) => ({
      id: generateId(),
      name: a.name,
      sketch: a.sketch,
      durationMinutes: a.durationMinutes,
      status: 'upcoming' as ActStatus,
      beatLocked: false,
      order: i,
      pinnedStartAt: a.pinnedStartAt ?? null,
      calendarEventId: a.calendarEventId ?? null,
    }))
    return {
      acts,
      beatThreshold: event.lineup.beatThreshold,
      lineupStatus: 'draft' as const,
      writersRoomStep: 'lineup_ready' as WritersRoomStep,
    }
  }),

  finalizeLineupContext: assign({
    lineupStatus: 'confirmed' as const,
  }),

  assignWritersRoomStep: assign({
    writersRoomStep: ({ event }: Args) => {
      if (event.type !== 'SET_WRITERS_ROOM_STEP') return 'energy' as WritersRoomStep
      return event.step
    },
  }),

  enterWritersRoom: assign({
    writersRoomStep: 'energy' as WritersRoomStep,
    writersRoomEnteredAt: () => Date.now(),
  }),

  startShowContext: assign(({ context }: Args) => {
    const firstAct = context.acts[0]
    const now = Date.now()
    return {
      currentActId: firstAct.id,
      timerEndAt: now + firstAct.durationMinutes * 60 * 1000,
      showDate: today(),
      showStartedAt: now,
      viewTier: 'micro' as ViewTier,
      acts: context.acts.map((a, i) =>
        i === 0 ? { ...a, status: 'active' as ActStatus, startedAt: now } : a
      ),
    }
  }),

  completeActContext: assign(({ context, event }: Args) => {
    if (event.type !== 'COMPLETE_ACT') return {}
    const now = Date.now()
    return {
      acts: context.acts.map((a) =>
        a.id === event.actId ? { ...a, status: 'completed' as ActStatus, completedAt: now } : a
      ),
      timerEndAt: null,
      timerPausedRemaining: null,
      beatCheckPending: true,
    }
  }),

  skipActContext: assign(({ context, event }: Args) => {
    if (event.type !== 'SKIP_ACT') return {}
    const wasActive = context.currentActId === event.actId
    const newActs = context.acts.map((a) =>
      a.id === event.actId ? { ...a, status: 'skipped' as ActStatus, completedAt: Date.now() } : a
    )
    const nextAct = newActs.find((a) => a.status === 'upcoming')
    return {
      acts: newActs,
      currentActId: wasActive ? (nextAct?.id ?? null) : context.currentActId,
      timerEndAt: wasActive ? null : context.timerEndAt,
      timerPausedRemaining: wasActive ? null : context.timerPausedRemaining,
    }
  }),

  autoStartNextAct: assign(({ context }: Args) => {
    const nextAct = findNextUpcoming(context.acts)
    if (!nextAct) return {}
    const now = Date.now()
    return {
      currentActId: nextAct.id,
      timerEndAt: now + nextAct.durationMinutes * 60 * 1000,
      timerPausedRemaining: null,
      acts: context.acts.map((a) =>
        a.id === nextAct.id ? { ...a, status: 'active' as ActStatus, startedAt: now } : a
      ),
    }
  }),

  extendActContext: assign(({ context, event }: Args) => {
    if (event.type !== 'EXTEND_ACT') return {}
    return {
      timerEndAt: context.timerEndAt ? context.timerEndAt + event.minutes * 60 * 1000 : null,
    }
  }),

  lockBeatContext: assign(({ context }: Args) => ({
    beatsLocked: context.beatsLocked + 1,
    celebrationActive: true,
    acts: context.acts.map((a) =>
      a.id === context.currentActId ? { ...a, beatLocked: true } : a
    ),
  })),

  skipBeatContext: assign({
    beatCheckPending: false,
  }),

  clearBeatState: assign({
    beatCheckPending: false,
    celebrationActive: false,
  }),

  celebrationDoneContext: assign({
    celebrationActive: false,
    beatCheckPending: false,
  }),

  enterIntermissionContext: assign(({ context }: Args) => {
    const remaining = context.timerEndAt ? Math.max(0, context.timerEndAt - Date.now()) : null
    return {
      timerEndAt: null,
      timerPausedRemaining: remaining,
    }
  }),

  exitIntermissionResumeTimer: assign(({ context }: Args) => ({
    timerEndAt: context.timerPausedRemaining ? Date.now() + context.timerPausedRemaining : null,
    timerPausedRemaining: null,
    breathingPauseEndAt: null,
  })),

  exitIntermissionStartNext: assign(({ context }: Args) => {
    const nextAct = findNextUpcoming(context.acts)
    if (!nextAct) return {}
    const now = Date.now()
    return {
      currentActId: nextAct.id,
      timerEndAt: now + nextAct.durationMinutes * 60 * 1000,
      timerPausedRemaining: null,
      breathingPauseEndAt: null,
      acts: context.acts.map((a) =>
        a.id === nextAct.id ? { ...a, status: 'active' as ActStatus, startedAt: now } : a
      ),
    }
  }),

  callShowEarlyContext: assign(({ context }: Args) => ({
    acts: context.acts.map((a) =>
      a.status === 'upcoming' || a.status === 'active'
        ? { ...a, status: 'skipped' as ActStatus, completedAt: Date.now() }
        : a
    ),
    currentActId: null,
    timerEndAt: null,
    timerPausedRemaining: null,
    showEndedAt: Date.now(),
    verdict: 'SHOW_CALLED_EARLY' as ShowVerdict,
    viewTier: 'expanded' as ViewTier,
    beatCheckPending: false,
  })),

  strikeContext: assign(({ context }: Args) => {
    const verdict = computeVerdict(context.beatsLocked, context.beatThreshold)
    return {
      verdict,
      showEndedAt: Date.now(),
      currentActId: null,
      timerEndAt: null,
      timerPausedRemaining: null,
      viewTier: 'expanded' as ViewTier,
      beatCheckPending: false,
    }
  }),

  resetContext: assign(() => createInitialContext()),

  startBreathingPauseContext: assign(({ context, event }: Args) => {
    if (event.type !== 'START_BREATHING_PAUSE') return {}
    const endAt = Date.now() + (event.durationMs ?? 5 * 60 * 1000)
    const remaining = context.timerEndAt ? Math.max(0, context.timerEndAt - Date.now()) : null
    return {
      breathingPauseEndAt: endAt,
      timerEndAt: null,
      timerPausedRemaining: remaining,
    }
  }),

  endBreathingPauseContext: assign({
    breathingPauseEndAt: null,
  }),

  setViewTierContext: assign({
    viewTier: ({ event }: Args) => {
      if (event.type !== 'SET_VIEW_TIER') return 'expanded' as ViewTier
      return event.tier
    },
  }),

  reorderActContext: assign(({ context, event }: Args) => {
    if (event.type !== 'REORDER_ACT') return {}
    const sorted = [...context.acts].sort((a, b) => a.order - b.order)
    const idx = sorted.findIndex((a) => a.id === event.actId)
    if (idx < 0) return {}
    const swapIdx = event.direction === 'up' ? idx - 1 : idx + 1
    if (swapIdx < 0 || swapIdx >= sorted.length) return {}
    const newOrder = [...sorted]
    ;[newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]]
    return {
      acts: newOrder.map((a, i) => ({ ...a, order: i })),
    }
  }),

  removeActContext: assign(({ context, event }: Args) => {
    if (event.type !== 'REMOVE_ACT') return {}
    const newActs = context.acts.filter((a) => a.id !== event.actId).map((a, i) => ({ ...a, order: i }))
    const removingCurrentAct = context.currentActId === event.actId
    return {
      acts: newActs,
      ...(removingCurrentAct ? {
        currentActId: null,
        timerEndAt: null,
        timerPausedRemaining: null,
      } : {}),
    }
  }),

  addActContext: assign(({ context, event }: Args) => {
    if (event.type !== 'ADD_ACT') return {}
    return {
      acts: [
        ...context.acts,
        {
          id: generateId(),
          name: event.name,
          sketch: event.sketch,
          durationMinutes: event.durationMinutes,
          status: 'upcoming' as ActStatus,
          beatLocked: false,
          order: context.acts.length,
        },
      ],
    }
  }),

  skipCurrentActContext: assign(({ context }: Args) => {
    const actId = context.currentActId
    if (!actId) return {}
    const newActs = context.acts.map((a) =>
      a.id === actId ? { ...a, status: 'skipped' as ActStatus, completedAt: Date.now() } : a
    )
    const nextAct = newActs.find((a) => a.status === 'upcoming')
    return {
      acts: newActs,
      currentActId: nextAct?.id ?? null,
      timerEndAt: null,
      timerPausedRemaining: null,
    }
  }),

  updateActContext: assign(({ context, event }: Args) => {
    if (event.type !== 'UPDATE_ACT') return {}
    const updatedActs = context.acts.map((a) =>
      a.id === event.actId
        ? {
            ...a,
            ...(event.name !== undefined ? { name: event.name } : {}),
            ...(event.durationMinutes !== undefined ? { durationMinutes: event.durationMinutes } : {}),
          }
        : a
    )
    // If updating the currently active act's duration, recalculate timerEndAt
    const act = updatedActs.find((a) => a.id === event.actId)
    const isActiveAct = event.actId === context.currentActId && context.timerEndAt && act?.startedAt
    const newTimerEndAt =
      isActiveAct && event.durationMinutes !== undefined
        ? act.startedAt! + event.durationMinutes * 60 * 1000
        : context.timerEndAt
    return {
      acts: updatedActs,
      ...(newTimerEndAt !== context.timerEndAt ? { timerEndAt: newTimerEndAt } : {}),
    }
  }),

  editLineupContext: assign(({ context }: Args) => {
    const remaining = context.timerEndAt ? Math.max(0, context.timerEndAt - Date.now()) : null
    return {
      timerEndAt: null,
      timerPausedRemaining: remaining,
      editingMidShow: true,
      writersRoomStep: 'conversation' as WritersRoomStep,
    }
  }),

  confirmLineupEditContext: assign(({ context, event }: Args) => {
    if (event.type !== 'CONFIRM_LINEUP_EDIT') return {}
    // Merge: keep completed/active acts, replace upcoming with new lineup
    const completedActs = context.acts.filter((a) => a.status === 'completed' || a.status === 'skipped')
    const activeAct = context.acts.find((a) => a.id === context.currentActId && a.status === 'active')
    const keptActs = activeAct ? [...completedActs, activeAct] : completedActs
    // New acts from the edit (upcoming replacements)
    const newUpcoming = event.acts.filter((a) => a.status === 'upcoming')
    const mergedActs = [...keptActs, ...newUpcoming].map((a, i) => ({ ...a, order: i }))
    return {
      acts: mergedActs,
      timerEndAt: context.timerPausedRemaining ? Date.now() + context.timerPausedRemaining : null,
      timerPausedRemaining: null,
      editingMidShow: false,
      lineupStatus: 'confirmed' as const,
    }
  }),

  restoreShowContext: assign(({ event }: Args) => {
    if (event.type !== 'RESTORE_SHOW') return {}
    // Filter out undefined values to avoid overwriting defaults with undefined.
    // Partial<ShowMachineContext> can have undefined fields from DB rows with NULL.
    return Object.fromEntries(
      Object.entries(event.context).filter(([, v]) => v !== undefined)
    )
  }),

  logDroppedEvent: ({ event, self }: { event: ShowMachineEvent; self: { getSnapshot: () => { value: unknown } } }) => {
    const snap = self.getSnapshot()
    if (typeof window !== 'undefined' && window.showtime?.logEvent) {
      window.showtime.logEvent('WARN', 'xstate.event_dropped', {
        event: event.type,
        state: JSON.stringify(snap.value),
      })
    }
    if (import.meta.env.DEV) {
      console.error(`[showMachine] DROPPED: "${event.type}" in state "${JSON.stringify(snap.value)}"`)
    }
  },
}
