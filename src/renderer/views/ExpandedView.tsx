import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { useShowPhase, useShowContext, useShowSelector, showSelectors } from '../machines/ShowMachineProvider'
import { TimerPanel } from '../panels/TimerPanel'
import { LineupPanel } from '../panels/LineupPanel'
import { OnAirIndicator } from '../components/OnAirIndicator'
import { BeatCounter } from '../components/BeatCounter'
import { IntermissionView } from '../components/IntermissionView'
import { DirectorMode } from '../components/DirectorMode'
import { RundownBar } from '../components/RundownBar'
import { Toolbar } from '../components/Toolbar'
import { formatDateLabel } from '../lib/utils'

function formatStartTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}

/** Full-size live view with hero timer panel, lineup sidebar, and director mode overlay. */
export function ExpandedView() {
  const phase = useShowPhase()
  const acts = useShowContext((ctx) => ctx.acts)
  const currentAct = useShowSelector(showSelectors.currentAct)
  const beatsLocked = useShowContext((ctx) => ctx.beatsLocked)
  const beatThreshold = useShowContext((ctx) => ctx.beatThreshold)
  const showStartedAt = useShowContext((ctx) => ctx.showStartedAt)

  const dateLabel = useMemo(formatDateLabel, [])

  return (
    <motion.div
      className="w-full h-full bg-surface overflow-hidden flex flex-col"
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Title Bar */}
      <div
        className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428] drag-region"
      >
        <div className="flex items-center gap-3">
          <span className="font-mono text-xs tracking-widest uppercase text-txt-muted">
            SHOWTIME
          </span>
          <span className="font-mono text-[10px] tracking-wider text-txt-muted/60" data-testid="date-label">
            {dateLabel}
          </span>
        </div>

        <Toolbar />
      </div>

      {/* Rundown Bar — between title bar and main content */}
      <RundownBar variant="full" />

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Timer Section / Conditional Overlays */}
        <div className="flex-1 px-8 py-8 flex flex-col">
          {phase === 'intermission' ? (
            <IntermissionView />
          ) : (
            <TimerPanel />
          )}
        </div>

        {/* Lineup Sidebar */}
        <div className="w-[200px] border-l border-[#242428] px-3 py-3 overflow-y-auto">
          <LineupPanel variant="sidebar" />
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="bg-[#151517] px-5 py-3 flex items-center justify-between border-t border-[#242428]">
        <div className="flex items-center gap-3">
          <OnAirIndicator isLive={phase === 'live'} />
          {showStartedAt && (
            <span className="font-mono text-[10px] text-txt-muted" data-testid="started-at">
              Started {formatStartTime(showStartedAt)}
            </span>
          )}
        </div>
        <BeatCounter size="sm" />
      </div>

      {/* Director Mode Overlay */}
      {phase === 'director' && <DirectorMode />}
    </motion.div>
  )
}
