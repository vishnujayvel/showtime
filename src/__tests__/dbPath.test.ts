/**
 * Tests for cross-context DB path resolution.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { homedir } from 'os'

// We test the Node.js fallback path since Electron's app module
// isn't available in the test environment.

describe('resolveDbPath', () => {
  let originalPlatform: PropertyDescriptor | undefined

  beforeEach(() => {
    // Clear module cache so we can re-import with different mocks
    vi.resetModules()
    originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform')
  })

  afterEach(() => {
    if (originalPlatform) {
      Object.defineProperty(process, 'platform', originalPlatform)
    }
    vi.restoreAllMocks()
  })

  it('resolves macOS path when not in Electron', async () => {
    Object.defineProperty(process, 'platform', { value: 'darwin', writable: true })
    const { resolveDbPath } = await import('../shared/db-path')
    const result = resolveDbPath()
    expect(result).toBe(join(homedir(), 'Library', 'Application Support', 'showtime', 'showtime.db'))
  })

  it('resolves Linux path when not in Electron', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })
    delete process.env.XDG_CONFIG_HOME
    const { resolveDbPath } = await import('../shared/db-path')
    const result = resolveDbPath()
    expect(result).toBe(join(homedir(), '.config', 'showtime', 'showtime.db'))
  })

  it('resolves Linux path with XDG_CONFIG_HOME', async () => {
    Object.defineProperty(process, 'platform', { value: 'linux', writable: true })
    process.env.XDG_CONFIG_HOME = '/custom/config'
    const { resolveDbPath } = await import('../shared/db-path')
    const result = resolveDbPath()
    expect(result).toBe(join('/custom/config', 'showtime', 'showtime.db'))
    delete process.env.XDG_CONFIG_HOME
  })

  it('returns a path ending with showtime.db', async () => {
    const { resolveDbPath } = await import('../shared/db-path')
    const result = resolveDbPath()
    expect(result.endsWith('showtime.db')).toBe(true)
  })

  it('returns an absolute path', async () => {
    const { resolveDbPath } = await import('../shared/db-path')
    const result = resolveDbPath()
    expect(result.startsWith('/')).toBe(true)
  })
})
