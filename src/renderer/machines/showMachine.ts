/**
 * XState v5 Show Machine — the source of truth for Showtime's phase lifecycle.
 *
 * Replaces imperative Zustand phase management with a declarative statechart.
 * 6 top-level phases, nested substates, guarded transitions, entry/exit actions,
 * and a parallel animation region.
 */
import { setup, assign, createActor, type AnyActorRef } from 'xstate'
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
  verdict: ShowVerdict | null
  viewTier: ViewTier
  beatCheckPending: boolean
  celebrationActive: boolean
  writersRoomStep: WritersRoomStep
  writersRoomEnteredAt: number | null
  breathingPauseEndAt: number | null
}

// ─── Events ───

export type ShowMachineEvent =
  | { type: 'ENTER_WRITERS_ROOM' }
  | { type: 'SET_ENERGY'; level: EnergyLevel }
  | { type: 'SET_WRITERS_ROOM_STEP'; step: WritersRoomStep }
  | { type: 'SET_LINEUP'; lineup: ShowLineup }
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
  // View tier
  | { type: 'SET_VIEW_TIER'; tier: ViewTier }

// ─── Helpers ───

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function generateId(): string {
  return Math.random().toString(36).slice(2, 10)
}

const VERDICT_MESSAGES: Record<ShowVerdict, string> = {
  DAY_WON: 'You showed up and you were present.',
  SOLID_SHOW: 'Not every sketch lands. The show was still great.',
  GOOD_EFFORT: 'You got on stage. That\'s the hardest part.',
  SHOW_CALLED_EARLY: 'Sometimes the show is short. The audience still came.',
}

function computeVerdict(beatsLocked: number, beatThreshold: number): ShowVerdict {
  if (beatsLocked >= beatThreshold) return 'DAY_WON'
  if (beatsLocked === beatThreshold - 1) return 'SOLID_SHOW'
  if (beatsLocked >= Math.ceil(beatThreshold / 2)) return 'GOOD_EFFORT'
  return 'SHOW_CALLED_EARLY'
}

function findNextUpcoming(acts: Act[]): Act | undefined {
  return acts.find((a) => a.status === 'upcoming')
}

// ─── Initial Context ───

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
    verdict: null,
    viewTier: 'expanded' as ViewTier,
    beatCheckPending: false,
    celebrationActive: false,
    writersRoomStep: 'energy',
    writersRoomEnteredAt: null,
    breathingPauseEndAt: null,
  }
}

// ─── Machine Definition ───

