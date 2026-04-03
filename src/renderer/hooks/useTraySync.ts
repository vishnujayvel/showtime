import { useEffect, useRef } from 'react'
import { useShowActor } from '../machines/ShowMachineProvider'
import { getPhaseFromState } from '../machines/showMachine'
import { useUIStore } from '../stores/uiStore'
import type { TrayShowState } from '../../shared/types'

/**
 * Subscribes to the XState show actor and sends tray state to the main process.
 * Timer-only updates (every 1s during live/director phase) use a lightweight
 * IPC channel that only sets tray title + icon — no menu rebuild.
 * Full state updates (with menu rebuild) are sent only on phase/act/beat changes.
 *
 * When timerDisplay === 'pill', tray title is cleared (no timer in menu bar).
 * When timerDisplay === 'menubar', tray title shows countdown.
 */
export function useTraySync(): void {
  const actor = useShowActor()
  const timerDisplay = useUIStore((s) => s.timerDisplay)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    function sendTrayState(): void {
      const snapshot = actor.getSnapshot()
      const ctx = snapshot.context
      const phase = getPhaseFromState(snapshot.value as Record<string, unknown>)
      const currentAct = ctx.acts.find((a) => a.id === ctx.currentActId)
      const currentIndex = ctx.acts.findIndex((a) => a.id === ctx.currentActId)

      let timerSeconds: number | null = null
      if (ctx.timerEndAt) {
        timerSeconds = Math.max(0, Math.ceil((ctx.timerEndAt - Date.now()) / 1000))
      }

      const state: TrayShowState = {
        phase,
        currentActName: currentAct?.name ?? null,
        currentActCategory: currentAct?.sketch ?? null,
        timerSeconds,
        beatsLocked: ctx.beatsLocked,
        beatThreshold: ctx.beatThreshold,
        actIndex: Math.max(0, currentIndex),
        totalActs: ctx.acts.length,
        nextActs: currentIndex >= 0
          ? ctx.acts.slice(currentIndex + 1, currentIndex + 3).map((a) => ({
              name: a.name,
              sketch: a.sketch,
              durationMinutes: a.durationMinutes,
            }))
          : [],
      }

      // When pill mode is active, null out timerSeconds so tray title stays empty
      if (useUIStore.getState().timerDisplay === 'pill' && (phase === 'live' || phase === 'director')) {
        state.timerSeconds = null
      }
      window.showtime.updateTrayState(state)
    }

    /** Lightweight timer-only update — no menu rebuild */
    function sendTimerOnly(): void {
      // When pill mode is active, clear the tray title (no timer in menu bar)
      if (useUIStore.getState().timerDisplay === 'pill') {
        return
      }
      const snapshot = actor.getSnapshot()
      const ctx = snapshot.context
      if (ctx.timerEndAt) {
        const seconds = Math.max(0, Math.ceil((ctx.timerEndAt - Date.now()) / 1000))
        window.showtime.updateTrayTimer(seconds)
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

    // Subscribe to actor state changes for non-timer updates (phase, acts, beats)
    let prevPhase = getPhaseFromState(actor.getSnapshot().value as Record<string, unknown>)
    let prevActId = actor.getSnapshot().context.currentActId
    let prevBeatsLocked = actor.getSnapshot().context.beatsLocked
    let prevBeatThreshold = actor.getSnapshot().context.beatThreshold
    let prevActs = actor.getSnapshot().context.acts
    let prevTimerEndAt = actor.getSnapshot().context.timerEndAt

    const subscription = actor.subscribe((snapshot) => {
      const ctx = snapshot.context
      const phase = getPhaseFromState(snapshot.value as Record<string, unknown>)
      const timerChanged = ctx.timerEndAt !== prevTimerEndAt

      if (
        phase !== prevPhase ||
        ctx.currentActId !== prevActId ||
        ctx.beatsLocked !== prevBeatsLocked ||
        ctx.beatThreshold !== prevBeatThreshold ||
        ctx.acts !== prevActs ||
        timerChanged
      ) {
        sendTrayState()

        // Start/stop the timer interval based on phase
        if ((phase === 'live' || phase === 'director') && ctx.timerEndAt) {
          startTimerInterval()
        } else {
          stopTimerInterval()
        }
      }

      prevPhase = phase
      prevActId = ctx.currentActId
      prevBeatsLocked = ctx.beatsLocked
      prevBeatThreshold = ctx.beatThreshold
      prevActs = ctx.acts
      prevTimerEndAt = ctx.timerEndAt
    })

    // Also start interval if we mount during a live/director phase
    const initialSnapshot = actor.getSnapshot()
    const initialPhase = getPhaseFromState(initialSnapshot.value as Record<string, unknown>)
    if ((initialPhase === 'live' || initialPhase === 'director') && initialSnapshot.context.timerEndAt) {
      startTimerInterval()
    }

    return () => {
      subscription.unsubscribe()
      stopTimerInterval()
    }
  }, [actor, timerDisplay])
}
