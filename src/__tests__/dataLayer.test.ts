// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { DataService } from '../main/data/DataService'

let tmpDir: string
let data: DataService

beforeEach(() => {
  tmpDir = mkdtempSync(join(tmpdir(), 'showtime-test-'))
  const dbPath = join(tmpDir, 'test.db')
  const migrationsDir = join(__dirname, '..', 'main', 'data', 'migrations')
  data = DataService.initWithPath(dbPath, migrationsDir)
})

afterEach(() => {
  data.close()
  rmSync(tmpDir, { recursive: true, force: true })
})

describe('ShowRepository', () => {
  it('creates and retrieves a show', () => {
    data.shows.upsertShow({
      id: '2026-03-21',
      phase: 'live',
      energy: 'high',
      beatsLocked: 2,
      beatThreshold: 3,
    })

    const show = data.shows.getShow('2026-03-21')
    expect(show).toBeDefined()
    expect(show!.phase).toBe('live')
    expect(show!.energy).toBe('high')
    expect(show!.beatsLocked).toBe(2)
    expect(show!.beatThreshold).toBe(3)
  })

  it('upsert updates existing show', () => {
    data.shows.upsertShow({ id: '2026-03-21', phase: 'writers_room' })
    data.shows.upsertShow({ id: '2026-03-21', phase: 'live', energy: 'medium' })

    const show = data.shows.getShow('2026-03-21')
    expect(show!.phase).toBe('live')
    expect(show!.energy).toBe('medium')
  })

  it('updatePhase only changes phase', () => {
    data.shows.upsertShow({ id: '2026-03-21', phase: 'writers_room', energy: 'high' })
    data.shows.updatePhase('2026-03-21', 'live')

    const show = data.shows.getShow('2026-03-21')
    expect(show!.phase).toBe('live')
    expect(show!.energy).toBe('high')
  })

  it('updateVerdict only changes verdict', () => {
    data.shows.upsertShow({ id: '2026-03-21', phase: 'strike' })
    data.shows.updateVerdict('2026-03-21', 'DAY_WON')

    const show = data.shows.getShow('2026-03-21')
    expect(show!.verdict).toBe('DAY_WON')
    expect(show!.phase).toBe('strike')
  })

  it('returns undefined for missing show', () => {
    expect(data.shows.getShow('2099-01-01')).toBeUndefined()
  })
})

describe('ActRepository', () => {
  beforeEach(() => {
    data.shows.upsertShow({ id: '2026-03-21', phase: 'live' })
  })

  it('bulk inserts and retrieves acts in order', () => {
    data.acts.insertActs('2026-03-21', [
      { id: 'act1', name: 'Deep Work', sketch: 'Deep Work', plannedDurationMs: 1800000, sortOrder: 0, status: 'active' },
      { id: 'act2', name: 'Email', sketch: 'Admin', plannedDurationMs: 900000, sortOrder: 1, status: 'pending' },
      { id: 'act3', name: 'Lunch', sketch: 'Social', plannedDurationMs: 1800000, sortOrder: 2, status: 'pending' },
    ])

    const acts = data.acts.getActsForShow('2026-03-21')
    expect(acts).toHaveLength(3)
    expect(acts[0].name).toBe('Deep Work')
    expect(acts[1].name).toBe('Email')
    expect(acts[2].name).toBe('Lunch')
  })

  it('updates act status and timestamps', () => {
    data.acts.insertActs('2026-03-21', [
      { id: 'act1', name: 'Test', sketch: 'Deep Work', plannedDurationMs: 1800000, sortOrder: 0, status: 'active' },
    ])

    data.acts.updateActStatus('act1', 'completed', {
      actualEndAt: 1000000,
      actualDurationMs: 1800000,
    })

    const acts = data.acts.getActsForShow('2026-03-21')
    expect(acts[0].status).toBe('completed')
    expect(acts[0].actualEndAt).toBe(1000000)
    expect(acts[0].actualDurationMs).toBe(1800000)
  })

  it('updates act order', () => {
    data.acts.insertActs('2026-03-21', [
      { id: 'act1', name: 'First', sketch: 'Admin', plannedDurationMs: 900000, sortOrder: 0, status: 'pending' },
      { id: 'act2', name: 'Second', sketch: 'Admin', plannedDurationMs: 900000, sortOrder: 1, status: 'pending' },
    ])

    data.acts.updateActOrder('act2', 0)
    data.acts.updateActOrder('act1', 1)

    const acts = data.acts.getActsForShow('2026-03-21')
    expect(acts[0].id).toBe('act2')
    expect(acts[1].id).toBe('act1')
  })

  it('deletes an act', () => {
    data.acts.insertActs('2026-03-21', [
      { id: 'act1', name: 'Delete me', sketch: 'Admin', plannedDurationMs: 900000, sortOrder: 0, status: 'pending' },
    ])

    data.acts.deleteAct('act1')
    expect(data.acts.getActsForShow('2026-03-21')).toHaveLength(0)
  })

  it('upserts act (insert then update)', () => {
    data.acts.upsertAct({
      id: 'act1', showId: '2026-03-21', name: 'Original', sketch: 'Admin',
      plannedDurationMs: 900000, sortOrder: 0, status: 'pending',
    })
    data.acts.upsertAct({
      id: 'act1', showId: '2026-03-21', name: 'Updated', sketch: 'Deep Work',
      plannedDurationMs: 1800000, sortOrder: 0, status: 'active',
    })

    const acts = data.acts.getActsForShow('2026-03-21')
    expect(acts).toHaveLength(1)
    expect(acts[0].name).toBe('Updated')
    expect(acts[0].status).toBe('active')
  })
})

