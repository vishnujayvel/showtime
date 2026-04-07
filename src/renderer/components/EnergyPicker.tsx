/**
 * EnergyPicker — dropdown chip for selecting the day's energy level.
 *
 * Extracted from WritersRoomView to keep the composition root focused on layout.
 * Renders a compact chip showing current energy with an animated dropdown on click.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'
import { springDefault as springTransition } from '../constants/animations'
import type { EnergyLevel } from '../../shared/types'

const ENERGY_OPTIONS: { level: EnergyLevel; emoji: string; label: string }[] = [
  { level: 'high', emoji: '⚡', label: 'High' },
  { level: 'medium', emoji: '☀️', label: 'Medium' },
  { level: 'low', emoji: '🌙', label: 'Low' },
  { level: 'recovery', emoji: '🛋️', label: 'Recovery' },
]

interface EnergyPickerProps {
  energy: EnergyLevel | null
  open: boolean
  onToggle: () => void
  onSelect: (level: EnergyLevel) => void
}

export function EnergyPicker({ energy, open, onToggle, onSelect }: EnergyPickerProps) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-hover/60 border border-card-border text-xs text-txt-secondary hover:text-txt-primary transition-colors"
        data-testid="energy-chip"
      >
        <span>{ENERGY_OPTIONS.find((o) => o.level === energy)?.emoji ?? '☀️'}</span>
        <span className="font-mono uppercase tracking-wider text-[10px]">
          {energy ?? 'medium'}
        </span>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={springTransition}
            className="absolute z-20 top-full right-0 mt-1 bg-surface border border-card-border rounded-lg shadow-lg py-1 min-w-[120px]"
          >
            {ENERGY_OPTIONS.map((opt) => (
              <button
                key={opt.level}
                onClick={() => onSelect(opt.level)}
                className={cn(
                  'w-full text-left px-3 py-1.5 text-xs flex items-center gap-2 hover:bg-surface-hover transition-colors',
                  energy === opt.level && 'bg-surface-hover',
                )}
              >
                <span>{opt.emoji}</span>
                <span className="text-txt-primary">{opt.label}</span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export { ENERGY_OPTIONS }
