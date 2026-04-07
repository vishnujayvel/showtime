/**
 * XState v5 Show Machine — the source of truth for Showtime's phase lifecycle.
 *
 * Replaces imperative Zustand phase management with a declarative statechart.
 * 6 top-level phases, nested substates, guarded transitions, entry/exit actions,
 * and a parallel animation region.
 *
 * Context types and helpers: ./showMachine.context.ts
 * Guard predicates: ./showMachine.guards.ts
 * Action implementations: ./showMachine.actions.ts
 */
import { setup, createActor } from 'xstate'
import { createInitialContext } from './showMachine.context'
import { showMachineGuards } from './showMachine.guards'
import { showMachineActions } from './showMachine.actions'
import type { ShowMachineContext, ShowMachineEvent } from './showMachine.context'
import type { ShowPhase, WritersRoomStep } from '../../shared/types'

// ─── Re-exports for backward compatibility ───
// All consumers import from this file; the split is an internal detail.
export type { ShowMachineContext, ShowMachineEvent } from './showMachine.context'
export {
  createInitialContext,
  computeVerdict,
  VERDICT_MESSAGES,
  findNextUpcoming,
  generateId,
  today,
} from './showMachine.context'

// ─── Machine Definition ───

/** XState v5 machine defining the show phase lifecycle with parallel animation and overlay regions. */
export const showMachine = setup({
  types: {
    context: {} as ShowMachineContext,
    events: {} as ShowMachineEvent,
  },
  // Type assertion: actions/guards are identical to the original inline versions.
  // XState v5 setup() needs inline definitions for full event-type narrowing;
  // extracting them loses TEvent refinement but doesn't change runtime behavior.
  guards: showMachineGuards as Record<string, (...args: any[]) => any>,
  actions: showMachineActions as Record<string, any>,
}).createMachine({
  id: 'show',
  type: 'parallel',
  context: createInitialContext(),
  on: {
    '*': { actions: 'logDroppedEvent' },
  },
  states: {
    // ─── Main Phase Region ───
    phase: {
      initial: 'no_show',
      // Handled at the phase level so they work from any phase
      on: {
        SET_VIEW_TIER: { actions: 'setViewTierContext' },
      },
      states: {
        no_show: {
          on: {
            ENTER_WRITERS_ROOM: {
              target: 'writers_room',
              actions: 'enterWritersRoom',
            },
            TRIGGER_COLD_OPEN: 'cold_open',
            // Auto-resume: restore from DB snapshot to the correct phase
            RESTORE_SHOW: [
              {
                // Safety net: Confirmed lineup in writers_room is invalid — promote to live.
                // Primary path (hydrateFromDB) already promotes targetPhase before dispatch.
                target: '#show.phase.live.act_active',
                guard: ({ event }) =>
                  event.type === 'RESTORE_SHOW' &&
                  event.targetPhase === 'writers_room' &&
                  event.context.lineupStatus === 'confirmed' &&
                  (event.context.acts?.length ?? 0) > 0,
                actions: 'restoreShowContext',
              },
              {
                // Restore to lineup_ready if acts exist (has a lineup to show)
                target: '#show.phase.writers_room.lineup_ready',
                guard: ({ event }) =>
                  event.type === 'RESTORE_SHOW' &&
                  event.targetPhase === 'writers_room' &&
                  (event.context.acts?.length ?? 0) > 0,
                actions: 'restoreShowContext',
              },
              {
                // Restore to energy if no acts (fresh Writer's Room)
                target: '#show.phase.writers_room.energy',
                guard: ({ event }) =>
                  event.type === 'RESTORE_SHOW' &&
                  event.targetPhase === 'writers_room' &&
                  (event.context.acts?.length ?? 0) === 0,
                actions: 'restoreShowContext',
              },
              {
                target: '#show.phase.live.act_active',
                guard: ({ event }) => event.type === 'RESTORE_SHOW' && event.targetPhase === 'live',
                actions: 'restoreShowContext',
              },
              {
                target: '#show.phase.intermission.resting',
                guard: ({ event }) => event.type === 'RESTORE_SHOW' && event.targetPhase === 'intermission',
                actions: 'restoreShowContext',
              },
              {
                target: '#show.phase.director',
                guard: ({ event }) => event.type === 'RESTORE_SHOW' && event.targetPhase === 'director',
                actions: 'restoreShowContext',
              },
              {
                target: '#show.phase.strike',
                guard: ({ event }) => event.type === 'RESTORE_SHOW' && event.targetPhase === 'strike',
                actions: 'restoreShowContext',
              },
            ],
            // RESET in no_show is intentionally a no-op — already reset.
            // Without this, the wildcard handler logs 524 false-positive drops
            // from test beforeEach blocks and app startup safety resets.
            RESET: {},
          },
        },

        cold_open: {
          on: {
            COMPLETE_COLD_OPEN: {
              target: 'writers_room',
              actions: 'enterWritersRoom',
            },
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
        },

        writers_room: {
          initial: 'energy',
          on: {
            // Mid-show editing: return to live with merged lineup
            CONFIRM_LINEUP_EDIT: {
              target: '#show.phase.live.act_active',
              guard: ({ context }) => context.editingMidShow && context.currentActId !== null,
              actions: 'confirmLineupEditContext',
            },
            // SET_LINEUP at parent level: accepted from any substate (energy, plan,
            // conversation, lineup_ready). The chat-first flow parses lineups before
            // reaching the conversation substate — parent-level handler fixes #160.
            SET_LINEUP: { target: '.lineup_ready', actions: 'assignLineup' },
            FINALIZE_LINEUP: {
              target: '.lineup_ready',
              guard: 'hasActs',
              actions: 'finalizeLineupContext',
            },
            // Lineup editing during writer's room
            REORDER_ACT: { actions: 'reorderActContext' },
            REMOVE_ACT: { actions: 'removeActContext' },
            ADD_ACT: { actions: 'addActContext' },
            UPDATE_ACT: { actions: 'updateActContext' },
            START_SHOW: {
              target: 'live',
              guard: 'hasConfirmedLineup',
              actions: 'startShowContext',
            },
            TRIGGER_GOING_LIVE: {
              target: 'going_live',
              guard: 'hasConfirmedLineup',
            },
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
          states: {
            energy: {
              on: {
                SET_ENERGY: { actions: 'assignEnergy' },
                // Only allow energy → plan (sequential flow, no skipping to conversation)
                SET_WRITERS_ROOM_STEP: [
                  { target: 'plan', guard: ({ event }) => event.step === 'plan', actions: 'assignWritersRoomStep' },
                ],
              },
            },
            plan: {
              on: {
                SET_WRITERS_ROOM_STEP: [
                  { target: 'conversation', guard: ({ event }) => event.step === 'conversation', actions: 'assignWritersRoomStep' },
                  { target: 'energy', guard: ({ event }) => event.step === 'energy', actions: 'assignWritersRoomStep' },
                ],
              },
            },
            conversation: {
              on: {
                SET_WRITERS_ROOM_STEP: [
                  { target: 'energy', guard: ({ event }) => event.step === 'energy', actions: 'assignWritersRoomStep' },
                  { target: 'plan', guard: ({ event }) => event.step === 'plan', actions: 'assignWritersRoomStep' },
                ],
              },
            },
            lineup_ready: {
              on: {
                SET_WRITERS_ROOM_STEP: [
                  { target: 'conversation', guard: ({ event }) => event.step === 'conversation', actions: 'assignWritersRoomStep' },
                  { target: 'plan', guard: ({ event }) => event.step === 'plan', actions: 'assignWritersRoomStep' },
                  { target: 'energy', guard: ({ event }) => event.step === 'energy', actions: 'assignWritersRoomStep' },
                ],
                SET_ENERGY: { actions: 'assignEnergy' },
              },
            },
          },
        },

        going_live: {
          on: {
            COMPLETE_GOING_LIVE: {
              target: 'live',
              guard: 'hasActs',
              actions: 'startShowContext',
            },
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
        },

        live: {
          initial: 'act_active',
          on: {
            EDIT_LINEUP: {
              target: '#show.phase.writers_room.conversation',
              actions: ['clearBeatState', 'editLineupContext'],
            },
            ENTER_INTERMISSION: {
              target: 'intermission',
              actions: ['clearBeatState', 'enterIntermissionContext'],
            },
            ENTER_DIRECTOR: {
              target: 'director',
              actions: 'clearBeatState',
            },
            STRIKE: {
              target: 'strike',
              actions: 'strikeContext',
            },
            CALL_SHOW_EARLY: {
              target: 'strike',
              actions: 'callShowEarlyContext',
            },
            START_BREATHING_PAUSE: {
              target: 'intermission.breathing_pause',
              actions: ['clearBeatState', 'startBreathingPauseContext'],
            },
            EXTEND_ACT: { actions: 'extendActContext' },
            // LOCK_BEAT/SKIP_BEAT removed from live parent — only handled in beat_check/celebrating
            // substates. Parent-level handlers accepted these from act_active, bypassing beat_check flow.
            // COMPLETE_ACT also moved to act_active only (PR #149).
            // Lineup editing during live
            REORDER_ACT: { actions: 'reorderActContext' },
            REMOVE_ACT: { actions: 'removeActContext' },
            ADD_ACT: { actions: 'addActContext' },
            UPDATE_ACT: { actions: 'updateActContext' },
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
          states: {
            act_active: {
              on: {
                COMPLETE_ACT: {
                  target: 'beat_check',
                  actions: 'completeActContext',
                },
                SKIP_ACT: [
                  // Skipping a non-current (upcoming) act — just mark it, don't touch current act
                  {
                    target: 'act_active',
                    guard: ({ context, event }) => {
                      if (event.type !== 'SKIP_ACT') return false
                      return context.currentActId !== event.actId
                    },
                    actions: 'skipActContext',
                  },
                  // Skipping the current act — advance to next if available
                  {
                    target: 'act_active',
                    guard: ({ context, event }) => {
                      if (event.type !== 'SKIP_ACT') return false
                      if (context.currentActId !== event.actId) return false
                      const remaining = context.acts.filter((a) => a.status === 'upcoming' && a.id !== event.actId)
                      return remaining.length > 0
                    },
                    actions: ['skipActContext', 'autoStartNextAct'],
                  },
                  // Skipping the current act with no next — go to strike
                  {
                    target: '#show.phase.strike',
                    actions: ['skipActContext', 'strikeContext'],
                  },
                ],
                REMOVE_ACT: [
                  // Removing a non-current (upcoming) act — just remove it
                  {
                    target: 'act_active',
                    guard: ({ context, event }) => {
                      if (event.type !== 'REMOVE_ACT') return false
                      return context.currentActId !== event.actId
                    },
                    actions: 'removeActContext',
                  },
                  // Removing the current act — advance to next if available
                  {
                    target: 'act_active',
                    guard: ({ context, event }) => {
                      if (event.type !== 'REMOVE_ACT') return false
                      if (context.currentActId !== event.actId) return false
                      const remaining = context.acts.filter((a) => a.status === 'upcoming' && a.id !== event.actId)
                      return remaining.length > 0
                    },
                    actions: ['removeActContext', 'autoStartNextAct'],
                  },
                  // Removing the current act with no next — go to strike
                  {
                    target: '#show.phase.strike',
                    actions: ['removeActContext', 'strikeContext'],
                  },
                ],
              },
            },
            beat_check: {
              on: {
                LOCK_BEAT: {
                  target: 'celebrating',
                  actions: 'lockBeatContext',
                },
                SKIP_BEAT: [
                  {
                    target: 'act_active',
                    guard: 'hasNextAct',
                    actions: ['skipBeatContext', 'autoStartNextAct'],
                  },
                  {
                    target: '#show.phase.strike',
                    actions: ['skipBeatContext', 'strikeContext'],
                  },
                ],
              },
            },
            celebrating: {
              on: {
                LOCK_BEAT: {
                  // Double-click: stay in celebrating, increment beats
                  actions: 'lockBeatContext',
                },
                CELEBRATION_DONE: [
                  {
                    target: 'act_active',
                    guard: 'hasNextAct',
                    actions: ['celebrationDoneContext', 'autoStartNextAct'],
                  },
                  {
                    target: '#show.phase.strike',
                    actions: ['celebrationDoneContext', 'strikeContext'],
                  },
                ],
              },
            },
          },
        },

        intermission: {
          initial: 'resting',
          on: {
            EXIT_INTERMISSION: [
              {
                target: 'live',
                guard: 'hasPausedTimer',
                actions: 'exitIntermissionResumeTimer',
              },
              {
                target: 'live',
                guard: 'hasNextAct',
                actions: 'exitIntermissionStartNext',
              },
              {
                target: 'strike',
                actions: 'strikeContext',
              },
            ],
            STRIKE: {
              target: 'strike',
              actions: 'strikeContext',
            },
            // Lineup editing during intermission
            REORDER_ACT: { actions: 'reorderActContext' },
            REMOVE_ACT: { actions: 'removeActContext' },
            ADD_ACT: { actions: 'addActContext' },
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
          states: {
            resting: {
              on: {
                START_BREATHING_PAUSE: {
                  target: 'breathing_pause',
                  actions: 'startBreathingPauseContext',
                },
              },
            },
            breathing_pause: {
              on: {
                END_BREATHING_PAUSE: {
                  target: 'resting',
                  actions: 'endBreathingPauseContext',
                },
              },
            },
          },
        },

        director: {
          on: {
            EXIT_DIRECTOR: {
              target: 'live',
              guard: 'hasCurrentAct',
            },
            EDIT_LINEUP: {
              target: '#show.phase.writers_room.conversation',
              actions: 'editLineupContext',
            },
            SKIP_TO_NEXT: [
              {
                target: 'live',
                guard: ({ context }) => {
                  // After skipping current act, is there another?
                  const remaining = context.acts.filter(
                    (a) => a.status === 'upcoming' && a.id !== context.currentActId
                  )
                  return remaining.length > 0
                },
                actions: ['skipCurrentActContext', 'autoStartNextAct'],
              },
              {
                target: 'strike',
                actions: ['skipCurrentActContext', 'strikeContext'],
              },
            ],
            CALL_SHOW_EARLY: {
              target: 'strike',
              actions: 'callShowEarlyContext',
            },
            START_BREATHING_PAUSE: {
              target: 'intermission.breathing_pause',
              actions: 'startBreathingPauseContext',
            },
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
        },

        strike: {
          on: {
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
        },
      },
    },

    // ─── Animation Region (parallel) ───
    animation: {
      initial: 'idle',
      states: {
        idle: {
          on: {
            TRIGGER_COLD_OPEN: 'cold_open',
            TRIGGER_GOING_LIVE: 'going_live',
          },
        },
        cold_open: {
          on: {
            COMPLETE_COLD_OPEN: 'idle',
          },
        },
        going_live: {
          on: {
            COMPLETE_GOING_LIVE: 'idle',
          },
        },
      },
    },

    // ─── Overlay Region (parallel) — history, settings, onboarding ───
    overlay: {
      initial: 'none',
      on: {
        RESET: '.none',
        VIEW_HISTORY: '.history',
        VIEW_SETTINGS: '.settings',
        VIEW_ONBOARDING: '.onboarding',
        CLOSE_OVERLAY: '.none',
      },
      states: {
        none: {},
        history: {},
        settings: {},
        onboarding: {},
      },
    },
  },
})

// ─── Actor Factory ───

/** Create a new show machine actor, optionally seeded with partial context. */
export function createShowActor(context?: Partial<ShowMachineContext>) {
  return createActor(showMachine, {
    input: context,
    ...(context ? { snapshot: showMachine.resolveState({ value: { phase: 'no_show', animation: 'idle', overlay: 'none' }, context: { ...createInitialContext(), ...context } }) } : {}),
  })
}

// ─── Phase Extraction ───

/** Extract the top-level ShowPhase from the machine state value */
export function getPhaseFromState(stateValue: Record<string, unknown> | string): ShowPhase {
  if (typeof stateValue === 'string') return stateValue as ShowPhase
  const phaseValue = (stateValue as { phase: string | Record<string, string> }).phase
  if (typeof phaseValue === 'string') return phaseValue as ShowPhase
  // Nested state — return the top-level key
  return Object.keys(phaseValue)[0] as ShowPhase
}

/** Extract the Writer's Room substep from machine state */
export function getWritersRoomStep(stateValue: Record<string, unknown> | string): WritersRoomStep | null {
  if (typeof stateValue === 'string') return null
  const phaseValue = (stateValue as { phase: string | Record<string, string> }).phase
  if (typeof phaseValue === 'string') return null
  if (typeof phaseValue === 'object' && 'writers_room' in phaseValue) {
    return (phaseValue as { writers_room: string }).writers_room as WritersRoomStep
  }
  return null
}

/** Check if a specific animation is active */
export function isAnimationActive(stateValue: Record<string, unknown>, animation: 'cold_open' | 'going_live'): boolean {
  return (stateValue as { animation: string }).animation === animation
}

/** Possible overlay view states (none means no overlay is showing). */
export type OverlayState = 'none' | 'history' | 'settings' | 'onboarding'
/** Extracts the current overlay view state from an XState state value. */
export function getOverlayFromState(stateValue: Record<string, unknown>): OverlayState {
  return ((stateValue as { overlay?: string }).overlay ?? 'none') as OverlayState
}

// ─── Type Exports ───

/** Snapshot type returned by the show machine's transition function. */
export type ShowMachineState = ReturnType<typeof showMachine.transition>
/** Actor type for the show machine, used for typed refs in React context. */
export type ShowMachineActor = ReturnType<typeof createShowActor>
