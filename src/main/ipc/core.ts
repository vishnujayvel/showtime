import { ipcMain } from 'electron'
import { execSync } from 'child_process'
import { homedir } from 'os'
import { getCliEnv } from '../cli-env'
import { controlPlane, DEBUG_MODE, log } from '../state'
import { IPC } from '../../shared/types'
import type { RunOptions } from '../../shared/types'

export function registerCoreIpc(): void {
  ipcMain.handle(IPC.START, async () => {
    log('IPC START — fetching static CLI info')

    let version = 'unknown'
    try {
      version = execSync('claude -v', { encoding: 'utf-8', timeout: 5000, env: getCliEnv() }).trim()
    } catch {}

    let auth: { email?: string; subscriptionType?: string; authMethod?: string } = {}
    try {
      const raw = execSync('claude auth status', { encoding: 'utf-8', timeout: 5000, env: getCliEnv() }).trim()
      auth = JSON.parse(raw)
    } catch {}

    let mcpServers: string[] = []
    try {
      const raw = execSync('claude mcp list', { encoding: 'utf-8', timeout: 5000, env: getCliEnv() }).trim()
      if (raw) mcpServers = raw.split('\n').filter(Boolean)
    } catch {}

    return { version, auth, mcpServers, projectPath: process.cwd(), homePath: homedir() }
  })

  ipcMain.handle(IPC.CREATE_TAB, () => {
    const tabId = controlPlane.createTab()
    log(`IPC CREATE_TAB → ${tabId}`)
    return { tabId }
  })

  ipcMain.on(IPC.INIT_SESSION, (_event, tabId: string) => {
    log(`IPC INIT_SESSION: ${tabId}`)
    controlPlane.initSession(tabId)
  })

  ipcMain.on(IPC.RESET_TAB_SESSION, (_event, tabId: string) => {
    log(`IPC RESET_TAB_SESSION: ${tabId}`)
    controlPlane.resetTabSession(tabId)
  })

  ipcMain.handle(IPC.PROMPT, async (_event, { tabId, requestId, options }: { tabId: string; requestId: string; options: RunOptions }) => {
    if (DEBUG_MODE) {
      log(`IPC PROMPT: tab=${tabId} req=${requestId} prompt="${options.prompt.substring(0, 100)}"`)
    } else {
      log(`IPC PROMPT: tab=${tabId} req=${requestId}`)
    }

    if (!tabId) {
      throw new Error('No tabId provided — prompt rejected')
    }
    if (!requestId) {
      throw new Error('No requestId provided — prompt rejected')
    }

    try {
      await controlPlane.submitPrompt(tabId, requestId, options)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      log(`PROMPT error: ${msg}`)
      throw err
    }
  })

  ipcMain.handle(IPC.CANCEL, (_event, requestId: string) => {
    log(`IPC CANCEL: ${requestId}`)
    return controlPlane.cancel(requestId)
  })

  ipcMain.handle(IPC.STOP_TAB, (_event, tabId: string) => {
    log(`IPC STOP_TAB: ${tabId}`)
    return controlPlane.cancelTab(tabId)
  })

  ipcMain.handle(IPC.RETRY, async (_event, { tabId, requestId, options }: { tabId: string; requestId: string; options: RunOptions }) => {
    log(`IPC RETRY: tab=${tabId} req=${requestId}`)
    return controlPlane.retry(tabId, requestId, options)
  })

  ipcMain.handle(IPC.STATUS, () => {
    return controlPlane.getHealth()
  })

  ipcMain.handle(IPC.TAB_HEALTH, () => {
    return controlPlane.getHealth()
  })

  ipcMain.handle(IPC.CLOSE_TAB, (_event, tabId: string) => {
    log(`IPC CLOSE_TAB: ${tabId}`)
    controlPlane.closeTab(tabId)
  })

  ipcMain.on(IPC.SET_PERMISSION_MODE, (_event, mode: string) => {
    if (mode !== 'ask' && mode !== 'auto') {
      log(`IPC SET_PERMISSION_MODE: invalid mode "${mode}" — ignoring`)
      return
    }
    log(`IPC SET_PERMISSION_MODE: ${mode}`)
    controlPlane.setPermissionMode(mode)
  })

  ipcMain.handle(IPC.RESPOND_PERMISSION, (_event, { tabId, questionId, optionId }: { tabId: string; questionId: string; optionId: string }) => {
    log(`IPC RESPOND_PERMISSION: tab=${tabId} question=${questionId} option=${optionId}`)
    return controlPlane.respondToPermission(tabId, questionId, optionId)
  })
}
