import { useShowStore, selectCompletedActs, selectSkippedActs } from '../stores/showStore'
import { ShowVerdict } from '../components/ShowVerdict'
import { OnAirIndicator } from '../components/OnAirIndicator'
import { BeatCounter } from '../components/BeatCounter'
import { Button } from '../ui/button'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'

export function StrikeView() {
  const verdict = useShowStore((s) => s.verdict)
  const acts = useShowStore((s) => s.acts)
  const beatsLocked = useShowStore((s) => s.beatsLocked)
  const beatThreshold = useShowStore((s) => s.beatThreshold)
  const resetShow = useShowStore((s) => s.resetShow)
  const setExpanded = useShowStore((s) => s.setExpanded)
  const completedActs = useShowStore(selectCompletedActs)
  const skippedActs = useShowStore(selectSkippedActs)

  return (
    <motion.div
      className="w-[560px] bg-surface rounded-xl overflow-hidden flex flex-col"
      data-clui-ui
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      {/* Title bar */}
      <div
        className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted">
          SHOWTIME
        </span>
        <OnAirIndicator isLive={false} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-8 py-6">
        {verdict && (
          <ShowVerdict
            verdict={verdict}
            beatsLocked={beatsLocked}
            beatThreshold={beatThreshold}
          />
        )}

        {/* Stats row */}
        <div className="flex items-center justify-center gap-8 mt-8">
          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.2 }}
          >
            <div className="font-mono text-3xl font-bold text-txt-primary">
              {completedActs.length}
            </div>
            <div className="text-xs text-txt-muted mt-1">Acts Completed</div>
          </motion.div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.3 }}
          >
            <div className="font-mono text-3xl font-bold text-txt-primary">
              {skippedActs.length}
            </div>
            <div className="text-xs text-txt-muted mt-1">Acts Cut</div>
          </motion.div>

          <motion.div
            className="text-center"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.4 }}
          >
            <div className="font-mono text-3xl font-bold text-txt-primary">
              {beatsLocked}
            </div>
            <div className="text-xs text-txt-muted mt-1">Beats Locked</div>
          </motion.div>
        </div>

        {/* Act recap panel */}
        <div className="bg-[#151517] rounded-xl p-4 mt-8">
          <h3 className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted mb-3">
            END CREDITS
          </h3>
          <div>
            {acts.map((act, i) => {
              const isCompleted = act.status === 'completed'
              const isSkipped = act.status === 'skipped'
              return (
                <motion.div
                  key={act.id}
                  className={cn(
                    'flex items-center gap-2 py-1.5 text-sm',
                    isCompleted ? 'text-txt-secondary' : 'text-txt-muted'
                  )}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    type: 'spring',
                    stiffness: 200,
                    damping: 25,
                    delay: 0.5 + i * 0.06,
                  }}
                >
                  <span
                    className={cn(
                      isCompleted ? 'text-emerald-400' : 'text-txt-muted'
                    )}
                  >
                    {isCompleted ? '✓' : isSkipped ? '✕' : '–'}
                  </span>
                  <span>{act.name}</span>
                  {act.beatLocked && <span className="text-beat">★</span>}
                </motion.div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="px-8 py-6 flex items-center gap-3 border-t border-[#242428]">
        <Button variant="accent" onClick={resetShow}>
          New Show
        </Button>
        <Button variant="neutral" onClick={() => setExpanded(false)}>
          Close
        </Button>
      </div>
    </motion.div>
  )
}
