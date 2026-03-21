import React from 'react'
import { motion } from 'framer-motion'
import { Play, Coffee, Sparkle } from '@phosphor-icons/react'
import { useShowStore, selectCurrentAct } from '../stores/showStore'
import { useTimer } from '../hooks/useTimer'
import { BeatCounter } from '../components/BeatCounter'
import { useColors } from '../theme'

export function PillView() {
  const phase = useShowStore((s) => s.phase)
  const toggleExpanded = useShowStore((s) => s.toggleExpanded)
  const currentAct = useShowStore(selectCurrentAct)
  const { minutes, seconds, isRunning } = useTimer()
  const colors = useColors()

  const timerText = isRunning ? `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}` : '--:--'

  let content: React.ReactNode

  if (phase === 'no_show' || phase === 'writers_room') {
    content = (
      <>
        <Sparkle size={16} weight="duotone" color="#f59e0b" />
        <span style={{ fontSize: 13, fontWeight: 500, color: colors.text }}>Tap to start your show</span>
      </>
    )
  } else if (phase === 'intermission') {
    content = (
      <>
        <Coffee size={16} weight="duotone" color="#a78bfa" />
        <span style={{ fontSize: 13, fontWeight: 500, color: colors.textSecondary }}>Intermission</span>
        <span style={{ fontSize: 12, color: colors.textTertiary }}>No rush</span>
        <div style={{ marginLeft: 'auto' }}><BeatCounter compact /></div>
      </>
    )
  } else if (phase === 'live' && currentAct) {
    content = (
      <>
        <Play size={14} weight="fill" color="#22c55e" />
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {currentAct.name}
        </span>
        <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: minutes < 5 ? '#f59e0b' : colors.text }}>
          {timerText}
        </span>
        <BeatCounter compact />
      </>
    )
  } else if (phase === 'strike') {
    content = (
      <>
        <Sparkle size={16} weight="fill" color="#f59e0b" />
        <span style={{ fontSize: 13, fontWeight: 600, color: colors.text }}>Show complete!</span>
        <div style={{ marginLeft: 'auto' }}><BeatCounter compact /></div>
      </>
    )
  } else {
    content = (
      <>
        <Sparkle size={16} weight="duotone" color={colors.textTertiary} />
        <span style={{ fontSize: 13, color: colors.textSecondary }}>Showtime</span>
      </>
    )
  }

  return (
    <motion.div
      layoutId="showtime-container"
      onClick={toggleExpanded}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        width: 320,
        height: 48,
        padding: '0 16px',
        borderRadius: 24,
        background: colors.pillBg || colors.cardBg,
        border: `1px solid ${colors.border}`,
        cursor: 'pointer',
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
      }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      data-clui-ui
    >
      {content}
    </motion.div>
  )
}
