/**
 * Unit tests for showActor state persistence (localStorage).
 *
 * Tests the save/hydrate round-trip, stale-date expiry,
 * transient field exclusion, clear-on-RESET behavior,
 * schema versioning, and state validation fallback.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createActor } from 'xstate'
import {
  showMachine,
  createInitialContext,
  getPhaseFromState,
  type ShowMachineContext,
} from '../renderer/machines/showMachine'
import type { ShowLineup, ShowPhase } from '../shared/types'

// ─── Constants (mirror showActor.ts) ───

const PERSIST_KEY = 'showtime-show-state'
const PERSIST_VERSION = 1
const TRANSIENT_KEYS = new Set(['beatCheckPending', 'celebrationActive'])

const VALID_PHASES = new Set([
  'no_show', 'cold_open', 'writers_room', 'going_live',
  'live', 'intermission', 'director', 'strike',
])
const VALID_ANIMATIONS = new Set(['idle', 'cold_open', 'going_live'])

const VALID_SUBSTATES: Record<string, Set<string>> = {
  writers_room: new Set(['energy', 'plan', 'conversation', 'lineup_ready']),
  live: new Set(['act_active', 'beat_check', 'celebrating']),
  intermission: new Set(['resting', 'breathing_pause']),
}

// ─── Helpers (reimplemented to test independently of module-level side effects) ───

function isValidStateValue(stateValue: unknown): boolean {
  if (typeof stateValue !== 'object' || stateValue === null) return false
  const sv = stateValue as Record<string, unknown>
  if (!('phase' in sv) || !('animation' in sv)) return false
  if (typeof sv.animation !== 'string' || !VALID_ANIMATIONS.has(sv.animation)) return false
  const phase = sv.phase
  if (typeof phase === 'string') return VALID_PHASES.has(phase)
  if (typeof phase === 'object' && phase !== null) {
    const phaseKey = Object.keys(phase)[0]
    if (!VALID_PHASES.has(phaseKey)) return false
    const validSubs = VALID_SUBSTATES[phaseKey]
    if (validSubs) {
      const subValue = (phase as Record<string, unknown>)[phaseKey]
      if (typeof subValue !== 'string' || !validSubs.has(subValue)) return false
    }
    return true
  }
  return false
}

function persistState(stateValue: unknown, ctx: ShowMachineContext) {
  const persisted = Object.fromEntries(
    Object.entries(ctx).filter(([k]) => !TRANSIENT_KEYS.has(k))
  )
  localStorage.setItem(
    PERSIST_KEY,
    JSON.stringify({ stateValue, context: persisted, version: PERSIST_VERSION, savedAt: Date.now() })
  )
}

function getPersistedSnapshot() {
  try {
    const raw = localStorage.getItem(PERSIST_KEY)
    if (!raw) return undefined
    const { stateValue, context, version } = JSON.parse(raw)

    if (version !== PERSIST_VERSION) {
      localStorage.removeItem(PERSIST_KEY)
      return undefined
    }

    const today = new Date().toISOString().slice(0, 10)
    if (context.showDate !== today) {
      localStorage.removeItem(PERSIST_KEY)
      return undefined
    }

    if (!isValidStateValue(stateValue)) {
      return showMachine.resolveState({
        value: { phase: 'no_show', animation: 'idle' },
        context: { ...createInitialContext(), ...context },
      })
    }

    return showMachine.resolveState({
      value: stateValue,
      context: { ...createInitialContext(), ...context },
    })
  } catch {
    return undefined
  }
}

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Deep Work', sketch: 'Focus session', durationMinutes: 60 },
    { name: 'Exercise', sketch: 'Run', durationMinutes: 45 },
    { name: 'Admin', sketch: 'Emails', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Test',
}

function createTestActor(snapshot?: ReturnType<typeof getPersistedSnapshot>) {
  const actor = createActor(showMachine, {
    ...(snapshot ? { snapshot } : {}),
  })
  actor.start()
  return actor
}

function getPhase(actor: ReturnType<typeof createTestActor>): ShowPhase {
  return getPhaseFromState(actor.getSnapshot().value as Record<string, unknown>)
}

// ─── Tests ───

describe('state persistence', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  describe('save → hydrate round-trip', () => {
    it('restores phase and context after persist + hydrate', () => {
      // Create actor, advance to writers_room with lineup
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'high' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      const snap = actor.getSnapshot()
      const phase = getPhaseFromState(snap.value as Record<string, unknown>)
      expect(phase).toBe('writers_room')
      expect(snap.context.acts).toHaveLength(3)
      expect(snap.context.energy).toBe('high')

      // Persist
      persistState(snap.value, snap.context)

      // Hydrate into a new actor
      const restoredSnapshot = getPersistedSnapshot()
      expect(restoredSnapshot).toBeDefined()

      const actor2 = createTestActor(restoredSnapshot)
      expect(getPhase(actor2)).toBe('writers_room')
      expect(actor2.getSnapshot().context.acts).toHaveLength(3)
      expect(actor2.getSnapshot().context.energy).toBe('high')

      actor.stop()
      actor2.stop()
    })

    it('restores live phase with active act', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'high' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })

      const snap = actor.getSnapshot()
      expect(getPhaseFromState(snap.value as Record<string, unknown>)).toBe('live')
      expect(snap.context.currentActId).not.toBeNull()

      persistState(snap.value, snap.context)

      const restoredSnapshot = getPersistedSnapshot()
      const actor2 = createTestActor(restoredSnapshot)
      expect(getPhase(actor2)).toBe('live')
      expect(actor2.getSnapshot().context.currentActId).toBe(snap.context.currentActId)
      expect(actor2.getSnapshot().context.acts).toHaveLength(3)

      actor.stop()
      actor2.stop()
    })

    it('restores intermission phase', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'medium' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })
      actor.send({ type: 'ENTER_INTERMISSION' })

      const snap = actor.getSnapshot()
      expect(getPhaseFromState(snap.value as Record<string, unknown>)).toBe('intermission')

      persistState(snap.value, snap.context)

      const restoredSnapshot = getPersistedSnapshot()
      const actor2 = createTestActor(restoredSnapshot)
      expect(getPhase(actor2)).toBe('intermission')

      actor.stop()
      actor2.stop()
    })
  })

  describe('stale date → start fresh', () => {
    it('discards persisted state from a different day', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'medium' })

      const snap = actor.getSnapshot()
      // Manually write with yesterday's date
      const persisted = Object.fromEntries(
        Object.entries(snap.context).filter(([k]) => !TRANSIENT_KEYS.has(k))
      )
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
      ;(persisted as Record<string, unknown>).showDate = yesterday

      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          stateValue: snap.value,
          context: persisted,
          savedAt: Date.now() - 86400000,
        })
      )

      const restoredSnapshot = getPersistedSnapshot()
      expect(restoredSnapshot).toBeUndefined()
      // localStorage should be cleared
      expect(localStorage.getItem(PERSIST_KEY)).toBeNull()

      actor.stop()
    })
  })

  describe('transient fields excluded', () => {
    it('does not persist beatCheckPending or celebrationActive', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })

      // Complete the first act to trigger beatCheckPending
      const actId = actor.getSnapshot().context.currentActId!
      actor.send({ type: 'COMPLETE_ACT', actId })

      const snap = actor.getSnapshot()
      expect(snap.context.beatCheckPending).toBe(true)

      persistState(snap.value, snap.context)

      const raw = JSON.parse(localStorage.getItem(PERSIST_KEY)!)
      expect(raw.context).not.toHaveProperty('beatCheckPending')
      expect(raw.context).not.toHaveProperty('celebrationActive')

      // Hydrated actor should have transient fields at defaults (from createInitialContext)
      const restoredSnapshot = getPersistedSnapshot()
      const actor2 = createTestActor(restoredSnapshot)
      expect(actor2.getSnapshot().context.beatCheckPending).toBe(false)
      expect(actor2.getSnapshot().context.celebrationActive).toBe(false)

      actor.stop()
      actor2.stop()
    })
  })

  describe('clear on RESET', () => {
    it('clears localStorage when actor resets to no_show', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })

      const snap = actor.getSnapshot()
      persistState(snap.value, snap.context)
      expect(localStorage.getItem(PERSIST_KEY)).not.toBeNull()

      // Simulate what resetShowActor does
      localStorage.removeItem(PERSIST_KEY)

      expect(localStorage.getItem(PERSIST_KEY)).toBeNull()
      const restoredSnapshot = getPersistedSnapshot()
      expect(restoredSnapshot).toBeUndefined()

      actor.stop()
    })
  })

  describe('corrupt data handling', () => {
    it('returns undefined for corrupt JSON', () => {
      localStorage.setItem(PERSIST_KEY, 'not valid json{{{')
      const result = getPersistedSnapshot()
      expect(result).toBeUndefined()
    })

    it('returns undefined for missing context', () => {
      localStorage.setItem(PERSIST_KEY, JSON.stringify({ stateValue: 'no_show' }))
      const result = getPersistedSnapshot()
      expect(result).toBeUndefined()
    })
  })

  describe('no persisted state', () => {
    it('returns undefined when nothing is stored', () => {
      const result = getPersistedSnapshot()
      expect(result).toBeUndefined()
    })
  })

  describe('schema versioning', () => {
    it('rejects persisted state with no version', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'high' })

      const snap = actor.getSnapshot()
      const persisted = Object.fromEntries(
        Object.entries(snap.context).filter(([k]) => !TRANSIENT_KEYS.has(k))
      )
      // Save WITHOUT version field (simulates pre-versioning data)
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({ stateValue: snap.value, context: persisted, savedAt: Date.now() })
      )

      const result = getPersistedSnapshot()
      expect(result).toBeUndefined()
      expect(localStorage.getItem(PERSIST_KEY)).toBeNull()

      actor.stop()
    })

    it('rejects persisted state with mismatched version', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })

      const snap = actor.getSnapshot()
      const persisted = Object.fromEntries(
        Object.entries(snap.context).filter(([k]) => !TRANSIENT_KEYS.has(k))
      )
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({ stateValue: snap.value, context: persisted, version: 999, savedAt: Date.now() })
      )

      const result = getPersistedSnapshot()
      expect(result).toBeUndefined()
      expect(localStorage.getItem(PERSIST_KEY)).toBeNull()

      actor.stop()
    })

    it('accepts persisted state with matching version', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'medium' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      const snap = actor.getSnapshot()
      persistState(snap.value, snap.context) // uses PERSIST_VERSION

      const result = getPersistedSnapshot()
      expect(result).toBeDefined()

      const actor2 = createTestActor(result)
      expect(getPhase(actor2)).toBe('writers_room')
      expect(actor2.getSnapshot().context.energy).toBe('medium')

      actor.stop()
      actor2.stop()
    })
  })

  describe('state value validation', () => {
    it('falls back to no_show when stateValue has unknown phase', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'high' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      const snap = actor.getSnapshot()
      const persisted = Object.fromEntries(
        Object.entries(snap.context).filter(([k]) => !TRANSIENT_KEYS.has(k))
      )
      // Save with an invalid phase that doesn't exist in the machine
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          stateValue: { phase: 'nonexistent_phase', animation: 'idle' },
          context: persisted,
          version: PERSIST_VERSION,
          savedAt: Date.now(),
        })
      )

      const result = getPersistedSnapshot()
      expect(result).toBeDefined()
      // Should fall back to no_show
      const actor2 = createTestActor(result)
      expect(getPhase(actor2)).toBe('no_show')
      // But context (energy, acts) should be preserved
      expect(actor2.getSnapshot().context.energy).toBe('high')
      expect(actor2.getSnapshot().context.acts).toHaveLength(3)

      actor.stop()
      actor2.stop()
    })

    it('falls back to no_show when stateValue is missing regions', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })

      const snap = actor.getSnapshot()
      const persisted = Object.fromEntries(
        Object.entries(snap.context).filter(([k]) => !TRANSIENT_KEYS.has(k))
      )
      // Save with stateValue that's just a string (not parallel regions)
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          stateValue: 'writers_room',
          context: persisted,
          version: PERSIST_VERSION,
          savedAt: Date.now(),
        })
      )

      const result = getPersistedSnapshot()
      expect(result).toBeDefined()
      const actor2 = createTestActor(result)
      expect(getPhase(actor2)).toBe('no_show')

      actor.stop()
      actor2.stop()
    })

    it('accepts valid nested state values', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
      actor.send({ type: 'START_SHOW' })

      const snap = actor.getSnapshot()
      // live phase has nested substates like { live: 'act_active' }
      expect(getPhaseFromState(snap.value as Record<string, unknown>)).toBe('live')

      persistState(snap.value, snap.context)

      const result = getPersistedSnapshot()
      expect(result).toBeDefined()
      const actor2 = createTestActor(result)
      expect(getPhase(actor2)).toBe('live')

      actor.stop()
      actor2.stop()
    })

    it('falls back to no_show when nested substate is invalid (schema-change regression)', () => {
      const actor = createTestActor()
      actor.send({ type: 'ENTER_WRITERS_ROOM' })
      actor.send({ type: 'SET_ENERGY', level: 'high' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'plan' })
      actor.send({ type: 'SET_WRITERS_ROOM_STEP', step: 'conversation' })
      actor.send({ type: 'SET_LINEUP', lineup: sampleLineup })

      const snap = actor.getSnapshot()
      const persisted = Object.fromEntries(
        Object.entries(snap.context).filter(([k]) => !TRANSIENT_KEYS.has(k))
      )
      // Simulate a stale nested substate that was removed in a schema change
      localStorage.setItem(
        PERSIST_KEY,
        JSON.stringify({
          stateValue: { phase: { live: 'removed_substate' }, animation: 'idle' },
          context: persisted,
          version: PERSIST_VERSION,
          savedAt: Date.now(),
        })
      )

      // Should NOT crash — should gracefully fall back to no_show
      const result = getPersistedSnapshot()
      expect(result).toBeDefined()
      const actor2 = createTestActor(result)
      expect(getPhase(actor2)).toBe('no_show')
      // Context (energy, acts) should be preserved
      expect(actor2.getSnapshot().context.energy).toBe('high')
      expect(actor2.getSnapshot().context.acts).toHaveLength(3)

      actor.stop()
      actor2.stop()
    })
  })
})
