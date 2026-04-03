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

// ─── State Persistence ───

const PERSIST_KEY = 'showtime-show-state'
/** Increment when machine shape changes to invalidate old persisted state. */
export const PERSIST_VERSION = 2
const TRANSIENT_KEYS = new Set(['beatCheckPending', 'celebrationActive'])

/** Valid top-level phase states in the show machine. */
const VALID_PHASES = new Set([
  'no_show', 'cold_open', 'writers_room', 'going_live',
  'live', 'intermission', 'director', 'strike',
])
/** Valid animation region states. */
const VALID_ANIMATIONS = new Set(['idle', 'cold_open', 'going_live'])

/** Valid nested substates for phases that have child states. */
const VALID_SUBSTATES: Record<string, Set<string>> = {
  writers_room: new Set(['energy', 'plan', 'conversation', 'lineup_ready']),
  live: new Set(['act_active', 'beat_check', 'celebrating']),
  intermission: new Set(['resting', 'breathing_pause']),
}

/**
 * Check that a persisted stateValue has keys matching the current machine.
 * The machine is parallel with `phase` and `animation` regions.
 * Also validates nested substates to prevent resolveState() from throwing
 * on stale/removed substates after schema changes.
 */
function isValidStateValue(stateValue: unknown): boolean {
  if (typeof stateValue !== 'object' || stateValue === null) return false
  const sv = stateValue as Record<string, unknown>
  if (!('phase' in sv) || !('animation' in sv)) return false
  // Validate animation region
  if (typeof sv.animation !== 'string' || !VALID_ANIMATIONS.has(sv.animation)) return false
  // Validate phase region (can be string or nested object like { live: 'act_active' })
  const phase = sv.phase
  if (typeof phase === 'string') return VALID_PHASES.has(phase)
  if (typeof phase === 'object' && phase !== null) {
    const phaseKey = Object.keys(phase)[0]
    if (!VALID_PHASES.has(phaseKey)) return false
    // Validate nested substate if the phase has defined substates
    const validSubs = VALID_SUBSTATES[phaseKey]
    if (validSubs) {
      const subValue = (phase as Record<string, unknown>)[phaseKey]
      if (typeof subValue !== 'string' || !validSubs.has(subValue)) return false
    }
    return true
  }
  return false
}

function getPersistedSnapshot() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return undefined
    const { stateValue, context, version } = JSON.parse(raw)

    // Reject if schema version doesn't match
    if (version !== PERSIST_VERSION) {
      console.warn('[showtime] Persisted state version mismatch:', version, '!==', PERSIST_VERSION)
      localStorage.removeItem(PERSIST_KEY)
      return undefined
    }

    // Only hydrate if same day (both use UTC for consistency with showMachine.today())
    const today = new Date().toISOString().slice(0, 10)
    if (context.showDate !== today) {
      localStorage.removeItem(PERSIST_KEY)
      return undefined
    }

    // Validate stateValue keys exist in the current machine
    if (!isValidStateValue(stateValue)) {
      console.warn('[showtime] Persisted state value does not match machine:', JSON.stringify(stateValue))
      // Fall back to no_show but preserve context (acts, energy, etc.)
      return showMachine.resolveState({
        value: { phase: 'no_show', animation: 'idle' },
        context: { ...createInitialContext(), ...context },
      })
    }

    return showMachine.resolveState({
      value: stateValue,
      context: { ...createInitialContext(), ...context },
    })
  } catch (err) {
    console.warn('[showtime] Failed to restore persisted state:', err)
    return undefined
  }
}

function persistState(stateValue: unknown, ctx: ShowMachineContext) {
  try {
    const persisted = Object.fromEntries(
      Object.entries(ctx).filter(([k]) => !TRANSIENT_KEYS.has(k))
    )
    localStorage.setItem(
      PERSIST_KEY,
      JSON.stringify({ stateValue, context: persisted, version: PERSIST_VERSION, savedAt: Date.now() })
    )
  } catch { /* ignore storage errors */ }
}

