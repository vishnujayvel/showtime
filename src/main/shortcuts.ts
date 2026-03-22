import { globalShortcut } from 'electron'
import { getMainWindow, broadcast, log } from './state'
import { IPC } from '../shared/types'

export function registerShortcuts(
  showWindow: (source?: string) => void,
  toggleWindow: (source?: string) => void,
): void {
  // Primary: Option+Space (2 keys, doesn't conflict with shell)
  // When visible: toggle expanded/pill state in the renderer
  // When hidden: show the window
  // Fallback: Cmd+Shift+K kept as secondary shortcut
  const registered = globalShortcut.register('Alt+Space', () => {
    if (getMainWindow()?.isVisible()) {
      // Toggle expanded state by broadcasting to renderer
      broadcast(IPC.TOGGLE_EXPANDED)
    } else {
      showWindow('shortcut Alt+Space')
    }
  })
  if (!registered) {
    log('Alt+Space shortcut registration failed — macOS input sources may claim it')
  }
  globalShortcut.register('CommandOrControl+Shift+K', () => toggleWindow('shortcut Cmd/Ctrl+Shift+K'))
}
