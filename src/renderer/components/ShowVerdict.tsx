import React from 'react'
import { motion } from 'framer-motion'
import { Trophy, Star, ThumbsUp, Heart } from '@phosphor-icons/react'
import type { ShowVerdict as ShowVerdictType } from '../../shared/types'
import { useColors } from '../theme'

const VERDICT_CONFIG: Record<ShowVerdictType, {
  icon: typeof Trophy
  title: string
  message: string
  color: string
  celebrate: boolean
}> = {
  DAY_WON: {
    icon: Trophy,
    title: 'DAY WON',
    message: 'Standing ovation! You showed up and stayed present. That\'s the whole game.',
    color: '#f59e0b',
    celebrate: true,
  },
  SOLID_SHOW: {
    icon: Star,
    title: 'SOLID SHOW',
    message: 'One beat short of a standing ovation \u2014 but still a solid show.',
    color: '#22c55e',
    celebrate: false,
  },
  GOOD_EFFORT: {
    icon: ThumbsUp,
    title: 'GOOD EFFORT',
    message: 'Not every show is a blockbuster \u2014 but this one had heart.',
    color: '#60a5fa',
    celebrate: false,
  },
  SHOW_CALLED_EARLY: {
    icon: Heart,
    title: 'SHOW CALLED EARLY',
    message: 'Sometimes the best direction is knowing when to wrap. See you tomorrow.',
    color: '#a78bfa',
    celebrate: false,
  },
}

interface ShowVerdictProps {
  verdict: ShowVerdictType
}

export function ShowVerdict({ verdict }: ShowVerdictProps) {
  const config = VERDICT_CONFIG[verdict]
  const Icon = config.icon
  const colors = useColors()

  return (
    <motion.div
      initial={{ scale: 0.9, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', damping: 15, stiffness: 200 }}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 16,
        padding: '28px 24px',
        borderRadius: 16,
        border: `2px solid ${config.color}40`,
        background: `${config.color}08`,
        textAlign: 'center',
      }}
    >
      <motion.div
        animate={config.celebrate ? { rotate: [0, -10, 10, -10, 10, 0], scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.8, delay: 0.3 }}
      >
        <Icon size={48} weight="duotone" color={config.color} />
      </motion.div>
      <h3 style={{ fontSize: 22, fontWeight: 700, color: config.color, margin: 0, letterSpacing: 1 }}>
        {config.title}
      </h3>
      <p style={{ fontSize: 14, color: colors.textSecondary, margin: 0, lineHeight: 1.5, maxWidth: 280 }}>
        {config.message}
      </p>
    </motion.div>
  )
}
