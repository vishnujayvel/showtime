import { create } from 'zustand'
import type { TabStatus, NormalizedEvent, EnrichedError, Message, TabState } from '../../shared/types'
import { useThemeStore } from '../theme'
import { useShowStore } from './showStore'
// @ts-expect-error Vite handles mp3 imports at build time
import notificationSrc from '../../../resources/notification.mp3'

// ─── Known models ───

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

interface State {
  /** Single session tab (Showtime uses one Claude session) */
  tabs: TabState[]
  activeTabId: string
  /** True once createTab() has resolved and the tab ID is valid in ControlPlane */
  tabReady: boolean
  isExpanded: boolean
  staticInfo: StaticInfo | null
  preferredModel: string | null

  // Actions
  initStaticInfo: () => Promise<void>
  setPreferredModel: (model: string | null) => void
  createTab: () => Promise<string>
  toggleExpanded: () => void
  addSystemMessage: (content: string) => void
  sendMessage: (prompt: string, projectPath?: string, displayText?: string) => void
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
    const visible = await window.clui.isVisible()
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
function updateTab(set: (fn: (s: State) => Partial<State>) => void, get: () => State, updates: Partial<TabState>) {
  const { activeTabId } = get()
  set((s) => ({
    tabs: s.tabs.map((t) => t.id === activeTabId ? { ...t, ...updates } : t),
  }))
}

const initialTab = makeLocalTab()

export const useSessionStore = create<State>((set, get) => ({
  tabs: [initialTab],
  activeTabId: initialTab.id,
  tabReady: false,
  isExpanded: false,
  staticInfo: null,
  preferredModel: null,

  initStaticInfo: async () => {
    try {
      const result = await window.clui.start()
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
      const { tabId } = await window.clui.createTab()
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
    window.clui.respondPermission(tabId, questionId, optionId).catch(() => {})
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

  sendMessage: (prompt, projectPath, displayText) => {
    const { activeTabId, tabs, staticInfo, tabReady } = get()
    if (!tabReady) {
      window.clui.logEvent('WARN', 'sendMessage.dropped', { reason: 'tab not ready yet', activeTabId })
      return
    }
    const tab = tabs.find((t) => t.id === activeTabId)
    const resolvedPath = projectPath || (tab?.hasChosenDirectory ? tab.workingDirectory : (staticInfo?.homePath || tab?.workingDirectory || '~'))
    if (!tab) {
      window.clui.logEvent('ERROR', 'sendMessage.dropped', { reason: 'no tab', activeTabId })
      return
    }
    // Don't drop messages while connecting — queue them instead.
    // The warmup (initSession) sets status to 'connecting' for 20-40s.
    // User prompts during this window must be queued, not silently discarded.
    window.clui.logEvent('INFO', 'sendMessage.dispatching', { tabId: tab.id, status: tab.status, promptLength: prompt.length })

    const isBusy = tab.status === 'running' || tab.status === 'connecting'
    const requestId = crypto.randomUUID()

    const visibleText = displayText || prompt
    const title = tab.messages.length === 0
      ? (visibleText.length > 30 ? visibleText.substring(0, 27) + '...' : visibleText)
      : tab.title

    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== activeTabId) return t
        const withBase = t.hasChosenDirectory
          ? t
          : { ...t, hasChosenDirectory: true, workingDirectory: resolvedPath }
        if (isBusy) {
          return {
            ...withBase,
            title,
            queuedPrompts: [...withBase.queuedPrompts, prompt],
            currentActivity: 'The writers are getting ready...',
            messages: [
              ...withBase.messages,
              { id: nextMsgId(), role: 'user' as const, content: visibleText, timestamp: Date.now() },
            ],
          }
        }
        return {
          ...withBase,
          status: 'connecting' as TabStatus,
          activeRequestId: requestId,
          currentActivity: 'The writers are getting ready...',
          title,
          messages: [
            ...withBase.messages,
            { id: nextMsgId(), role: 'user' as const, content: visibleText, timestamp: Date.now() },
          ],
        }
      }),
    }))

