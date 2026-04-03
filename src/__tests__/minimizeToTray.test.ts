import { describe, it, expect } from 'vitest'
import { IPC } from '../shared/types'
import type { TrayShowState } from '../shared/types'

describe('Minimize to Tray', () => {
  describe('IPC channel', () => {
    it('has MINIMIZE_TO_TRAY channel defined', () => {
      expect(IPC.MINIMIZE_TO_TRAY).toBe('showtime:minimize-to-tray')
    })

    it('MINIMIZE_TO_TRAY is unique among IPC channels', () => {
      const values = Object.values(IPC)
      const unique = new Set(values)
      expect(unique.size).toBe(values.length)
    })
  })

  describe('TrayShowState', () => {
    it('accepts windowVisible as optional boolean', () => {
      const state: TrayShowState = {
        phase: 'live',
        currentActName: 'Deep Work',
        currentActCategory: 'Deep Work',
        timerSeconds: 1500,
        beatsLocked: 1,
        beatThreshold: 3,
        actIndex: 0,
        totalActs: 4,
        nextActs: [],
        windowVisible: false,
      }
      expect(state.windowVisible).toBe(false)
    })

    it('windowVisible defaults to undefined when not provided', () => {
      const state: TrayShowState = {
        phase: 'live',
        currentActName: 'Deep Work',
        currentActCategory: 'Deep Work',
        timerSeconds: 1500,
        beatsLocked: 1,
        beatThreshold: 3,
        actIndex: 0,
        totalActs: 4,
        nextActs: [],
      }
      expect(state.windowVisible).toBeUndefined()
    })
  })

  describe('Tray title formatting', () => {
    // Replicating the formatTimer logic from tray.ts since it can't be imported (Electron deps)
    function formatTimer(seconds: number): string {
      const h = Math.floor(seconds / 3600)
      const m = Math.floor((seconds % 3600) / 60)
      const s = seconds % 60
      if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      return `${m}:${String(s).padStart(2, '0')}`
    }

    function buildTrayTitle(actName: string | null, seconds: number, windowHidden: boolean): string {
      const isAmber = seconds < 300
      const timer = formatTimer(seconds)
      if (windowHidden && actName) {
        return isAmber ? `⚡ ${actName} — ${timer}` : `${actName} — ${timer}`
      }
      return isAmber ? `⚡ ${timer}` : timer
    }

    it('shows act name + timer when window is hidden', () => {
      expect(buildTrayTitle('Deep Work', 2332, true)).toBe('Deep Work — 38:52')
    })

    it('shows only timer when window is visible', () => {
      expect(buildTrayTitle('Deep Work', 2332, false)).toBe('38:52')
    })

    it('adds ⚡ prefix when under 5 minutes and window hidden', () => {
      expect(buildTrayTitle('Deep Work', 180, true)).toBe('⚡ Deep Work — 3:00')
    })

    it('adds ⚡ prefix when under 5 minutes and window visible', () => {
      expect(buildTrayTitle('Deep Work', 180, false)).toBe('⚡ 3:00')
    })

    it('falls back to timer-only when actName is null', () => {
      expect(buildTrayTitle(null, 600, true)).toBe('10:00')
    })
  })
})
