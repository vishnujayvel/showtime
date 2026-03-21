import React from 'react'
import { motion } from 'framer-motion'
import { FilmSlate, ArrowCounterClockwise, X } from '@phosphor-icons/react'
import { useShowStore, selectCompletedActs, selectSkippedActs } from '../stores/showStore'
import { ShowVerdict } from '../components/ShowVerdict'
import { BeatCounter } from '../components/BeatCounter'
import { useColors } from '../theme'

export function StrikeView() {
  const verdict = useShowStore((s) => s.verdict)
  const acts = useShowStore((s) => s.acts)
  const resetShow = useShowStore((s) => s.resetShow)
  const setExpanded = useShowStore((s) => s.setExpanded)
  const completedActs = useShowStore(selectCompletedActs)
  const skippedActs = useShowStore(selectSkippedActs)
  const colors = useColors()

  return (
    <motion.div
      layoutId="showtime-container"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{
        width: 420,
        maxHeight: 560,
        borderRadius: 20,
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        padding: '28px 24px',
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        overflowY: 'auto',
      }}
      data-clui-ui
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <FilmSlate size={20} weight="duotone" color="#f59e0b" />
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0 }}>Strike the Stage</h2>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: colors.text }}>{completedActs.length}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase' }}>Completed</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: colors.textTertiary }}>{skippedActs.length}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase' }}>Cut</div>
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#f59e0b' }}>{acts.filter((a) => a.beatLocked).length}</div>
          <div style={{ fontSize: 11, color: colors.textTertiary, textTransform: 'uppercase' }}>Beats</div>
        </div>
      </div>

      <BeatCounter />

      {verdict && <ShowVerdict verdict={verdict} />}

      <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={resetShow}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 10,
            border: `1px solid ${colors.border}`, background: 'transparent',
            color: colors.text, fontWeight: 500, fontSize: 14, cursor: 'pointer',
          }}
        >
          <ArrowCounterClockwise size={16} /> New Show
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.03 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setExpanded(false)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '10px 20px', borderRadius: 10,
            border: 'none', background: colors.border,
            color: colors.textSecondary, fontWeight: 500, fontSize: 14, cursor: 'pointer',
          }}
        >
          <X size={16} /> Close
        </motion.button>
      </div>
    </motion.div>
  )
}
