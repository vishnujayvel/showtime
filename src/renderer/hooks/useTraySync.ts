import { useEffect, useRef } from 'react'
import { useShowStore } from '../stores/showStore'
import type { TrayShowState } from '../../shared/types'

/**
 * Subscribes to showStore changes and sends tray state to the main process.
 * Timer-only updates (every 1s during live/director phase) use a lightweight
 * IPC channel that only sets tray title + icon — no menu rebuild.
 * Full state updates (with menu rebuild) are sent only on phase/act/beat changes.
 */
export function useTraySync(): void {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function sendTrayState(): void {
      const s = useShowStore.getState()
      const currentAct = s.acts.find((a) => a.id === s.currentActId)
      const currentIndex = s.acts.findIndex((a) => a.id === s.currentActId)

      let timerSeconds: number | null = null
      if (s.timerEndAt) {
        timerSeconds = Math.max(0, Math.ceil((s.timerEndAt - Date.now()) / 1000))
      }

      const state: TrayShowState = {
        phase: s.phase,
        currentActName: currentAct?.name ?? null,
        currentActCategory: currentAct?.sketch ?? null,
        timerSeconds,
        beatsLocked: s.beatsLocked,
        beatThreshold: s.beatThreshold,
        actIndex: Math.max(0, currentIndex),
        totalActs: s.acts.length,
        nextActs: currentIndex >= 0
          ? s.acts.slice(currentIndex + 1, currentIndex + 3).map((a) => ({
              name: a.name,
              sketch: a.sketch,
              durationMinutes: a.durationMinutes,
            }))
          : [],
      }

      window.clui.updateTrayState(state)
    }

    /** Lightweight timer-only update — no menu rebuild */
    function sendTimerOnly(): void {
      const s = useShowStore.getState()
      if (s.timerEndAt) {
        const seconds = Math.max(0, Math.ceil((s.timerEndAt - Date.now()) / 1000))
        window.clui.updateTrayTimer(seconds)
      }
    }

    function startTimerInterval(): void {
      if (!intervalRef.current) {
        intervalRef.current = setInterval(sendTimerOnly, 1000)
      }
    }

    function stopTimerInterval(): void {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }

    // Send immediately on mount
    sendTrayState()

    // Subscribe to store changes for non-timer updates (phase, acts, beats)
    const unsub = useShowStore.subscribe((curr, prev) => {
      const timerChanged = curr.timerEndAt !== prev.timerEndAt
      if (
        curr.phase !== prev.phase ||
        curr.currentActId !== prev.currentActId ||
        curr.beatsLocked !== prev.beatsLocked ||
        curr.beatThreshold !== prev.beatThreshold ||
        curr.acts !== prev.acts ||
        timerChanged
      ) {
        sendTrayState()

        // Start/stop the timer interval based on phase
        if ((curr.phase === 'live' || curr.phase === 'director') && curr.timerEndAt) {
          startTimerInterval()
        } else {
          stopTimerInterval()
        }
      }
    })

    // Also start interval if we mount during a live/director phase
    const initial = useShowStore.getState()
    if ((initial.phase === 'live' || initial.phase === 'director') && initial.timerEndAt) {
      startTimerInterval()
    }

    return () => {
      unsub()
      stopTimerInterval()
    }
  }, [])
}
