/**
 * Test helper: creates an XState actor with drop detection.
 *
 * Captures events that the current state can't handle (Layer 1 drops)
 * and provides assertNoDrops() to fail tests on unexpected drops.
 *
 * Usage:
 *   const { actor, assertNoDrops } = createTrackedActor()
 *   // ... send events ...
 *   assertNoDrops() // call in afterEach
 *   actor.stop()
 */
import { createActor, type InspectionEvent } from 'xstate'
import {
  showMachine,
  createInitialContext,
  type ShowMachineContext,
} from '../../renderer/machines/showMachine'

export interface DroppedEvent {
  eventType: string
  state: unknown
}

export interface TrackedActor {
  actor: ReturnType<typeof createActor<typeof showMachine>>
  drops: DroppedEvent[]
  assertNoDrops: () => void
}

export function createTrackedActor(
  contextOverrides?: Partial<ShowMachineContext>,
): TrackedActor {
  const drops: DroppedEvent[] = []

  const actor = createActor(showMachine, {
    ...(contextOverrides
      ? {
          snapshot: showMachine.resolveState({
            value: { phase: 'no_show', animation: 'idle', overlay: 'none' },
            context: { ...createInitialContext(), ...contextOverrides },
          }),
        }
      : {}),
    inspect: (inspectionEvent: InspectionEvent) => {
      if (inspectionEvent.type !== '@xstate.event') return
      const event = (inspectionEvent as any).event
      if (typeof event?.type === 'string' && event.type.startsWith('xstate.')) return
      const snapshot = actor.getSnapshot()
      if (!snapshot.can(event)) {
        drops.push({ eventType: event.type, state: snapshot.value })
      }
    },
  })

  actor.start()

  return {
    actor,
    drops,
    assertNoDrops() {
      if (drops.length > 0) {
        const summary = drops
          .map((d) => `"${d.eventType}" in ${JSON.stringify(d.state)}`)
          .join('\n  ')
        throw new Error(
          `XState event drops detected (${drops.length}):\n  ${summary}`,
        )
      }
    },
  }
}
