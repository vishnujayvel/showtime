import { useState, useEffect } from 'react'
import { useShowStore } from '../stores/showStore'
import { EnergySelector } from '../components/EnergySelector'
import { LineupPanel } from '../panels/LineupPanel'
import { Button } from '../ui/button'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../lib/utils'

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function WritersRoomView() {
  const energy = useShowStore((s) => s.energy)
  const writersRoomStep = useShowStore((s) => s.writersRoomStep)
  const acts = useShowStore((s) => s.acts)
  const setEnergy = useShowStore((s) => s.setEnergy)
  const setWritersRoomStep = useShowStore((s) => s.setWritersRoomStep)
  const setLineup = useShowStore((s) => s.setLineup)
  const triggerGoingLive = useShowStore((s) => s.triggerGoingLive)
  const writersRoomEnteredAt = useShowStore((s) => s.writersRoomEnteredAt)

  const [planText, setPlanText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showNudge, setShowNudge] = useState(false)

  // 20-minute nudge timer
  useEffect(() => {
    if (!writersRoomEnteredAt) return

    const check = () => {
      const elapsed = Date.now() - writersRoomEnteredAt
      if (elapsed > 20 * 60 * 1000) {
        setShowNudge(true)
      }
    }

    check()
    const interval = setInterval(check, 60_000)
    return () => clearInterval(interval)
  }, [writersRoomEnteredAt])

  const handleBuildLineup = () => {
    if (!planText.trim()) return
    setIsSubmitting(true)

    // Mock lineup generation (will be replaced with real Claude integration)
    const mockActs = planText
      .split('\n')
      .filter((l) => l.trim())
      .slice(0, 5)
      .map((line) => ({
        name: line.trim(),
        sketch: ['Deep Work', 'Admin', 'Creative', 'Exercise', 'Social'][
          Math.floor(Math.random() * 5)
        ],
        durationMinutes: [25, 30, 45, 60][Math.floor(Math.random() * 4)],
      }))

    setLineup({
      acts: mockActs,
      beatThreshold: Math.min(mockActs.length, 3),
      openingNote: '',
    })
    setWritersRoomStep('lineup')
    setIsSubmitting(false)
  }

  return (
    <div
      className="w-[560px] min-h-[680px] bg-surface rounded-xl overflow-hidden flex flex-col"
      data-clui-ui
    >
      {/* Title bar */}
      <div
        className="bg-[#151517] px-5 py-3 flex items-center border-b border-[#242428]"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        <span className="font-mono text-xs tracking-widest uppercase text-txt-muted">
          SHOWTIME
        </span>
      </div>

      {/* Content */}
      <div className="px-8 py-8 flex-1 flex flex-col relative">
        {/* Spotlight gradient overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'radial-gradient(ellipse at 50% 0%, rgba(217,119,87,0.05) 0%, transparent 70%)',
          }}
        />

        <AnimatePresence mode="wait">
          {/* Step 1: Energy */}
          {writersRoomStep === 'energy' && (
            <motion.div
              key="energy"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
            >
              <h2 className="font-body text-xl font-semibold text-txt-primary mb-6">
                How&apos;s your energy?
              </h2>
              <EnergySelector
                onSelect={(level) => {
                  setEnergy(level)
                  setWritersRoomStep('plan')
                }}
              />
            </motion.div>
          )}

          {/* Step 2: Plan Dump */}
          {writersRoomStep === 'plan' && (
            <motion.div
              key="plan"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
            >
              <h2 className="font-body text-xl font-semibold text-txt-primary mb-2">
                What&apos;s on the schedule?
              </h2>
              <p className="text-sm text-txt-muted mb-6">
                Dump everything. Claude will organize it into tonight&apos;s lineup.
              </p>

              <div className="bg-notepad-bg border border-notepad-border rounded-lg p-4">
                <textarea
                  value={planText}
                  onChange={(e) => setPlanText(e.target.value)}
                  placeholder="meetings, tasks, errands, whatever..."
                  className="w-full h-[200px] resize-none bg-transparent font-body text-sm text-notepad-text placeholder:text-txt-muted focus:outline-none"
                  autoFocus
                />
              </div>

              <Button
                variant="accent"
                className="mt-4"
                disabled={isSubmitting || !planText.trim()}
                onClick={handleBuildLineup}
              >
                {isSubmitting ? 'Building...' : 'Build my lineup'}
              </Button>

              {showNudge && (
                <p className="text-xs text-txt-muted mt-4 animate-breathe">
                  Still writing? No rush — the show starts when you&apos;re ready.
                </p>
              )}
            </motion.div>
          )}

          {/* Step 3: Lineup Preview */}
          {writersRoomStep === 'lineup' && (
            <motion.div
              key="lineup"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={springTransition}
            >
              <h2 className="font-body text-xl font-semibold text-txt-primary mb-6">
                Tonight&apos;s Lineup
              </h2>

              <LineupPanel variant="full" />

              <Button
                variant="primary"
                className="mt-8"
                onClick={() => triggerGoingLive()}
              >
                WE&apos;RE LIVE!
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
