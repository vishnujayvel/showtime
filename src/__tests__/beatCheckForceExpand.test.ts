import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { useShowStore } from '../renderer/stores/showStore'
import type { ShowLineup, ViewTier } from '../shared/types'

/**
 * Tests for the beat-check force-expand behavior.
 *
 * When an act completes, beatCheckPending becomes true. The App.tsx useEffect
 * (lines 136-140) checks: if beatCheckPending is true AND viewTier is 'micro'
 * or 'compact', it force-expands to 'dashboard' so the user can see the
 * BeatCheckModal.
 *
 * We test the logic at the store level by simulating the same condition check
 * that App.tsx performs, plus verifying the store transitions that feed it.
 */

// Helper to reset store between tests
function resetStore() {
  useShowStore.setState({
    phase: 'no_show',
    energy: null,
    acts: [],
    currentActId: null,
    beatsLocked: 0,
    beatThreshold: 3,
    timerEndAt: null,
    timerPausedRemaining: null,
    claudeSessionId: null,
    showDate: new Date().toISOString().slice(0, 10),
    verdict: null,
    viewTier: 'expanded',
    beatCheckPending: false,
    celebrationActive: false,
    coldOpenActive: false,
    goingLiveActive: false,
  })
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

/**
 * Mirrors the App.tsx useEffect logic:
 *   if (beatCheckPending && (viewTier === 'micro' || viewTier === 'compact')) {
 *     setViewTier('dashboard')
 *   }
 */
function applyForceExpandLogic() {
  const state = useShowStore.getState()
  if (state.beatCheckPending && (state.viewTier === 'micro' || state.viewTier === 'compact')) {
    state.setViewTier('dashboard')
  }
}

describe('beatCheckPending force-expand logic', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  // ─── Store preconditions: completeAct sets beatCheckPending ───

  describe('completeAct sets beatCheckPending', () => {
    it('sets beatCheckPending to true when act completes', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      const actId = useShowStore.getState().currentActId!
      expect(useShowStore.getState().beatCheckPending).toBe(false)

      useShowStore.getState().completeAct(actId)
      expect(useShowStore.getState().beatCheckPending).toBe(true)
    })

    it('startShow sets viewTier to micro (pill)', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      expect(useShowStore.getState().viewTier).toBe('micro')
    })
  })

  // ─── Force-expand from micro ───

  describe('force-expand from micro', () => {
    it('expands from micro to dashboard when beatCheckPending is true', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      // startShow sets viewTier to 'micro'
      expect(useShowStore.getState().viewTier).toBe('micro')

      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)
      expect(useShowStore.getState().beatCheckPending).toBe(true)

      applyForceExpandLogic()
      expect(useShowStore.getState().viewTier).toBe('dashboard')
    })
  })

  // ─── Force-expand from compact ───

  describe('force-expand from compact', () => {
    it('expands from compact to dashboard when beatCheckPending is true', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      // Manually set to compact (user might have cycled to compact view)
      useShowStore.getState().setViewTier('compact')
      expect(useShowStore.getState().viewTier).toBe('compact')

      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)

      applyForceExpandLogic()
      expect(useShowStore.getState().viewTier).toBe('dashboard')
    })
  })

  // ─── No expansion when already large enough ───

  describe('no expansion when view is already large enough', () => {
    it.each<ViewTier>(['dashboard', 'expanded'])(
      'does not change viewTier when already at "%s"',
      (tier) => {
        useShowStore.getState().setLineup(sampleLineup)
        useShowStore.getState().startShow()

        useShowStore.getState().setViewTier(tier)
        const actId = useShowStore.getState().currentActId!
        useShowStore.getState().completeAct(actId)

        applyForceExpandLogic()
        expect(useShowStore.getState().viewTier).toBe(tier)
      },
    )
  })

  // ─── No expansion when beatCheckPending is false ───

  describe('no expansion when beatCheckPending is false', () => {
    it.each<ViewTier>(['micro', 'compact'])(
      'does not expand from "%s" when beatCheckPending is false',
      (tier) => {
        useShowStore.getState().setViewTier(tier)
        expect(useShowStore.getState().beatCheckPending).toBe(false)

        applyForceExpandLogic()
        expect(useShowStore.getState().viewTier).toBe(tier)
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
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      // 1. Act is live, pill view
      expect(useShowStore.getState().viewTier).toBe('micro')
      expect(useShowStore.getState().phase).toBe('live')

      // 2. Complete act — triggers beatCheckPending
      const firstActId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(firstActId)
      expect(useShowStore.getState().beatCheckPending).toBe(true)

      // 3. Force-expand fires (simulating the useEffect)
      applyForceExpandLogic()
      expect(useShowStore.getState().viewTier).toBe('dashboard')

      // 4. User locks a beat
      useShowStore.getState().lockBeat()
      expect(useShowStore.getState().beatsLocked).toBe(1)
      expect(useShowStore.getState().celebrationActive).toBe(true)

      // 5. Celebration completes, next act starts
      vi.advanceTimersByTime(1800)
      expect(useShowStore.getState().beatCheckPending).toBe(false)
      expect(useShowStore.getState().celebrationActive).toBe(false)
      expect(useShowStore.getState().acts[1].status).toBe('active')
    })

    it('completes full cycle with skip beat instead of lock', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      const firstActId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(firstActId)

      applyForceExpandLogic()
      expect(useShowStore.getState().viewTier).toBe('dashboard')

      // User skips beat — should clear beatCheckPending and start next act
      useShowStore.getState().skipBeat()
      expect(useShowStore.getState().beatCheckPending).toBe(false)
      expect(useShowStore.getState().beatsLocked).toBe(0)
      expect(useShowStore.getState().acts[1].status).toBe('active')
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
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      expect(useShowStore.getState().viewTier).toBe('micro')

      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)

      // beatCheckPending is true, but user skips beat before the useEffect fires
      useShowStore.getState().skipBeat()
      expect(useShowStore.getState().beatCheckPending).toBe(false)

      // Force-expand logic should not change viewTier since beatCheckPending is cleared
      applyForceExpandLogic()
      // viewTier stays at micro since skipBeat does not change it
      expect(useShowStore.getState().viewTier).toBe('micro')
    })

    it('resetShow clears beatCheckPending so force-expand does not fire', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)
      expect(useShowStore.getState().beatCheckPending).toBe(true)

      useShowStore.getState().resetShow()
      expect(useShowStore.getState().beatCheckPending).toBe(false)

      applyForceExpandLogic()
      // After reset, viewTier is 'expanded' (initial state) and beatCheckPending is false
      expect(useShowStore.getState().viewTier).toBe('expanded')
    })

    it('strikeTheStage clears beatCheckPending and sets expanded', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      // Manually set beatCheckPending (simulating a race where strike happens during beat check)
      useShowStore.setState({ beatCheckPending: true })
      useShowStore.getState().strikeTheStage()

      expect(useShowStore.getState().beatCheckPending).toBe(false)
      expect(useShowStore.getState().viewTier).toBe('expanded')
      expect(useShowStore.getState().phase).toBe('strike')
    })

    it('callShowEarly clears beatCheckPending and sets expanded', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      useShowStore.setState({ beatCheckPending: true })
      useShowStore.getState().callShowEarly()

      expect(useShowStore.getState().beatCheckPending).toBe(false)
      expect(useShowStore.getState().viewTier).toBe('expanded')
      expect(useShowStore.getState().phase).toBe('strike')
    })
  })
})
