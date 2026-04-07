import { useCallback, useRef, useEffect } from 'react'

/** Union of all audio cue identifiers that can be played during a show. */
export type AudioCue =
  | 'going-live'
  | 'beat-check'
  | 'beat-locked'
  | 'timer-warning'
  | 'show-complete'
  | 'intermission'

const MUTE_KEY = 'showtime-audio-muted'

let audioContext: AudioContext | null = null

function getAudioContext(): AudioContext {
  if (!audioContext) {
    audioContext = new AudioContext()
  }
  if (audioContext.state === 'suspended') {
    audioContext.resume()
  }
  return audioContext
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  duration: number,
  startTime: number,
  type: OscillatorType = 'sine',
  gain = 0.15,
) {
  const osc = ctx.createOscillator()
  const gainNode = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(frequency, startTime)
  gainNode.gain.setValueAtTime(gain, startTime)
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration)
  osc.connect(gainNode)
  gainNode.connect(ctx.destination)
  osc.start(startTime)
  osc.stop(startTime + duration)
}

function playChord(
  ctx: AudioContext,
  frequencies: number[],
  duration: number,
  startTime: number,
  type: OscillatorType = 'sine',
  gain = 0.1,
) {
  for (const freq of frequencies) {
    playTone(ctx, freq, duration, startTime, type, gain)
  }
}

const CUE_PLAYERS: Record<AudioCue, (ctx: AudioContext) => void> = {
  // Ascending two-tone chime (C5 → G5)
  'going-live': (ctx) => {
    const now = ctx.currentTime
    playTone(ctx, 523.25, 0.25, now, 'sine', 0.2) // C5
    playTone(ctx, 783.99, 0.35, now + 0.2, 'sine', 0.2) // G5
  },

  // Single warm bell (A4)
  'beat-check': (ctx) => {
    const now = ctx.currentTime
    playTone(ctx, 440, 0.6, now, 'sine', 0.15)
    playTone(ctx, 880, 0.4, now, 'sine', 0.05) // harmonic
  },

  // Confirmation chord (C4+E4+G4)
  'beat-locked': (ctx) => {
    const now = ctx.currentTime
    playChord(ctx, [261.63, 329.63, 392.0], 0.4, now, 'sine', 0.1)
  },

  // Soft tick (filtered noise-like)
  'timer-warning': (ctx) => {
    const now = ctx.currentTime
    playTone(ctx, 1000, 0.08, now, 'square', 0.06)
  },

  // Ascending arpeggio (C4→E4→G4→C5)
  'show-complete': (ctx) => {
    const now = ctx.currentTime
    const notes = [261.63, 329.63, 392.0, 523.25]
    notes.forEach((freq, i) => {
      playTone(ctx, freq, 0.3, now + i * 0.15, 'sine', 0.15)
    })
  },

  // Descending soft tone (G4→C4)
  'intermission': (ctx) => {
    const now = ctx.currentTime
    playTone(ctx, 392.0, 0.35, now, 'sine', 0.12)
    playTone(ctx, 261.63, 0.45, now + 0.3, 'sine', 0.12)
  },
}

/** Checks whether audio cues are muted via localStorage. */
export function isMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Persists the audio mute preference to localStorage. */
export function setMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, String(muted))
  } catch { /* ignore */ }
}

/** Plays a synthesized audio cue unless audio is muted. */
export function playAudioCue(cue: AudioCue): void {
  if (isMuted()) return
  try {
    const ctx = getAudioContext()
    CUE_PLAYERS[cue](ctx)
  } catch { /* audio is non-critical */ }
}

/** React hook providing audio cue playback with a one-shot timer warning guard. */
export function useAudio() {
  const timerWarningFired = useRef(false)

  const play = useCallback((cue: AudioCue) => {
    playAudioCue(cue)
  }, [])

  const resetTimerWarning = useCallback(() => {
    timerWarningFired.current = false
  }, [])

  const playTimerWarningOnce = useCallback(() => {
    if (!timerWarningFired.current) {
      timerWarningFired.current = true
      playAudioCue('timer-warning')
    }
  }, [])

  return { play, resetTimerWarning, playTimerWarningOnce }
}
