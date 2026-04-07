import { useState, useEffect, useCallback, useRef } from 'react'
import { useShowContext, useShowSend } from '../machines/ShowMachineProvider'
import { playAudioCue } from './useAudio'

interface TimerState {
  minutes: number
  seconds: number
  isRunning: boolean
  isComplete: boolean
  totalSeconds: number
  progress: number // 0-1, how much time has elapsed
}

/** React hook that tracks the current act's countdown timer and auto-completes when time expires. */
export function useTimer(): TimerState {
  const timerEndAt = useShowContext((ctx) => ctx.timerEndAt)
  const currentActId = useShowContext((ctx) => ctx.currentActId)
  const acts = useShowContext((ctx) => ctx.acts)
  const send = useShowSend()

  const currentAct = acts.find((a) => a.id === currentActId)
  const totalDurationMs = currentAct ? currentAct.durationMinutes * 60 * 1000 : 0

  // Track whether we've fired the 5-minute warning for this act
  const warningFired = useRef<string | null>(null)

  const calcRemaining = useCallback(() => {
    if (!timerEndAt) return 0
    return Math.max(0, timerEndAt - Date.now())
  }, [timerEndAt])

  const [remaining, setRemaining] = useState(calcRemaining)

  // Reset warning when act changes
  useEffect(() => {
    warningFired.current = null
  }, [currentActId])

  useEffect(() => {
    setRemaining(calcRemaining())

    if (!timerEndAt) return

    const interval = setInterval(() => {
      const r = calcRemaining()
      setRemaining(r)

      // Play timer warning once when crossing the 5-minute threshold
      const mins = Math.ceil(r / 1000 / 60)
      if (mins <= 5 && mins > 0 && r > 0 && warningFired.current !== currentActId) {
        warningFired.current = currentActId
        playAudioCue('timer-warning')
      }

      if (r <= 0 && currentActId) {
        clearInterval(interval)
        send({ type: 'COMPLETE_ACT', actId: currentActId })
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerEndAt, currentActId, calcRemaining, send])

  const totalSeconds = Math.ceil(remaining / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  const elapsed = totalDurationMs > 0 ? totalDurationMs - remaining : 0
  const progress = totalDurationMs > 0 ? Math.min(1, elapsed / totalDurationMs) : 0

  return {
    minutes,
    seconds,
    isRunning: timerEndAt !== null && remaining > 0,
    isComplete: timerEndAt !== null && remaining <= 0,
    totalSeconds,
    progress,
  }
}
