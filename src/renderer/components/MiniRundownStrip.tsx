import { useState, useEffect, useMemo } from 'react'
import { useShowStore } from '../stores/showStore'
import { getCategoryClasses } from '../lib/category-colors'

export function MiniRundownStrip() {
  const phase = useShowStore((s) => s.phase)
  const acts = useShowStore((s) => s.acts)
  const currentActId = useShowStore((s) => s.currentActId)
  const showStartedAt = useShowStore((s) => s.showStartedAt)

  const [nowPercent, setNowPercent] = useState(0)

  const shouldRender = (phase === 'live' || phase === 'intermission') && acts.length > 0

  const sortedActs = useMemo(
    () => (shouldRender ? [...acts].sort((a, b) => a.order - b.order) : []),
    [acts, shouldRender],
  )
  const totalPlannedMs = useMemo(
    () => sortedActs.reduce((sum, a) => sum + a.durationMinutes * 60 * 1000, 0),
    [sortedActs],
  )

  // Update NOW marker position — hook must be called unconditionally
  useEffect(() => {
    if (!shouldRender || totalPlannedMs === 0 || !showStartedAt) return
    const update = () => {
      const elapsed = Date.now() - showStartedAt
      setNowPercent(Math.min(100, (elapsed / totalPlannedMs) * 100))
    }
    update()
    const interval = setInterval(update, 1000)
    return () => clearInterval(interval)
  }, [showStartedAt, totalPlannedMs, shouldRender])

  if (!shouldRender || totalPlannedMs === 0) return null

  return (
    <div className="mx-3 mb-1 relative h-1 flex rounded-full overflow-hidden">
      {sortedActs.map((act) => {
        const widthPercent = (act.durationMinutes * 60 * 1000 / totalPlannedMs) * 100
        const isActive = act.id === currentActId
        const isCompleted = act.status === 'completed' || act.status === 'skipped'
        const catClasses = getCategoryClasses(act.sketch)

        return (
          <div
            key={act.id}
            className={`h-full ${catClasses.bg} ${
              isCompleted ? 'opacity-80' : isActive ? 'opacity-80' : 'opacity-30'
            } ${isActive ? 'shadow-[0_0_4px_1px_currentColor]' : ''}`}
            style={{ width: `${widthPercent}%` }}
          />
        )
      })}

      {/* NOW marker: 1px wide, 6px tall, extends above and below */}
      <div
        className="absolute -top-px -bottom-px w-px bg-onair z-10"
        style={{ left: `${nowPercent}%` }}
      />
    </div>
  )
}
