import { useState } from 'react'
import { useShowStore } from '../stores/showStore'
import { ActCard } from '../components/ActCard'
import { motion } from 'framer-motion'
import type { Act } from '../../shared/types'

interface LineupPanelProps {
  variant: 'full' | 'sidebar'
}

function formatTime(ms: number): string {
  const d = new Date(ms)
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
}

/** Compute projected start/end times for each act based on show start and cumulative durations. */
function computeProjectedTimes(acts: Act[], showStartedAt: number | null) {
  if (!showStartedAt) return new Map<string, { start: number; end: number; planned: number; plannedEnd: number }>()
  const map = new Map<string, { start: number; end: number; planned: number; plannedEnd: number }>()

  let cursor = showStartedAt
  let plannedCursor = showStartedAt

  for (const act of acts) {
    const plannedMs = act.durationMinutes * 60 * 1000
    const plannedStart = plannedCursor
    const plannedEnd = plannedCursor + plannedMs

    if (act.status === 'completed' || act.status === 'skipped') {
      const actualMs = act.startedAt && act.completedAt ? act.completedAt - act.startedAt : plannedMs
      map.set(act.id, {
        start: act.startedAt ?? cursor,
        end: act.completedAt ?? cursor + actualMs,
        planned: plannedStart,
        plannedEnd,
      })
      cursor = act.completedAt ?? cursor + actualMs
    } else if (act.status === 'active') {
      map.set(act.id, {
        start: act.startedAt ?? cursor,
        end: cursor + plannedMs,
        planned: plannedStart,
        plannedEnd,
      })
      cursor = (act.startedAt ?? cursor) + plannedMs
    } else {
      map.set(act.id, {
        start: cursor,
        end: cursor + plannedMs,
        planned: plannedStart,
        plannedEnd,
      })
      cursor += plannedMs
    }
    plannedCursor += plannedMs
  }
  return map
}

function FullLineupPanel() {
  const acts = useShowStore((s) => s.acts)
  const reorderAct = useShowStore((s) => s.reorderAct)
  const removeAct = useShowStore((s) => s.removeAct)

  const sorted = [...acts].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((act, index) => (
        <motion.div
          key={act.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            delay: index * 0.06,
          }}
        >
          <ActCard
            act={act}
            variant="full"
            actNumber={index + 1}
            onReorder={(direction) => reorderAct(act.id, direction)}
            onRemove={() => removeAct(act.id)}
          />
        </motion.div>
      ))}
    </div>
  )
}

function SidebarLineupPanel() {
  const acts = useShowStore((s) => s.acts)
  const phase = useShowStore((s) => s.phase)
  const showStartedAt = useShowStore((s) => s.showStartedAt)
  const reorderAct = useShowStore((s) => s.reorderAct)
  const removeAct = useShowStore((s) => s.removeAct)
  const addAct = useShowStore((s) => s.addAct)

  const [encoreOpen, setEncoreOpen] = useState(false)
  const [encoreName, setEncoreName] = useState('')
  const [encoreSketch, setEncoreSketch] = useState('')
  const [encoreDuration, setEncoreDuration] = useState('15')

  const sorted = [...acts].sort((a, b) => a.order - b.order)
  const projectedTimes = computeProjectedTimes(sorted, showStartedAt)
  const isLive = phase === 'live' || phase === 'intermission'

  const handleEncoreSubmit = () => {
    if (!encoreName.trim()) return
    addAct(encoreName.trim(), encoreSketch.trim() || encoreName.trim(), parseInt(encoreDuration) || 15)
    setEncoreName('')
    setEncoreSketch('')
    setEncoreDuration('15')
    setEncoreOpen(false)
  }

  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted mb-2">
        TONIGHT&apos;S LINEUP
      </span>
      {sorted.map((act, index) => {
        const times = projectedTimes.get(act.id)
        const canReorder = isLive && act.status === 'upcoming'
        const canRemove = isLive && act.status === 'upcoming'

        // Check if projected time differs from planned
        let timeLabel: string | undefined
        let drifted = false
        if (times && showStartedAt) {
          const startStr = formatTime(times.start)
          const endStr = formatTime(times.end)
          timeLabel = `${startStr} \u2014 ${endStr}`
          // Compare projected start vs planned start (> 2 min drift)
          if (Math.abs(times.start - times.planned) > 120000) {
            drifted = true
          }
        }

        return (
          <ActCard
            key={act.id}
            act={act}
            variant="sidebar"
            actNumber={index + 1}
            timeLabel={timeLabel}
            timeDrifted={drifted}
            plannedTimeLabel={drifted && times ? formatTime(times.planned) : undefined}
            onReorder={canReorder ? (direction) => reorderAct(act.id, direction) : undefined}
            onRemove={canRemove ? () => removeAct(act.id) : undefined}
          />
        )
      })}

      {/* Encore button */}
      {isLive && !encoreOpen && (
        <button
          onClick={() => setEncoreOpen(true)}
          className="mt-2 px-2 py-1 text-xs text-txt-muted hover:text-accent transition-colors text-left"
        >
          + Encore
        </button>
      )}

      {/* Encore form */}
      {encoreOpen && (
        <div className="mt-2 flex flex-col gap-1.5 p-2 rounded-md bg-surface-hover/50 border border-card-border">
          <input
            type="text"
            placeholder="Act name"
            value={encoreName}
            onChange={(e) => setEncoreName(e.target.value)}
            className="bg-transparent text-xs text-txt-primary placeholder:text-txt-muted outline-none px-1 py-0.5 border-b border-surface-hover"
            autoFocus
          />
          <input
            type="text"
            placeholder="Category (optional)"
            value={encoreSketch}
            onChange={(e) => setEncoreSketch(e.target.value)}
            className="bg-transparent text-xs text-txt-primary placeholder:text-txt-muted outline-none px-1 py-0.5 border-b border-surface-hover"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              min="1"
              max="120"
              value={encoreDuration}
              onChange={(e) => setEncoreDuration(e.target.value)}
              className="bg-transparent text-xs text-txt-primary outline-none px-1 py-0.5 w-12 border-b border-surface-hover"
            />
            <span className="text-xs text-txt-muted">min</span>
            <div className="flex-1" />
            <button
              onClick={handleEncoreSubmit}
              className="text-xs text-accent hover:text-accent-dark transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => setEncoreOpen(false)}
              className="text-xs text-txt-muted hover:text-txt-secondary transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export function LineupPanel({ variant }: LineupPanelProps) {
  if (variant === 'sidebar') {
    return <SidebarLineupPanel />
  }

  return <FullLineupPanel />
}
