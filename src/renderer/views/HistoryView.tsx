import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Button } from '../ui/button'
import { cn } from '../lib/utils'
import type { ShowHistoryEntry } from '../../main/data/types'

interface HistoryViewProps {
  onBack: () => void
}

const VERDICT_LABELS: Record<string, { label: string; color: string }> = {
  DAY_WON: { label: 'Day Won', color: 'text-beat' },
  SOLID_SHOW: { label: 'Solid Show', color: 'text-emerald-400' },
  GOOD_EFFORT: { label: 'Good Effort', color: 'text-txt-secondary' },
  SHOW_CALLED_EARLY: { label: 'Called Early', color: 'text-txt-muted' },
}

function formatShowDate(dateId: string): string {
  const d = new Date(dateId + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

export function HistoryView({ onBack }: HistoryViewProps) {
  const [history, setHistory] = useState<ShowHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.clui.getShowHistory(30).then((entries) => {
      setHistory(entries)
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  return (
    <motion.div
      className="w-full h-full bg-surface overflow-hidden flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 25 }}
    >
      {/* Title bar */}
      <div className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428] drag-region">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted">
          PAST SHOWS
        </span>
        <button
          onClick={onBack}
          className="text-txt-muted hover:text-txt-secondary text-sm no-drag transition-colors"
        >
          Back
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <p className="text-sm text-txt-muted text-center py-8">Loading...</p>
        )}

        {!loading && history.length === 0 && (
          <p className="text-sm text-txt-muted text-center py-8">
            No past shows yet. Your history will appear here after your first show.
          </p>
        )}

        {!loading && history.map((show, i) => {
          const verdictInfo = show.verdict ? VERDICT_LABELS[show.verdict] : null
          return (
            <motion.div
              key={show.showId}
              className="flex items-center gap-3 py-3 border-b border-[#242428] last:border-b-0"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 25, delay: i * 0.03 }}
            >
              {/* Date */}
              <div className="w-[100px] shrink-0">
                <p className="font-body text-sm text-txt-primary font-medium">
                  {formatShowDate(show.showId)}
                </p>
              </div>

              {/* Verdict badge */}
              <div className="w-[90px] shrink-0">
                {verdictInfo ? (
                  <span className={cn('font-mono text-[10px] font-bold uppercase tracking-wider', verdictInfo.color)}>
                    {verdictInfo.label}
                  </span>
                ) : (
                  <span className="font-mono text-[10px] text-txt-muted">
                    {show.phase === 'strike' ? 'Complete' : 'In Progress'}
                  </span>
                )}
              </div>

              {/* Acts */}
              <div className="flex-1">
                <span className="font-mono text-xs text-txt-secondary">
                  {show.completedActCount}/{show.actCount} acts
                </span>
              </div>

              {/* Beats */}
              <div className="shrink-0 flex items-center gap-0.5">
                {Array.from({ length: show.beatThreshold }, (_, j) => (
                  <span
                    key={j}
                    className={cn(
                      'text-sm',
                      j < show.beatsLocked ? 'text-beat' : 'text-txt-muted'
                    )}
                  >
                    {j < show.beatsLocked ? '\u2605' : '\u2606'}
                  </span>
                ))}
              </div>
            </motion.div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-[#242428]">
        <Button variant="neutral" onClick={onBack}>
          Back to Stage
        </Button>
      </div>
    </motion.div>
  )
}