    const { preferredModel } = get()
    window.clui.prompt(activeTabId, requestId, {
      prompt,
      projectPath: resolvedPath,
      sessionId: tab.claudeSessionId || undefined,
      model: preferredModel || 'claude-sonnet-4-6',
      addDirs: tab.additionalDirs.length > 0 ? tab.additionalDirs : undefined,
    }).catch((err: Error) => {
      get().handleError(activeTabId, {
        message: err.message,
        stderrTail: [],
        exitCode: null,
        elapsedMs: 0,
        toolCallCount: 0,
      })
    })
  },

  // ─── Event handlers ───

  handleNormalizedEvent: (tabId, event) => {
    set((s) => {
      const { activeTabId } = s
      const tabs = s.tabs.map((tab) => {
        if (tab.id !== tabId) return tab
        const updated = { ...tab }

        switch (event.type) {
          case 'session_init':
            updated.claudeSessionId = event.sessionId
            updated.sessionModel = event.model
            updated.sessionTools = event.tools
            updated.sessionMcpServers = event.mcpServers
            updated.sessionSkills = event.skills
            updated.sessionVersion = event.version
            // Detect Google Calendar MCP availability
            {
              const hasCalendar = event.tools.some((t: string) =>
                t.toLowerCase().includes('gcal') ||
                t.toLowerCase().includes('google_calendar') ||
                t.toLowerCase().includes('calendar')
              )
              if (hasCalendar) {
                useShowStore.getState().setCalendarAvailable(true)
                localStorage.setItem('showtime-gcal-connected', 'true')
              } else {
                localStorage.removeItem('showtime-gcal-connected')
                useShowStore.getState().setCalendarAvailable(false)
              }
            }
            if (!event.isWarmup) {
              updated.status = 'running'
              updated.currentActivity = 'Thinking...'
              // Clear queued prompts — user messages are already shown when queued
              if (updated.queuedPrompts.length > 0) {
                updated.queuedPrompts = []
              }
            }
            break

          case 'text_chunk': {
            updated.currentActivity = 'Writing...'
            const lastMsg = updated.messages[updated.messages.length - 1]
            if (lastMsg?.role === 'assistant' && !lastMsg.toolName) {
              updated.messages = [
                ...updated.messages.slice(0, -1),
                { ...lastMsg, content: lastMsg.content + event.text },
              ]
            } else {
              updated.messages = [
                ...updated.messages,
                { id: nextMsgId(), role: 'assistant', content: event.text, timestamp: Date.now() },
              ]
            }
            break
          }

          case 'tool_call':
            updated.currentActivity = `Running ${event.toolName}...`
            updated.messages = [
              ...updated.messages,
              {
                id: nextMsgId(),
                role: 'tool',
                content: '',
                toolName: event.toolName,
                toolInput: '',
                toolStatus: 'running',
                timestamp: Date.now(),
              },
            ]
            break

          case 'tool_call_update': {
            const msgs = [...updated.messages]
            const lastTool = [...msgs].reverse().find((m) => m.role === 'tool' && m.toolStatus === 'running')
            if (lastTool) {
              lastTool.toolInput = (lastTool.toolInput || '') + event.partialInput
            }
            updated.messages = msgs
            break
          }

          case 'tool_call_complete': {
            const msgs2 = [...updated.messages]
            const runningTool = [...msgs2].reverse().find((m) => m.role === 'tool' && m.toolStatus === 'running')
            if (runningTool) {
              runningTool.toolStatus = 'completed'
            }
            updated.messages = msgs2
            break
          }

          case 'task_update': {
            if (event.message?.content) {
              const lastUserIdx = (() => {
                for (let i = updated.messages.length - 1; i >= 0; i--) {
                  if (updated.messages[i].role === 'user') return i
                }
                return -1
              })()
              const hasStreamedText = updated.messages
                .slice(lastUserIdx + 1)
                .some((m) => m.role === 'assistant' && !m.toolName)

              if (!hasStreamedText) {
                const textContent = event.message.content
                  .filter((b) => b.type === 'text' && b.text)
                  .map((b) => b.text!)
                  .join('')
                if (textContent) {
                  updated.messages = [
                    ...updated.messages,
                    { id: nextMsgId(), role: 'assistant' as const, content: textContent, timestamp: Date.now() },
                  ]
                }
              }

              for (const block of event.message.content) {
                if (block.type === 'tool_use' && block.name) {
                  const exists = updated.messages.find(
                    (m) => m.role === 'tool' && m.toolName === block.name && !m.content
                  )
                  if (!exists) {
                    updated.messages = [
                      ...updated.messages,
                      {
                        id: nextMsgId(),
                        role: 'tool',
                        content: '',
                        toolName: block.name,
                        toolInput: JSON.stringify(block.input, null, 2),
                        toolStatus: 'completed',
                        timestamp: Date.now(),
                      },
                    ]
                  }
                }
              }
            }
            break
          }

          case 'task_complete':
            updated.status = 'completed'
            updated.activeRequestId = null
            updated.currentActivity = ''
            updated.permissionQueue = []
            updated.lastResult = {
              totalCostUsd: event.costUsd,
              durationMs: event.durationMs,
              numTurns: event.numTurns,
              usage: event.usage,
              sessionId: event.sessionId,
            }
            if (event.result) {
              const lastUserIdx2 = (() => {
                for (let i = updated.messages.length - 1; i >= 0; i--) {
                  if (updated.messages[i].role === 'user') return i
                }
                return -1
              })()
              const hasAnyText = updated.messages
                .slice(lastUserIdx2 + 1)
                .some((m) => m.role === 'assistant' && !m.toolName)
              if (!hasAnyText) {
                updated.messages = [
                  ...updated.messages,
                  { id: nextMsgId(), role: 'assistant' as const, content: event.result, timestamp: Date.now() },
                ]
              }
            }
            if (tabId !== activeTabId || !s.isExpanded) {
              updated.hasUnread = true
            }
            if (event.permissionDenials && event.permissionDenials.length > 0) {
              updated.permissionDenied = { tools: event.permissionDenials }
            } else {
              updated.permissionDenied = null
            }
            playNotificationIfHidden()
            break

          case 'error':
            updated.status = 'failed'
            updated.activeRequestId = null
            updated.currentActivity = ''
            updated.permissionQueue = []
            updated.permissionDenied = null
            updated.messages = [
              ...updated.messages,
              { id: nextMsgId(), role: 'system', content: `Error: ${event.message}`, timestamp: Date.now() },
            ]
            break

          case 'session_dead':
            updated.status = 'dead'
            updated.activeRequestId = null
            updated.currentActivity = ''
            updated.permissionQueue = []
            updated.permissionDenied = null
            updated.messages = [
              ...updated.messages,
              {
                id: nextMsgId(),
                role: 'system',
                content: `Session ended unexpectedly (exit ${event.exitCode})`,
                timestamp: Date.now(),
              },
            ]
            break

          case 'permission_request': {
            const newReq: import('../../shared/types').PermissionRequest = {
              questionId: event.questionId,
              toolTitle: event.toolName,
              toolDescription: event.toolDescription,
              toolInput: event.toolInput,
              options: event.options.map((o) => ({
                optionId: o.id,
                kind: o.kind,
                label: o.label,
              })),
            }
            updated.permissionQueue = [...updated.permissionQueue, newReq]
            updated.currentActivity = `Waiting for permission: ${event.toolName}`
            break
          }

          case 'rate_limit':
            if (event.status !== 'allowed') {
              updated.messages = [
                ...updated.messages,
                {
                  id: nextMsgId(),
                  role: 'system',
                  content: `Rate limited (${event.rateLimitType}). Resets at ${new Date(event.resetsAt).toLocaleTimeString()}.`,
                  timestamp: Date.now(),
                },
              ]
            }
            break
        }

        return updated
      })

      return { tabs }
    })
  },

  handleStatusChange: (tabId, newStatus) => {
    set((s) => ({
      tabs: s.tabs.map((t) =>
        t.id === tabId
          ? {
              ...t,
              status: newStatus as TabStatus,
              ...(newStatus === 'idle' ? { currentActivity: '', permissionQueue: [] as import('../../shared/types').PermissionRequest[], permissionDenied: null } : {}),
            }
          : t
      ),
    }))
  },

  handleError: (tabId, error) => {
    set((s) => ({
      tabs: s.tabs.map((t) => {
        if (t.id !== tabId) return t
        const lastMsg = t.messages[t.messages.length - 1]
        const alreadyHasError = lastMsg?.role === 'system' && lastMsg.content.startsWith('Error:')
        return {
          ...t,
          status: 'failed' as TabStatus,
          activeRequestId: null,
          currentActivity: '',
          permissionQueue: [],
          messages: alreadyHasError
            ? t.messages
            : [
                ...t.messages,
                {
                  id: nextMsgId(),
                  role: 'system' as const,
                  content: `Error: ${error.message}${error.stderrTail.length > 0 ? '\n\n' + error.stderrTail.slice(-5).join('\n') : ''}`,
                  timestamp: Date.now(),
                },
              ],
        }
      }),
    }))
  },
}))