export const showMachine = setup({
  types: {
    context: {} as ShowMachineContext,
    events: {} as ShowMachineEvent,
  },
  guards: {
    hasActs: ({ context }) => context.acts.length > 0,
    hasCurrentAct: ({ context }) => context.currentActId !== null,
    hasNextAct: ({ context }) => findNextUpcoming(context.acts) !== undefined,
    noNextAct: ({ context }) => findNextUpcoming(context.acts) === undefined,
    hasTimerRunning: ({ context }) => context.timerEndAt !== null,
    hasPausedTimer: ({ context }) => context.timerPausedRemaining !== null && context.currentActId !== null,
  },
  actions: {
    assignEnergy: assign({
      energy: ({ event }) => {
        if (event.type !== 'SET_ENERGY') return null
        return event.level
      },
    }),

    assignLineup: assign(({ context, event }) => {
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
      }
    }),

    assignWritersRoomStep: assign({
      writersRoomStep: ({ event }) => {
        if (event.type !== 'SET_WRITERS_ROOM_STEP') return 'energy' as WritersRoomStep
        return event.step
      },
    }),

    enterWritersRoom: assign({
      writersRoomStep: 'energy' as WritersRoomStep,
      writersRoomEnteredAt: () => Date.now(),
    }),

    startShowContext: assign(({ context }) => {
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

    completeActContext: assign(({ context, event }) => {
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

    skipActContext: assign(({ context, event }) => {
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

    autoStartNextAct: assign(({ context }) => {
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

    extendActContext: assign(({ context, event }) => {
      if (event.type !== 'EXTEND_ACT') return {}
      return {
        timerEndAt: context.timerEndAt ? context.timerEndAt + event.minutes * 60 * 1000 : null,
      }
    }),

    lockBeatContext: assign(({ context }) => ({
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

    enterIntermissionContext: assign(({ context }) => {
      const remaining = context.timerEndAt ? Math.max(0, context.timerEndAt - Date.now()) : null
      return {
        timerEndAt: null,
        timerPausedRemaining: remaining,
      }
    }),

    exitIntermissionResumeTimer: assign(({ context }) => ({
      timerEndAt: context.timerPausedRemaining ? Date.now() + context.timerPausedRemaining : null,
      timerPausedRemaining: null,
      breathingPauseEndAt: null,
    })),

    exitIntermissionStartNext: assign(({ context }) => {
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

    callShowEarlyContext: assign(({ context }) => ({
      acts: context.acts.map((a) =>
        a.status === 'upcoming' || a.status === 'active'
          ? { ...a, status: 'skipped' as ActStatus, completedAt: Date.now() }
          : a
      ),
      currentActId: null,
      timerEndAt: null,
      timerPausedRemaining: null,
      verdict: 'SHOW_CALLED_EARLY' as ShowVerdict,
      viewTier: 'expanded' as ViewTier,
      beatCheckPending: false,
    })),

    strikeContext: assign(({ context }) => {
      const verdict = computeVerdict(context.beatsLocked, context.beatThreshold)
      return {
        verdict,
        currentActId: null,
        timerEndAt: null,
        timerPausedRemaining: null,
        viewTier: 'expanded' as ViewTier,
        beatCheckPending: false,
      }
    }),

    resetContext: assign(() => createInitialContext()),

    startBreathingPauseContext: assign(({ context, event }) => {
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
      viewTier: ({ event }) => {
        if (event.type !== 'SET_VIEW_TIER') return 'expanded' as ViewTier
        return event.tier
      },
    }),

    reorderActContext: assign(({ context, event }) => {
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

    removeActContext: assign(({ context, event }) => {
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

    addActContext: assign(({ context, event }) => {
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

    skipCurrentActContext: assign(({ context }) => {
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
  },
}).createMachine({
  id: 'show',
  type: 'parallel',
  context: createInitialContext(),
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
          },
        },

        cold_open: {
          on: {
            COMPLETE_COLD_OPEN: {
              target: 'writers_room',
              actions: 'enterWritersRoom',
            },
          },
        },

        writers_room: {
          initial: 'energy',
          on: {
            SET_ENERGY: { actions: 'assignEnergy' },
            SET_LINEUP: { actions: 'assignLineup' },
            SET_WRITERS_ROOM_STEP: { actions: 'assignWritersRoomStep' },
            // Lineup editing during writer's room
            REORDER_ACT: { actions: 'reorderActContext' },
            REMOVE_ACT: { actions: 'removeActContext' },
            ADD_ACT: { actions: 'addActContext' },
            START_SHOW: {
              target: 'live',
              guard: 'hasActs',
              actions: 'startShowContext',
            },
            TRIGGER_GOING_LIVE: 'going_live',
            RESET: {
              target: 'no_show',
              actions: 'resetContext',
            },
          },
          states: {
            energy: {
              on: {
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
                SET_LINEUP: { target: 'lineup_ready', actions: 'assignLineup' },
                SET_WRITERS_ROOM_STEP: [
                  { target: 'energy', guard: ({ event }) => event.step === 'energy', actions: 'assignWritersRoomStep' },
                  { target: 'plan', guard: ({ event }) => event.step === 'plan', actions: 'assignWritersRoomStep' },
                ],
              },
            },
            lineup_ready: {},
          },
        },

        going_live: {
          on: {
            COMPLETE_GOING_LIVE: {
              target: 'live',
              guard: 'hasActs',
              actions: 'startShowContext',
            },
          },
        },

        live: {
          initial: 'act_active',
          on: {
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
            // These work from any live substate for backward compat
            LOCK_BEAT: {
              target: '.celebrating',
              actions: 'lockBeatContext',
            },
            SKIP_BEAT: [
              {
                target: '.act_active',
                guard: 'hasNextAct',
                actions: ['skipBeatContext', 'autoStartNextAct'],
              },
              {
                target: 'strike',
                actions: ['skipBeatContext', 'strikeContext'],
              },
            ],
            COMPLETE_ACT: {
              target: '.beat_check',
              actions: 'completeActContext',
            },
            // Lineup editing during live
            REORDER_ACT: { actions: 'reorderActContext' },
            REMOVE_ACT: { actions: 'removeActContext' },
            ADD_ACT: { actions: 'addActContext' },
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
  },
})

// ─── Actor Factory ───

export function createShowActor(context?: Partial<ShowMachineContext>) {
  return createActor(showMachine, {
    input: context,
    ...(context ? { snapshot: showMachine.resolveState({ value: { phase: 'no_show', animation: 'idle' }, context: { ...createInitialContext(), ...context } }) } : {}),
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

// ─── Verdict Messages Export ───

export { VERDICT_MESSAGES, computeVerdict }

// ─── Type Exports ───

export type ShowMachineState = ReturnType<typeof showMachine.transition>
export type ShowMachineActor = ReturnType<typeof createShowActor>
