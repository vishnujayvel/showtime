import { useState, useRef, useEffect } from 'react'
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
  onUpdateName?: (name: string) => void
  onUpdateDuration?: (minutes: number) => void
  timeLabel?: string
  timeDrifted?: boolean
  plannedTimeLabel?: string
  /** Whether this act is pinned to a fixed calendar time */
  pinned?: boolean
}

function FullActCard({ act, actNumber, onReorder, onRemove, onUpdateName, onUpdateDuration, pinned }: Omit<ActCardProps, 'variant'>) {
  const categoryClasses = getCategoryClasses(act.sketch)
  const [editingName, setEditingName] = useState(false)
  const [editingDuration, setEditingDuration] = useState(false)
  const [nameValue, setNameValue] = useState(act.name)
  const [durationValue, setDurationValue] = useState(String(act.durationMinutes))
  const nameInputRef = useRef<HTMLInputElement>(null)
  const durationInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { setNameValue(act.name) }, [act.name])
  useEffect(() => { setDurationValue(String(act.durationMinutes)) }, [act.durationMinutes])
  useEffect(() => { if (editingName) nameInputRef.current?.focus() }, [editingName])
  useEffect(() => { if (editingDuration) durationInputRef.current?.focus() }, [editingDuration])

  const commitName = () => {
    setEditingName(false)
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== act.name && onUpdateName) {
      onUpdateName(trimmed)
    } else {
      setNameValue(act.name)
    }
  }

  const commitDuration = () => {
    setEditingDuration(false)
    const parsed = parseInt(durationValue, 10)
    if (!isNaN(parsed) && parsed > 0 && onUpdateDuration) {
      const clamped = Math.max(5, Math.min(240, parsed))
      if (clamped !== act.durationMinutes) {
        onUpdateDuration(clamped)
      } else {
        setDurationValue(String(act.durationMinutes))
      }
    } else {
      setDurationValue(String(act.durationMinutes))
    }
  }

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-hover/50 border border-card-border">
      {/* Category stripe */}
      <div className={cn('w-1 h-10 rounded-full', categoryClasses.bg)} />

      {/* Middle content */}
      <div className="flex-1 min-w-0">
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => { if (e.key === 'Enter') commitName(); if (e.key === 'Escape') { setNameValue(act.name); setEditingName(false) } }}
            className="w-full bg-transparent border-b border-accent/50 text-sm text-txt-primary font-medium outline-none"
            aria-label="Act name"
            data-testid="act-name-input"
          />
        ) : (
          <div
            className={cn('font-medium text-sm text-txt-primary truncate', onUpdateName && 'cursor-text hover:text-accent')}
            onClick={() => onUpdateName && setEditingName(true)}
            data-testid="act-name"
          >
            {pinned && <span className="text-txt-muted mr-1" title="Pinned to calendar time">&#128204;</span>}
            {act.name}
          </div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          <ClapperboardBadge sketch={act.sketch} actNumber={actNumber} size="sm" />
          {editingDuration ? (
            <div className="flex items-center gap-1">
              <input
                ref={durationInputRef}
                value={durationValue}
                onChange={(e) => setDurationValue(e.target.value)}
                onBlur={commitDuration}
                onKeyDown={(e) => { if (e.key === 'Enter') commitDuration(); if (e.key === 'Escape') { setDurationValue(String(act.durationMinutes)); setEditingDuration(false) } }}
                className="w-10 bg-transparent border-b border-accent/50 text-xs text-txt-muted outline-none text-center"
                aria-label="Act duration in minutes"
                data-testid="act-duration-input"
              />
              <span className="text-xs text-txt-muted">m</span>
            </div>
          ) : (
            <span
              className={cn('text-xs text-txt-muted', onUpdateDuration && 'cursor-text hover:text-accent')}
              onClick={() => onUpdateDuration && setEditingDuration(true)}
              data-testid="act-duration"
            >
              {act.durationMinutes}m
            </span>
          )}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {onUpdateDuration && (
          <div className="flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => onUpdateDuration(Math.min(act.durationMinutes + 5, 240))}
              className="text-txt-muted hover:text-txt-secondary text-[10px] leading-none p-0.5"
              title="Add 5 minutes"
              aria-label="Increase duration"
            >
              +5
            </button>
            <button
              type="button"
              onClick={() => onUpdateDuration(Math.max(act.durationMinutes - 5, 5))}
              className="text-txt-muted hover:text-txt-secondary text-[10px] leading-none p-0.5"
              title="Remove 5 minutes"
              aria-label="Decrease duration"
            >
              -5
            </button>
          </div>
        )}
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

export function ActCard({ act, variant, actNumber, onReorder, onRemove, onUpdateName, onUpdateDuration, timeLabel, timeDrifted, plannedTimeLabel, pinned }: ActCardProps) {
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
      onUpdateName={onUpdateName}
      onUpdateDuration={onUpdateDuration}
      pinned={pinned}
    />
  )
}
