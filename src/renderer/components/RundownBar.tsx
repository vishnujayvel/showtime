import { useState, useEffect, useCallback, useMemo } from 'react'
import { motion } from 'framer-motion'
import { useShowStore, selectCurrentAct } from '../stores/showStore'
import { getCategoryClasses } from '../lib/category-colors'
import type { Act } from '../../shared/types'

interface RundownBarProps {
  variant?: 'full' | 'compact'
}

/** Map act status to the Rundown Bar status model */
function actBarStatus(act: Act, currentActId: string | null): 'completed' | 'active' | 'upcoming' {
  if (act.status === 'completed' || act.status === 'skipped') return 'completed'
  if (act.id === currentActId) return 'active'
  return 'upcoming'
}

function formatDriftBadge(currentActIndex: number, totalActs: number, driftSeconds: number): string {
  const actNum = currentActIndex + 1
  const absDrift = Math.abs(Math.round(driftSeconds / 60))
  if (driftSeconds === 0 || absDrift === 0) return `Act ${actNum} of ${totalActs} \u2014 on schedule`
  if (driftSeconds > 0) return `Act ${actNum} of ${totalActs} \u2014 ${absDrift}m behind schedule`
  return `Act ${actNum} of ${totalActs} \u2014 ${absDrift}m ahead of schedule`
}

export function RundownBar({ variant = 'full' }: RundownBarProps) {
  const phase = useShowStore((s) => s.phase)
  const acts = useShowStore((s) => s.acts)
  const currentActId = useShowStore((s) => s.currentActId)
  const currentAct = useShowStore(selectCurrentAct)
  const showStartedAt = useShowStore((s) => s.showStartedAt)
  const showDate = useShowStore((s) => s.showDate)

  const [driftSeconds, setDriftSeconds] = useState(0)
  const [nowPercent, setNowPercent] = useState(0)

  const isVisible = (phase === 'live' || phase === 'intermission' || phase === 'director' || phase === 'strike') && acts.length > 0

  const sortedActs = useMemo(
    () => [...acts].sort((a, b) => a.order - b.order),
    [acts],
  )
  const totalPlannedMs = useMemo(
    () => sortedActs.reduce((sum, a) => sum + a.durationMinutes * 60 * 1000, 0),
    [sortedActs],
  )
  const currentActIndex = sortedActs.findIndex((a) => a.id === currentActId)

  // Fetch drift on act lifecycle changes
  const fetchDrift = useCallback(async () => {
    if (!isVisible) return
    try {
      const d = await window.clui.getTimelineDrift(showDate)
      setDriftSeconds(d)
    } catch { /* ignore */ }
  }, [showDate, isVisible])

  useEffect(() => {
    fetchDrift()
  }, [fetchDrift, currentActId, acts.length])

  // Update NOW marker position on a 1-second interval
  useEffect(() => {
    if (!showStartedAt || phase === 'strike' || !isVisible || totalPlannedMs === 0) return
    const update = () => {
      const elapsed = Date.now() - showStartedAt
      const pct = Math.min(100, (elapsed / totalPlannedMs) * 100)
      setNowPercent(pct)
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [showStartedAt, totalPlannedMs, phase, isVisible])

  // All hooks above — conditional returns below
  if (!isVisible || totalPlannedMs === 0) return null

  return (
    <div className={variant === 'full' ? 'px-4 my-2' : ''} data-testid="rundown-bar">
      {/* Bar container */}
      <div className="relative h-7 rounded-lg border border-surface-hover overflow-hidden flex">
        {sortedActs.map((act) => {
          const widthPercent = (act.durationMinutes * 60 * 1000 / totalPlannedMs) * 100
          const barStatus = actBarStatus(act, currentActId)
          const catClasses = getCategoryClasses(act.sketch)

          // Compute overrun for completed acts
          let overrunPercent = 0
          if (barStatus === 'completed' && act.startedAt && act.completedAt) {
            const actualMs = act.completedAt - act.startedAt
            const plannedMs = act.durationMinutes * 60 * 1000
            if (actualMs > plannedMs) {
              overrunPercent = ((actualMs - plannedMs) / actualMs) * 100
            }
          }

          // Active act progress
          let progressPercent = 0
          if (barStatus === 'active' && act.startedAt) {
            const elapsed = Date.now() - act.startedAt
            const plannedMs = act.durationMinutes * 60 * 1000
            progressPercent = Math.min(100, (elapsed / plannedMs) * 100)
          }

          return (
            <div
              key={act.id}
              className={`relative h-full ${barStatus === 'upcoming' ? 'opacity-40' : ''} ${
                barStatus === 'active' ? 'onair-glow' : ''
              }`}
              style={{ width: `${widthPercent}%` }}
            >
              {/* Base color fill */}
              <div className={`absolute inset-0 ${catClasses.bg} ${
                barStatus === 'completed' ? 'opacity-80' : 'opacity-30'
              }`} />

              {/* Active act progress fill */}
              {barStatus === 'active' && (
                <motion.div
                  className={`absolute inset-y-0 left-0 ${catClasses.bg} opacity-80`}
                  initial={{ width: '0%' }}
                  animate={{ width: `${progressPercent}%` }}
                  transition={{ type: 'spring', stiffness: 400, damping: 40 }}
                />
              )}

              {/* Overrun hatching for completed acts */}
              {barStatus === 'completed' && overrunPercent > 0 && (
                <div
                  className="absolute inset-y-0 right-0 overrun-hatching"
                  style={{ width: `${overrunPercent}%` }}
                />
              )}

              {/* Separator line */}
              <div className="absolute right-0 top-0 bottom-0 w-px bg-studio-bg/50" />
            </div>
          )
        })}

        {/* NOW marker */}
        {phase !== 'strike' && (
          <motion.div
            className="absolute top-0 bottom-0 w-0.5 bg-onair shadow-sm z-10"
            style={{ left: `${nowPercent}%` }}
            layout
            transition={{ type: 'spring', stiffness: 400, damping: 40 }}
          />
        )}
      </div>

      {/* Drift status badge */}
      {variant === 'full' && (
        <p className="font-mono text-xs text-txt-secondary mt-1.5 text-center">
          {formatDriftBadge(
            currentActIndex >= 0 ? currentActIndex : sortedActs.length - 1,
            sortedActs.filter((a) => a.status !== 'skipped').length,
            driftSeconds,
          )}
        </p>
      )}
    </div>
  )
}
