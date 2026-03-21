import { useEffect } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useSessionStore } from './stores/sessionStore'
import { useShowStore } from './stores/showStore'
import { useThemeStore } from './theme'
import { DarkStudioView } from './views/DarkStudioView'
import { WritersRoomView } from './views/WritersRoomView'
import { GoingLiveTransition } from './views/GoingLiveTransition'
import { PillView } from './views/PillView'
import { ExpandedView } from './views/ExpandedView'
import { StrikeView } from './views/StrikeView'
import { BeatCheckModal } from './components/BeatCheckModal'

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const phase = useShowStore((s) => s.phase)
  const isExpanded = useShowStore((s) => s.isExpanded)
  const goingLiveActive = useShowStore((s) => s.goingLiveActive)
  const completeGoingLive = useShowStore((s) => s.completeGoingLive)
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
    // Going Live transition takes priority
    if (goingLiveActive) {
      return <GoingLiveTransition key="going-live" onComplete={completeGoingLive} />
    }

    // Pill view when collapsed
    if (!isExpanded) {
      return <PillView key="pill" />
    }

    // Phase-based routing
    switch (phase) {
      case 'no_show':
        return <DarkStudioView key="dark-studio" />
      case 'writers_room':
        return <WritersRoomView key="writers-room" />
      case 'strike':
        return <StrikeView key="strike" />
      case 'live':
      case 'intermission':
      case 'director':
        return <ExpandedView key="expanded" />
      default:
        return <DarkStudioView key="dark-studio-default" />
    }
  }

  return (
    <div className="w-full h-full relative bg-transparent">
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>
      <BeatCheckModal />
    </div>
  )
}
