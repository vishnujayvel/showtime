import { app, Tray, Menu, nativeImage, ipcMain } from 'electron'
import { join } from 'path'
import { getMainWindow } from './state'
import { IPC } from '../shared/types'
import type { TrayShowState } from '../shared/types'

// ─── Icon paths (resolved at createTray time) ───

let iconDefault: Electron.NativeImage
let iconLive: Electron.NativeImage
let iconAmber: Electron.NativeImage
let currentIconState: 'default' | 'live' | 'amber' = 'default'

function loadIcons(): void {
  const base = join(__dirname, '../../resources')

  iconDefault = nativeImage.createFromPath(join(base, 'trayTemplate.png'))
  if (iconDefault.isEmpty()) { console.warn('[Showtime] trayTemplate.png not found or corrupt') }
  iconDefault.setTemplateImage(true)

  iconLive = nativeImage.createFromPath(join(base, 'trayTemplate-live.png'))
  if (iconLive.isEmpty()) { console.warn('[Showtime] trayTemplate-live.png not found or corrupt') }
  // Not template — colored dot must remain red, not recolored by macOS
  iconLive.setTemplateImage(false)

  iconAmber = nativeImage.createFromPath(join(base, 'trayTemplate-amber.png'))
  if (iconAmber.isEmpty()) { console.warn('[Showtime] trayTemplate-amber.png not found or corrupt') }
  // Not template — colored dot must remain amber
  iconAmber.setTemplateImage(false)
}

function setTrayIcon(tray: Tray, state: 'default' | 'live' | 'amber'): void {
  if (state === currentIconState) return
  currentIconState = state
  switch (state) {
    case 'live': tray.setImage(iconLive); break
    case 'amber': tray.setImage(iconAmber); break
    default: tray.setImage(iconDefault)
  }
}

