/**
 * XState v5 machine modeling Showtime's ShowPhase transitions.
 * Used by show-machine.test.ts to auto-generate all valid state paths.
 */
import { setup } from 'xstate'

export type ShowMachineEvent =
  | { type: 'ENTER_WRITERS_ROOM' }
  | { type: 'SET_LINEUP' }
  | { type: 'START_SHOW' }
  | { type: 'COMPLETE_ACT' }
  | { type: 'ENTER_INTERMISSION' }
  | { type: 'EXIT_INTERMISSION' }
  | { type: 'ENTER_DIRECTOR' }
  | { type: 'EXIT_DIRECTOR' }
  | { type: 'CALL_EARLY' }
  | { type: 'SKIP_TO_NEXT' }
  | { type: 'STRIKE' }
  | { type: 'RESET' }

export const showMachine = setup({
  types: {
    events: {} as ShowMachineEvent,
  },
}).createMachine({
  id: 'showPhase',
  initial: 'no_show',
  states: {
    no_show: {
      on: {
        ENTER_WRITERS_ROOM: 'writers_room',
      },
    },
    writers_room: {
      on: {
        START_SHOW: 'live',
        RESET: 'no_show',
      },
    },
    live: {
      on: {
        COMPLETE_ACT: 'live',         // beat check → next act (stay live)
        ENTER_INTERMISSION: 'intermission',
        ENTER_DIRECTOR: 'director',
        STRIKE: 'strike',
        RESET: 'no_show',
      },
    },
    intermission: {
      on: {
        EXIT_INTERMISSION: 'live',
        STRIKE: 'strike',
        RESET: 'no_show',
      },
    },
    director: {
      on: {
        EXIT_DIRECTOR: 'live',
        CALL_EARLY: 'strike',
        SKIP_TO_NEXT: 'live',
        RESET: 'no_show',
      },
    },
    strike: {
      on: {
        RESET: 'no_show',
      },
    },
  },
})
