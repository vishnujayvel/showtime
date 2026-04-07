/**
 * Cross-context DB path resolution.
 *
 * Resolves the showtime.db path in both Electron main process
 * and standalone Node.js/CLI contexts (e.g., skills).
 */
import { join } from 'path'
import { homedir } from 'os'

/** Resolves the showtime.db file path for both Electron and standalone Node.js contexts. */
export function resolveDbPath(): string {
  // Try Electron's app module first
  try {
    // Dynamic require to avoid bundling issues in non-Electron contexts
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron')
    if (app && typeof app.getPath === 'function') {
      return join(app.getPath('userData'), 'showtime.db')
    }
  } catch {
    // Not in Electron context — fall through to Node.js resolution
  }

  // Node.js/CLI fallback: match Electron's userData path on macOS
  // Electron uses ~/Library/Application Support/<app-name>/
  // The app name in package.json is "showtime"
  const platform = process.platform
  if (platform === 'darwin') {
    return join(homedir(), 'Library', 'Application Support', 'showtime', 'showtime.db')
  }
  if (platform === 'win32') {
    return join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'showtime', 'showtime.db')
  }
  // Linux
  return join(process.env.XDG_CONFIG_HOME || join(homedir(), '.config'), 'showtime', 'showtime.db')
}
