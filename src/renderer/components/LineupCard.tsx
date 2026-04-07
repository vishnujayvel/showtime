import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getCategoryClasses, SKETCH_CATEGORIES, type SketchCategory } from '../lib/category-colors'
import { cn } from '../lib/utils'
import type { ShowLineup } from '../../shared/types'

import { springDefault as springTransition } from '../constants/animations'

interface LineupAct {
  name: string
  sketch: string
  durationMinutes: number
  reason?: string
}

interface LineupCardProps {
  lineup: ShowLineup
  onEdit: (updated: ShowLineup) => void
}

function CategoryPicker({
  current,
  onSelect,
  onClose,
}: {
  current: string
  onSelect: (cat: SketchCategory) => void
  onClose: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={springTransition}
      className="absolute z-10 top-full left-0 mt-1 bg-surface border border-card-border rounded-lg shadow-lg py-1 min-w-[140px]"
    >
      {SKETCH_CATEGORIES.map((cat) => {
        const classes = getCategoryClasses(cat)
        return (
          <button
            key={cat}
            onClick={() => {
              onSelect(cat)
              onClose()
            }}
            className={cn(
              'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-surface-hover transition-colors',
              current === cat && 'bg-surface-hover',
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', classes.bg)} />
            <span className="text-txt-primary">{cat}</span>
          </button>
        )
      })}
    </motion.div>
  )
}

function ActRow({
  act,
  index,
  onUpdate,
  onRemove,
}: {
  act: LineupAct
  index: number
  onUpdate: (updated: LineupAct) => void
  onRemove: () => void
}) {
  const [editingName, setEditingName] = useState(false)
  const [editingDuration, setEditingDuration] = useState(false)
  const [categoryOpen, setCategoryOpen] = useState(false)
  const [nameValue, setNameValue] = useState(act.name)
  const [durationValue, setDurationValue] = useState(String(act.durationMinutes))
  const nameInputRef = useRef<HTMLInputElement>(null)
  const durationInputRef = useRef<HTMLInputElement>(null)

  const categoryClasses = getCategoryClasses(act.sketch)

  useEffect(() => {
    if (editingName) nameInputRef.current?.focus()
  }, [editingName])

  useEffect(() => {
    if (editingDuration) durationInputRef.current?.focus()
  }, [editingDuration])

  const commitName = () => {
    setEditingName(false)
    const trimmed = nameValue.trim()
    if (trimmed && trimmed !== act.name) {
      onUpdate({ ...act, name: trimmed })
    } else {
      setNameValue(act.name)
    }
  }

  const commitDuration = () => {
    setEditingDuration(false)
    const num = parseInt(durationValue)
    if (num > 0 && num !== act.durationMinutes) {
      onUpdate({ ...act, durationMinutes: num })
    } else {
      setDurationValue(String(act.durationMinutes))
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...springTransition, delay: index * 0.04 }}
      className="group flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface-hover/40 transition-colors"
      data-testid={`lineup-act-${index}`}
    >
      {/* Act number */}
      <span className="font-mono text-xs text-txt-muted w-5 text-right shrink-0">
        {index + 1}
      </span>

      {/* Category badge — clickable */}
      <div className="relative shrink-0">
        <button
          onClick={() => setCategoryOpen(!categoryOpen)}
          className={cn(
            'px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider border',
            categoryClasses.text,
            categoryClasses.bgTint,
            categoryClasses.borderTint,
            'hover:opacity-80 transition-opacity',
          )}
          data-testid={`act-category-${index}`}
        >
          {act.sketch}
        </button>
        <AnimatePresence>
          {categoryOpen && (
            <CategoryPicker
              current={act.sketch}
              onSelect={(cat) => onUpdate({ ...act, sketch: cat })}
              onClose={() => setCategoryOpen(false)}
            />
          )}
        </AnimatePresence>
      </div>

      {/* Name — click to edit */}
      <div className="flex-1 min-w-0">
        {editingName ? (
          <input
            ref={nameInputRef}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitName()
              if (e.key === 'Escape') {
                setNameValue(act.name)
                setEditingName(false)
              }
            }}
            className="w-full bg-transparent text-sm text-txt-primary outline-none border-b border-accent/40 pb-0.5"
            data-testid={`act-name-input-${index}`}
          />
        ) : (
          <button
            onClick={() => setEditingName(true)}
            className="text-sm text-txt-primary truncate block text-left w-full hover:text-accent transition-colors"
            data-testid={`act-name-${index}`}
          >
            {act.name}
          </button>
        )}
      </div>

      {/* Duration — click to edit */}
      {editingDuration ? (
        <div className="flex items-center gap-0.5 shrink-0">
          <input
            ref={durationInputRef}
            type="number"
            min="1"
            max="480"
            value={durationValue}
            onChange={(e) => setDurationValue(e.target.value)}
            onBlur={commitDuration}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitDuration()
              if (e.key === 'Escape') {
                setDurationValue(String(act.durationMinutes))
                setEditingDuration(false)
              }
            }}
            className="w-10 bg-transparent text-xs text-txt-primary font-mono text-right outline-none border-b border-accent/40 pb-0.5"
            data-testid={`act-duration-input-${index}`}
          />
          <span className="text-xs text-txt-muted font-mono">m</span>
        </div>
      ) : (
        <button
          onClick={() => setEditingDuration(true)}
          className="text-xs text-txt-muted font-mono hover:text-accent transition-colors shrink-0"
          data-testid={`act-duration-${index}`}
        >
          {act.durationMinutes}m
        </button>
      )}

      {/* Remove button (visible on hover) */}
      <button
        onClick={onRemove}
        className="text-txt-muted hover:text-onair text-sm opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
        data-testid={`act-remove-${index}`}
      >
        ×
      </button>
    </motion.div>
  )
}

