import { useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useThemeStore, type ThemeMode } from '../theme'
import { useShowSend } from '../machines/ShowMachineProvider'
import { useUIStore } from '../stores/uiStore'
import { Button } from '../ui/button'

interface SettingsViewProps {
  onBack: () => void
}

import { springGentle as springTransition } from '../constants/animations'

/** Preferences panel for theme, sound, calendar sync, and show reset. */
export function SettingsView({ onBack }: SettingsViewProps) {
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)
  const soundEnabled = useThemeStore((s) => s.soundEnabled)
  const setSoundEnabled = useThemeStore((s) => s.setSoundEnabled)
  const send = useShowSend()
  const resetShow = useCallback(() => send({ type: 'RESET' }), [send])
  const calendarAvailable = useUIStore((s) => s.calendarAvailable)
  const calendarEnabled = useUIStore((s) => s.calendarEnabled)
  const setCalendarEnabled = useUIStore((s) => s.setCalendarEnabled)

  const [confirmReset, setConfirmReset] = useState(false)

  const handleReset = useCallback(() => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    resetShow()
    setConfirmReset(false)
  }, [confirmReset, resetShow])

  return (
    <motion.div
      className="w-full h-full bg-surface overflow-hidden flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={springTransition}
    >
      {/* Title bar */}
      <div className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428] drag-region">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted">
          PREFERENCES
        </span>
        <button
          onClick={onBack}
          className="text-txt-muted hover:text-txt-secondary text-sm no-drag transition-colors"
        >
          Back
        </button>
      </div>

      {/* Settings content */}
      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-6">
        {/* Calendar Sync */}
        <div>
          <p className="font-mono text-[10px] tracking-[0.15em] uppercase text-txt-muted mb-3">
            CALENDAR SYNC
          </p>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${calendarAvailable ? 'bg-green-500' : 'bg-txt-muted'}`}
              />
              <p className="text-sm font-body text-txt-primary">
                {calendarAvailable ? 'Connected' : 'Not configured'}
              </p>
            </div>
          </div>
          {!calendarAvailable && (
            <p className="text-xs text-txt-muted mb-2">
              Add the Google Calendar MCP in Claude Code settings to enable calendar sync.
            </p>
          )}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-body text-txt-primary">Import calendar events</p>
              <p className="text-xs text-txt-muted mt-0.5">
                Pull today&apos;s events into the Writer&apos;s Room lineup
              </p>
            </div>
            <button
              onClick={() => {
                if (calendarAvailable) setCalendarEnabled(!calendarEnabled)
              }}
              disabled={!calendarAvailable}
              className={`relative w-10 h-6 rounded-full transition-colors ${
                !calendarAvailable
                  ? 'bg-surface-hover opacity-50 cursor-not-allowed'
                  : calendarEnabled
                    ? 'bg-accent'
                    : 'bg-surface-hover'
              }`}
            >
              <span
                className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  calendarEnabled && calendarAvailable ? 'translate-x-4' : ''
                }`}
              />
            </button>
          </div>
        </div>

        {/* Sound */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-body text-txt-primary">Sound</p>
            <p className="text-xs text-txt-muted mt-0.5">Notification sounds</p>
          </div>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`relative w-10 h-6 rounded-full transition-colors ${soundEnabled ? 'bg-accent' : 'bg-surface-hover'}`}
          >
            <span
              className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${soundEnabled ? 'translate-x-4' : ''}`}
            />
          </button>
        </div>

        {/* Theme */}
        <div>
          <p className="text-sm font-body text-txt-primary mb-2">Theme</p>
          <div className="flex gap-2">
            {(['dark', 'light', 'system'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setThemeMode(mode)}
                className={`px-3 py-1.5 rounded text-xs font-body capitalize transition-colors ${
                  themeMode === mode
                    ? 'bg-accent text-white'
                    : 'bg-surface-hover text-txt-secondary hover:text-txt-primary'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </div>

        {/* Reset Show */}
        <div className="pt-2 border-t border-[#242428]">
          <p className="text-sm font-body text-txt-primary mb-1">Reset Show</p>
          <p className="text-xs text-txt-muted mb-3">
            Clear today's show and start fresh from Dark Studio.
          </p>
          <Button
            variant={confirmReset ? 'destructive' : 'neutral'}
            onClick={handleReset}
          >
            {confirmReset ? 'Confirm Reset' : 'Reset Show'}
          </Button>
          {confirmReset && (
            <button
              onClick={() => setConfirmReset(false)}
              className="ml-2 text-xs text-txt-muted hover:text-txt-secondary transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#242428] text-center">
        <p className="text-xs text-txt-muted font-body">
          Showtime v{__APP_VERSION__}
        </p>
        <p className="text-[10px] text-txt-muted mt-1">
          An ADHD-friendly day planner
        </p>
      </div>
    </motion.div>
  )
}
