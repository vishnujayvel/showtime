import { useEffect, useState, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useSessionStore } from './stores/sessionStore'
import { useShowStore, selectIsExpanded } from './stores/showStore'
import { useThemeStore } from './theme'
import { DarkStudioView } from './views/DarkStudioView'
import { WritersRoomView } from './views/WritersRoomView'
import { ColdOpenTransition } from './views/ColdOpenTransition'
import { GoingLiveTransition } from './views/GoingLiveTransition'
import { PillView } from './views/PillView'
import { CompactView } from './views/CompactView'
import { DashboardView } from './views/DashboardView'
import { ExpandedView } from './views/ExpandedView'
import { StrikeView } from './views/StrikeView'
import { HistoryView } from './views/HistoryView'
import { SettingsView } from './views/SettingsView'
import { OnboardingView } from './views/OnboardingView'
import { BeatCheckModal } from './components/BeatCheckModal'
import { HelpDialog } from './components/HelpDialog'
import type { ViewTier, ViewMode, ShowPhase } from '../shared/types'

// Map viewTier + phase to the IPC view mode that determines window size
function tierToViewMode(tier: ViewTier, phase: ShowPhase): ViewMode {
  // Full-screen phases always use 'full' regardless of tier
  if (phase === 'no_show' || phase === 'writers_room' || phase === 'strike') {
    return 'full'
  }
  const map: Record<ViewTier, ViewMode> = {
    micro: 'pill',
    compact: 'compact',
    dashboard: 'dashboard',
    expanded: 'expanded',
  }
  return map[tier]
}