/** Editable draft lineup card displaying all acts with inline name, duration, and category editing. */
export function LineupCard({ lineup, onEdit }: LineupCardProps) {
  const totalMinutes = lineup.acts.reduce((sum, a) => sum + a.durationMinutes, 0)
  const hours = Math.floor(totalMinutes / 60)
  const mins = totalMinutes % 60

  const handleActUpdate = (index: number, updated: LineupAct) => {
    const newActs = [...lineup.acts]
    newActs[index] = updated
    onEdit({ ...lineup, acts: newActs })
  }

  const handleActRemove = (index: number) => {
    const newActs = lineup.acts.filter((_, i) => i !== index)
    onEdit({ ...lineup, acts: newActs })
  }

  const handleAddAct = () => {
    onEdit({
      ...lineup,
      acts: [...lineup.acts, { name: 'New Act', sketch: 'Admin', durationMinutes: 30 }],
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className="rounded-xl border border-card-border bg-surface overflow-hidden my-2"
      data-testid="lineup-card"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-card-border">
        <div className="flex items-center gap-2">
          <span className="font-mono text-[10px] tracking-[0.15em] uppercase text-txt-muted">
            TODAY&apos;S LINEUP
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono uppercase tracking-wider bg-accent/10 text-accent border border-accent/20">
            DRAFT
          </span>
        </div>
        <span className="text-xs text-txt-muted font-mono">
          {hours > 0 ? `${hours}h ${mins}m` : `${mins}m`} &middot; {lineup.acts.length} acts
        </span>
      </div>

      {/* Opening note */}
      {lineup.openingNote && (
        <div className="px-4 py-2.5 border-b border-card-border/50">
          <p className="text-xs text-txt-secondary italic">{lineup.openingNote}</p>
        </div>
      )}

      {/* Act rows */}
      <div className="py-1">
        {lineup.acts.map((act, i) => (
          <ActRow
            key={`${act.name}-${i}`}
            act={act}
            index={i}
            onUpdate={(updated) => handleActUpdate(i, updated)}
            onRemove={() => handleActRemove(i)}
          />
        ))}
      </div>

      {/* Add Act button */}
      <div className="px-4 pb-3">
        <button
          onClick={handleAddAct}
          className="w-full py-2 rounded-lg border border-dashed border-card-border text-xs text-txt-muted hover:text-accent hover:border-accent/30 transition-colors"
          data-testid="lineup-add-act"
        >
          ＋ Add Act
        </button>
      </div>
    </motion.div>
  )
}
