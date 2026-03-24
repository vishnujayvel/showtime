import { app, Tray, Menu, nativeImage } from 'electron'
import { join } from 'path'
import { getMainWindow } from './state'
import { IPC } from '../shared/types'

export function createTray(
  showWindow: (source?: string) => void,
  toggleWindow: (source?: string) => void,
): Tray {
  const trayIconPath = join(__dirname, '../../resources/trayTemplate.png')
  const trayIcon = nativeImage.createFromPath(trayIconPath)
  trayIcon.setTemplateImage(true)
  const tray = new Tray(trayIcon)
  tray.setToolTip('Showtime')
  tray.on('click', () => toggleWindow('tray click'))
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Show Showtime', click: () => showWindow('tray menu') },
      { type: 'separator' },
      { label: 'Preferences…', click: () => {
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          showWindow('tray preferences')
          mainWindow.webContents.send(IPC.OPEN_SETTINGS)
        }
      }},
      { label: 'Reset Show', click: () => {
        const mainWindow = getMainWindow()
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send(IPC.RESET_SHOW)
        }
      }},
      { type: 'separator' },
      { label: 'Quit Showtime', click: () => { app.quit() } },
    ])
  )
  return tray
}
