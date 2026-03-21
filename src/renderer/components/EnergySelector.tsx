import { motion } from 'framer-motion'
import type { EnergyLevel } from '../../shared/types'
import { cn } from '../lib/utils'

interface EnergySelectorProps {
  onSelect: (level: EnergyLevel) => void
}

const ENERGY_OPTIONS: Array<{
  level: EnergyLevel
  emoji: string
  label: string
  sublabel: string
  bg: string
  border: string
  hover: string
  labelColor: string
}> = [
  {
    level: 'high',
    emoji: '⚡',
    label: 'High Energy',
    sublabel: 'Ready to crush it',
    bg: 'bg-amber-500/5',
    border: 'border-amber-500/20',
    hover: 'hover:bg-amber-500/10',
    labelColor: 'text-amber-400',
  },
  {
    level: 'medium',
    emoji: '☀️',
    label: 'Medium Energy',
    sublabel: 'Solid and steady',
    bg: 'bg-emerald-500/5',
    border: 'border-emerald-500/20',
    hover: 'hover:bg-emerald-500/10',
    labelColor: 'text-emerald-400',
  },
  {
    level: 'low',
    emoji: '🌙',
    label: 'Low Energy',
    sublabel: 'Gentle & light',
    bg: 'bg-blue-500/5',
    border: 'border-blue-500/20',
    hover: 'hover:bg-blue-500/10',
    labelColor: 'text-blue-400',
  },
  {
    level: 'recovery',
    emoji: '🛌',
    label: 'Recovery Day',
    sublabel: 'Rest is the show',
    bg: 'bg-purple-500/5',
    border: 'border-purple-500/20',
    hover: 'hover:bg-purple-500/10',
    labelColor: 'text-purple-400',
  },
]

export function EnergySelector({ onSelect }: EnergySelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {ENERGY_OPTIONS.map(({ level, emoji, label, sublabel, bg, border, hover, labelColor }, index) => (
        <motion.div
          key={level}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30, delay: index * 0.08 }}
        >
          <button
            onClick={() => onSelect(level)}
            className={cn(
              'flex flex-col items-center gap-1.5 rounded-xl p-4 border transition-colors cursor-pointer',
              bg,
              border,
              hover,
            )}
          >
            <span className="text-2xl">{emoji}</span>
            <span className={cn('font-semibold text-sm', labelColor)}>{label}</span>
            <span className="text-xs text-txt-muted">{sublabel}</span>
          </button>
        </motion.div>
      ))}
    </div>
  )
}
