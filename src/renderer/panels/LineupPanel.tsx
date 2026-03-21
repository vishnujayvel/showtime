import React from 'react'
import { useShowStore } from '../stores/showStore'
import { ActCard } from '../components/ActCard'
import { useColors } from '../theme'

export function LineupPanel() {
  const acts = useShowStore((s) => s.acts)
  const currentActId = useShowStore((s) => s.currentActId)
  const skipAct = useShowStore((s) => s.skipAct)
  const reorderAct = useShowStore((s) => s.reorderAct)
  const colors = useColors()

  const sorted = [...acts].sort((a, b) => a.order - b.order)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '12px 12px', overflowY: 'auto', flex: 1 }}>
      <div style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, paddingLeft: 4 }}>
        Show Lineup
      </div>
      {sorted.map((act, i) => (
        <ActCard
          key={act.id}
          act={act}
          isActive={act.id === currentActId}
          onSkip={() => skipAct(act.id)}
          onMoveUp={i > 0 ? () => reorderAct(act.id, 'up') : undefined}
          onMoveDown={i < sorted.length - 1 ? () => reorderAct(act.id, 'down') : undefined}
          showReorder
        />
      ))}
    </div>
  )
}
