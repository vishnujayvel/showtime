import { motion } from 'framer-motion'
import { useShowStore } from '../stores/showStore'
import { Button } from '../ui/button'

export function DarkStudioView() {
  const triggerColdOpen = useShowStore((s) => s.triggerColdOpen)

  return (
    <div
      className="w-full h-full bg-studio-bg flex flex-col items-center justify-center relative"
    >
      {/* Invisible drag handle */}
      <div className="absolute top-0 left-0 right-0 h-8 drag-region" />

      {/* Spotlight overlay */}
      <div className="absolute inset-0 pointer-events-none spotlight-accent" />

      <motion.div
        initial={{ opacity: 0, filter: 'blur(8px)' }}
        animate={{ opacity: 1, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 80, damping: 20 }}
      >
        <h1 className="font-body text-2xl font-light text-txt-primary tracking-tight">
          Tonight's show hasn't been written yet.
        </h1>
        <p className="font-body text-sm text-txt-muted mt-3">
          Every great show starts somewhere.
        </p>

        <motion.div
          className="mt-8"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 200, damping: 25, delay: 1.2 }}
        >
          <Button variant="accent" onClick={triggerColdOpen}>
            Enter the Writer's Room
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
