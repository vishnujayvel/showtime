/**
 * Show Machine Guards — boolean predicates used by XState transitions.
 *
 * Extracted from showMachine.ts to keep the machine definition focused on state topology.
 * Each guard receives { context } and returns a boolean to allow/block a transition.
 */
import type { ShowMachineContext } from './showMachine.context'
import { findNextUpcoming } from './showMachine.context'

type GuardArgs = { context: ShowMachineContext }

/** All named guards referenced by the show machine's guarded transitions. */
export const showMachineGuards = {
  hasActs: ({ context }: GuardArgs) => context.acts.length > 0,
  hasCurrentAct: ({ context }: GuardArgs) => context.currentActId !== null,
  hasNextAct: ({ context }: GuardArgs) => findNextUpcoming(context.acts) !== undefined,
  noNextAct: ({ context }: GuardArgs) => findNextUpcoming(context.acts) === undefined,
  hasConfirmedLineup: ({ context }: GuardArgs) => context.acts.length > 0 && context.lineupStatus === 'confirmed',
  hasTimerRunning: ({ context }: GuardArgs) => context.timerEndAt !== null,
  hasPausedTimer: ({ context }: GuardArgs) =>
    context.timerPausedRemaining !== null &&
    context.currentActId !== null &&
    context.acts.some((a) => a.id === context.currentActId && a.status === 'active'),
}