export default function App() {
  useClaudeEvents()
  useHealthReconciliation()

  const phase = useShowStore((s) => s.phase)
  const viewTier = useShowStore((s) => s.viewTier)
  const isExpanded = useShowStore(selectIsExpanded)
  const coldOpenActive = useShowStore((s) => s.coldOpenActive)
  const completeColdOpen = useShowStore((s) => s.completeColdOpen)
  const goingLiveActive = useShowStore((s) => s.goingLiveActive)
  const completeGoingLive = useShowStore((s) => s.completeGoingLive)
  const enterWritersRoom = useShowStore((s) => s.enterWritersRoom)
  const beatCheckPending = useShowStore((s) => s.beatCheckPending)
  const setViewTier = useShowStore((s) => s.setViewTier)
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)

  const [showOnboarding, setShowOnboarding] = useState(() => {
    return localStorage.getItem('showtime-onboarding-complete') !== 'true'
  })
  const [showHistory, setShowHistory] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showHelp, setShowHelp] = useState(false)

  // ─── Listen for tray-triggered reset ───
  const resetShow = useShowStore((s) => s.resetShow)
  useEffect(() => {
    if (!window.clui?.onResetShow) return
    return window.clui.onResetShow(() => resetShow())
  }, [resetShow])

  // ─── Listen for settings open (Cmd+, or tray) ───
  useEffect(() => {
    if (!window.clui?.onOpenSettings) return
    return window.clui.onOpenSettings(() => setShowSettings(true))
  }, [])

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

  // ─── Tray state sync — push show state to main process for menu bar display ───
  useEffect(() => {
    const unsub = useShowStore.subscribe((state) => {
      if (!window.clui?.updateTrayState) return
      const currentAct = state.acts[state.currentActIndex]
      const timerSeconds = state.timerEndAt
        ? Math.max(0, Math.round((state.timerEndAt - Date.now()) / 1000))
        : state.timerPausedRemaining
          ? Math.round(state.timerPausedRemaining / 1000)
          : null
      window.clui.updateTrayState({
        phase: state.phase,
        currentActName: currentAct?.name || null,
        currentActCategory: currentAct?.sketch || null,
        timerSeconds,
        beatsLocked: state.beatsLocked,
        beatThreshold: state.beatThreshold,
        actIndex: state.currentActIndex,
        totalActs: state.acts.length,
        nextActs: state.acts.slice(state.currentActIndex + 1, state.currentActIndex + 3).map(a => ({
          name: a.name,
          sketch: a.sketch,
          durationMinutes: a.durationMinutes,
        })),
      })
    })
    return unsub
  }, [])

  // ─── Session initialization + immediate warmup ───
  // CLUI CC's secret sauce: create tab then IMMEDIATELY warm up the Claude
  // subprocess. The ~20s CLI startup happens in the background while the user
  // is on Dark Studio or selecting energy. By the time they click "Build my
  // lineup", the session is already hot and uses --resume (instant).
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
            tabReady: true,
          }))
          // Warm up immediately after tab is created — don't wait for Writer's Room
          window.clui.initSession(tabId)
        }).catch(() => {})
      }
    })
  }, [])

  // ─── Dynamic window sizing via IPC ───
  useEffect(() => {
    if (!window.clui?.setViewMode) return

    if (coldOpenActive || goingLiveActive) {
      window.clui.setViewMode('full')
      return
    }

    // History and Settings views are full-screen
    if (showHistory || showSettings) {
      window.clui.setViewMode('full')
      return
    }

    const mode = tierToViewMode(viewTier, phase)
    window.clui.setViewMode(mode)
  }, [phase, viewTier, coldOpenActive, goingLiveActive, showHistory, showSettings])

  // ─── Force-expand on Beat Check ───
  useEffect(() => {
    if (beatCheckPending && (viewTier === 'micro' || viewTier === 'compact')) {
      setViewTier('dashboard')
    }
  }, [beatCheckPending, viewTier, setViewTier])

  // ─── Onboarding completion handler ───
  const handleOnboardingComplete = useCallback((enterRoom: boolean) => {
    localStorage.setItem('showtime-onboarding-complete', 'true')
    setShowOnboarding(false)
    if (enterRoom) {
      enterWritersRoom()
    }
  }, [enterWritersRoom])

  // ─── Help button opens help dialog ───
  const handleHelpClick = useCallback(() => {
    setShowHelp(true)
  }, [])

  // ─── View routing ───
  const renderView = () => {
    // Settings overlay
    if (showSettings) {
      return <SettingsView key="settings" onBack={() => setShowSettings(false)} />
    }

    // History overlay
    if (showHistory) {
      return <HistoryView key="history" onBack={() => setShowHistory(false)} />
    }

    // Onboarding takes priority on first launch
    if (showOnboarding && phase === 'no_show' && isExpanded && !coldOpenActive && !goingLiveActive) {
      return (
        <OnboardingView
          key="onboarding"
          onComplete={() => handleOnboardingComplete(true)}
          onSkip={() => handleOnboardingComplete(false)}
        />
      )
    }

    // Cold Open transition (Dark Studio → Writer's Room)
    if (coldOpenActive) {
      return <ColdOpenTransition key="cold-open" onComplete={completeColdOpen} />
    }

    // Going Live transition takes priority
    if (goingLiveActive) {
      return <GoingLiveTransition key="going-live" onComplete={completeGoingLive} />
    }

    // Full-screen phases render regardless of viewTier
    switch (phase) {
      case 'no_show':
        return <DarkStudioView key="dark-studio" onShowHistory={() => setShowHistory(true)} />
      case 'writers_room':
        return <WritersRoomView key="writers-room" />
      case 'strike':
        return <StrikeView key="strike" onShowHistory={() => setShowHistory(true)} />
    }

    // Live/intermission/director — tier-based routing
    switch (viewTier) {
      case 'micro':
        return <PillView key="pill" />
      case 'compact':
        return <CompactView key="compact" />
      case 'dashboard':
        return <DashboardView key="dashboard" />
      case 'expanded':
      default:
        return <ExpandedView key="expanded" />
    }
  }

  return (
    <div data-testid="showtime-app" className="w-full h-full relative bg-transparent flex flex-col">
      {/* Help button — visible on DarkStudio when onboarding was completed */}
      {!showOnboarding && phase === 'no_show' && isExpanded && !coldOpenActive && !goingLiveActive && !showHistory && (
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
      <HelpDialog open={showHelp} onOpenChange={setShowHelp} />
      <BeatCheckModal />
    </div>
  )
}
