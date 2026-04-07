import { useCallback, useEffect, useState } from 'react'
import { localToday } from '../../shared/date-utils'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import { Toolbar } from '../components/Toolbar'
import type { ShowHistoryEntry, ShowDetailEntry, ActSnapshot } from '../../shared/types'

interface HistoryViewProps {
  onBack: () => void
}

const VERDICT_LABELS: Record<string, { label: string; color: string }> = {
  DAY_WON: { label: 'Day Won', color: 'text-beat' },
  SOLID_SHOW: { label: 'Solid Show', color: 'text-emerald-400' },
  GOOD_EFFORT: { label: 'Good Effort', color: 'text-txt-secondary' },
  SHOW_CALLED_EARLY: { label: 'Called Early', color: 'text-txt-muted' },
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  completed: { label: 'Done', color: 'text-emerald-400' },
  active: { label: 'Live', color: 'text-onair' },
  cut: { label: 'Cut', color: 'text-txt-muted' },
  pending: { label: 'Pending', color: 'text-txt-secondary' },
  upcoming: { label: 'Upcoming', color: 'text-txt-secondary' },
}

/** Categorize a show as Completed, In Progress, or Abandoned for the diary view */
function getShowStatus(show: ShowHistoryEntry): { label: string; color: string } {
  // Has a verdict → completed show
  if (show.verdict) {
    return VERDICT_LABELS[show.verdict] ?? { label: 'Complete', color: 'text-emerald-400' }
  }
  // Strike phase without verdict → still complete
  if (show.phase === 'strike') {
    return { label: 'Complete', color: 'text-emerald-400' }
  }
  // Active phases → show in progress
  if (show.phase === 'live' || show.phase === 'intermission' || show.phase === 'director') {
    return { label: 'In Progress', color: 'text-onair' }
  }
  // Past-date shows that never went live → abandoned
  const today = localToday()
  if (show.showId < today && (show.phase === 'writers_room' || show.phase === 'no_show')) {
    return { label: 'Never Aired', color: 'text-txt-muted' }
  }
  // Today's show in planning
  if (show.phase === 'writers_room') {
    return { label: 'Planning', color: 'text-txt-secondary' }
  }
  return { label: 'No Show', color: 'text-txt-muted' }
}

function formatShowDate(dateId: string): string {
  const d = new Date(dateId + 'T12:00:00')
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function formatDuration(ms: number): string {
  const mins = Math.round(ms / 60000)
  if (mins < 60) return `${mins}m`
  return `${Math.floor(mins / 60)}h ${mins % 60}m`
}

import { springGentle as springTransition } from '../constants/animations'

/** Scrollable list of past shows with expandable detail rows for acts and plan text. */
export function HistoryView({ onBack }: HistoryViewProps) {
  const [history, setHistory] = useState<ShowHistoryEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ShowDetailEntry | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    window.showtime.getShowHistory(30).then((entries) => {
      setHistory(Array.isArray(entries) ? entries : [])
      setLoading(false)
    }).catch((err) => {
      console.error('[HistoryView] Failed to load show history:', err)
      setError('Failed to load show history')
      setLoading(false)
    })
  }, [])

  const toggleExpand = useCallback((showId: string) => {
    if (expandedId === showId) {
      setExpandedId(null)
      setDetail(null)
      return
    }
    setExpandedId(showId)
    setDetailLoading(true)
    window.showtime.getShowDetail(showId).then((d) => {
      setDetail(d)
      setDetailLoading(false)
    }).catch(() => setDetailLoading(false))
  }, [expandedId])

  return (
    <motion.div
      className="w-full h-full bg-surface overflow-hidden flex flex-col"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={springTransition}
    >
      {/* Title bar */}
      <div className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428] drag-region">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted">
          PAST SHOWS
        </span>
        <Toolbar onBack={onBack} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {loading && (
          <p className="text-sm text-txt-muted text-center py-8">Loading...</p>
        )}

        {!loading && error && (
          <p className="text-sm text-onair text-center py-8">
            {error}
          </p>
        )}

        {!loading && !error && history.length === 0 && (
          <p className="text-sm text-txt-muted text-center py-8">
            No past shows yet. Your history will appear here after your first show.
          </p>
        )}

        {!loading && !error && history.map((show, i) => {
          const statusInfo = getShowStatus(show)
          const isExpanded = expandedId === show.showId
          return (
            <div key={show.showId}>
              <motion.button
                data-testid={`show-entry-${show.showId}`}
                className="w-full flex items-center gap-3 py-3 border-b border-[#242428] last:border-b-0 hover:bg-surface-hover/50 transition-colors rounded px-1 -mx-1 text-left"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...springTransition, delay: i * 0.03 }}
                onClick={() => toggleExpand(show.showId)}
              >
                {/* Expand indicator */}
                <span className={cn('text-txt-muted text-xs transition-transform', isExpanded && 'rotate-90')}>
                  ▶
                </span>

                {/* Date */}
                <div className="w-[100px] shrink-0">
                  <p className="font-body text-sm text-txt-primary font-medium">
                    {formatShowDate(show.showId)}
                  </p>
                </div>

                {/* Status badge */}
                <div className="w-[90px] shrink-0">
                  <span className={cn('font-mono text-[10px] font-bold uppercase tracking-wider', statusInfo.color)}>
                    {statusInfo.label}
                  </span>
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
              </motion.button>

              {/* Expanded detail */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={springTransition}
                    className="overflow-hidden"
                  >
                    <div data-testid={`show-detail-${show.showId}`} className="pl-8 pr-2 py-3 border-b border-[#242428]">
                      {detailLoading && (
                        <p className="text-xs text-txt-muted">Loading detail...</p>
                      )}

                      {!detailLoading && detail && (
                        <div className="space-y-3">
                          {/* Plan text */}
                          {detail.planText && (
                            <div>
                              <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-txt-muted">
                                PLAN
                              </span>
                              <p className="text-xs text-txt-secondary mt-1 whitespace-pre-wrap line-clamp-4">
                                {detail.planText}
                              </p>
                            </div>
                          )}

                          {/* Acts detail */}
                          {detail.acts.length > 0 && (
                            <div>
                              <span className="font-mono text-[9px] tracking-[0.12em] uppercase text-txt-muted">
                                ACTS
                              </span>
                              <div className="mt-1 space-y-1">
                                {detail.acts.map((act: ActSnapshot) => {
                                  const statusInfo = STATUS_LABELS[act.status] ?? { label: act.status, color: 'text-txt-muted' }
                                  const planned = formatDuration(act.plannedDurationMs)
                                  const actual = act.actualDurationMs != null ? formatDuration(act.actualDurationMs) : null
                                  const drifted = actual && actual !== planned

                                  return (
                                    <div key={act.id} data-testid={`act-row-${act.status}`} className="flex items-center gap-2 text-xs">
                                      <span className={cn('font-mono text-[9px] w-[42px] shrink-0 uppercase', statusInfo.color)}>
                                        {statusInfo.label}
                                      </span>
                                      <span className="text-txt-primary flex-1 truncate">
                                        {act.name}
                                      </span>
                                      <span className="text-txt-muted shrink-0">
                                        {planned}
                                        {drifted && (
                                          <span data-testid="drift-indicator" className="text-accent ml-1">→ {actual}</span>
                                        )}
                                      </span>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!detailLoading && !detail && (
                        <p className="text-xs text-txt-muted">No detail available.</p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )
        })}
      </div>

    </motion.div>
  )
}
