import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { showActor, resetShowActor } from '../renderer/machines/showActor'
import { getPhaseFromState } from '../renderer/machines/showMachine'
import type { ShowLineup, ViewTier } from '../shared/types'

/**
 * Tests for the beat-check force-expand behavior.
 *
 * When an act completes, beatCheckPending becomes true. The App.tsx useEffect
 * (lines 136-140) checks: if beatCheckPending is true AND viewTier is 'micro'
 * or 'compact', it force-expands to 'dashboard' so the user can see the
 * BeatCheckModal.
 *
 * We test the logic at the actor level by simulating the same condition check
 * that App.tsx performs, plus verifying the actor transitions that feed it.
 */

/** Helper to get current phase from the actor */
function phase() {
  return getPhaseFromState(showActor.getSnapshot().value as Record<string, unknown>)
}

/** Helper to get actor context */
function ctx() {
  return showActor.getSnapshot().context
}

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Morning Deep Work', sketch: 'Deep Work', durationMinutes: 60 },
    { name: 'Exercise Block', sketch: 'Exercise', durationMinutes: 45 },
    { name: 'Admin Catch-up', sketch: 'Admin', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Test lineup',
}

/** Navigate actor to live phase */
function goLive() {
  showActor.send({ type: 'ENTER_WRITERS_ROOM' })
  showActor.send({ type: 'SET_ENERGY', level: 'high' })
  showActor.send({ type: 'SET_LINEUP', lineup: sampleLineup })
  showActor.send({ type: 'START_SHOW' })
}

/**
 * Mirrors the App.tsx useEffect logic:
 *   if (beatCheckPending && (viewTier === 'micro' || viewTier === 'compact')) {
 *     setViewTier('dashboard')
 *   }
 */
function applyForceExpandLogic() {
  const c = ctx()
  if (c.beatCheckPending && (c.viewTier === 'micro' || c.viewTier === 'compact')) {
    showActor.send({ type: 'SET_VIEW_TIER', tier: 'dashboard' })
  }
}

