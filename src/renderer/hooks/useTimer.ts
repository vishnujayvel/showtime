import { useState, useEffect, useCallback } from 'react'
import { useShowStore } from '../stores/showStore'

interface TimerState {
  minutes: number
  seconds: number
  isRunning: boolean
  isComplete: boolean
  totalSeconds: number
  progress: number // 0-1, how much time has elapsed
}

export function useTimer(): TimerState {
  const timerEndAt = useShowStore((s) => s.timerEndAt)
  const currentActId = useShowStore((s) => s.currentActId)
  const acts = useShowStore((s) => s.acts)
  const completeAct = useShowStore((s) => s.completeAct)

  const currentAct = acts.find((a) => a.id === currentActId)
  const totalDurationMs = currentAct ? currentAct.durationMinutes * 60 * 1000 : 0

  const calcRemaining = useCallback(() => {
    if (!timerEndAt) return 0
    return Math.max(0, timerEndAt - Date.now())
  }, [timerEndAt])

  const [remaining, setRemaining] = useState(calcRemaining)

  useEffect(() => {
    setRemaining(calcRemaining())

    if (!timerEndAt) return

    const interval = setInterval(() => {
      const r = calcRemaining()
      setRemaining(r)

      if (r <= 0 && currentActId) {
        clearInterval(interval)
        completeAct(currentActId)
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [timerEndAt, currentActId, calcRemaining, completeAct])

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
