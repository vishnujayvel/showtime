import type { DataService } from './DataService'
import type { ShowStateSnapshot, TimelineEventInput } from './types'

export class SyncEngine {
  private debounceTimer: ReturnType<typeof setTimeout> | null = null
  private pendingSnapshot: ShowStateSnapshot | null = null
  private readonly DEBOUNCE_MS = 5000

  constructor(private data: DataService) {}

  /**
   * Queue a state snapshot for debounced write (5s interval).
   * Only the latest snapshot is written.
   */
  queueSync(snapshot: ShowStateSnapshot): void {
    this.pendingSnapshot = snapshot
    if (!this.debounceTimer) {
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null
        this.writeSnapshot()
      }, this.DEBOUNCE_MS)
    }
  }

  /**
   * Immediately flush pending state to SQLite.
   * Cancels any pending debounce timer.
   */
  flush(snapshot?: ShowStateSnapshot): void {
    if (snapshot) this.pendingSnapshot = snapshot
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.writeSnapshot()
  }

  /**
   * Record a timeline event and flush the associated snapshot.
   */
  recordAndFlush(event: TimelineEventInput, snapshot?: ShowStateSnapshot): void {
    this.data.timeline.recordEvent({
      showId: event.showId,
      actId: event.actId ?? null,
      eventType: event.eventType,
      plannedStart: event.plannedStart ?? null,
      plannedEnd: event.plannedEnd ?? null,
      actualStart: event.actualStart ?? null,
      actualEnd: event.actualEnd ?? null,
      driftSeconds: event.driftSeconds ?? null,
      metadata: event.metadata ? JSON.stringify(event.metadata) : null,
    })
    if (snapshot) this.flush(snapshot)
  }

  /**
   * Hydrate: load today's show from SQLite.
   * Returns null if no resumable show exists for today.
   */
  hydrate(): ShowStateSnapshot | null {
    const today = new Date().toISOString().slice(0, 10)
    const show = this.data.shows.getShow(today)
    if (!show) return null
    if (show.phase === 'no_show' || show.phase === 'strike') return null

    const actRows = this.data.acts.getActsForShow(today)
    return {
      showId: show.id,
      phase: show.phase,
      energy: show.energy,
      verdict: show.verdict,
      beatsLocked: show.beatsLocked,
      beatThreshold: show.beatThreshold,
      startedAt: show.startedAt,
      endedAt: show.endedAt,
      planText: show.planText,
      acts: actRows.map((a) => ({
        id: a.id,
        name: a.name,
        sketch: a.sketch,
        category: a.category,
        plannedDurationMs: a.plannedDurationMs,
        actualDurationMs: a.actualDurationMs,
        sortOrder: a.sortOrder,
        status: a.status,
        beatLocked: a.beatLocked,
        plannedStartAt: a.plannedStartAt,
        actualStartAt: a.actualStartAt,
        actualEndAt: a.actualEndAt,
      })),
    }
  }

  /**
   * Final synchronous flush on app quit.
   */
  finalFlush(): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer)
      this.debounceTimer = null
    }
    this.writeSnapshot()
  }

  private writeSnapshot(): void {
    const snapshot = this.pendingSnapshot
    if (!snapshot) return
    this.pendingSnapshot = null

    // Upsert show
    this.data.shows.upsertShow({
      id: snapshot.showId,
      phase: snapshot.phase,
      energy: snapshot.energy ?? null,
      verdict: snapshot.verdict ?? null,
      beatsLocked: snapshot.beatsLocked ?? 0,
      beatThreshold: snapshot.beatThreshold ?? 3,
      startedAt: snapshot.startedAt ?? null,
      endedAt: snapshot.endedAt ?? null,
      planText: snapshot.planText ?? null,
    })

    // Upsert acts
    if (snapshot.acts) {
      for (const act of snapshot.acts) {
        this.data.acts.upsertAct({
          id: act.id,
          showId: snapshot.showId,
          name: act.name,
          sketch: act.sketch,
          category: act.category ?? null,
          plannedDurationMs: act.plannedDurationMs,
          actualDurationMs: act.actualDurationMs ?? null,
          sortOrder: act.sortOrder,
          status: act.status,
          beatLocked: act.beatLocked ?? 0,
          plannedStartAt: act.plannedStartAt ?? null,
          actualStartAt: act.actualStartAt ?? null,
          actualEndAt: act.actualEndAt ?? null,
        })
      }
    }
  }
}
