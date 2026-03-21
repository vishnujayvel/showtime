import React from 'react'
import { motion } from 'framer-motion'
import { Star } from '@phosphor-icons/react'
import { useShowStore } from '../stores/showStore'
import { useColors } from '../theme'

interface BeatCounterProps {
  compact?: boolean
}

export function BeatCounter({ compact }: BeatCounterProps) {
  const beatsLocked = useShowStore((s) => s.beatsLocked)
  const beatThreshold = useShowStore((s) => s.beatThreshold)
  const colors = useColors()

  const stars = Array.from({ length: beatThreshold }, (_, i) => i < beatsLocked)

  if (compact) {
    return (
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, color: colors.textSecondary }}>
        {stars.map((filled, i) => (
          <Star key={i} size={14} weight={filled ? 'fill' : 'regular'} color={filled ? '#f59e0b' : colors.textTertiary} />
        ))}
        <span style={{ marginLeft: 2 }}>{beatsLocked}/{beatThreshold}</span>
      </span>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px' }}>
      <div style={{ display: 'flex', gap: 4 }}>
        {stars.map((filled, i) => (
          <motion.div
            key={i}
            initial={false}
            animate={filled ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 0.3 }}
          >
            <Star size={20} weight={filled ? 'fill' : 'regular'} color={filled ? '#f59e0b' : colors.textTertiary} />
          </motion.div>
        ))}
      </div>
      <span style={{ fontSize: 14, fontWeight: 500, color: colors.textSecondary }}>
        {beatsLocked}/{beatThreshold} Beats
      </span>
    </div>
  )
}
