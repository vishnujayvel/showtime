import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useShowStore } from '../stores/showStore'
import { Button } from '../ui/button'
import { BeatCounter } from './BeatCounter'

const AFFIRMATIONS = [
  'Rest is free. Always has been.',
  "The audience isn't going anywhere.",
  'Even the best shows have intermissions.',
  "Your presence doesn't have an expiry date.",
  'The stage will be here when you\'re ready.',
]

export function IntermissionView() {
  const exitIntermission = useShowStore((s) => s.exitIntermission)
  const [affirmation] = useState(
    () => AFFIRMATIONS[Math.floor(Math.random() * AFFIRMATIONS.length)]
  )

  return (
    <motion.div
      className="max-w-[380px] w-full p-8 rounded-xl bg-surface border border-card-border flex flex-col items-center text-center"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted mb-4">
        INTERMISSION
      </span>

      <h2 className="font-body text-xl font-bold text-txt-primary mb-6">
        WE'LL BE RIGHT BACK
      </h2>

      <p className="text-sm text-txt-secondary animate-breathe mb-6">
        {affirmation}
      </p>

      <div className="mb-6">
        <BeatCounter dimmed={true} showLabel={true} />
      </div>

      <Button variant="accent" onClick={exitIntermission}>
        Back to the show
      </Button>
    </motion.div>
  )
}