export function clearPersistedState() {
  try { localStorage.removeItem(PERSIST_KEY) } catch { /* ignore */ }
}

// ─── Singleton Actor ───

const persistedSnapshot = getPersistedSnapshot()

export const showActor = createActor(showMachine, {
  ...(persistedSnapshot ? { snapshot: persistedSnapshot } : {}),
})

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

function tryShowtime(fn: () => void): void {
  try { fn() } catch { /* ignore if showtime API not ready */ }
}

// ─── Celebration Timer (moved from showStore) ───

let celebrationTimeout: ReturnType<typeof setTimeout> | null = null

function scheduleCelebration() {
  if (celebrationTimeout) {
    clearTimeout(celebrationTimeout)
    celebrationTimeout = null
  }
  celebrationTimeout = setTimeout(() => {
    celebrationTimeout = null
    showActor.send({ type: 'CELEBRATION_DONE' })
  }, 1800)
}

export function clearCelebrationTimeout() {
  if (celebrationTimeout) {
    clearTimeout(celebrationTimeout)
    celebrationTimeout = null
  }
}

// ─── State Change Subscriber ───

let previousPhase: string = 'no_show'
let previousActId: string | null = null
let previousBeatCheckPending = false
let previousCelebrationActive = false

showActor.subscribe((snapshot) => {
  const phase = getPhaseFromState(snapshot.value as Record<string, unknown>)
  const ctx = snapshot.context
  const snap = buildSnapshot(ctx, phase)

  // Phase change side effects
  if (phase !== previousPhase) {
    tryShowtime(() => window.showtime.logEvent('INFO', 'phase_change', { from: previousPhase, to: phase }))

    // Record timeline events
    if (phase === 'live' && previousPhase !== 'live') {
      if (previousPhase === 'writers_room' || previousPhase === 'going_live') {
        tryShowtime(() => window.showtime.timelineRecord({
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
        tryShowtime(() => window.showtime.timelineRecord({
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
      tryShowtime(() => window.showtime.timelineRecord({
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
      tryShowtime(() => window.showtime.timelineRecord({
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
        tryShowtime(() => window.showtime.notifyVerdict(ctx.verdict!, VERDICT_MESSAGES[ctx.verdict!]))
      }
    }

    previousPhase = phase
  }

  // Act completion side effects — notify when beatCheckPending transitions to true
  if (ctx.beatCheckPending && !previousBeatCheckPending) {
    const completedAct = ctx.acts.find((a) => a.status === 'completed' && a.completedAt)
    if (completedAct) {
      tryShowtime(() => window.showtime.notifyActComplete(completedAct.name, completedAct.sketch))
      tryShowtime(() => window.showtime.notifyBeatCheck(completedAct.name))
    }
  }
  previousBeatCheckPending = ctx.beatCheckPending

  // Celebration side effects — schedule timeout when celebrationActive goes true
  if (ctx.celebrationActive && !previousCelebrationActive) {
    scheduleCelebration()
  }
  previousCelebrationActive = ctx.celebrationActive

  // Act change side effects
  if (ctx.currentActId !== previousActId) {
    if (ctx.currentActId) {
      const act = ctx.acts.find((a) => a.id === ctx.currentActId)
      if (act?.startedAt) {
        tryShowtime(() => window.showtime.timelineRecord({
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
    tryShowtime(() => window.showtime.dataFlush(snap))
  }

  // Persistence: save actor state to localStorage on every change
  if (phase === 'no_show') {
    clearPersistedState()
  } else {
    persistState(snapshot.value, ctx)
  }
})

// ─── Test Support ───

/** Reset the actor to initial state. Used by test setup. */
export function resetShowActor(): void {
  showActor.send({ type: 'RESET' })
  previousPhase = 'no_show'
  previousActId = null
  previousBeatCheckPending = false
  previousCelebrationActive = false
  clearCelebrationTimeout()
  clearPersistedState()
}

// ─── Convenience: re-export for consumers ───

export type { ShowMachineContext, ShowMachineEvent }
export { getPhaseFromState, VERDICT_MESSAGES }
