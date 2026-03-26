import { app, BrowserWindow, screen } from 'electron'
import { join } from 'path'
import { computeAnchorFromBounds, computeBoundsFromAnchor, clampToWorkArea } from './window-geometry'
import { getMainWindow, setMainWindow, SPACES_DEBUG, log, broadcast } from './state'
import { IPC } from '../shared/types'
import type { ViewMode } from '../shared/types'

const PILL_BOTTOM_MARGIN = 24

// ─── Content-tight window sizing ───
// Window resizes to match view content exactly. No transparent dead zones.
export const VIEW_DIMENSIONS: Record<ViewMode, { width: number; height: number }> = {
  pill: { width: 320, height: 64 },   // 56px content + 8px for MiniRundownStrip
  compact: { width: 340, height: 140 },
  dashboard: { width: 400, height: 320 },
  expanded: { width: 560, height: 620 },
  full: { width: 560, height: 740 },
}

const VALID_VIEW_MODES = new Set<string>(Object.keys(VIEW_DIMENSIONS))

/** Runtime check for untrusted IPC input. */
export function isValidViewMode(mode: unknown): mode is ViewMode {
  return typeof mode === 'string' && VALID_VIEW_MODES.has(mode)
}

// Anchor-based position tracking: center-bottom point preserved across view transitions and user drags.
let anchorPoint: { x: number; y: number } | null = null
let isDragging = false
let deferredViewMode: ViewMode | null = null
let toggleSequence = 0

export function snapshotWindowState(reason: string): void {
  if (!SPACES_DEBUG) return
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) {
    log(`[spaces] ${reason} window=none`)
    return
  }

  const b = mainWindow.getBounds()
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const visibleOnAll = mainWindow.isVisibleOnAllWorkspaces()
  const wcFocused = mainWindow.webContents.isFocused()

  log(
    `[spaces] ${reason} ` +
    `vis=${mainWindow.isVisible()} focused=${mainWindow.isFocused()} wcFocused=${wcFocused} ` +
    `alwaysOnTop=${mainWindow.isAlwaysOnTop()} allWs=${visibleOnAll} ` +
    `bounds=(${b.x},${b.y},${b.width}x${b.height}) ` +
    `cursor=(${cursor.x},${cursor.y}) display=${display.id} ` +
    `workArea=(${display.workArea.x},${display.workArea.y},${display.workArea.width}x${display.workArea.height})`
  )
}

export function scheduleToggleSnapshots(toggleId: number, phase: 'show' | 'hide'): void {
  if (!SPACES_DEBUG) return
  const probes = [0, 100, 400, 1200]
  for (const delay of probes) {
    setTimeout(() => {
      snapshotWindowState(`toggle#${toggleId} ${phase} +${delay}ms`)
    }, delay)
  }
}

function clampToDisplay(bounds: { x: number; y: number; width: number; height: number }): { x: number; y: number; width: number; height: number } {
  const display = screen.getDisplayMatching(bounds as Electron.Rectangle)
  return clampToWorkArea(bounds, display.workArea)
}

// Debounce rapid view mode changes — prevents ghost frames from queued setBounds() calls
let pendingViewMode: ViewMode | null = null
let viewModeTimer: ReturnType<typeof setTimeout> | null = null

export function applyViewMode(mode: ViewMode): void {
  // Debounce: coalesce rapid calls into a single setBounds
  pendingViewMode = mode
  if (viewModeTimer) clearTimeout(viewModeTimer)
  viewModeTimer = setTimeout(() => {
    viewModeTimer = null
    if (pendingViewMode) {
      applyViewModeImmediate(pendingViewMode)
      pendingViewMode = null
    }
  }, 16) // One frame debounce at 60fps
}

function applyViewModeImmediate(mode: ViewMode): void {
  const mainWindow = getMainWindow()
  if (!mainWindow || mainWindow.isDestroyed()) return
  const dims = VIEW_DIMENSIONS[mode]
  if (!dims) return

  if (isDragging) {
    deferredViewMode = mode
    return
  }

  if (!anchorPoint) {
    anchorPoint = computeAnchorFromBounds(mainWindow.getBounds())
  }

  const newBounds = clampToDisplay(computeBoundsFromAnchor(anchorPoint, dims))

  // Ghost frame fix: when shrinking (e.g. expanded → pill), the macOS compositor
  // retains the old frame buffer causing black bars and ghost artifacts.
  // Opacity fade prevents the flash while giving the compositor time to render at new size.
  const currentBounds = mainWindow.getBounds()
  const isShrinking = newBounds.width < currentBounds.width || newBounds.height < currentBounds.height

  if (isShrinking) {
    mainWindow.setOpacity(0)
    mainWindow.setBounds(newBounds)
    // Give compositor ~2 frames at 60fps to render at new size before revealing
    setTimeout(() => {
      if (!mainWindow.isDestroyed()) {
        mainWindow.webContents.invalidate()
        mainWindow.setOpacity(1)
      }
    }, 32)
  } else {
    mainWindow.setBounds(newBounds)
    mainWindow.webContents.invalidate()
  }

  anchorPoint = computeAnchorFromBounds(newBounds)
  log(`Showtime: applyViewMode(${mode}) → bounds=(${newBounds.x},${newBounds.y},${newBounds.width}x${newBounds.height})`)
}

