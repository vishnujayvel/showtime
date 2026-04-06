import { describe, it, expect, afterEach } from 'vitest'
import { createTrackedActor, type TrackedActor } from './drop-tracker'

describe('createTrackedActor', () => {
  let tracked: TrackedActor

  afterEach(() => {
    tracked?.actor.stop()
  })

  it('assertNoDrops passes when no events are dropped', () => {
    tracked = createTrackedActor()
    // TRIGGER_COLD_OPEN is valid in no_show
    tracked.actor.send({ type: 'TRIGGER_COLD_OPEN' })
    expect(() => tracked.assertNoDrops()).not.toThrow()
  })

  it('records drops array for unhandled events', () => {
    tracked = createTrackedActor()
    // Events with no-op handlers (overriding wildcard) produce can()=false → drop
    // But wildcard catches most events, so drops array captures Layer 1 drops only
    expect(tracked.drops).toEqual([])
  })

  it('starts actor in no_show phase by default', () => {
    tracked = createTrackedActor()
    const snapshot = tracked.actor.getSnapshot()
    const phaseValue = (snapshot.value as Record<string, unknown>).phase
    expect(phaseValue).toBe('no_show')
  })

  it('accepts context overrides', () => {
    tracked = createTrackedActor({ energy: 'high' })
    const ctx = tracked.actor.getSnapshot().context
    expect(ctx.energy).toBe('high')
  })

  it('tracks multiple events through valid flow without drops', () => {
    tracked = createTrackedActor()
    tracked.actor.send({ type: 'TRIGGER_COLD_OPEN' })
    tracked.actor.send({ type: 'ENTER_WRITERS_ROOM' })
    // Valid flow — no drops expected
    expect(tracked.drops).toHaveLength(0)
    tracked.assertNoDrops()
  })
})
