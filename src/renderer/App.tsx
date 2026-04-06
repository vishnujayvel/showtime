import { useEffect, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useClaudeEvents } from './hooks/useClaudeEvents'
import { useHealthReconciliation } from './hooks/useHealthReconciliation'
import { useTraySync } from './hooks/useTraySync'
import { useSessionStore } from './stores/sessionStore'
import {
  useShowPhase,
  useShowContext,
  useShowSend,
  useShowSelector,
  useColdOpenActive,
  useGoingLiveActive,
  useOverlay,
  showSelectors,
} from './machines/ShowMachineProvider'
import { hydrateFromDB } from './machines/showActor'
import { useUIStore } from './stores/uiStore'
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
import { HelpButton } from './components/HelpButton'
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
  useTraySync()

  const phase = useShowPhase()
  const viewTier = useShowContext((ctx) => ctx.viewTier)
  const isExpanded = useShowSelector(showSelectors.isExpanded)
  const coldOpenActive = useColdOpenActive()
  const goingLiveActive = useGoingLiveActive()
  const beatCheckPending = useShowContext((ctx) => ctx.beatCheckPending)
  const send = useShowSend()
  const setSystemTheme = useThemeStore((s) => s.setSystemTheme)
  const timerDisplay = useUIStore((s) => s.timerDisplay)
  const toggleTimerDisplay = useUIStore((s) => s.toggleTimerDisplay)

  const overlay = useOverlay()
  const showOnboarding = overlay === 'onboarding'
  const showHistory = overlay === 'history'
  const showSettings = overlay === 'settings'

  // Open onboarding only while still in the initial no_show phase
  useEffect(() => {
    const onboardingComplete = localStorage.getItem('showtime-onboarding-complete') === 'true'

    if (!onboardingComplete && phase === 'no_show' && overlay === 'none') {
      send({ type: 'VIEW_ONBOARDING' })
      return
    }

    // Clean up stale overlay if phase advanced past no_show
    if (phase !== 'no_show' && overlay === 'onboarding') {
      send({ type: 'CLOSE_OVERLAY' })
    }
  }, [phase, overlay, send])

  // ─── Listen for tray-triggered reset ───
  useEffect(() => {
    if (!window.showtime?.onResetShow) return
    return window.showtime.onResetShow(() => send({ type: 'RESET' }))
  }, [send])

  // ─── Listen for settings open (Cmd+, or tray) ───
  useEffect(() => {
    if (!window.showtime?.onOpenSettings) return
    return window.showtime.onOpenSettings(() => send({ type: 'VIEW_SETTINGS' }))
  }, [send])

  // ─── Theme initialization ───
  useEffect(() => {
    window.showtime.getTheme().then(({ isDark }) => {
      setSystemTheme(isDark)
    }).catch(() => {})

    const unsub = window.showtime.onThemeChange((isDark) => {
      setSystemTheme(isDark)
    })
    return unsub
  }, [setSystemTheme])

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
        window.showtime.createTab().then(({ tabId }) => {
          useSessionStore.setState((s) => ({
            tabs: s.tabs.map((t, i) => (i === 0 ? { ...t, id: tabId } : t)),
            activeTabId: tabId,
            tabReady: true,
          }))
          // Warm up immediately after tab is created — don't wait for Writer's Room
          window.showtime.initSession(tabId)
        }).catch(() => {})
      }
    })
  }, [])

  // ─── Listen for timer display toggle from tray menu ───
  useEffect(() => {
    if (!window.showtime?.onTimerDisplayToggle) return
    return window.showtime.onTimerDisplayToggle(() => toggleTimerDisplay())
  }, [toggleTimerDisplay])

  // ─── Auto-resume from DB on startup ───
  useEffect(() => {
    // If the machine is at no_show (localStorage was empty/stale),
    // try to restore from SQLite. This handles app restart scenarios.
    if (phase === 'no_show') {
      hydrateFromDB()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps -- one-time startup check

  // ─── Dynamic window sizing via IPC ───
  useEffect(() => {
    if (!window.showtime?.setViewMode) return

    if (coldOpenActive || goingLiveActive) {
      window.showtime.setViewMode('full')
      return
    }

    // Overlay views (history, settings, onboarding) are full-screen
    if (overlay !== 'none') {
      window.showtime.setViewMode('full')
      return
    }

    const mode = tierToViewMode(viewTier, phase)
    window.showtime.setViewMode(mode)
  }, [phase, viewTier, coldOpenActive, goingLiveActive, overlay])

  // ─── Force-expand on Beat Check ───
  useEffect(() => {
    if (beatCheckPending && (viewTier === 'micro' || viewTier === 'compact')) {
      send({ type: 'SET_VIEW_TIER', tier: 'dashboard' })
    }
  }, [beatCheckPending, viewTier, send])

  // ─── Onboarding completion handler ───
  const handleOnboardingComplete = useCallback((enterRoom: boolean) => {
    localStorage.setItem('showtime-onboarding-complete', 'true')
    send({ type: 'CLOSE_OVERLAY' })
    if (enterRoom) {
      send({ type: 'ENTER_WRITERS_ROOM' })
    }
  }, [send])

  // ─── View routing ───
  const renderView = () => {
    // Settings overlay
    if (showSettings) {
      return <SettingsView key="settings" onBack={() => send({ type: 'CLOSE_OVERLAY' })} />
    }

    // History overlay
    if (showHistory) {
      return <HistoryView key="history" onBack={() => send({ type: 'CLOSE_OVERLAY' })} />
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
      return <ColdOpenTransition key="cold-open" onComplete={() => send({ type: 'COMPLETE_COLD_OPEN' })} />
    }

    // Going Live transition takes priority
    if (goingLiveActive) {
      return <GoingLiveTransition key="going-live" onComplete={() => send({ type: 'COMPLETE_GOING_LIVE' })} />
    }

    // Full-screen phases render regardless of viewTier
    switch (phase) {
      case 'no_show':
        return <DarkStudioView key="dark-studio" />
      case 'writers_room':
        return <WritersRoomView key="writers-room" />
      case 'strike':
        return <StrikeView key="strike" />
    }

    // Live/intermission/director — tier-based routing
    // When menu bar timer is active, skip pill and show compact instead
    switch (viewTier) {
      case 'micro':
        return timerDisplay === 'menubar'
          ? <CompactView key="compact" />
          : <PillView key="pill" />
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
      {/* Help button — visible on every view except onboarding, transitions, pill, and compact */}
      {overlay === 'none' && !coldOpenActive && !goingLiveActive && isExpanded && viewTier !== 'micro' && viewTier !== 'compact' && (
        <HelpButton
          phase={showSettings ? 'settings' : phase}
          className="absolute right-3 top-3.5"
        />
      )}
      <AnimatePresence mode="wait">
        {renderView()}
      </AnimatePresence>
      <BeatCheckModal />
    </div>
  )
}
