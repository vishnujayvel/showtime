import { useEffect, useMemo } from 'react'
import { useShowStore } from '../stores/showStore'
import { ShowVerdict } from '../components/ShowVerdict'
import { OnAirIndicator } from '../components/OnAirIndicator'
import { BeatCounter } from '../components/BeatCounter'
import { Button } from '../ui/button'
import { motion } from 'framer-motion'
import { cn } from '../lib/utils'
import { playAudioCue } from '../hooks/useAudio'

function formatDuration(startMs: number): string {
  const elapsed = Date.now() - startMs
  const totalMinutes = Math.round(elapsed / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60
  if (hours === 0) return `${mins}m`
  return `${hours}h ${mins}m`
}

export function StrikeView() {
  const verdict = useShowStore((s) => s.verdict)
  const acts = useShowStore((s) => s.acts)
  const beatsLocked = useShowStore((s) => s.beatsLocked)
  const beatThreshold = useShowStore((s) => s.beatThreshold)
  const resetShow = useShowStore((s) => s.resetShow)
  const setExpanded = useShowStore((s) => s.setExpanded)
  const enterWritersRoom = useShowStore((s) => s.enterWritersRoom)
  const showStartedAt = useShowStore((s) => s.showStartedAt)

  // Compute derived data inline to avoid selector referential instability
  const completedActs = useMemo(() => acts.filter((a) => a.status === 'completed'), [acts])
  const skippedActs = useMemo(() => acts.filter((a) => a.status === 'skipped'), [acts])

  const showDuration = useMemo(
    () => (showStartedAt ? formatDuration(showStartedAt) : null),
    [showStartedAt],
  )

  // Play show-complete audio cue once on mount
  useEffect(() => {
    playAudioCue('show-complete')
  }, [])

  return (
    <motion.div
      className="w-[560px] max-h-[680px] bg-surface rounded-xl overflow-hidden flex flex-col relative"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      {/* Title bar */}
      <div
        className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428] drag-region"
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

          {showDuration && (
            <motion.div
              className="text-center"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.5 }}
              data-testid="show-duration"
            >
              <div className="font-mono text-3xl font-bold text-txt-primary">
                {showDuration}
              </div>
              <div className="text-xs text-txt-muted mt-1">Show Duration</div>
            </motion.div>
          )}
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

      {/* DAY WON confetti */}
      {verdict === 'DAY_WON' && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
          {Array.from({ length: 24 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-full animate-confetti"
              style={{
                left: `${Math.random() * 100}%`,
                backgroundColor: ['#f59e0b', '#ef4444', '#8b5cf6', '#22c55e', '#60a5fa', '#ec4899'][i % 6],
                animationDelay: `${Math.random() * 1.5}s`,
              }}
            />
          ))}
        </div>
      )}

      {/* Footer — Celebration Actions */}
      <div className="px-8 py-6 flex flex-col gap-3 border-t border-[#242428]">
        {verdict === 'DAY_WON' && (
          <motion.p
            className="text-sm text-beat text-center font-medium mb-1"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 0.8 }}
          >
            Standing ovation.
          </motion.p>
        )}
        <div className="flex items-center gap-3">
          <Button
            variant="accent"
            onClick={enterWritersRoom}
            data-testid="encore-btn"
          >
            Add an Encore
          </Button>
          <Button
            variant="neutral"
            onClick={resetShow}
            data-testid="plan-tomorrow-btn"
          >
            Plan Tomorrow
          </Button>
          <Button
            variant="neutral"
            onClick={() => setExpanded(false)}
            data-testid="thats-a-wrap-btn"
          >
            That&apos;s a Wrap
          </Button>
        </div>
      </div>
    </motion.div>
  )
}