describe('beatCheckPending force-expand logic', () => {
  beforeEach(() => {
    resetShowActor()
    vi.clearAllMocks()
  })

  // ─── Store preconditions: completeAct sets beatCheckPending ───

  describe('completeAct sets beatCheckPending', () => {
    it('sets beatCheckPending to true when act completes', () => {
      goLive()

      const actId = ctx().currentActId!
      expect(ctx().beatCheckPending).toBe(false)

      showActor.send({ type: 'COMPLETE_ACT', actId })
      expect(ctx().beatCheckPending).toBe(true)
    })

    it('startShow sets viewTier to micro (pill)', () => {
      goLive()
      expect(ctx().viewTier).toBe('micro')
    })
  })

  // ─── Force-expand from micro ───

  describe('force-expand from micro', () => {
    it('expands from micro to dashboard when beatCheckPending is true', () => {
      goLive()

      // startShow sets viewTier to 'micro'
      expect(ctx().viewTier).toBe('micro')

      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
      expect(ctx().beatCheckPending).toBe(true)

      applyForceExpandLogic()
      expect(ctx().viewTier).toBe('dashboard')
    })
  })

  // ─── Force-expand from compact ───

  describe('force-expand from compact', () => {
    it('expands from compact to dashboard when beatCheckPending is true', () => {
      goLive()

      // Manually set to compact (user might have cycled to compact view)
      showActor.send({ type: 'SET_VIEW_TIER', tier: 'compact' })
      expect(ctx().viewTier).toBe('compact')

      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })

      applyForceExpandLogic()
      expect(ctx().viewTier).toBe('dashboard')
    })
  })

  // ─── No expansion when already large enough ───

  describe('no expansion when view is already large enough', () => {
    it.each<ViewTier>(['dashboard', 'expanded'])(
      'does not change viewTier when already at "%s"',
      (tier) => {
        goLive()

        showActor.send({ type: 'SET_VIEW_TIER', tier })
        const actId = ctx().currentActId!
        showActor.send({ type: 'COMPLETE_ACT', actId })

        applyForceExpandLogic()
        expect(ctx().viewTier).toBe(tier)
      },
    )
  })

  // ─── No expansion when beatCheckPending is false ───

  describe('no expansion when beatCheckPending is false', () => {
    it.each<ViewTier>(['micro', 'compact'])(
      'does not expand from "%s" when beatCheckPending is false',
      (tier) => {
        showActor.send({ type: 'SET_VIEW_TIER', tier })
        expect(ctx().beatCheckPending).toBe(false)

        applyForceExpandLogic()
        expect(ctx().viewTier).toBe(tier)
      },
    )
  })

  // ─── Full act lifecycle: complete → force-expand → beat check → next act ───

  describe('full lifecycle: complete → force-expand → lock beat → next act', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('completes full cycle: act complete → expand → lock beat → next act starts', () => {
      goLive()

      // 1. Act is live, pill view
      expect(ctx().viewTier).toBe('micro')
      expect(phase()).toBe('live')

      // 2. Complete act — triggers beatCheckPending
      const firstActId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId: firstActId })
      expect(ctx().beatCheckPending).toBe(true)

      // 3. Force-expand fires (simulating the useEffect)
      applyForceExpandLogic()
      expect(ctx().viewTier).toBe('dashboard')

      // 4. User locks a beat
      showActor.send({ type: 'LOCK_BEAT' })
      expect(ctx().beatsLocked).toBe(1)
      expect(ctx().celebrationActive).toBe(true)

      // 5. Celebration completes, next act starts
      vi.advanceTimersByTime(1800)
      expect(ctx().beatCheckPending).toBe(false)
      expect(ctx().celebrationActive).toBe(false)
      expect(ctx().acts[1].status).toBe('active')
    })

    it('completes full cycle with skip beat instead of lock', () => {
      goLive()

      const firstActId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId: firstActId })

      applyForceExpandLogic()
      expect(ctx().viewTier).toBe('dashboard')

      // User skips beat — should clear beatCheckPending and start next act
      showActor.send({ type: 'SKIP_BEAT' })
      expect(ctx().beatCheckPending).toBe(false)
      expect(ctx().beatsLocked).toBe(0)
      expect(ctx().acts[1].status).toBe('active')
    })
  })

  // ─── Edge case: beatCheckPending cleared before force-expand runs ───

  describe('edge cases', () => {
    beforeEach(() => {
      vi.useFakeTimers()
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('no-ops if beatCheckPending is cleared before force-expand logic runs', () => {
      goLive()
      expect(ctx().viewTier).toBe('micro')

      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })

      // beatCheckPending is true, but user skips beat before the useEffect fires
      showActor.send({ type: 'SKIP_BEAT' })
      expect(ctx().beatCheckPending).toBe(false)

      // Force-expand logic should not change viewTier since beatCheckPending is cleared
      applyForceExpandLogic()
      // viewTier stays at micro since skipBeat does not change it
      expect(ctx().viewTier).toBe('micro')
    })

    it('resetShow clears beatCheckPending so force-expand does not fire', () => {
      goLive()

      const actId = ctx().currentActId!
      showActor.send({ type: 'COMPLETE_ACT', actId })
      expect(ctx().beatCheckPending).toBe(true)

      showActor.send({ type: 'RESET' })
      expect(ctx().beatCheckPending).toBe(false)

      applyForceExpandLogic()
      // After reset, viewTier is 'expanded' (initial state) and beatCheckPending is false
      expect(ctx().viewTier).toBe('expanded')
    })

    it('strikeTheStage clears beatCheckPending and sets expanded', () => {
      goLive()

      // Manually set beatCheckPending (simulating a race where strike happens during beat check)
      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatCheckPending: true } })
      showActor.send({ type: 'STRIKE' })

      expect(ctx().beatCheckPending).toBe(false)
      expect(ctx().viewTier).toBe('expanded')
      expect(phase()).toBe('strike')
    })

    it('callShowEarly clears beatCheckPending and sets expanded', () => {
      goLive()

      showActor.send({ type: '_PATCH_CONTEXT', patch: { beatCheckPending: true } })
      showActor.send({ type: 'CALL_SHOW_EARLY' })

      expect(ctx().beatCheckPending).toBe(false)
      expect(ctx().viewTier).toBe('expanded')
      expect(phase()).toBe('strike')
    })
  })
})
