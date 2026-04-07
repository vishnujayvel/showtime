import { describe, it, expect, vi, beforeEach } from 'vitest'

// ─── Mock electron ipcMain ───

const handleMap = new Map<string, Function>()
const onMap = new Map<string, Function>()

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: Function) => { handleMap.set(channel, handler) }),
    on: vi.fn((channel: string, handler: Function) => { onMap.set(channel, handler) }),
  },
  app: { getPath: () => '/tmp/showtime-test', getVersion: () => '0.0.0-test', quit: vi.fn() },
  Notification: class { static isSupported() { return false } show() {} },
  nativeTheme: { shouldUseDarkColors: true, on: vi.fn() },
  shell: { openExternal: vi.fn() },
}))

// ─── Mock main process dependencies ───

vi.mock('../main/state', () => ({
  controlPlane: {
    createTab: vi.fn(() => 'tab-1'),
    initSession: vi.fn(),
    resetTabSession: vi.fn(),
    submitPrompt: vi.fn(),
    cancel: vi.fn(() => true),
    cancelTab: vi.fn(() => true),
    retry: vi.fn(),
    getHealth: vi.fn(() => ({ healthy: true })),
    closeTab: vi.fn(),
    setPermissionMode: vi.fn(),
    respondToPermission: vi.fn(() => true),
    preWarmSubprocess: vi.fn(),
  },
  getMainWindow: vi.fn(() => ({ isVisible: () => true, hide: vi.fn(), isDestroyed: () => false })),
  getSyncEngine: vi.fn(() => ({
    hydrate: vi.fn(() => null),
    queueSync: vi.fn(),
    flush: vi.fn(),
    recordAndFlush: vi.fn(),
  })),
  log: vi.fn(),
  broadcast: vi.fn(),
  DEBUG_MODE: false,
}))

vi.mock('../main/cli-env', () => ({
  getCliEnv: vi.fn(() => ({})),
}))

vi.mock('../main/window', () => ({
  applyViewMode: vi.fn(),
  forceRepaint: vi.fn(),
  isValidViewMode: vi.fn(() => true),
}))

vi.mock('../main/data/DataService', () => ({
  DataService: {
    getInstance: vi.fn(() => ({
      resetAllData: vi.fn(),
      timeline: { getEventsForShow: vi.fn(() => []), computeDrift: vi.fn(() => 0), getDriftPerAct: vi.fn(() => []) },
      claudeCtx: { saveContext: vi.fn(), getLatestContext: vi.fn(() => null) },
      shows: { getRecentShows: vi.fn(() => []), getShowDetail: vi.fn(() => null) },
      metrics: { recordTiming: vi.fn(), getSummary: vi.fn(() => ({ avg: 0, p95: 0, min: 0, max: 0, count: 0 })) },
      calendarCache: { getEventsForDay: vi.fn(() => []), upsertEvents: vi.fn() },
    })),
  },
}))

vi.mock('../main/app-logger', () => ({
  appLog: vi.fn(),
}))

vi.mock('../main/metrics', () => ({
  getMetricsWriter: vi.fn(() => ({ emit: vi.fn() })),
}))

// ─── Import after mocks ───

import { registerCoreIpc } from '../main/ipc/core'
import { registerShowtimeIpc } from '../main/ipc/showtime'
import { IPC } from '../shared/types'

// ─── Tests ───

describe('registerCoreIpc', () => {
  beforeEach(() => {
    handleMap.clear()
    onMap.clear()
    registerCoreIpc()
  })

  it('registers handle channels for request-response IPC', () => {
    const expectedHandles = [IPC.START, IPC.CREATE_TAB, IPC.PROMPT, IPC.CANCEL, IPC.STOP_TAB, IPC.RETRY, IPC.STATUS, IPC.TAB_HEALTH, IPC.CLOSE_TAB, IPC.RESPOND_PERMISSION]
    for (const channel of expectedHandles) {
      expect(handleMap.has(channel), `missing handle: ${channel}`).toBe(true)
    }
  })

  it('registers on channels for fire-and-forget IPC', () => {
    const expectedOn = [IPC.INIT_SESSION, IPC.RESET_TAB_SESSION, IPC.SET_PERMISSION_MODE]
    for (const channel of expectedOn) {
      expect(onMap.has(channel), `missing on: ${channel}`).toBe(true)
    }
  })

  it('CREATE_TAB returns an object with tabId', async () => {
    const handler = handleMap.get(IPC.CREATE_TAB)!
    const result = await handler()
    expect(result).toEqual({ tabId: 'tab-1' })
  })
})

describe('registerShowtimeIpc', () => {
  beforeEach(() => {
    handleMap.clear()
    onMap.clear()
    registerShowtimeIpc()
  })

  it('registers window management channels', () => {
    expect(onMap.has(IPC.HIDE_WINDOW)).toBe(true)
    expect(onMap.has(IPC.MINIMIZE_TO_TRAY)).toBe(true)
    expect(handleMap.has(IPC.IS_VISIBLE)).toBe(true)
  })

  it('registers notification channels', () => {
    expect(onMap.has(IPC.NOTIFY_ACT_COMPLETE)).toBe(true)
    expect(onMap.has(IPC.NOTIFY_BEAT_CHECK)).toBe(true)
    expect(onMap.has(IPC.NOTIFY_VERDICT)).toBe(true)
  })

  it('registers data persistence channels', () => {
    expect(handleMap.has(IPC.DATA_HYDRATE)).toBe(true)
    expect(onMap.has(IPC.DATA_SYNC)).toBe(true)
    expect(handleMap.has(IPC.DATA_FLUSH)).toBe(true)
    expect(handleMap.has(IPC.TIMELINE_EVENTS)).toBe(true)
    expect(handleMap.has(IPC.TIMELINE_DRIFT)).toBe(true)
  })

  it('registers history and detail channels', () => {
    expect(handleMap.has(IPC.SHOW_HISTORY)).toBe(true)
    expect(handleMap.has(IPC.SHOW_DETAIL)).toBe(true)
  })

  it('GET_THEME returns isDark boolean', async () => {
    const handler = handleMap.get(IPC.GET_THEME)!
    const result = await handler()
    expect(result).toEqual({ isDark: true })
  })

  it('RESET_ALL_DATA returns { ok: true }', async () => {
    const handler = handleMap.get(IPC.RESET_ALL_DATA)!
    const result = await handler()
    expect(result).toEqual({ ok: true })
  })
})