describe('TimelineRepository', () => {
  beforeEach(() => {
    data.shows.upsertShow({ id: '2026-03-21', phase: 'live' })
    data.acts.insertActs('2026-03-21', [
      { id: 'act1', name: 'Act 1', sketch: 'Deep Work', plannedDurationMs: 1800000, sortOrder: 0, status: 'completed', actualDurationMs: 2100000 },
      { id: 'act2', name: 'Act 2', sketch: 'Admin', plannedDurationMs: 900000, sortOrder: 1, status: 'completed', actualDurationMs: 800000 },
    ])
  })

  it('records and retrieves events', () => {
    data.timeline.recordEvent({
      showId: '2026-03-21',
      actId: 'act1',
      eventType: 'act_completed',
      driftSeconds: 300,
    })

    const events = data.timeline.getEventsForShow('2026-03-21')
    expect(events).toHaveLength(1)
    expect(events[0].eventType).toBe('act_completed')
    expect(events[0].driftSeconds).toBe(300)
  })

  it('computes cumulative drift', () => {
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: 'act1', eventType: 'act_completed', driftSeconds: 300,
    })
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: 'act2', eventType: 'act_completed', driftSeconds: -100,
    })

    expect(data.timeline.computeDrift('2026-03-21')).toBe(200)
  })

  it('returns 0 drift for show with no events', () => {
    expect(data.timeline.computeDrift('2026-03-21')).toBe(0)
  })

  it('gets events for specific act', () => {
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: 'act1', eventType: 'act_started',
    })
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: 'act2', eventType: 'act_started',
    })
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: 'act1', eventType: 'act_completed', driftSeconds: 300,
    })

    const act1Events = data.timeline.getEventsForAct('act1')
    expect(act1Events).toHaveLength(2)
    expect(act1Events[0].eventType).toBe('act_started')
    expect(act1Events[1].eventType).toBe('act_completed')
  })

  it('getDriftPerAct returns per-act breakdown', () => {
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: 'act1', eventType: 'act_completed', driftSeconds: 300,
    })
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: 'act2', eventType: 'act_completed', driftSeconds: -100,
    })

    const perAct = data.timeline.getDriftPerAct('2026-03-21')
    expect(perAct).toHaveLength(2)
    const act1 = perAct.find((a) => a.actId === 'act1')
    expect(act1?.driftSeconds).toBe(300)
  })

  it('records show-level events without act_id', () => {
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: null, eventType: 'show_started',
    })
    data.timeline.recordEvent({
      showId: '2026-03-21', actId: null, eventType: 'intermission_started',
    })

    const events = data.timeline.getEventsForShow('2026-03-21')
    expect(events).toHaveLength(2)
    expect(events[0].actId).toBeNull()
  })
})

