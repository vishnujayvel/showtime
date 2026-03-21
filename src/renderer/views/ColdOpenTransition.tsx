import { useEffect } from 'react'
import { motion } from 'framer-motion'
import { playAudioCue } from '../hooks/useAudio'

interface ColdOpenTransitionProps {
  onComplete: () => void
}

export function ColdOpenTransition({ onComplete }: ColdOpenTransitionProps) {
  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' })

  useEffect(() => {
    playAudioCue('going-live')
    const timer = setTimeout(onComplete, 1500)
    return () => clearTimeout(timer)
  }, [onComplete])

  return (
    <div className="fixed inset-0 bg-studio-bg flex flex-col items-center justify-center z-50">
      <div className="absolute inset-0 spotlight-stage" />

      <motion.h1
        className="font-mono text-3xl font-bold text-txt-primary tracking-tight relative z-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
      >
        Live from your desk...
      </motion.h1>

      <motion.p
        className="font-mono text-xl text-accent mt-3 relative z-10"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20, delay: 0.3 }}
      >
        it&apos;s {dayName}!
      </motion.p>
    </div>
  )
}
