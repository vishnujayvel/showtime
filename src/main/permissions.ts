import { systemPreferences } from 'electron'
import { log } from './state'

// ─── Permission Preflight ───
// Request all required macOS permissions upfront on first launch so the user
// is never interrupted mid-session by a permission prompt.

export async function requestPermissions(): Promise<void> {
  if (process.platform !== 'darwin') return

  // ── Microphone (for voice input via Whisper) ──
  try {
    const micStatus = systemPreferences.getMediaAccessStatus('microphone')
    if (micStatus === 'not-determined') {
      await systemPreferences.askForMediaAccess('microphone')
    }
  } catch (err: unknown) {
    log(`Permission preflight: microphone check failed — ${err instanceof Error ? err.message : String(err)}`)
  }

  // ── Accessibility (for global Option+Space shortcut) ──
  // globalShortcut works without it on modern macOS; Cmd+Shift+K is always the fallback.
  // Screen Recording: not requested upfront — macOS 15 Sequoia shows an alarming
  // "bypass private window picker" dialog. Let the OS prompt naturally if/when
  // the screenshot feature is actually used.
}
