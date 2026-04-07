import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useShowContext, useShowSend, useShowSelector, showSelectors } from '../machines/ShowMachineProvider'
import { ClapperboardBadge } from './ClapperboardBadge'
import { Button } from '../ui/button'
import { playAudioCue } from '../hooks/useAudio'

/** Modal overlay asking whether the user experienced a moment of presence after an act completes. */
export function BeatCheckModal() {
  const beatCheckPending = useShowContext((ctx) => ctx.beatCheckPending)
  const celebrationActive = useShowContext((ctx) => ctx.celebrationActive)
  const send = useShowSend()
  const acts = useShowContext((ctx) => ctx.acts)
  const currentAct = useShowSelector(showSelectors.currentAct)

  // Play beat-check audio when modal appears
  const prevPending = useRef(false)
  useEffect(() => {
    if (beatCheckPending && !prevPending.current) {
      playAudioCue('beat-check')
    }
    prevPending.current = beatCheckPending
  }, [beatCheckPending])

  // Show modal when Beat Check is pending OR celebration is playing
  if (!beatCheckPending && !celebrationActive) return null

  const actNumber = currentAct
    ? acts.findIndex((a) => a.id === currentAct.id) + 1
    : 0

  const handleLockBeat = () => {
    playAudioCue('beat-locked')
    send({ type: 'LOCK_BEAT' })
  }

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-[8px] z-50 flex items-center justify-center">
      <AnimatePresence mode="wait">
        <motion.div
          key={celebrationActive ? 'celebration' : 'prompt'}
          initial={{ scale: 0.8, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          className="w-[380px] p-8 rounded-2xl bg-surface border border-card-border flex flex-col items-center text-center relative"
        >
          {/* Golden spotlight gradient */}
          <div className="absolute inset-0 rounded-2xl pointer-events-none spotlight-golden" />

          {celebrationActive ? (
            <p className="text-beat font-semibold text-lg animate-beat-ignite relative z-10">
              That moment was real.
            </p>
          ) : (
            <div className="relative z-10 flex flex-col items-center">
              {currentAct && (
                <ClapperboardBadge
                  sketch={currentAct.sketch}
                  actNumber={actNumber}
                  status="complete"
                />
              )}

              <p className="font-body text-lg font-semibold text-txt-primary mt-6 mb-8">
                Did you have a moment of presence?
              </p>

              <Button
                variant="beat-large"
                onClick={handleLockBeat}
              >
                Yes — Lock the Beat
              </Button>

              <span
                className="text-sm text-txt-muted hover:text-txt-secondary cursor-pointer mt-4"
                onClick={() => send({ type: 'SKIP_BEAT' })}
              >
                Not this time
              </span>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