// ─── Timer formatting ───

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${m}:${String(s).padStart(2, '0')}`
}

// ─── Menu builders per show phase ───

function buildIdleMenu(showWindow: (s?: string) => void): Electron.MenuItemConstructorOptions[] {
  return [
    { label: 'SHOWTIME', enabled: false },
    { type: 'separator' },
    { label: 'No show running', enabled: false },
    { type: 'separator' },
    { label: 'Enter Writer\'s Room', click: () => {
      showWindow('tray menu')
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send(IPC.RESET_SHOW)
    }},
    { label: 'Past Shows', click: () => showWindow('tray past-shows') },
    { type: 'separator' },
    { label: 'Preferences…', click: () => {
      showWindow('tray preferences')
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send(IPC.OPEN_SETTINGS)
    }},
    { label: 'Quit Showtime', click: () => app.quit() },
  ]
}

function buildLiveMenu(state: TrayShowState, showWindow: (s?: string) => void, windowHidden = false): Electron.MenuItemConstructorOptions[] {
  const timerLabel = state.timerSeconds !== null ? formatTimer(state.timerSeconds) : '--:--'
  const beatStars = '★'.repeat(state.beatsLocked) + '☆'.repeat(Math.max(0, state.beatThreshold - state.beatsLocked))

  const items: Electron.MenuItemConstructorOptions[] = [
    { label: `ON AIR${state.currentActCategory ? ` • ${state.currentActCategory.toUpperCase()}` : ''} • ${state.currentActName || 'Act'}`, enabled: false },
    { type: 'separator' },
    { label: `⏱ ${timerLabel} remaining`, enabled: false },
    { label: `${beatStars}  ${state.beatsLocked}/${state.beatThreshold} beats`, enabled: false },
  ]

  if (state.nextActs.length > 0) {
    items.push({ type: 'separator' })
    items.push({ label: 'COMING UP', enabled: false })
    for (const act of state.nextActs) {
      items.push({ label: `  ${act.name} — ${act.sketch} — ${act.durationMinutes}m`, enabled: false })
    }
  }

  items.push(
    { type: 'separator' },
    { label: windowHidden ? 'Show Floating Pill' : 'Show as Floating Pill / Menu Bar', click: () => {
      if (windowHidden) {
        showWindow('tray restore')
      } else {
        const win = getMainWindow()
        if (win && !win.isDestroyed()) win.webContents.send(IPC.TIMER_DISPLAY_TOGGLE)
      }
    }},
    { label: 'Open Expanded View', click: () => showWindow('tray open') },
    { label: 'Director Mode…', click: () => {
      showWindow('tray director')
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send(IPC.TOGGLE_EXPANDED)
    }},
    { type: 'separator' },
    { label: 'Quit Showtime', click: () => app.quit() },
  )

  return items
}

function buildIntermissionMenu(state: TrayShowState, showWindow: (s?: string) => void): Electron.MenuItemConstructorOptions[] {
  const beatStars = '★'.repeat(state.beatsLocked) + '☆'.repeat(Math.max(0, state.beatThreshold - state.beatsLocked))

  return [
    { label: 'INTERMISSION', enabled: false },
    { type: 'separator' },
    { label: `Between acts • ${state.actIndex + 1}/${state.totalActs} complete`, enabled: false },
    { label: `${beatStars}  ${state.beatsLocked}/${state.beatThreshold} beats`, enabled: false },
    ...(state.nextActs.length > 0 ? [
      { type: 'separator' as const },
      { label: `Next: ${state.nextActs[0].name} — ${state.nextActs[0].sketch} — ${state.nextActs[0].durationMinutes}m`, enabled: false },
    ] : []),
    { type: 'separator' },
    { label: 'Back to Show', click: () => showWindow('tray back') },
    { label: 'Director Mode…', click: () => {
      showWindow('tray director')
      const win = getMainWindow()
      if (win && !win.isDestroyed()) win.webContents.send(IPC.TOGGLE_EXPANDED)
    }},
    { type: 'separator' },
    { label: 'Quit Showtime', click: () => app.quit() },
  ]
}

function menuLabels(items: Electron.MenuItemConstructorOptions[]): string[] {
  return items.map((i) => i.type === 'separator' ? 'separator' : (i.label || ''))
}

// ─── Public API ───

export function createTray(
  showWindow: (source?: string) => void,
  toggleWindow: (source?: string) => void,
): Tray {
  loadIcons()

  const tray = new Tray(iconDefault)
  tray.setToolTip('Showtime')
  tray.on('click', () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed() && !win.isVisible()) {
      showWindow('tray click')
      return
    }
    toggleWindow('tray click')
  })

  // Start with idle menu
  const idleMenu = buildIdleMenu(showWindow)
  tray.setContextMenu(Menu.buildFromTemplate(idleMenu))
  ;(global as any).__trayMenuLabels = menuLabels(idleMenu)

  // Track last known act name for timer-only updates when window is hidden
  let lastActName: string | null = null

  // Listen for show state updates from renderer
  const trayStateHandler = (_event: Electron.IpcMainEvent, state: TrayShowState) => {
    if (!tray || tray.isDestroyed()) return

    lastActName = state.currentActName
    const windowHidden = !getMainWindow()?.isVisible()

    let menu: Electron.MenuItemConstructorOptions[]

    switch (state.phase) {
      case 'live': {
        const isAmber = state.timerSeconds !== null && state.timerSeconds < 300
        menu = buildLiveMenu(state, showWindow, windowHidden)
        setTrayIcon(tray, isAmber ? 'amber' : 'live')
        if (state.timerSeconds !== null) {
          const timer = formatTimer(state.timerSeconds)
          if (windowHidden && state.currentActName) {
            tray.setTitle(isAmber ? `⚡ ${state.currentActName} — ${timer}` : `${state.currentActName} — ${timer}`)
          } else {
            tray.setTitle(isAmber ? `⚡ ${timer}` : timer)
          }
        } else {
          tray.setTitle('')
        }
        break
      }
      case 'director': {
        const isDirAmber = state.timerSeconds !== null && state.timerSeconds < 300
        menu = buildLiveMenu(state, showWindow, windowHidden)
        setTrayIcon(tray, isDirAmber ? 'amber' : 'live')
        if (state.timerSeconds !== null) {
          const timer = formatTimer(state.timerSeconds)
          if (windowHidden && state.currentActName) {
            tray.setTitle(isDirAmber ? `⚡ ${state.currentActName} — ${timer}` : `${state.currentActName} — ${timer}`)
          } else {
            tray.setTitle(isDirAmber ? `⚡ ${timer}` : timer)
          }
        } else {
          tray.setTitle('')
        }
        break
      }
      case 'intermission':
        menu = buildIntermissionMenu(state, showWindow)
        setTrayIcon(tray, 'default')
        tray.setTitle('BREAK')
        break
      case 'writers_room':
        menu = [
          { label: 'SHOWTIME — Writer\'s Room', enabled: false },
          { type: 'separator' },
          { label: 'Planning your show...', enabled: false },
          { type: 'separator' },
          { label: 'Show Showtime', click: () => showWindow('tray menu') },
          { label: 'Quit Showtime', click: () => app.quit() },
        ]
        setTrayIcon(tray, 'default')
        tray.setTitle('')
        break
      case 'strike':
        menu = [
          { label: 'SHOWTIME — Show Complete', enabled: false },
          { type: 'separator' },
          { label: 'View Results', click: () => showWindow('tray menu') },
          { label: 'Quit Showtime', click: () => app.quit() },
        ]
        setTrayIcon(tray, 'default')
        tray.setTitle('')
        break
      default:
        menu = buildIdleMenu(showWindow)
        setTrayIcon(tray, 'default')
        tray.setTitle('')
    }

    tray.setContextMenu(Menu.buildFromTemplate(menu))
    ;(global as any).__trayMenuLabels = menuLabels(menu)
  }

  ipcMain.on(IPC.TRAY_STATE_UPDATE, trayStateHandler)

  // Timer-only updates — no menu rebuild, just title + icon state
  const trayTimerHandler = (_event: Electron.IpcMainEvent, seconds: number) => {
    if (!tray || tray.isDestroyed()) return
    const isAmber = seconds < 300
    setTrayIcon(tray, isAmber ? 'amber' : 'live')
    const timer = formatTimer(seconds)
    const windowHidden = !getMainWindow()?.isVisible()
    if (windowHidden && lastActName) {
      tray.setTitle(isAmber ? `⚡ ${lastActName} — ${timer}` : `${lastActName} — ${timer}`)
    } else {
      tray.setTitle(isAmber ? `⚡ ${timer}` : timer)
    }
  }

  ipcMain.on(IPC.TRAY_TIMER_UPDATE, trayTimerHandler)

  // Clean up IPC listeners when tray is destroyed (app quit)
  app.on('before-quit', () => {
    ipcMain.removeListener(IPC.TRAY_STATE_UPDATE, trayStateHandler)
    ipcMain.removeListener(IPC.TRAY_TIMER_UPDATE, trayTimerHandler)
  })

  return tray
}
