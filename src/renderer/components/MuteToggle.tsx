import { useState, useCallback } from 'react'
import { isMuted, setMuted } from '../hooks/useAudio'

/** Toggle button that mutes or unmutes all app audio cues. */
export function MuteToggle() {
  const [muted, setMutedState] = useState(isMuted)

  const toggle = useCallback(() => {
    const next = !muted
    setMuted(next)
    setMutedState(next)
  }, [muted])

  return (
    <button
      onClick={toggle}
      className="px-2 py-1.5 text-txt-muted hover:text-txt-secondary transition-colors no-drag"
      title={muted ? 'Unmute audio' : 'Mute audio'}
      data-testid="mute-toggle"
    >
      {muted ? (
        // Speaker with X (muted)
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
          <path d="M8 2L4 5.5H1v5h3L8 14V2z" fill="currentColor" />
          <path d="M12 5.5l3 5M15 5.5l-3 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      ) : (
        // Speaker (unmuted)
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="inline-block">
          <path d="M8 2L4 5.5H1v5h3L8 14V2z" fill="currentColor" />
          <path d="M11 5.5a3.5 3.5 0 010 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <path d="M13 3.5a6.5 6.5 0 010 9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
