import { useShowStore } from '../stores/showStore'
import { ActCard } from '../components/ActCard'
import { motion } from 'framer-motion'

interface LineupPanelProps {
  variant: 'full' | 'sidebar'
}

function FullLineupPanel() {
  const acts = useShowStore((s) => s.acts)
  const reorderAct = useShowStore((s) => s.reorderAct)
  const removeAct = useShowStore((s) => s.removeAct)

  const sorted = [...acts].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col gap-3">
      {sorted.map((act, index) => (
        <motion.div
          key={act.id}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            type: 'spring',
            stiffness: 300,
            damping: 30,
            delay: index * 0.06,
          }}
        >
          <ActCard
            act={act}
            variant="full"
            actNumber={index + 1}
            onReorder={(direction) => reorderAct(act.id, direction)}
            onRemove={() => removeAct(act.id)}
          />
        </motion.div>
      ))}
    </div>
  )
}

function SidebarLineupPanel() {
  const acts = useShowStore((s) => s.acts)

  const sorted = [...acts].sort((a, b) => a.order - b.order)

  return (
    <div className="flex flex-col">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted mb-2">
        TONIGHT&apos;S LINEUP
      </span>
      {sorted.map((act, index) => (
        <ActCard
          key={act.id}
          act={act}
          variant="sidebar"
          actNumber={index + 1}
        />
      ))}
    </div>
  )
}

export function LineupPanel({ variant }: LineupPanelProps) {
  if (variant === 'sidebar') {
    return <SidebarLineupPanel />
  }

  return <FullLineupPanel />
}
