/**
 * Show Machine Context — types, helpers, and initial context for the XState show machine.
 *
 * Extracted from showMachine.ts to keep the machine definition focused on state topology.
 * Contains the context shape, event union, verdict logic, and factory functions.
 */
import { localToday } from '../../shared/date-utils'
import type {
  ShowPhase,
  EnergyLevel,
  Act,
  ActStatus,
  ShowVerdict,
  ShowLineup,
  WritersRoomStep,
  ViewTier,
} from '../../shared/types'

// ─── Context ───

/** Full context shape for the show machine including acts, timer, energy, and view state. */
export interface ShowMachineContext {
  energy: EnergyLevel | null
  acts: Act[]
  currentActId: string | null
  beatsLocked: number
  beatThreshold: number
  timerEndAt: number | null
  timerPausedRemaining: number | null
  showDate: string
  showStartedAt: number | null
  showEndedAt: number | null
  verdict: ShowVerdict | null
  viewTier: ViewTier
  beatCheckPending: boolean
  celebrationActive: boolean
  writersRoomStep: WritersRoomStep
  writersRoomEnteredAt: number | null
  breathingPauseEndAt: number | null
  lineupStatus: 'draft' | 'confirmed'
  editingMidShow: boolean
}

// ─── Events ───

/** Union of all events the show machine can receive. */
export type ShowMachineEvent =
  | { type: 'ENTER_WRITERS_ROOM' }
  | { type: 'SET_ENERGY'; level: EnergyLevel }
  | { type: 'SET_WRITERS_ROOM_STEP'; step: WritersRoomStep }
  | { type: 'SET_LINEUP'; lineup: ShowLineup }
  | { type: 'FINALIZE_LINEUP' }
  | { type: 'START_SHOW' }
  | { type: 'TRIGGER_COLD_OPEN' }
  | { type: 'COMPLETE_COLD_OPEN' }
  | { type: 'TRIGGER_GOING_LIVE' }
  | { type: 'COMPLETE_GOING_LIVE' }
  | { type: 'COMPLETE_ACT'; actId: string }
  | { type: 'SKIP_ACT'; actId: string }
  | { type: 'EXTEND_ACT'; minutes: number }
  | { type: 'LOCK_BEAT' }
  | { type: 'SKIP_BEAT' }
  | { type: 'CELEBRATION_DONE' }
  | { type: 'ENTER_INTERMISSION' }
  | { type: 'EXIT_INTERMISSION' }
  | { type: 'ENTER_DIRECTOR' }
  | { type: 'EXIT_DIRECTOR' }
  | { type: 'SKIP_TO_NEXT' }
  | { type: 'CALL_SHOW_EARLY' }
  | { type: 'START_BREATHING_PAUSE'; durationMs?: number }
  | { type: 'END_BREATHING_PAUSE' }
  | { type: 'STRIKE' }
  | { type: 'RESET' }
  // Lineup editing
  | { type: 'REORDER_ACT'; actId: string; direction: 'up' | 'down' }
  | { type: 'REMOVE_ACT'; actId: string }
  | { type: 'ADD_ACT'; name: string; sketch: string; durationMinutes: number }
  | { type: 'UPDATE_ACT'; actId: string; name?: string; durationMinutes?: number }
  // Mid-show lineup editing
  | { type: 'EDIT_LINEUP' }
  | { type: 'CONFIRM_LINEUP_EDIT'; acts: Act[] }
  // View tier
  | { type: 'SET_VIEW_TIER'; tier: ViewTier }
  // Overlay views (history, settings, onboarding)
  | { type: 'VIEW_HISTORY' }
  | { type: 'VIEW_SETTINGS' }
  | { type: 'VIEW_ONBOARDING' }
  | { type: 'CLOSE_OVERLAY' }
  // Auto-resume from DB
  | { type: 'RESTORE_SHOW'; targetPhase: ShowPhase; context: Partial<ShowMachineContext> }

// ─── Helpers ───

export function today(): string {
  return localToday()
}

export function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

/** Human-readable verdict messages keyed by ShowVerdict enum value. */
export const VERDICT_MESSAGES: Record<ShowVerdict, string> = {
  DAY_WON: 'You showed up and you were present.',
  SOLID_SHOW: 'Not every sketch lands. The show was still great.',
  GOOD_EFFORT: 'You got on stage. That\'s the hardest part.',
  SHOW_CALLED_EARLY: 'Sometimes the show is short. The audience still came.',
}

/** Determine the show verdict based on how many beats were locked vs the threshold. */
export function computeVerdict(beatsLocked: number, beatThreshold: number): ShowVerdict {
  if (beatsLocked >= beatThreshold) return 'DAY_WON'
  if (beatsLocked === beatThreshold - 1) return 'SOLID_SHOW'
  if (beatsLocked >= Math.ceil(beatThreshold / 2)) return 'GOOD_EFFORT'
  return 'SHOW_CALLED_EARLY'
}

export function findNextUpcoming(acts: Act[]): Act | undefined {
  return acts.find((a) => a.status === 'upcoming')
}

// ─── Initial Context ───

/** Create a fresh default context for a new show (no energy, no acts, today's date). */
export function createInitialContext(): ShowMachineContext {
  return {
    energy: null,
    acts: [],
    currentActId: null,
    beatsLocked: 0,
    beatThreshold: 3,
    timerEndAt: null,
    timerPausedRemaining: null,
    showDate: today(),
    showStartedAt: null,
    showEndedAt: null,
    verdict: null,
    viewTier: 'expanded' as ViewTier,
    beatCheckPending: false,
    celebrationActive: false,
    writersRoomStep: 'energy',
    writersRoomEnteredAt: null,
    breathingPauseEndAt: null,
    lineupStatus: 'draft',
    editingMidShow: false,
  }
}
