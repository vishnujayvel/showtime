import React from 'react'
import { useShowStore } from '../stores/showStore'
import { useColors } from '../theme'

const SKETCH_COLORS: Record<string, string> = {
  'Deep Work': '#8b5cf6',
  'Exercise': '#22c55e',
  'Admin': '#60a5fa',
  'Creative': '#f59e0b',
  'Social': '#ec4899',
  'Errands': '#f97316',
}

const START_HOUR = 7
const END_HOUR = 23
const HOUR_HEIGHT = 32

export function CalendarPanel() {
  const acts = useShowStore((s) => s.acts)
  const colors = useColors()

  const hours = Array.from({ length: END_HOUR - START_HOUR }, (_, i) => START_HOUR + i)
  const now = new Date()
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const nowOffset = ((currentMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT

  // Map acts to time blocks based on cumulative duration starting from first act's startedAt or 9am
  const firstStart = acts.find((a) => a.startedAt)?.startedAt
  let cursor = firstStart ? new Date(firstStart).getHours() * 60 + new Date(firstStart).getMinutes() : 9 * 60

  const blocks = acts
    .filter((a) => a.status !== 'skipped')
    .sort((a, b) => a.order - b.order)
    .map((act) => {
      const startMin = cursor
      cursor += act.durationMinutes
      return { act, startMin, endMin: cursor }
    })

  return (
    <div style={{
      position: 'relative',
      height: hours.length * HOUR_HEIGHT,
      borderTop: `1px solid ${colors.border}`,
      fontSize: 10,
      overflow: 'hidden',
    }}>
      {/* Hour lines */}
      {hours.map((h) => (
        <div
          key={h}
          style={{
            position: 'absolute',
            top: (h - START_HOUR) * HOUR_HEIGHT,
            left: 0,
            right: 0,
            display: 'flex',
            alignItems: 'flex-start',
            borderTop: `1px solid ${colors.border}20`,
          }}
        >
          <span style={{ width: 28, textAlign: 'right', paddingRight: 6, color: colors.textTertiary, fontSize: 10 }}>
            {h % 12 || 12}{h < 12 ? 'a' : 'p'}
          </span>
        </div>
      ))}

      {/* Act blocks */}
      {blocks.map(({ act, startMin, endMin }) => {
        const top = ((startMin - START_HOUR * 60) / 60) * HOUR_HEIGHT
        const height = ((endMin - startMin) / 60) * HOUR_HEIGHT
        const color = SKETCH_COLORS[act.sketch] || '#94a3b8'

        return (
          <div
            key={act.id}
            style={{
              position: 'absolute',
              top: Math.max(0, top),
              left: 34,
              right: 4,
              height: Math.max(14, height),
              borderRadius: 4,
              background: `${color}25`,
              borderLeft: `3px solid ${color}`,
              padding: '2px 6px',
              overflow: 'hidden',
              whiteSpace: 'nowrap',
              textOverflow: 'ellipsis',
              color: colors.textSecondary,
              fontSize: 10,
              lineHeight: `${Math.max(14, height)}px`,
            }}
          >
            {act.name}
          </div>
        )
      })}

      {/* Current time marker */}
      {nowOffset >= 0 && nowOffset <= hours.length * HOUR_HEIGHT && (
        <div style={{
          position: 'absolute',
          top: nowOffset,
          left: 28,
          right: 0,
          height: 2,
          background: '#ef4444',
          zIndex: 10,
        }}>
          <div style={{
            position: 'absolute',
            left: -3,
            top: -3,
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#ef4444',
          }} />
        </div>
      )}
    </div>
  )
}
