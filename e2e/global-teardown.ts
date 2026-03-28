import { execSync } from 'child_process'

/**
 * Playwright global teardown — kills orphaned Electron processes left by test runs.
 * Only targets Showtime Electron instances (not other Electron apps).
 */
export default async function globalTeardown() {
  try {
    // Kill only Electron processes launched from this specific project directory
    const projectDir = process.cwd()
    const escapedDir = projectDir.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const result = execSync(
      `ps -axo pid=,command= | awk '/[Ee]lectron/ && /${escapedDir}/ { print $1 }' 2>/dev/null || true`,
      { encoding: 'utf-8' }
    ).trim()

    if (result) {
      const pids = result.split('\n').filter(Boolean)
      for (const pid of pids) {
        try {
          process.kill(Number(pid), 'SIGTERM')
        } catch {
          // Process already dead — ignore
        }
      }
      // Give processes time to exit gracefully, then force-kill stragglers
      await new Promise((resolve) => setTimeout(resolve, 2000))
      for (const pid of pids) {
        try {
          process.kill(Number(pid), 'SIGKILL')
        } catch {
          // Already dead — good
        }
      }
    }
  } catch {
    // Best-effort cleanup — don't fail the test run
  }
}
