/**
 * Theme store — manages dark/light mode and persisted settings.
 *
 * Design tokens for Showtime live in Tailwind CSS @theme (src/renderer/index.css).
 * This file only keeps runtime color values needed by PermissionCard (which
 * still uses inline styles for dynamic allow/deny button coloring).
 */
import { create } from 'zustand'

// ─── Runtime colors for PermissionCard ───
// These are the only values consumed via useColors(). Everything else
// is handled by Tailwind utility classes.

const darkPermissionColors = {
  containerBg: '#242422',
  accent: '#d97757',
  accentLight: 'rgba(217, 119, 87, 0.1)',
  accentSoft: 'rgba(217, 119, 87, 0.15)',
  textPrimary: '#ccc9c0',
  textSecondary: '#c0bdb2',
  textTertiary: '#76766e',
  codeBg: '#1a1a18',
  statusPermission: '#d97757',
  statusComplete: '#7aac8c',
  statusError: '#c47060',
  permissionBorder: 'rgba(245, 158, 11, 0.3)',
  permissionShadow: '0 2px 12px rgba(245, 158, 11, 0.08)',
  permissionHeaderBg: 'rgba(245, 158, 11, 0.06)',
  permissionHeaderBorder: 'rgba(245, 158, 11, 0.12)',
  permissionAllowBg: 'rgba(34, 197, 94, 0.1)',
  permissionAllowHoverBg: 'rgba(34, 197, 94, 0.22)',
  permissionAllowBorder: 'rgba(34, 197, 94, 0.25)',
  permissionDenyBg: 'rgba(239, 68, 68, 0.08)',
  permissionDenyHoverBg: 'rgba(239, 68, 68, 0.18)',
  permissionDenyBorder: 'rgba(239, 68, 68, 0.22)',
} as const

const lightPermissionColors = {
  containerBg: '#f9f8f5',
  accent: '#d97757',
  accentLight: 'rgba(217, 119, 87, 0.1)',
  accentSoft: 'rgba(217, 119, 87, 0.12)',
  textPrimary: '#3c3929',
  textSecondary: '#5a5749',
  textTertiary: '#8a8a80',
  codeBg: '#f0eee8',
  statusPermission: '#d97757',
  statusComplete: '#5a9e6f',
  statusError: '#c47060',
  permissionBorder: 'rgba(245, 158, 11, 0.3)',
  permissionShadow: '0 2px 12px rgba(245, 158, 11, 0.08)',
  permissionHeaderBg: 'rgba(245, 158, 11, 0.06)',
  permissionHeaderBorder: 'rgba(245, 158, 11, 0.12)',
  permissionAllowBg: 'rgba(34, 197, 94, 0.1)',
  permissionAllowHoverBg: 'rgba(34, 197, 94, 0.22)',
  permissionAllowBorder: 'rgba(34, 197, 94, 0.25)',
  permissionDenyBg: 'rgba(239, 68, 68, 0.08)',
  permissionDenyHoverBg: 'rgba(239, 68, 68, 0.18)',
  permissionDenyBorder: 'rgba(239, 68, 68, 0.22)',
} as const

export type PermissionColors = { [K in keyof typeof darkPermissionColors]: string }

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
        themeMode: ['light', 'dark'].includes(parsed.themeMode) ? parsed.themeMode : 'dark',
        soundEnabled: typeof parsed.soundEnabled === 'boolean' ? parsed.soundEnabled : true,
      }
    }
  } catch {}
  return { themeMode: 'dark', soundEnabled: true }
}

function saveSettings(s: { themeMode: ThemeMode; soundEnabled: boolean }): void {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)) } catch {}
}

function applyTheme(isDark: boolean): void {
  document.documentElement.classList.toggle('dark', isDark)
  document.documentElement.classList.toggle('light', !isDark)
}

const saved = loadSettings()

export const useThemeStore = create<ThemeState>((set, get) => ({
  isDark: saved.themeMode === 'dark' ? true : saved.themeMode === 'light' ? false : true,
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

// ─── Color hooks (for PermissionCard) ───

export function useColors(): PermissionColors {
  const isDark = useThemeStore((s) => s.isDark)
  return isDark ? darkPermissionColors : lightPermissionColors
}
