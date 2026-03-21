/** Snapshot of show state sent from renderer to main for persistence */
export interface ShowStateSnapshot {
  showId: string
  phase: string
  energy?: string | null
  verdict?: string | null
  beatsLocked?: number
  beatThreshold?: number
  startedAt?: number | null
  endedAt?: number | null
  planText?: string | null
  acts?: ActSnapshot[]
}

export interface ActSnapshot {
  id: string
  name: string
  sketch: string
  category?: string | null
  plannedDurationMs: number
  actualDurationMs?: number | null
  sortOrder: number
  status: string
  beatLocked?: number
  plannedStartAt?: number | null
  actualStartAt?: number | null
  actualEndAt?: number | null
}

export interface TimelineEventInput {
  showId: string
  actId?: string | null
  eventType: string
  plannedStart?: number | null
  plannedEnd?: number | null
  actualStart?: number | null
  actualEnd?: number | null
  driftSeconds?: number | null
  metadata?: Record<string, unknown> | null
}

export interface ClaudeContextPayload {
  showId: string
  energy?: string | null
  planText?: string | null
  lineupJson?: string | null
  sessionId?: string | null
}

export interface ActDriftResult {
  actId: string | null
  actName: string | null
  driftSeconds: number
  plannedMs: number
  actualMs: number
}
