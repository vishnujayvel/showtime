import type { Act } from '../../shared/types'
import { cn } from '../lib/utils'
import { ClapperboardBadge } from './ClapperboardBadge'
import { getCategoryClasses } from '../lib/category-colors'

interface ActCardProps {
  act: Act
  variant: 'full' | 'sidebar'
  actNumber: number
  onReorder?: (direction: 'up' | 'down') => void
  onRemove?: () => void
  timeLabel?: string
  timeDrifted?: boolean
  plannedTimeLabel?: string
  /** Whether this act is pinned to a fixed calendar time */
  pinned?: boolean
}

function FullActCard({ act, actNumber, onReorder, onRemove, pinned }: Omit<ActCardProps, 'variant'>) {
  const categoryClasses = getCategoryClasses(act.sketch)

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover/50 border border-card-border">
      {/* Category stripe */}
      <div className={cn('w-1 h-10 rounded-full', categoryClasses.bg)} />

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-txt-primary truncate">
          {pinned && <span className="text-txt-muted mr-1" title="Pinned to calendar time">&#128204;</span>}
          {act.name}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <ClapperboardBadge sketch={act.sketch} actNumber={actNumber} size="sm" />
          <span className="text-xs text-txt-muted">{act.durationMinutes}m</span>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {onReorder && (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onReorder('up')}
              className="text-txt-muted hover:text-txt-secondary text-xs leading-none p-0.5"
            >
              ↑
            </button>
            <button
              type="button"
              onClick={() => onReorder('down')}
              className="text-txt-muted hover:text-txt-secondary text-xs leading-none p-0.5"
            >
              ↓
            </button>
          </div>
        )}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-txt-muted hover:text-onair text-sm leading-none p-0.5 ml-1"
          >
            ×
          </button>
        )}
      </div>
    </div>
  )
}

function SidebarActCard({ act, timeLabel, timeDrifted, plannedTimeLabel, onReorder, onRemove, pinned }: Omit<ActCardProps, 'variant'>) {
  const statusDotClass = (() => {
    switch (act.status) {
      case 'active':
        return 'w-1.5 h-1.5 rounded-full bg-onair animate-tally-pulse'
      case 'completed':
        return act.beatLocked
          ? 'w-1.5 h-1.5 rounded-full bg-beat'
          : 'w-1.5 h-1.5 rounded-full bg-emerald-500'
      case 'skipped':
        return 'w-1.5 h-1.5 rounded-full bg-txt-muted'
      default:
        return 'w-1.5 h-1.5 rounded-full bg-surface-hover'
    }
  })()

  const nameClass = (() => {
    switch (act.status) {
      case 'active':
        return 'text-txt-primary font-medium'
      case 'completed':
        return 'text-txt-secondary'
      case 'skipped':
        return 'text-txt-muted line-through'
      default:
        return 'text-txt-muted'
    }
  })()

  return (
    <div className="group flex items-center gap-2 px-2 py-1.5 rounded-md text-xs hover:bg-surface-hover/30 transition-colors">
      {/* Status dot */}
      <div className={statusDotClass} />

      {/* Act info */}
      <div className="flex-1 min-w-0">
        <span className={cn('truncate block', nameClass)}>
          {pinned && <span className="text-txt-muted mr-0.5" title="Pinned to calendar time">&#128204;</span>}
          {act.name}
        </span>
        {/* Projected time display */}
        {timeLabel && (
          <span className="block mt-0.5">
            {timeDrifted && plannedTimeLabel && (
              <span className="line-through text-txt-muted mr-1">{plannedTimeLabel}</span>
            )}
            <span className={timeDrifted ? 'text-txt-secondary' : 'text-txt-muted'}>
              {timeLabel}
            </span>
          </span>
        )}
      </div>

      {/* Beat star */}
      {act.beatLocked && (
        <span className="text-beat text-xs">★</span>
      )}

      {/* Reorder / Remove (visible on hover for upcoming acts) */}
      {(onReorder || onRemove) && (
        <div className="hidden group-hover:flex items-center gap-0.5">
          {onReorder && (
            <>
              <button onClick={() => onReorder('up')} className="text-txt-muted hover:text-txt-secondary text-xs p-0.5">↑</button>
              <button onClick={() => onReorder('down')} className="text-txt-muted hover:text-txt-secondary text-xs p-0.5">↓</button>
            </>
          )}
          {onRemove && (
            <button onClick={onRemove} className="text-txt-muted hover:text-onair text-xs p-0.5">×</button>
          )}
        </div>
      )}
    </div>
  )
}

export function ActCard({ act, variant, actNumber, onReorder, onRemove, timeLabel, timeDrifted, plannedTimeLabel, pinned }: ActCardProps) {
  if (variant === 'sidebar') {
    return (
      <SidebarActCard
        act={act}
        actNumber={actNumber}
        timeLabel={timeLabel}
        timeDrifted={timeDrifted}
        plannedTimeLabel={plannedTimeLabel}
        onReorder={onReorder}
        onRemove={onRemove}
        pinned={pinned}
      />
    )
  }

  return (
    <FullActCard
      act={act}
      actNumber={actNumber}
      onReorder={onReorder}
      onRemove={onRemove}
      pinned={pinned}
    />
  )
}
