import { BrowserWindow } from 'electron'
import { ControlPlane } from './claude/control-plane'
import { SyncEngine } from './data/SyncEngine'
import { log as _log } from './logger'

export const DEBUG_MODE = process.env.CLUI_DEBUG === '1'
export const SPACES_DEBUG = DEBUG_MODE || process.env.CLUI_SPACES_DEBUG === '1'
const INTERACTIVE_PTY = process.env.CLUI_INTERACTIVE_PERMISSIONS_PTY === '1'

export const controlPlane = new ControlPlane(INTERACTIVE_PTY)

// Mutable shared refs — set during app.whenReady()
let _mainWindow: BrowserWindow | null = null
let _syncEngine: SyncEngine | null = null

export function getMainWindow(): BrowserWindow | null { return _mainWindow }
export function setMainWindow(w: BrowserWindow | null): void { _mainWindow = w }
export function getSyncEngine(): SyncEngine | null { return _syncEngine }
export function setSyncEngine(s: SyncEngine): void { _syncEngine = s }

export function log(msg: string): void {
  _log('main', msg)
}

export function broadcast(channel: string, ...args: unknown[]): void {
  if (_mainWindow && !_mainWindow.isDestroyed()) {
    _mainWindow.webContents.send(channel, ...args)
  }
}
