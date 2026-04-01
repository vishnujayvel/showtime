import { join } from 'path'
import { homedir } from 'os'

/**
 * Resolve the path to showtime.db.
 *
 * Works in both Electron main process (uses app.getPath) and standalone
 * Node.js contexts like Claude Code skills (uses well-known macOS path).
 */
export function getShowtimeDbPath(): string {
  // Electron main process
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      return join(app.getPath('userData'), 'showtime.db')
    }
  } catch {
    // Not in Electron — fall through to OS path
  }

  // macOS: ~/Library/Application Support/showtime/showtime.db
  // (matches Electron's default userData path for app named "showtime")
  return join(homedir(), 'Library', 'Application Support', 'showtime', 'showtime.db')
}
