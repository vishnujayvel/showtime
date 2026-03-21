import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Coffee } from '@phosphor-icons/react'
import { useShowStore } from '../stores/showStore'
import { useColors } from '../theme'
import { BeatCounter } from './BeatCounter'

const AFFIRMATIONS = [
  'The show is better for the break.',
  'Rest is free. Always has been.',
  'Intermission: where the best ideas sneak in.',
  'The stage will be here when you\'re ready.',
  'No timer. No rush. Just a pause.',
  'Even the best performers take intermission.',
  'Recovery isn\'t lost time \u2014 it\'s preparation.',
  'The audience can wait. You come first.',
  'Breathe. The next act isn\'t going anywhere.',
  'Rest costs zero. Take as much as you need.',
]

export function RestAffirmation() {
  const exitIntermission = useShowStore((s) => s.exitIntermission)
  const colors = useColors()
  const [affirmation] = useState(() => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32, height: '100%' }}>
      <motion.div
        animate={{ scale: [1, 1.05, 1] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <Coffee size={48} weight="duotone" color="#a78bfa" />
      </motion.div>

      <div style={{ textAlign: 'center' }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: colors.text, margin: 0, marginBottom: 8 }}>Intermission</h2>
        <p style={{ fontSize: 15, color: colors.textSecondary, margin: 0, lineHeight: 1.5, maxWidth: 280 }}>
          {affirmation}
        </p>
      </div>

      <BeatCounter />

      <motion.button
        whileHover={{ scale: 1.03 }}
        whileTap={{ scale: 0.97 }}
        onClick={exitIntermission}
        style={{
          padding: '10px 24px',
          borderRadius: 10,
          border: `1px solid ${colors.border}`,
          background: colors.cardBg,
          color: colors.text,
          fontWeight: 500,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Ready to continue
      </motion.button>
    </div>
  )
}
