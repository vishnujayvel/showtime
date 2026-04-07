import { describe, it, expect, vi, beforeAll } from 'vitest'

// ─── Capture the api object passed to contextBridge.exposeInMainWorld ───

let exposedApi: Record<string, unknown> = {}
const mockExposeInMainWorld = vi.fn((_key: string, api: Record<string, unknown>) => {
  exposedApi = api
})

vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld,
  },
  ipcRenderer: {
    invoke: vi.fn(),
    send: vi.fn(),
    on: vi.fn(() => vi.fn()),
    removeListener: vi.fn(),
  },
}))

// ─── Import triggers exposeInMainWorld ───

beforeAll(async () => {
  await import('../preload/index')
})

// ─── Expected API surface (all methods from ShowtimeAPI) ───

const expectedMethods = [
  // Request-response
  'start', 'createTab', 'prompt', 'cancel', 'stopTab', 'retry',
  'status', 'tabHealth', 'closeTab', 'respondPermission',
  'initSession', 'resetTabSession', 'getTheme', 'onThemeChange',
  // App lifecycle
  'quit', 'openExternal',
  // Window management
  'isVisible', 'minimizeToTray',
  // Event listeners
  'onEvent', 'onTabStatusChange', 'onError', 'onSkillStatus',
  // Logging
  'logEvent',
  // Notifications
  'notifyActComplete', 'notifyBeatCheck', 'notifyVerdict',
  // Calendar
  'getCalendarCache', 'setCalendarCache',
  // Subprocess
  'prewarmSubprocess',
  // Metrics
  'emitMetric',
  // Tray
  'updateTrayState', 'updateTrayTimer',
  // Window management (showtime)
  'setViewMode', 'forceRepaint',
  'onDayBoundary', 'onToggleExpanded', 'onResetShow', 'onOpenSettings', 'onTimerDisplayToggle',
  // Data persistence
  'dataHydrate', 'dataSync', 'dataFlush',
  'timelineRecord', 'getTimelineEvents', 'getTimelineDrift', 'getTimelineDriftPerAct',
  'saveClaudeContext', 'getClaudeContext',
  'getShowHistory', 'getShowDetail',
  'recordMetricTiming', 'getMetricsSummary',
  // Data reset
  'resetAllData',
] as const

// ─── Tests ───

describe('preload bridge (window.showtime)', () => {
  it('exposes an API under the "showtime" key', () => {
    expect(mockExposeInMainWorld).toHaveBeenCalledWith('showtime', expect.any(Object))
  })

  it.each(expectedMethods)('exposes %s as a function', (method) => {
    expect(typeof exposedApi[method]).toBe('function')
  })

  it('does not expose unexpected properties (allowlist check)', () => {
    const allowlist = new Set([...expectedMethods, 'testGetWindowConfig', 'testGetTrayMenu'])
    for (const key of Object.keys(exposedApi)) {
      expect(allowlist.has(key), `unexpected bridge method: ${key}`).toBe(true)
    }
  })

  it('listener methods return unsubscribe functions', () => {
    const listeners = ['onEvent', 'onTabStatusChange', 'onError', 'onSkillStatus', 'onThemeChange', 'onDayBoundary', 'onToggleExpanded', 'onResetShow', 'onOpenSettings', 'onTimerDisplayToggle']
    for (const name of listeners) {
      const unsub = (exposedApi[name] as Function)(vi.fn())
      expect(typeof unsub).toBe('function')
    }
  })
})
