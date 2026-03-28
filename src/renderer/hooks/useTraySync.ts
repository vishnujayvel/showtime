import { useEffect, useRef } from 'react'
import { useShowStore } from '../stores/showStore'
import type { TrayShowState } from '../../shared/types'

/**
 * Subscribes to showStore changes and sends tray state to the main process.
 * Runs a 1-second interval during live phase to keep the timer current.
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

    // Send immediately on mount
    sendTrayState()

    // Subscribe to store changes for non-timer updates (phase, acts, beats)
    const unsub = useShowStore.subscribe((curr, prev) => {
      if (
        curr.phase !== prev.phase ||
        curr.currentActId !== prev.currentActId ||
        curr.beatsLocked !== prev.beatsLocked ||
        curr.acts !== prev.acts
      ) {
        sendTrayState()

        // Start/stop the timer interval based on phase
        if (curr.phase === 'live' && curr.timerEndAt) {
          if (!intervalRef.current) {
            intervalRef.current = setInterval(sendTrayState, 1000)
          }
        } else {
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      }
    })

    // Also start interval if we mount during a live phase
    const initial = useShowStore.getState()
    if (initial.phase === 'live' && initial.timerEndAt) {
      intervalRef.current = setInterval(sendTrayState, 1000)
    }

    return () => {
      unsub()
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [])
}
