import { app, clipboard, dialog, Menu } from 'electron'
import { getMainWindow } from './state'
import { IPC } from '../shared/types'
import { collectRecentLogs } from './app-logger'

export function buildAppMenu(): void {
  app.setAboutPanelOptions({
    applicationName: 'Showtime',
    applicationVersion: app.getVersion(),
    copyright: '© 2026 Showtime',
    credits: 'An ADHD-friendly macOS day planner built on the SNL Day Framework.',
  })

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Showtime',
      submenu: [
        { role: 'about', label: 'About Showtime' },
        { type: 'separator' },
        {
          label: 'Preferences…',
          accelerator: 'Cmd+,',
          click: () => {
            const mainWindow = getMainWindow()
            if (mainWindow && !mainWindow.isDestroyed()) {
              mainWindow.webContents.send(IPC.OPEN_SETTINGS)
            }
          },
        },
        { type: 'separator' },
        {
          label: 'Report Issue...',
          click: () => {
            const report = collectRecentLogs()
            clipboard.writeText(report)
            dialog.showMessageBox({
              type: 'info',
              title: 'Diagnostic Report Copied',
              message: 'Diagnostic information has been copied to your clipboard.',
              detail: 'Paste it into a new GitHub issue at github.com/your-org/showtime/issues.',
              buttons: ['OK'],
            })
          },
        },
        { type: 'separator' },
        { role: 'quit', label: 'Quit Showtime' },
      ],
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' },
      ],
    },
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}
