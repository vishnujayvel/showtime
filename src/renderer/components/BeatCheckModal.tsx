import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Star, X } from '@phosphor-icons/react'
import { useShowStore } from '../stores/showStore'
import { useColors } from '../theme'

const BEAT_PROMPTS = [
  'Did you have a moment where you forgot about everything else?',
  'Was there a moment you were fully in it?',
  'Any flash of flow in that Act?',
  'Did time disappear, even for a second?',
  'Was there a beat where you were just... doing the thing?',
  'Any moment of genuine immersion?',
  'Did you catch yourself in the zone at all?',
  'Was there a stretch where it felt effortless?',
  'Any moment where the noise went quiet?',
  'Did you feel present at any point during that Act?',
]

function getRandomPrompt(): string {
  return BEAT_PROMPTS[Math.floor(Math.random() * BEAT_PROMPTS.length)]
}

export function BeatCheckModal() {
  const beatCheckPending = useShowStore((s) => s.beatCheckPending)
  const lockBeat = useShowStore((s) => s.lockBeat)
  const skipBeat = useShowStore((s) => s.skipBeat)
  const colors = useColors()

  const [prompt] = React.useState(getRandomPrompt)

  return (
    <AnimatePresence>
      {beatCheckPending && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)',
            zIndex: 100,
          }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 300 }}
            style={{
              background: colors.cardBg,
              borderRadius: 16,
              padding: '28px 24px',
              maxWidth: 340,
              width: '90%',
              textAlign: 'center',
              border: `1px solid ${colors.border}`,
            }}
          >
            <Star size={32} weight="duotone" color="#f59e0b" style={{ marginBottom: 12 }} />
            <p style={{ fontSize: 16, fontWeight: 500, color: colors.text, lineHeight: 1.5, marginBottom: 24 }}>
              {prompt}
            </p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={lockBeat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: 'none',
                  background: '#f59e0b',
                  color: '#000',
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <Star size={16} weight="fill" /> Yes, lock it
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={skipBeat}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '10px 20px',
                  borderRadius: 10,
                  border: `1px solid ${colors.border}`,
                  background: 'transparent',
                  color: colors.textSecondary,
                  fontWeight: 500,
                  fontSize: 14,
                  cursor: 'pointer',
                }}
              >
                <X size={16} /> Not this time
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
