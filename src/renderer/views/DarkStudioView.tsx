import { motion } from 'framer-motion'
import { useShowStore } from '../stores/showStore'
import { Button } from '../ui/button'

export function DarkStudioView() {
  const enterWritersRoom = useShowStore((s) => s.enterWritersRoom)

  return (
    <div
      className="min-h-screen bg-studio-bg flex flex-col items-center justify-center relative"
    >
      {/* Spotlight overlay */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 400px 350px at 50% 35%, rgba(217,119,87,0.06) 0%, transparent 70%)',
        }}
      />

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
          <Button variant="accent" onClick={enterWritersRoom}>
            Enter the Writer's Room
          </Button>
        </motion.div>
      </motion.div>
    </div>
  )
}
