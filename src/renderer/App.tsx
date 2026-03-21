import React, { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useSessionStore } from './stores/sessionStore'
import { useShowStore } from './stores/showStore'
import { useThemeStore } from './theme'
import { PillView } from './views/PillView'
import { ExpandedView } from './views/ExpandedView'
import { WritersRoomView } from './views/WritersRoomView'
import { StrikeView } from './views/StrikeView'
import { BeatCheckModal } from './components/BeatCheckModal'

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const phase = useShowStore((s) => s.phase)
  const isExpanded = useShowStore((s) => s.isExpanded)
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)

  // ─── Theme initialization ───
  useEffect(() => {
    window.clui.getTheme().then(({ isDark }) => {
      setSystemTheme(isDark)
    }).catch(() => {})

    const unsub = window.clui.onThemeChange((isDark) => {
      setSystemTheme(isDark)
    })
    return unsub
  }, [setSystemTheme])

  // ─── Session initialization ───
  useEffect(() => {
    useSessionStore.getState().initStaticInfo().then(() => {
      const homeDir = useSessionStore.getState().staticInfo?.homePath || '~'
      const tab = useSessionStore.getState().tabs[0]
      if (tab) {
        useSessionStore.setState((s) => ({
          tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, workingDirectory: homeDir, hasChosenDirectory: false } : t)),
        }))
        window.clui.createTab().then(({ tabId }) => {
          useSessionStore.setState((s) => ({
            tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, id: tabId } : t)),
            activeTabId: tabId,
          }))
        }).catch(() => {})
      }
    })
  }, [])

  // ─── OS-level click-through ───
  useEffect(() => {
    if (!window.clui?.setIgnoreMouseEvents) return
    let lastIgnored: boolean | null = null

    const onMouseMove = (e: MouseEvent) => {
      const el = document.elementFromPoint(e.clientX, e.clientY)
      const isUI = !!(el && el.closest('[data-clui-ui]'))
      const shouldIgnore = !isUI
      if (shouldIgnore !== lastIgnored) {
        lastIgnored = shouldIgnore
        if (shouldIgnore) {
          window.clui.setIgnoreMouseEvents(true, { forward: true })
        } else {
          window.clui.setIgnoreMouseEvents(false)
        }
      }
    }

    const onMouseLeave = () => {
      if (lastIgnored !== true) {
        lastIgnored = true
        window.clui.setIgnoreMouseEvents(true, { forward: true })
      }
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseleave', onMouseLeave)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseleave', onMouseLeave)
    }
  }, [])

  // ─── View routing ───
  const renderView = () => {
    if (!isExpanded) {
      return <PillView key="pill" />
    }

    switch (phase) {
      case 'no_show':
      case 'writers_room':
        return <WritersRoomView key="writers-room" />
      case 'strike':
        return <StrikeView key="strike" />
      case 'live':
      case 'intermission':
      case 'director':
        return <ExpandedView key="expanded" />
      default:
        return <WritersRoomView key="writers-room-default" />
    }
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: 'transparent' }}>
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>
      <BeatCheckModal />
    </div>
  )
}
