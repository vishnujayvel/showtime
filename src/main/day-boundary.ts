import { broadcast, log } from './state'
import { IPC } from '../shared/types'
import { localToday } from '../shared/date-utils'

// ─── Day Boundary Detection ───

export function startDayBoundaryCheck(): void {
  let currentDay = localToday()
  setInterval(() => {
    const now = localToday()
    if (now !== currentDay) {
      log(`Showtime: Day boundary crossed — ${currentDay} → ${now}`)
      currentDay = now
      broadcast(IPC.DAY_BOUNDARY)
    }
  }, 60_000) // Check every minute
}
