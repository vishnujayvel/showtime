import { motion, AnimatePresence } from 'framer-motion'
import { useShowStore, selectCurrentAct } from '../stores/showStore'
import { ClapperboardBadge } from './ClapperboardBadge'
import { Button } from '../ui/button'

export function BeatCheckModal() {
  const beatCheckPending = useShowStore((s) => s.beatCheckPending)
  const celebrationActive = useShowStore((s) => s.celebrationActive)
  const lockBeat = useShowStore((s) => s.lockBeat)
  const skipBeat = useShowStore((s) => s.skipBeat)
  const acts = useShowStore((s) => s.acts)
  const currentAct = useShowStore(selectCurrentAct)

  if (!beatCheckPending) return null

  const actNumber = currentAct
    ? acts.findIndex((a) => a.id === currentAct.id) + 1
    : 0

  const handleLockBeat = () => {
    lockBeat()
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
          <div
            className="absolute inset-0 rounded-2xl pointer-events-none"
            style={{
              background:
                'radial-gradient(ellipse 300px 200px at 50% 30%, rgba(245,158,11,0.06) 0%, transparent 70%)',
            }}
          />

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
                onClick={skipBeat}
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