export function createWindow(): void {
  const initialDims = VIEW_DIMENSIONS.full
  const cursor = screen.getCursorScreenPoint()
  const display = screen.getDisplayNearestPoint(cursor)
  const { width: screenWidth, height: screenHeight } = display.workAreaSize
  const { x: dx, y: dy } = display.workArea

  const x = dx + Math.round((screenWidth - initialDims.width) / 2)
  const y = dy + screenHeight - initialDims.height - PILL_BOTTOM_MARGIN

  const mainWindow = new BrowserWindow({
    width: initialDims.width,
    height: initialDims.height,
    x,
    y,
    ...(process.platform === 'darwin' ? { type: 'panel' as const } : {}),
    frame: false,
    transparent: true,
    // Do NOT use vibrancy — it creates a native NSVisualEffectView that bleeds
    // through as a visible gray border around content. Paint backgrounds in CSS.
    resizable: false,
    movable: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: true,
    roundedCorners: true,
    backgroundColor: '#00000000',
    show: false,
    icon: join(__dirname, '../../resources/icon.icns'),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  setMainWindow(mainWindow)

  // Initialize anchor from initial bounds
  anchorPoint = computeAnchorFromBounds({ x, y, width: initialDims.width, height: initialDims.height })

  // Belt-and-suspenders: panel already joins all spaces and floats,
  // but explicit flags ensure correct behavior on older Electron builds.
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  mainWindow.setAlwaysOnTop(true, 'screen-saver')

  // isDragging guard: track user drags to prevent setBounds during drag
  let dragTimeout: ReturnType<typeof setTimeout> | null = null
  mainWindow.on('will-move', () => {
    isDragging = true
    // Safety valve: if 'moved' never fires, reset after 5 seconds
    if (dragTimeout) clearTimeout(dragTimeout)
    dragTimeout = setTimeout(() => {
      if (isDragging) {
        log('Showtime: isDragging safety valve triggered (5s timeout)')
        isDragging = false
        if (deferredViewMode) {
          const mode = deferredViewMode
          deferredViewMode = null
          applyViewMode(mode)
        }
      }
    }, 5000)
  })
  mainWindow.on('moved', () => {
    if (dragTimeout) { clearTimeout(dragTimeout); dragTimeout = null }
    isDragging = false
    if (mainWindow && !mainWindow.isDestroyed()) {
      anchorPoint = computeAnchorFromBounds(mainWindow.getBounds())
    }
    if (deferredViewMode) {
      const mode = deferredViewMode
      deferredViewMode = null
      applyViewMode(mode)
    }
  })

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
    if (process.env.ELECTRON_RENDERER_URL) {
      mainWindow?.webContents.openDevTools({ mode: 'detach' })
    }
  })

  let forceQuit = false
  app.on('before-quit', () => { forceQuit = true })
  mainWindow.on('close', (e) => {
    if (!forceQuit) {
      e.preventDefault()
      mainWindow?.hide()
    }
  })

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL)
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

export function showWindow(source = 'unknown'): void {
  const mainWindow = getMainWindow()
  if (!mainWindow) return
  const toggleId = ++toggleSequence

  if (anchorPoint) {
    // Use stored anchor — window returns to where user last placed it
    const currentBounds = mainWindow.getBounds()
    const dims = { width: currentBounds.width, height: currentBounds.height }
    const newBounds = clampToDisplay(computeBoundsFromAnchor(anchorPoint, dims))
    mainWindow.setBounds(newBounds)
  } else {
    // First show after launch — center on cursor's display, bottom-aligned
    const cursor = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursor)
    const { width: sw, height: sh } = display.workAreaSize
    const { x: dx, y: dy } = display.workArea
    const dims = VIEW_DIMENSIONS.full
    const bounds = {
      x: dx + Math.round((sw - dims.width) / 2),
      y: dy + sh - dims.height - PILL_BOTTOM_MARGIN,
      width: dims.width,
      height: dims.height,
    }
    mainWindow.setBounds(bounds)
    anchorPoint = computeAnchorFromBounds(bounds)
  }

  // Always re-assert space membership — the flag can be lost after hide/show cycles
  // and must be set before show() so the window joins the active Space, not its
  // last-known Space.
  mainWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (SPACES_DEBUG) {
    const currentDisplay = screen.getDisplayMatching(mainWindow.getBounds())
    log(`[spaces] showWindow#${toggleId} source=${source} move-to-display id=${currentDisplay.id}`)
    snapshotWindowState(`showWindow#${toggleId} pre-show`)
  }
  // As an accessory app (app.dock.hide), show() + focus gives keyboard
  // without deactivating the active app — hover preserved everywhere.
  mainWindow.show()
  mainWindow.webContents.focus()
  broadcast(IPC.WINDOW_SHOWN)
  if (SPACES_DEBUG) scheduleToggleSnapshots(toggleId, 'show')
}

export function toggleWindow(source = 'unknown'): void {
  const mainWindow = getMainWindow()
  if (!mainWindow) return
  const toggleId = ++toggleSequence
  if (SPACES_DEBUG) {
    log(`[spaces] toggle#${toggleId} source=${source} start`)
    snapshotWindowState(`toggle#${toggleId} pre`)
  }

  if (mainWindow.isVisible()) {
    mainWindow.hide()
    if (SPACES_DEBUG) scheduleToggleSnapshots(toggleId, 'hide')
  } else {
    showWindow(source)
  }
}

/**
 * Force a window repaint — recovery mechanism for stuck/ghost frames.
 * Nudges the window by 1px and back to force the macOS compositor to redraw.
 */
export function forceRepaint(): void {
  const win = getMainWindow()
  if (!win || win.isDestroyed()) return
  const bounds = win.getBounds()
  win.setBounds({ ...bounds, width: bounds.width + 1 })
  setTimeout(() => {
    if (!win.isDestroyed()) {
      win.setBounds(bounds)
      win.webContents.invalidate()
    }
  }, 16)
}
