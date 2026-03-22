import { broadcast, log } from './state'
import { IPC } from '../shared/types'

// ─── Day Boundary Detection ───

export function startDayBoundaryCheck(): void {
  let currentDay = new Date().toISOString().slice(0, 10)
  setInterval(() => {
    const now = new Date().toISOString().slice(0, 10)
    if (now !== currentDay) {
      log(`Showtime: Day boundary crossed — ${currentDay} → ${now}`)
      currentDay = now
      broadcast(IPC.DAY_BOUNDARY)
    }
  }, 60_000) // Check every minute
}
