import { useEffect, useState, useCallback } from 'react'
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
import { OnboardingView } from './views/OnboardingView'
import { BeatCheckModal } from './components/BeatCheckModal'

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const phase = useShowStore((s) => s.phase)
  const isExpanded = useShowStore((s) => s.isExpanded)
  const goingLiveActive = useShowStore((s) => s.goingLiveActive)
  const completeGoingLive = useShowStore((s) => s.completeGoingLive)
  const enterWritersRoom = useShowStore((s) => s.enterWritersRoom)
  const beatCheckPending = useShowStore((s) => s.beatCheckPending)
  const setExpanded = useShowStore((s) => s.setExpanded)
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('showtime-onboarding-complete') !== 'true'
  })

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

  // ─── Dynamic window sizing via IPC ───
  useEffect(() => {
    if (!window.clui?.setViewMode) return

    if (goingLiveActive) {
      window.clui.setViewMode('full')
      return
    }

    if (!isExpanded) {
      window.clui.setViewMode('pill')
      return
    }

    switch (phase) {
      case 'writers_room':
      case 'strike':
        window.clui.setViewMode('full')
        break
      case 'no_show':
      case 'live':
      case 'intermission':
      case 'director':
      default:
        window.clui.setViewMode('expanded')
        break
    }
  }, [phase, isExpanded, goingLiveActive])

  // ─── Force-expand on Beat Check ───
  useEffect(() => {
    if (beatCheckPending && !isExpanded) {
      setExpanded(true)
      window.clui?.setViewMode('expanded')
    }
  }, [beatCheckPending, isExpanded, setExpanded])

  // ─── Onboarding completion handler ───
  const handleOnboardingComplete = useCallback((enterRoom: boolean) => {
    localStorage.setItem('showtime-onboarding-complete', 'true')
    setShowOnboarding(false)
    if (enterRoom) {
      enterWritersRoom()
    }
  }, [enterWritersRoom])

  // ─── Help button re-triggers onboarding ───
  const handleHelpClick = useCallback(() => {
    localStorage.removeItem('showtime-onboarding-complete')
    setShowOnboarding(true)
  }, [])

  // ─── View routing ───
  const renderView = () => {
    // Onboarding takes priority on first launch
    if (showOnboarding && phase === 'no_show' && isExpanded && !goingLiveActive) {
      return (
        <OnboardingView
          key="onboarding"
          onComplete={() => handleOnboardingComplete(true)}
          onSkip={() => handleOnboardingComplete(false)}
        />
      )
    }

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
    <div className="w-full h-full relative bg-transparent flex flex-col items-center justify-end">
      {/* Help button — visible on DarkStudio when onboarding was completed */}
      {!showOnboarding && phase === 'no_show' && isExpanded && !goingLiveActive && (
        <button
          onClick={handleHelpClick}
          className="absolute right-3 top-3.5 w-6 h-6 rounded-full bg-surface-hover/60 text-txt-muted hover:text-txt-secondary text-xs font-body flex items-center justify-center no-drag z-50"
        >
          ?
        </button>
      )}
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>
      <BeatCheckModal />
    </div>
  )
}