describe('ClaudeContextRepository', () => {
  beforeEach(() => {
    data.shows.upsertShow({ id: '2026-03-21', phase: 'live' })
  })

  it('saves and retrieves latest context', () => {
    data.claudeCtx.saveContext({
      showId: '2026-03-21',
      energy: 'high',
      planText: 'Focus on deep work',
      lineupJson: '[{"name":"Work"}]',
      sessionId: 'sess-1',
    })

    const ctx = data.claudeCtx.getLatestContext('2026-03-21')
    expect(ctx).toBeDefined()
    expect(ctx!.energy).toBe('high')
    expect(ctx!.planText).toBe('Focus on deep work')
    expect(ctx!.sessionId).toBe('sess-1')
  })

  it('returns latest of multiple contexts', () => {
    data.claudeCtx.saveContext({
      showId: '2026-03-21', energy: 'high', planText: 'First',
    })
    data.claudeCtx.saveContext({
      showId: '2026-03-21', energy: 'medium', planText: 'Second',
    })

    const ctx = data.claudeCtx.getLatestContext('2026-03-21')
    expect(ctx!.planText).toBe('Second')
  })

  it('returns undefined for missing context', () => {
    expect(data.claudeCtx.getLatestContext('2099-01-01')).toBeUndefined()
  })
})

describe('MetricsRepository', () => {
  it('recordTiming + getSummary returns correct stats', () => {
    data.metrics.recordTiming('app.startup', 100)
    data.metrics.recordTiming('app.startup', 200)
    data.metrics.recordTiming('app.startup', 300)
    data.metrics.recordTiming('app.startup', 400)
    data.metrics.recordTiming('app.startup', 500)

    const summary = data.metrics.getSummary('app.startup')
    expect(summary.count).toBe(5)
    expect(summary.avg).toBe(300)
    expect(summary.min).toBe(100)
    expect(summary.max).toBe(500)
    expect(summary.p95).toBe(500)
  })

  it('prune removes old entries, keeps recent ones', () => {
    // Insert an "old" entry by manipulating created_at via raw SQL
    data.raw.prepare(
      'INSERT INTO metrics (name, duration_ms, created_at) VALUES (?, ?, ?)'
    ).run('app.startup', 150, Date.now() - 31 * 24 * 60 * 60 * 1000) // 31 days ago

    // Insert a recent entry
    data.metrics.recordTiming('app.startup', 200)

    const deleted = data.metrics.prune(30)
    expect(deleted).toBe(1)

    const summary = data.metrics.getSummary('app.startup')
    expect(summary.count).toBe(1)
    expect(summary.avg).toBe(200)
  })

  it('getSummary with no data returns zeros', () => {
    const summary = data.metrics.getSummary('nonexistent')
    expect(summary).toEqual({ avg: 0, p95: 0, min: 0, max: 0, count: 0 })
  })

  it('getSummary filters by sinceDays', () => {
    // Insert an "old" entry
    data.raw.prepare(
      'INSERT INTO metrics (name, duration_ms, created_at) VALUES (?, ?, ?)'
    ).run('sqlite.hydrate', 50, Date.now() - 10 * 24 * 60 * 60 * 1000) // 10 days ago

    // Insert a recent entry
    data.metrics.recordTiming('sqlite.hydrate', 100)

    const last7 = data.metrics.getSummary('sqlite.hydrate', 7)
    expect(last7.count).toBe(1)
    expect(last7.avg).toBe(100)

    const last30 = data.metrics.getSummary('sqlite.hydrate', 30)
    expect(last30.count).toBe(2)
  })

  it('recordTiming stores metadata as JSON', () => {
    data.metrics.recordTiming('app.startup', 250, { version: '1.0.0' })

    const row = data.raw.prepare('SELECT metadata FROM metrics WHERE name = ?').get('app.startup') as { metadata: string }
    expect(JSON.parse(row.metadata)).toEqual({ version: '1.0.0' })
  })
})

describe('MigrationRunner', () => {
  it('creates all tables and is idempotent', () => {
    // Tables already exist from beforeEach init
    // Running again should not throw
    const dbPath = join(tmpDir, 'test2.db')
    const migrationsDir = join(__dirname, '..', 'main', 'data', 'migrations')
    const data2 = DataService.initWithPath(dbPath, migrationsDir)

    // Verify tables exist by querying them
    data2.shows.upsertShow({ id: '2026-01-01', phase: 'no_show' })
    expect(data2.shows.getShow('2026-01-01')).toBeDefined()

    // Running migrations again (idempotent)
    const data3 = DataService.initWithPath(dbPath, migrationsDir)
    expect(data3.shows.getShow('2026-01-01')).toBeDefined()
    data3.close()
    data2.close()
  })
})
