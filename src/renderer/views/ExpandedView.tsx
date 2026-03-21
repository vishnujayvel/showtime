import React from 'react'
import { motion } from 'framer-motion'
import { FilmSlate, CaretDown } from '@phosphor-icons/react'
import { useShowStore } from '../stores/showStore'
import { TimerPanel } from '../panels/TimerPanel'
import { ChatPanel } from '../panels/ChatPanel'
import { LineupPanel } from '../panels/LineupPanel'
import { CalendarPanel } from '../panels/CalendarPanel'
import { BeatCounter } from '../components/BeatCounter'
import { RestAffirmation } from '../components/RestAffirmation'
import { DirectorMode } from '../components/DirectorMode'
import { useColors } from '../theme'

export function ExpandedView() {
  const phase = useShowStore((s) => s.phase)
  const toggleExpanded = useShowStore((s) => s.toggleExpanded)
  const enterDirector = useShowStore((s) => s.enterDirector)
  const colors = useColors()

  // Intermission overlay
  if (phase === 'intermission') {
    return (
      <motion.div
        layoutId="showtime-container"
        style={containerStyle(colors)}
        data-clui-ui
      >
        <Header onCollapse={toggleExpanded} />
        <RestAffirmation />
      </motion.div>
    )
  }

  // Director mode overlay
  if (phase === 'director') {
    return (
      <motion.div
        layoutId="showtime-container"
        style={containerStyle(colors)}
        data-clui-ui
      >
        <Header onCollapse={toggleExpanded} />
        <DirectorMode />
      </motion.div>
    )
  }

  // Live show layout
  return (
    <motion.div
      layoutId="showtime-container"
      style={containerStyle(colors)}
      data-clui-ui
    >
      <Header onCollapse={toggleExpanded} onDirector={enterDirector} />
      <TimerPanel />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left: Chat */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          <ChatPanel />
        </div>

        {/* Right: Lineup + Calendar */}
        <div style={{ width: 200, display: 'flex', flexDirection: 'column', borderLeft: `1px solid ${colors.border}` }}>
          <div style={{ flex: 1, overflowY: 'auto' }}>
            <LineupPanel />
          </div>
          <div style={{ height: 180, overflowY: 'auto', borderTop: `1px solid ${colors.border}`, padding: '8px 4px' }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: colors.textTertiary, textTransform: 'uppercase', letterSpacing: 1, padding: '0 8px 4px' }}>
              Today
            </div>
            <CalendarPanel />
          </div>
        </div>
      </div>

      <div style={{ borderTop: `1px solid ${colors.border}`, padding: '4px 0' }}>
        <BeatCounter />
      </div>
    </motion.div>
  )
}

function containerStyle(colors: ReturnType<typeof useColors>): React.CSSProperties {
  return {
    width: 580,
    height: 620,
    borderRadius: 20,
    background: colors.cardBg,
    border: `1px solid ${colors.border}`,
    position: 'absolute',
    bottom: 12,
    left: '50%',
    transform: 'translateX(-50%)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  }
}

function Header({ onCollapse, onDirector }: { onCollapse: () => void; onDirector?: () => void }) {
  const colors = useColors()
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderBottom: `1px solid ${colors.border}` }}>
      <span style={{ fontSize: 14, fontWeight: 600, color: colors.text, flex: 1 }}>Showtime</span>
      {onDirector && (
        <button
          onClick={onDirector}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
          title="Director Mode"
        >
          <FilmSlate size={16} color={colors.textTertiary} />
        </button>
      )}
      <button
        onClick={onCollapse}
        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, lineHeight: 0 }}
        title="Collapse"
      >
        <CaretDown size={16} color={colors.textTertiary} />
      </button>
    </div>
  )
}
