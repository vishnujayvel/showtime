import React from 'react'
import { motion } from 'framer-motion'
import { Plus, Stop, Pause } from '@phosphor-icons/react'
import { useShowStore, selectCurrentAct } from '../stores/showStore'
import { useTimer } from '../hooks/useTimer'
import { useColors } from '../theme'

export function TimerPanel() {
  const currentAct = useShowStore(selectCurrentAct)
  const extendAct = useShowStore((s) => s.extendAct)
  const completeAct = useShowStore((s) => s.completeAct)
  const enterIntermission = useShowStore((s) => s.enterIntermission)
  const { minutes, seconds, isRunning, progress } = useTimer()
  const colors = useColors()

  if (!currentAct) return null

  // Urgency: shift color in last 5 minutes
  const isUrgent = isRunning && minutes < 5
  const timerColor = isUrgent ? '#f59e0b' : colors.text

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 8,
      padding: '16px 20px',
      borderBottom: `1px solid ${colors.border}`,
    }}>
      <div style={{ fontSize: 12, fontWeight: 500, color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1 }}>
        {currentAct.sketch}
      </div>
      <div style={{ fontSize: 15, fontWeight: 600, color: colors.text }}>
        {currentAct.name}
      </div>

      <motion.div
        animate={isUrgent ? { scale: [1, 1.02, 1] } : {}}
        transition={isUrgent ? { duration: 1, repeat: Infinity } : {}}
        style={{
          fontSize: 42,
          fontWeight: 700,
          fontVariantNumeric: 'tabular-nums',
          color: timerColor,
          lineHeight: 1,
          marginTop: 4,
        }}
      >
        {String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
      </motion.div>

      {/* Progress bar */}
      <div style={{ width: '100%', height: 3, borderRadius: 2, background: colors.border, marginTop: 4 }}>
        <motion.div
          initial={false}
          animate={{ width: `${progress * 100}%` }}
          style={{ height: '100%', borderRadius: 2, background: isUrgent ? '#f59e0b' : '#8b5cf6' }}
        />
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
        <button
          onClick={() => extendAct(15)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${colors.border}`, background: 'transparent',
            color: colors.textSecondary, fontSize: 12, cursor: 'pointer',
          }}
        >
          <Plus size={12} /> 15m
        </button>
        <button
          onClick={() => completeAct(currentAct.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${colors.border}`, background: 'transparent',
            color: colors.textSecondary, fontSize: 12, cursor: 'pointer',
          }}
        >
          <Stop size={12} /> End
        </button>
        <button
          onClick={enterIntermission}
          style={{
            display: 'flex', alignItems: 'center', gap: 4,
            padding: '6px 12px', borderRadius: 8,
            border: `1px solid ${colors.border}`, background: 'transparent',
            color: colors.textSecondary, fontSize: 12, cursor: 'pointer',
          }}
        >
          <Pause size={12} /> Rest
        </button>
      </div>
    </div>
  )
}
