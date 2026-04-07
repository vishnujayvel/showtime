import { create } from 'zustand'
import type { TabStatus, NormalizedEvent, EnrichedError, Message, TabState } from '../../shared/types'
import { useThemeStore } from '../theme'
import { useUIStore } from './uiStore'
import { createSendMessage } from './sessionStore.sendMessage'
import { createHandleNormalizedEvent, createHandleStatusChange, createHandleError } from './sessionStore.events'
import notificationSrc from '../../../resources/notification.mp3'

// ─── Known models ───

/** List of Claude models available for selection in the session settings. */
export const AVAILABLE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
] as const

// ─── Store ───

interface StaticInfo {
  version: string
  email: string | null
  subscriptionType: string | null
  projectPath: string
  homePath: string
}

/** Full state shape for the session store, exported for use by extracted modules. */
export interface SessionState {
  /** Single session tab (Showtime uses one Claude session) */
  tabs: TabState[]
  activeTabId: string
  /** True once createTab() has resolved and the tab ID is valid in ControlPlane */
  tabReady: boolean
  /** Prompts queued before tabReady — flushed when tab becomes ready */
  pendingPrompts: Array<{ prompt: string; options?: { projectPath?: string; displayText?: string; maxTurns?: number } }>
  isExpanded: boolean
  staticInfo: StaticInfo | null
  preferredModel: string | null

  // Actions
  initStaticInfo: () => Promise<void>
  setPreferredModel: (model: string | null) => void
  createTab: () => Promise<string>
  toggleExpanded: () => void
  addSystemMessage: (content: string) => void
  sendMessage: (prompt: string, options?: { projectPath?: string; displayText?: string; maxTurns?: number }) => void
  respondPermission: (tabId: string, questionId: string, optionId: string) => void
  handleNormalizedEvent: (tabId: string, event: NormalizedEvent) => void
  handleStatusChange: (tabId: string, newStatus: string, oldStatus: string) => void
  handleError: (tabId: string, error: EnrichedError) => void
}

let msgCounter = 0
const nextMsgId = () => `msg-${++msgCounter}`

// ─── Notification sound (plays when task completes while window is hidden) ───
const notificationAudio = new Audio(notificationSrc)
notificationAudio.volume = 1.0

async function playNotificationIfHidden(): Promise<void> {
  if (!useThemeStore.getState().soundEnabled) return
  try {
    const visible = await window.showtime.isVisible()
    if (!visible) {
      notificationAudio.currentTime = 0
      notificationAudio.play().catch(() => {})
    }
  } catch {}
}

function makeLocalTab(): TabState {
  return {
    id: crypto.randomUUID(),
    claudeSessionId: null,
    status: 'idle',
    activeRequestId: null,
    hasUnread: false,
    currentActivity: '',
    permissionQueue: [],
    permissionDenied: null,
    attachments: [],
    messages: [],
    title: 'Showtime',
    lastResult: null,
    sessionModel: null,
    sessionTools: [],
    sessionMcpServers: [],
    sessionSkills: [],
    sessionVersion: null,
    queuedPrompts: [],
    workingDirectory: '~',
    hasChosenDirectory: false,
    additionalDirs: [],
  }
}

/** Helper: update the single active tab's fields */
function updateTab(set: (fn: (s: SessionState) => Partial<SessionState>) => void, get: () => SessionState, updates: Partial<TabState>) {
  const { activeTabId } = get()
  set((s) => ({
    tabs: s.tabs.map((t) => t.id === activeTabId ? { ...t, ...updates } : t),
  }))
}

const initialTab = makeLocalTab()

/** Zustand store managing the Claude subprocess session, message history, and permission flow. */
export const useSessionStore = create<SessionState>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  tabReady: false,
  pendingPrompts: [],
  isExpanded: false,
  staticInfo: null,
  preferredModel: null,

  initStaticInfo: async () => {
    try {
      const result = await window.showtime.start()
      set({
        staticInfo: {
          version: result.version || 'unknown',
          email: result.auth?.email || null,
          subscriptionType: result.auth?.subscriptionType || null,
          projectPath: result.projectPath || '~',
          homePath: result.homePath || '~',
        },
      })
    } catch {}
  },

  setPreferredModel: (model) => {
    set({ preferredModel: model })
  },

  createTab: async () => {
    const homeDir = get().staticInfo?.homePath || '~'
    try {
      const { tabId } = await window.showtime.createTab()
      const tab: TabState = { ...makeLocalTab(), id: tabId, workingDirectory: homeDir }
      set({ tabs: [tab], activeTabId: tab.id })
      return tabId
    } catch {
      const tab = makeLocalTab()
      tab.workingDirectory = homeDir
      set({ tabs: [tab], activeTabId: tab.id })
      return tab.id
    }
  },

  toggleExpanded: () => {
    set((s) => ({ isExpanded: !s.isExpanded }))
  },

  addSystemMessage: (content) => {
    updateTab(set, get, {
      messages: [
        ...get().tabs[0].messages,
        { id: nextMsgId(), role: 'system' as const, content, timestamp: Date.now() },
      ],
    })
  },

  respondPermission: (tabId, questionId, optionId) => {
    window.showtime.respondPermission(tabId, questionId, optionId).catch(() => {})
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t
        const remaining = t.permissionQueue.filter((p) => p.questionId !== questionId)
        return {
          ...t,
          permissionQueue: remaining,
          currentActivity: remaining.length > 0
            ? `Waiting for permission: ${remaining[0].toolTitle}`
            : 'Working...',
        }
      }),
    }))
  },

  sendMessage: createSendMessage(set, get, nextMsgId),

  handleNormalizedEvent: createHandleNormalizedEvent(set, get, nextMsgId, playNotificationIfHidden),
  handleStatusChange: createHandleStatusChange(set),
  handleError: createHandleError(set, nextMsgId),
}))
