import { app, globalShortcut, ipcMain, screen } from 'electron'
import { ensureSkills, type SkillStatus } from './skills/installer'
import { flushLogs } from './logger'
import { initAppLogger, flushAppLogs, appLog } from './app-logger'
import { DataService } from './data/DataService'
import { SyncEngine } from './data/SyncEngine'
import type { NormalizedEvent, EnrichedError } from '../shared/types'
import { IPC } from '../shared/types'

import { controlPlane, getMainWindow, getSyncEngine, setSyncEngine, SPACES_DEBUG, log, broadcast } from './state'
import { createWindow, showWindow, toggleWindow, snapshotWindowState } from './window'
import { registerCoreIpc } from './ipc/core'
import { registerShowtimeIpc } from './ipc/showtime'
import { createTray } from './tray'
import { buildAppMenu } from './menu'
import { registerShortcuts } from './shortcuts'
import { requestPermissions } from './permissions'
import { startDayBoundaryCheck } from './day-boundary'

// ─── Wire ControlPlane events → renderer ───

controlPlane.on('event', (tabId: string, event: NormalizedEvent) => {
  broadcast(IPC.NORMALIZED_EVENT, tabId, event)
})

controlPlane.on('tab-status-change', (tabId: string, newStatus: string, oldStatus: string) => {
  broadcast(IPC.TAB_STATUS_CHANGE, tabId, newStatus, oldStatus)
})

controlPlane.on('error', (tabId: string, error: EnrichedError) => {
  broadcast(IPC.ENRICHED_ERROR, tabId, error)
})

// ─── Isolated userData for parallel E2E workers ───

if (process.env.SHOWTIME_USER_DATA) {
  app.setPath('userData', process.env.SHOWTIME_USER_DATA)
}

// ─── App Lifecycle ───

const appStartTime = Date.now()

app.whenReady().then(async () => {
  // Initialize structured application logger (JSONL to ~/Library/Logs/Showtime/)
  initAppLogger({ level: process.env.SHOWTIME_LOG_LEVEL as any || 'INFO' })
  // macOS: become an accessory app. Accessory apps can have key windows (keyboard works)
  // without deactivating the currently active app (hover preserved in browsers).
  // This is how Spotlight, Alfred, Raycast work.
  if (process.platform === 'darwin' && app.dock) {
    app.dock.hide()
  }

  // Request permissions upfront so the user is never interrupted mid-session.
  await requestPermissions()

  // Skill provisioning — non-blocking, streams status to renderer
  ensureSkills((status: SkillStatus) => {
    log(`Skill ${status.name}: ${status.state}${status.error ? ` — ${status.error}` : ''}`)
    broadcast(IPC.SKILL_STATUS, status)
  }).catch((err: Error) => log(`Skill provisioning error: ${err.message}`))

  // Initialize SQLite data layer
  try {
    const dataService = DataService.init()
    setSyncEngine(new SyncEngine(dataService))
    dataService.metrics.prune(30)
    log('DataService initialized')
    appLog('INFO', 'data_service_init', { status: 'ok' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    log(`DataService initialization failed: ${msg}`)
    appLog('ERROR', 'data_service_init', { status: 'failed', error: msg })
  }

  buildAppMenu()
  createWindow()
  snapshotWindowState('after createWindow')

  // Record app startup timing
  try {
    DataService.getInstance().metrics.recordTiming('app.startup', Date.now() - appStartTime)
  } catch { /* DataService may not be initialized */ }

  // Start day boundary detection (checks every minute for midnight crossing)
  startDayBoundaryCheck()

  if (SPACES_DEBUG) {
    const mainWindow = getMainWindow()
    mainWindow?.on('show', () => snapshotWindowState('event window show'))
    mainWindow?.on('hide', () => snapshotWindowState('event window hide'))
    mainWindow?.on('focus', () => snapshotWindowState('event window focus'))
    mainWindow?.on('blur', () => snapshotWindowState('event window blur'))
    mainWindow?.webContents.on('focus', () => snapshotWindowState('event webContents focus'))
    mainWindow?.webContents.on('blur', () => snapshotWindowState('event webContents blur'))

    app.on('browser-window-focus', () => snapshotWindowState('event app browser-window-focus'))
    app.on('browser-window-blur', () => snapshotWindowState('event app browser-window-blur'))

    screen.on('display-added', (_e, display) => {
      log(`[spaces] event display-added id=${display.id}`)
      snapshotWindowState('event display-added')
    })
    screen.on('display-removed', (_e, display) => {
      log(`[spaces] event display-removed id=${display.id}`)
      snapshotWindowState('event display-removed')
    })
    screen.on('display-metrics-changed', (_e, display, changedMetrics) => {
      log(`[spaces] event display-metrics-changed id=${display.id} changed=${changedMetrics.join(',')}`)
      snapshotWindowState('event display-metrics-changed')
    })
  }

  registerShortcuts(showWindow, toggleWindow)
  const tray = createTray(showWindow, toggleWindow)

  registerCoreIpc()
  registerShowtimeIpc()

  // app 'activate' fires when macOS brings the app to the foreground (e.g. after
  // webContents.focus() triggers applicationDidBecomeActive on some macOS versions).
  // Using showWindow here instead of toggleWindow prevents the re-entry race where
  // a summon immediately hides itself because activate fires mid-show.
  app.on('activate', () => showWindow('app activate'))

  // ─── Test-mode IPC handlers for E2E verification ───
  if (process.env.NODE_ENV === 'test') {
    ipcMain.handle('test:get-window-config', () => {
      const mainWindow = getMainWindow()
      return {
        alwaysOnTop: mainWindow?.isAlwaysOnTop(),
        visibleOnAllWorkspaces: mainWindow?.isVisibleOnAllWorkspaces(),
        backgroundColor: mainWindow?.getBackgroundColor(),
        bounds: mainWindow?.getBounds(),
      }
    })
    ipcMain.handle('test:get-tray-menu', () => (global as any).__trayMenuLabels)
  }

  // Suppress unused variable warning — tray must stay referenced to avoid GC
  void tray
})

app.on('will-quit', () => {
  appLog('INFO', 'app_quit')
  flushAppLogs()
  globalShortcut.unregisterAll()
  controlPlane.shutdown()
  getSyncEngine()?.finalFlush()
  flushLogs()
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
