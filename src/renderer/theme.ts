/**
 * Theme store — manages dark/light mode and persisted settings.
 *
 * Design tokens for Showtime live in Tailwind CSS @theme (src/renderer/index.css).
 * All color tokens are consumed via Tailwind utility classes — no runtime
 * color objects are needed.
 */
import { create } from 'zustand'

// ─── Theme store ───

export type ThemeMode = 'system' | 'light' | 'dark'

interface ThemeState {
  isDark: boolean
  themeMode: ThemeMode
  soundEnabled: boolean
  _systemIsDark: boolean
  setThemeMode: (mode: ThemeMode) => void
  setSoundEnabled: (enabled: boolean) => void
  setSystemTheme: (isDark: boolean) => void
}

const SETTINGS_KEY = 'clui-settings'

function loadSettings(): { themeMode: ThemeMode; soundEnabled: boolean } {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      return {
        themeMode: ['system', 'light', 'dark'].includes(parsed.themeMode) ? parsed.themeMode : 'system',
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      }
    }
  } catch {}
  return { themeMode: 'system', soundEnabled: true }
}

function saveSettings(s: { themeMode: ThemeMode; soundEnabled: boolean }): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.classList.toggle('light', !isDark)
}

const saved = loadSettings()
const initialIsDark = saved.themeMode === 'light' ? false : true

// Apply theme class immediately on module load — before first React render
applyTheme(initialIsDark)

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: initialIsDark,
  themeMode: saved.themeMode,
  soundEnabled: saved.soundEnabled,
  _systemIsDark: true,
  setThemeMode: (mode) => {
    const resolved = mode === 'system' ? get()._systemIsDark : mode === 'dark'
    set({ themeMode: mode, isDark: resolved })
    applyTheme(resolved)
    saveSettings({ themeMode: mode, soundEnabled: get().soundEnabled })
  },
  setSoundEnabled: (enabled) => {
    set({ soundEnabled: enabled })
    saveSettings({ themeMode: get().themeMode, soundEnabled: enabled })
  },
  setSystemTheme: (isDark) => {
    set({ _systemIsDark: isDark })
    if (get().themeMode === 'system') {
      set({ isDark })
      applyTheme(isDark)
    }
  },
}))

