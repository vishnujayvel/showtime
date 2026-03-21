import React from 'react'
import { motion } from 'framer-motion'
import { FilmSlate, SkipForward, ArrowsClockwise, Coffee, FlagCheckered } from '@phosphor-icons/react'
import { useShowStore } from '../stores/showStore'
import { useColors } from '../theme'

export function DirectorMode() {
  const exitDirector = useShowStore((s) => s.exitDirector)
  const callShowEarly = useShowStore((s) => s.callShowEarly)
  const enterIntermission = useShowStore((s) => s.enterIntermission)
  const colors = useColors()

  const options = [
    {
      icon: SkipForward,
      label: 'Cut remaining acts',
      subtitle: 'Some of the best shows are short ones.',
      action: callShowEarly,
      color: '#f97316',
    },
    {
      icon: Coffee,
      label: 'Extended intermission',
      subtitle: 'Take all the time. The stage will be here.',
      action: () => { exitDirector(); enterIntermission() },
      color: '#a78bfa',
    },
    {
      icon: FlagCheckered,
      label: 'Call the show',
      subtitle: 'Every show has a runtime. This one\'s been solid.',
      action: callShowEarly,
      color: '#60a5fa',
    },
    {
      icon: ArrowsClockwise,
      label: 'Back to the show',
      subtitle: 'False alarm \u2014 let\'s keep going.',
      action: exitDirector,
      color: '#22c55e',
    },
  ]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: 28 }}>
      <FilmSlate size={40} weight="duotone" color="#f59e0b" />
      <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0 }}>The show adapts.</h2>
      <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0, textAlign: 'center' }}>What do you need right now?</p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%', maxWidth: 320 }}>
        {options.map(({ icon: Icon, label, subtitle, action, color }) => (
          <motion.button
            key={label}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={action}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderRadius: 12,
              border: `1px solid ${colors.border}`,
              background: colors.cardBg,
              cursor: 'pointer',
              textAlign: 'left',
              width: '100%',
            }}
          >
            <Icon size={20} color={color} weight="duotone" />
            <div>
              <div style={{ fontSize: 14, fontWeight: 500, color: colors.text }}>{label}</div>
              <div style={{ fontSize: 12, color: colors.textTertiary, marginTop: 2 }}>{subtitle}</div>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  )
}
