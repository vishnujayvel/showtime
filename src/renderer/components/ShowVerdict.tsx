import { motion } from 'framer-motion'
import type { ShowVerdict as ShowVerdictType } from '../../shared/types'
import { BeatCounter } from './BeatCounter'
import { cn } from '../lib/utils'

interface VerdictConfig {
  headline: string
  message: string
  colorClass: string
  animationClass?: string
  spotlightGradient?: string
}

const VERDICT_CONFIG: Record<ShowVerdictType, VerdictConfig> = {
  DAY_WON: {
    headline: 'DAY WON',
    message: 'You showed up and you were present.',
    colorClass: 'text-beat',
    animationClass: 'animate-golden-glow',
    spotlightGradient: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
  },
  SOLID_SHOW: {
    headline: 'SOLID SHOW',
    message: 'Not every sketch lands. The show was still great.',
    colorClass: 'text-accent',
  },
  GOOD_EFFORT: {
    headline: 'GOOD EFFORT',
    message: 'You got on stage. That\'s the hardest part.',
    colorClass: 'text-blue-400',
  },
  SHOW_CALLED_EARLY: {
    headline: 'SHOW CALLED EARLY',
    message: 'Sometimes the show is short. The audience still came.',
    colorClass: 'text-txt-secondary',
  },
}

interface ShowVerdictProps {
  verdict: ShowVerdictType
  beatsLocked: number
  beatThreshold: number
}

export function ShowVerdict({ verdict, beatsLocked, beatThreshold }: ShowVerdictProps) {
  const config = VERDICT_CONFIG[verdict]

  return (
    <div className="flex flex-col items-center text-center py-8 relative">
      {config.spotlightGradient && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: config.spotlightGradient }}
        />
      )}

      <motion.h2
        className={cn(
          'font-body text-5xl font-black tracking-tight',
          config.colorClass,
          config.animationClass,
        )}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        {config.headline}
      </motion.h2>

      <p className="text-sm text-txt-secondary mt-4 max-w-[300px]">
        {config.message}
      </p>

      <div className="mt-6">
        <BeatCounter size="xl" showLabel />
      </div>
    </div>
  )
}
