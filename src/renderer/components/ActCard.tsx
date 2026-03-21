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
}

function FullActCard({ act, actNumber, onReorder, onRemove }: Omit<ActCardProps, 'variant'>) {
  const categoryClasses = getCategoryClasses(act.sketch)

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover/50 border border-card-border">
      {/* Category stripe */}
      <div className={cn('w-1 h-10 rounded-full', categoryClasses.bg)} />

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm text-txt-primary truncate">
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

function SidebarActCard({ act }: Omit<ActCardProps, 'variant' | 'onReorder' | 'onRemove'>) {
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
    <div className="flex items-center gap-2 px-2 py-1.5 rounded-md text-xs">
      {/* Status dot */}
      <div className={statusDotClass} />

      {/* Act name */}
      <span className={cn('truncate flex-1', nameClass)}>
        {act.name}
      </span>

      {/* Beat star */}
      {act.beatLocked && (
        <span className="text-beat text-xs">★</span>
      )}
    </div>
  )
}

export function ActCard({ act, variant, actNumber, onReorder, onRemove }: ActCardProps) {
  if (variant === 'sidebar') {
    return <SidebarActCard act={act} actNumber={actNumber} />
  }

  return (
    <FullActCard
      act={act}
      actNumber={actNumber}
      onReorder={onReorder}
      onRemove={onRemove}
    />
  )
}
