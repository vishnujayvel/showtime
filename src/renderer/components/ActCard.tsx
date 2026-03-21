import React from 'react'
import { motion } from 'framer-motion'
import { Play, Check, SkipForward, ArrowUp, ArrowDown, Star, Timer } from '@phosphor-icons/react'
import type { Act } from '../../shared/types'
import { useColors } from '../theme'

const SKETCH_COLORS: Record<string, string> = {
  'Deep Work': '#8b5cf6',
  'Exercise': '#22c55e',
  'Admin': '#60a5fa',
  'Creative': '#f59e0b',
  'Social': '#ec4899',
  'Errands': '#f97316',
}

interface ActCardProps {
  act: Act
  isActive: boolean
  onSkip: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  showReorder?: boolean
}

export function ActCard({ act, isActive, onSkip, onMoveUp, onMoveDown, showReorder }: ActCardProps) {
  const colors = useColors()
  const sketchColor = SKETCH_COLORS[act.sketch] || '#94a3b8'

  const statusIcon = () => {
    switch (act.status) {
      case 'active':
        return <Play size={16} weight="fill" color={sketchColor} />
      case 'completed':
        return <Check size={16} weight="bold" color="#22c55e" />
      case 'skipped':
        return <SkipForward size={16} weight="bold" color={colors.textTertiary} />
      default:
        return <Timer size={16} color={colors.textTertiary} />
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        borderRadius: 10,
        border: `1.5px solid ${isActive ? sketchColor : 'transparent'}`,
        background: isActive ? `${sketchColor}10` : act.status === 'skipped' ? `${colors.cardBg}80` : colors.cardBg,
        opacity: act.status === 'skipped' ? 0.5 : 1,
      }}
    >
      <div style={{ flexShrink: 0 }}>{statusIcon()}</div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: isActive ? 600 : 400, color: colors.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {act.name}
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 2 }}>
          <span style={{ fontSize: 11, color: sketchColor, fontWeight: 500 }}>{act.sketch}</span>
          <span style={{ fontSize: 11, color: colors.textTertiary }}>{act.durationMinutes}m</span>
          {act.status === 'completed' && (
            <Star size={12} weight={act.beatLocked ? 'fill' : 'regular'} color={act.beatLocked ? '#f59e0b' : colors.textTertiary} />
          )}
        </div>
      </div>

      {showReorder && act.status === 'upcoming' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {onMoveUp && (
            <button onClick={onMoveUp} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
              <ArrowUp size={14} color={colors.textTertiary} />
            </button>
          )}
          {onMoveDown && (
            <button onClick={onMoveDown} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2, lineHeight: 0 }}>
              <ArrowDown size={14} color={colors.textTertiary} />
            </button>
          )}
        </div>
      )}

      {act.status === 'upcoming' && (
        <button
          onClick={onSkip}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            lineHeight: 0,
            opacity: 0.6,
          }}
          title="Cut this act"
        >
          <SkipForward size={14} color={colors.textTertiary} />
        </button>
      )}
    </motion.div>
  )
}
