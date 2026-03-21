import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useShowStore, selectCurrentAct, selectNextAct, selectCompletedActs, selectSkippedActs, selectBeatsRemaining } from '../renderer/stores/showStore'
import type { ShowLineup } from '../shared/types'

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
    isExpanded: true,
    beatCheckPending: false,
  })
}

const sampleLineup: ShowLineup = {
  acts: [
    { name: 'Morning Deep Work', sketch: 'Deep Work', durationMinutes: 60 },
    { name: 'Exercise Block', sketch: 'Exercise', durationMinutes: 45 },
    { name: 'Admin Catch-up', sketch: 'Admin', durationMinutes: 30 },
  ],
  beatThreshold: 3,
  openingNote: 'Solid lineup!',
}

describe('showStore', () => {
  beforeEach(() => {
    resetStore()
    vi.clearAllMocks()
  })

  // ─── Initial State ───

  describe('initial state', () => {
    it('starts in no_show phase', () => {
      expect(useShowStore.getState().phase).toBe('no_show')
    })

    it('has no energy selected', () => {
      expect(useShowStore.getState().energy).toBeNull()
    })

    it('has no acts', () => {
      expect(useShowStore.getState().acts).toHaveLength(0)
    })

    it('has default beat threshold of 3', () => {
      expect(useShowStore.getState().beatThreshold).toBe(3)
    })

    it('has no verdict', () => {
      expect(useShowStore.getState().verdict).toBeNull()
    })
  })

  // ─── Writer's Room ───

  describe('setEnergy', () => {
    it('sets energy level', () => {
      useShowStore.getState().setEnergy('high')
      expect(useShowStore.getState().energy).toBe('high')
    })

    it('can change energy level', () => {
      useShowStore.getState().setEnergy('high')
      useShowStore.getState().setEnergy('low')
      expect(useShowStore.getState().energy).toBe('low')
    })
  })

  describe('setLineup', () => {
    it('creates acts from lineup', () => {
      useShowStore.getState().setLineup(sampleLineup)
      const state = useShowStore.getState()

      expect(state.acts).toHaveLength(3)
      expect(state.acts[0].name).toBe('Morning Deep Work')
      expect(state.acts[0].sketch).toBe('Deep Work')
      expect(state.acts[0].durationMinutes).toBe(60)
      expect(state.acts[0].status).toBe('upcoming')
      expect(state.acts[0].beatLocked).toBe(false)
    })

    it('sets beat threshold from lineup', () => {
      useShowStore.getState().setLineup(sampleLineup)
      expect(useShowStore.getState().beatThreshold).toBe(3)
    })

    it('transitions phase to writers_room', () => {
      useShowStore.getState().setLineup(sampleLineup)
      expect(useShowStore.getState().phase).toBe('writers_room')
    })

    it('assigns sequential order to acts', () => {
      useShowStore.getState().setLineup(sampleLineup)
      const acts = useShowStore.getState().acts
      expect(acts[0].order).toBe(0)
      expect(acts[1].order).toBe(1)
      expect(acts[2].order).toBe(2)
    })

    it('generates unique IDs for acts', () => {
      useShowStore.getState().setLineup(sampleLineup)
      const acts = useShowStore.getState().acts
      const ids = new Set(acts.map((a) => a.id))
      expect(ids.size).toBe(3)
    })
  })

  // ─── startShow ───

  describe('startShow', () => {
    it('does nothing with no acts', () => {
      useShowStore.getState().startShow()
      expect(useShowStore.getState().phase).toBe('no_show')
    })

    it('transitions to live phase', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      expect(useShowStore.getState().phase).toBe('live')
    })

    it('sets first act as active', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      const state = useShowStore.getState()

      expect(state.currentActId).toBe(state.acts[0].id)
      expect(state.acts[0].status).toBe('active')
      expect(state.acts[0].startedAt).toBeDefined()
    })

    it('sets timer for first act duration', () => {
      useShowStore.getState().setLineup(sampleLineup)
      const before = Date.now()
      useShowStore.getState().startShow()
      const after = Date.now()

      const timerEnd = useShowStore.getState().timerEndAt!
      // 60 min act = 3,600,000 ms
      expect(timerEnd).toBeGreaterThanOrEqual(before + 60 * 60 * 1000)
      expect(timerEnd).toBeLessThanOrEqual(after + 60 * 60 * 1000)
    })

    it('collapses to pill view', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      expect(useShowStore.getState().isExpanded).toBe(false)
    })

    it('leaves other acts as upcoming', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      const acts = useShowStore.getState().acts
      expect(acts[1].status).toBe('upcoming')
      expect(acts[2].status).toBe('upcoming')
    })
  })

  // ─── completeAct ───

  describe('completeAct', () => {
    beforeEach(() => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
    })

    it('marks act as completed', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)

      const act = useShowStore.getState().acts.find((a) => a.id === actId)
      expect(act?.status).toBe('completed')
      expect(act?.completedAt).toBeDefined()
    })

    it('clears timer', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)

      expect(useShowStore.getState().timerEndAt).toBeNull()
      expect(useShowStore.getState().timerPausedRemaining).toBeNull()
    })

    it('triggers beat check', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)
      expect(useShowStore.getState().beatCheckPending).toBe(true)
    })

    it('sends IPC notifications', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)

      expect(window.clui.notifyActComplete).toHaveBeenCalledWith('Morning Deep Work')
      expect(window.clui.notifyBeatCheck).toHaveBeenCalled()
    })
  })

  // ─── skipAct ───

  describe('skipAct', () => {
    beforeEach(() => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
    })

    it('marks act as skipped', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().skipAct(actId)

      const act = useShowStore.getState().acts.find((a) => a.id === actId)
      expect(act?.status).toBe('skipped')
    })

    it('auto-starts next act when skipping active act', () => {
      const firstId = useShowStore.getState().currentActId!
      useShowStore.getState().skipAct(firstId)

      const state = useShowStore.getState()
      expect(state.currentActId).not.toBe(firstId)
      expect(state.currentActId).toBe(state.acts[1].id)
      expect(state.acts[1].status).toBe('active')
    })

    it('strikes stage when skipping last upcoming act', () => {
      const acts = useShowStore.getState().acts
      // Skip first two, third will be auto-started then we skip that
      useShowStore.getState().skipAct(acts[0].id)
      useShowStore.getState().skipAct(acts[1].id)
      useShowStore.getState().skipAct(acts[2].id)

      expect(useShowStore.getState().phase).toBe('strike')
    })
  })

  // ─── extendAct ───

  describe('extendAct', () => {
    it('adds time to timer', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      const timerBefore = useShowStore.getState().timerEndAt!
      useShowStore.getState().extendAct(15)
      const timerAfter = useShowStore.getState().timerEndAt!

      expect(timerAfter - timerBefore).toBe(15 * 60 * 1000)
    })

    it('does nothing when no timer is active', () => {
      useShowStore.getState().extendAct(15)
      expect(useShowStore.getState().timerEndAt).toBeNull()
    })
  })

  // ─── Beat Tracking ───

  describe('lockBeat', () => {
    beforeEach(() => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)
    })

    it('increments beatsLocked', () => {
      useShowStore.getState().lockBeat()
      expect(useShowStore.getState().beatsLocked).toBe(1)
    })

    it('clears beatCheckPending', () => {
      expect(useShowStore.getState().beatCheckPending).toBe(true)
      useShowStore.getState().lockBeat()
      expect(useShowStore.getState().beatCheckPending).toBe(false)
    })

    it('marks act as beat-locked', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().lockBeat()
      const act = useShowStore.getState().acts.find((a) => a.id === actId)
      expect(act?.beatLocked).toBe(true)
    })

    it('starts next act after locking', () => {
      useShowStore.getState().lockBeat()
      const state = useShowStore.getState()
      expect(state.acts[1].status).toBe('active')
    })
  })

  describe('skipBeat', () => {
    beforeEach(() => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)
    })

    it('clears beatCheckPending without incrementing beats', () => {
      useShowStore.getState().skipBeat()
      expect(useShowStore.getState().beatCheckPending).toBe(false)
      expect(useShowStore.getState().beatsLocked).toBe(0)
    })

    it('starts next act after skipping', () => {
      useShowStore.getState().skipBeat()
      const state = useShowStore.getState()
      expect(state.acts[1].status).toBe('active')
    })
  })

  // ─── Intermission ───

  describe('enterIntermission', () => {
    it('transitions to intermission phase', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().enterIntermission()
      expect(useShowStore.getState().phase).toBe('intermission')
    })

    it('pauses timer by storing remaining time', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()

      const timerEnd = useShowStore.getState().timerEndAt!
      useShowStore.getState().enterIntermission()

      expect(useShowStore.getState().timerEndAt).toBeNull()
      expect(useShowStore.getState().timerPausedRemaining).toBeGreaterThan(0)
    })
  })

  describe('exitIntermission', () => {
    it('resumes timer with remaining time', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().enterIntermission()

      const paused = useShowStore.getState().timerPausedRemaining!
      const before = Date.now()
      useShowStore.getState().exitIntermission()

      expect(useShowStore.getState().phase).toBe('live')
      const timerEnd = useShowStore.getState().timerEndAt!
      expect(timerEnd).toBeGreaterThanOrEqual(before + paused - 50) // 50ms tolerance
    })
  })

  // ─── Director Mode ───

  describe('enterDirector', () => {
    it('transitions to director phase', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().enterDirector()
      expect(useShowStore.getState().phase).toBe('director')
    })
  })

  describe('exitDirector', () => {
    it('returns to live when act is active', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().enterDirector()
      useShowStore.getState().exitDirector()
      expect(useShowStore.getState().phase).toBe('live')
    })

    it('returns to no_show when no act is active', () => {
      useShowStore.getState().enterDirector()
      useShowStore.getState().exitDirector()
      expect(useShowStore.getState().phase).toBe('no_show')
    })
  })

  describe('callShowEarly', () => {
    it('skips all remaining acts', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().callShowEarly()

      const acts = useShowStore.getState().acts
      expect(acts.every((a) => a.status === 'skipped')).toBe(true)
    })

    it('transitions to strike phase', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().callShowEarly()
      expect(useShowStore.getState().phase).toBe('strike')
    })

    it('clears timer', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().callShowEarly()
      expect(useShowStore.getState().timerEndAt).toBeNull()
    })
  })

  // ─── Lineup Editing ───

  describe('reorderAct', () => {
    beforeEach(() => {
      useShowStore.getState().setLineup(sampleLineup)
    })

    it('moves act up', () => {
      const acts = useShowStore.getState().acts
      useShowStore.getState().reorderAct(acts[1].id, 'up')

      const reordered = useShowStore.getState().acts
      expect(reordered[0].name).toBe('Exercise Block')
      expect(reordered[1].name).toBe('Morning Deep Work')
    })

    it('moves act down', () => {
      const acts = useShowStore.getState().acts
      useShowStore.getState().reorderAct(acts[0].id, 'down')

      const reordered = useShowStore.getState().acts
      expect(reordered[0].name).toBe('Exercise Block')
      expect(reordered[1].name).toBe('Morning Deep Work')
    })

    it('does nothing at boundaries', () => {
      const acts = useShowStore.getState().acts
      useShowStore.getState().reorderAct(acts[0].id, 'up')

      const reordered = useShowStore.getState().acts
      expect(reordered[0].name).toBe('Morning Deep Work')
    })
  })

  describe('removeAct', () => {
    it('removes act and re-indexes order', () => {
      useShowStore.getState().setLineup(sampleLineup)
      const acts = useShowStore.getState().acts
      useShowStore.getState().removeAct(acts[1].id)

      const remaining = useShowStore.getState().acts
      expect(remaining).toHaveLength(2)
      expect(remaining[0].order).toBe(0)
      expect(remaining[1].order).toBe(1)
    })
  })

  describe('addAct', () => {
    it('appends act with correct order', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().addAct('New Act', 'Creative', 30)

      const acts = useShowStore.getState().acts
      expect(acts).toHaveLength(4)
      expect(acts[3].name).toBe('New Act')
      expect(acts[3].sketch).toBe('Creative')
      expect(acts[3].order).toBe(3)
      expect(acts[3].status).toBe('upcoming')
    })
  })

  // ─── Strike the Stage ───

  describe('strikeTheStage', () => {
    beforeEach(() => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
    })

    it('sets DAY_WON when all beats locked', () => {
      useShowStore.setState({ beatsLocked: 3, beatThreshold: 3 })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('DAY_WON')
    })

    it('sets SOLID_SHOW when one beat short', () => {
      useShowStore.setState({ beatsLocked: 2, beatThreshold: 3 })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('SOLID_SHOW')
    })

    it('sets GOOD_EFFORT when at least half', () => {
      useShowStore.setState({ beatsLocked: 3, beatThreshold: 5 })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('GOOD_EFFORT')
    })

    it('sets SHOW_CALLED_EARLY when less than half', () => {
      useShowStore.setState({ beatsLocked: 0, beatThreshold: 3 })
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().verdict).toBe('SHOW_CALLED_EARLY')
    })

    it('transitions to strike phase', () => {
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().phase).toBe('strike')
    })

    it('expands view', () => {
      useShowStore.getState().strikeTheStage()
      expect(useShowStore.getState().isExpanded).toBe(true)
    })

    it('sends verdict notification', () => {
      useShowStore.getState().strikeTheStage()
      expect(window.clui.notifyVerdict).toHaveBeenCalled()
    })
  })

  // ─── Navigation ───

  describe('toggleExpanded', () => {
    it('toggles isExpanded', () => {
      expect(useShowStore.getState().isExpanded).toBe(true)
      useShowStore.getState().toggleExpanded()
      expect(useShowStore.getState().isExpanded).toBe(false)
      useShowStore.getState().toggleExpanded()
      expect(useShowStore.getState().isExpanded).toBe(true)
    })
  })

  // ─── Reset ───

  describe('resetShow', () => {
    it('resets to initial state', () => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
      useShowStore.getState().resetShow()

      const state = useShowStore.getState()
      expect(state.phase).toBe('no_show')
      expect(state.energy).toBeNull()
      expect(state.acts).toHaveLength(0)
      expect(state.verdict).toBeNull()
      expect(state.beatsLocked).toBe(0)
      expect(state.isExpanded).toBe(true)
    })
  })

  // ─── Session ───

  describe('setClaudeSessionId', () => {
    it('sets session ID', () => {
      useShowStore.getState().setClaudeSessionId('test-session')
      expect(useShowStore.getState().claudeSessionId).toBe('test-session')
    })
  })

  // ─── Selectors ───

  describe('selectors', () => {
    beforeEach(() => {
      useShowStore.getState().setLineup(sampleLineup)
      useShowStore.getState().startShow()
    })

    it('selectCurrentAct returns active act', () => {
      const state = useShowStore.getState()
      const current = selectCurrentAct(state)
      expect(current?.name).toBe('Morning Deep Work')
      expect(current?.status).toBe('active')
    })

    it('selectNextAct returns first upcoming act', () => {
      const state = useShowStore.getState()
      const next = selectNextAct(state)
      expect(next?.name).toBe('Exercise Block')
    })

    it('selectCompletedActs returns completed acts', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().completeAct(actId)
      const completed = selectCompletedActs(useShowStore.getState())
      expect(completed).toHaveLength(1)
      expect(completed[0].name).toBe('Morning Deep Work')
    })

    it('selectSkippedActs returns skipped acts', () => {
      const actId = useShowStore.getState().currentActId!
      useShowStore.getState().skipAct(actId)
      const skipped = selectSkippedActs(useShowStore.getState())
      expect(skipped).toHaveLength(1)
      expect(skipped[0].name).toBe('Morning Deep Work')
    })

    it('selectBeatsRemaining returns remaining beats', () => {
      expect(selectBeatsRemaining(useShowStore.getState())).toBe(3)
      useShowStore.getState().completeAct(useShowStore.getState().currentActId!)
      useShowStore.getState().lockBeat()
      expect(selectBeatsRemaining(useShowStore.getState())).toBe(2)
    })
  })
})
