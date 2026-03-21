import { motion } from 'framer-motion'
import { useShowStore, selectCurrentAct } from '../stores/showStore'
import { TimerPanel } from '../panels/TimerPanel'
import { LineupPanel } from '../panels/LineupPanel'
import { OnAirIndicator } from '../components/OnAirIndicator'
import { BeatCounter } from '../components/BeatCounter'
import { IntermissionView } from '../components/IntermissionView'
import { DirectorMode } from '../components/DirectorMode'

export function ExpandedView() {
  const phase = useShowStore((s) => s.phase)
  const acts = useShowStore((s) => s.acts)
  const currentAct = useShowStore(selectCurrentAct)
  const beatsLocked = useShowStore((s) => s.beatsLocked)
  const beatThreshold = useShowStore((s) => s.beatThreshold)
  const toggleExpanded = useShowStore((s) => s.toggleExpanded)
  const enterDirector = useShowStore((s) => s.enterDirector)

  return (
    <motion.div
      className="w-[560px] min-h-[620px] bg-surface rounded-xl overflow-hidden flex flex-col"
      initial={{ scale: 0.9, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      exit={{ scale: 0.9, opacity: 0, y: 20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
    >
      {/* Title Bar */}
      <div
        className="bg-[#151517] px-5 py-3 flex items-center justify-between border-b border-[#242428] drag-region"
      >
        <span className="font-mono text-xs tracking-widest uppercase text-txt-muted">
          SHOWTIME
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={enterDirector}
            className="px-3 py-1.5 rounded-lg bg-surface-hover text-txt-secondary text-sm font-medium hover:text-txt-primary transition-colors no-drag"
          >
            Director
          </button>
          <button
            onClick={toggleExpanded}
            className="px-2 py-1.5 text-txt-muted hover:text-txt-secondary transition-colors no-drag"
          >
            ▼
          </button>
          <button
            onClick={() => window.clui.quit()}
            className="px-2 py-1.5 text-txt-muted hover:text-onair transition-colors text-sm no-drag"
            title="Quit Showtime"
          >
            ✕
          </button>
        </div>
      </div>

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
        <OnAirIndicator isLive={phase === 'live'} />
        <BeatCounter size="sm" />
      </div>

      {/* Director Mode Overlay */}
      {phase === 'director' && <DirectorMode />}
    </motion.div>
  )
}
