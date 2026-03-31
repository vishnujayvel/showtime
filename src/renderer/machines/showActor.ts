/**
 * Singleton XState show machine actor.
 *
 * This is the source of truth for all phase-related state.
 * Import this to send events or read state directly.
 */
import { createActor } from 'xstate'
import {
  showMachine,
  createInitialContext,
  getPhaseFromState,
  VERDICT_MESSAGES,
  type ShowMachineContext,
  type ShowMachineEvent,
} from './showMachine'
import type { ShowPhase, ShowLineup, EnergyLevel, Act, ActStatus, ShowVerdict, ViewTier } from '../../shared/types'

// ─── Singleton Actor ───

export const showActor = createActor(showMachine)

// Start immediately — actor is alive for the entire app lifecycle
showActor.start()

// ─── SQLite Sync Side Effects ───
// Subscribe to actor state changes and sync to SQLite/notifications.
// This replaces the inline syncToSQLite/flushToSQLite calls in the old showStore.

function buildSnapshot(ctx: ShowMachineContext, phase: string) {
  return {
    showId: ctx.showDate,
    phase,
    energy: ctx.energy,
    verdict: ctx.verdict,
    beatsLocked: ctx.beatsLocked,
    beatThreshold: ctx.beatThreshold,
    startedAt: ctx.showStartedAt,
    planText: null as string | null,
    acts: ctx.acts.map((a) => ({
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

function tryClui(fn: () => void): void {
  try { fn() } catch { /* ignore if clui not ready */ }
}

let previousPhase: string = 'no_show'
let previousActId: string | null = null

showActor.subscribe((snapshot) => {
  const phase = getPhaseFromState(snapshot.value as Record<string, unknown>)
  const ctx = snapshot.context
  const snap = buildSnapshot(ctx, phase)

  // Phase change side effects
  if (phase !== previousPhase) {
    tryClui(() => window.clui.logEvent('INFO', 'phase_change', { from: previousPhase, to: phase }))

    // Record timeline events
    if (phase === 'live' && previousPhase !== 'live') {
      if (previousPhase === 'writers_room' || previousPhase === 'going_live') {
        tryClui(() => window.clui.timelineRecord({
          showId: ctx.showDate,
          actId: null,
          eventType: 'show_started',
          actualStart: ctx.showStartedAt,
          actualEnd: null,
          plannedStart: null,
          plannedEnd: null,
          driftSeconds: null,
          metadata: null,
        }))
      }
      if (previousPhase === 'intermission') {
        tryClui(() => window.clui.timelineRecord({
          showId: ctx.showDate,
          actId: null,
          eventType: 'intermission_ended',
          actualStart: null,
          actualEnd: Date.now(),
          plannedStart: null,
          plannedEnd: null,
          driftSeconds: null,
          metadata: null,
        }))
      }
    }

    if (phase === 'intermission') {
      tryClui(() => window.clui.timelineRecord({
        showId: ctx.showDate,
        actId: null,
        eventType: 'intermission_started',
        actualStart: Date.now(),
        actualEnd: null,
        plannedStart: null,
        plannedEnd: null,
        driftSeconds: null,
        metadata: null,
      }))
    }

    if (phase === 'strike') {
      tryClui(() => window.clui.timelineRecord({
        showId: ctx.showDate,
        actId: null,
        eventType: 'show_ended',
        actualStart: null,
        actualEnd: Date.now(),
        plannedStart: null,
        plannedEnd: null,
        driftSeconds: null,
        metadata: null,
      }))
      if (ctx.verdict) {
        tryClui(() => window.clui.notifyVerdict(ctx.verdict!, VERDICT_MESSAGES[ctx.verdict!]))
      }
    }

    previousPhase = phase
  }

  // Act change side effects
  if (ctx.currentActId !== previousActId) {
    if (ctx.currentActId) {
      const act = ctx.acts.find((a) => a.id === ctx.currentActId)
      if (act?.startedAt) {
        tryClui(() => window.clui.timelineRecord({
          showId: ctx.showDate,
          actId: ctx.currentActId,
          eventType: 'act_started',
          actualStart: act.startedAt!,
          actualEnd: null,
          plannedStart: null,
          plannedEnd: null,
          driftSeconds: null,
          metadata: null,
        }))
      }
    }
    previousActId = ctx.currentActId
  }

  // Flush to SQLite on every state change during active phases
  if (phase === 'live' || phase === 'intermission' || phase === 'director' || phase === 'strike') {
    tryClui(() => window.clui.dataFlush(snap))
  }
})

// ─── Test Support ───

/** Reset the actor to initial state. Used by test setup. */
export function resetShowActor(): void {
  showActor.send({ type: 'RESET' })
}

// ─── Convenience: re-export for consumers ───

export type { ShowMachineContext, ShowMachineEvent }
export { getPhaseFromState, VERDICT_MESSAGES }
