/**
 * Session Store — sendMessage logic.
 *
 * Extracted from sessionStore.ts to keep the store definition focused on state shape.
 * Handles prompt dispatch, queuing for busy tabs, user message rendering, and Claude API calls.
 */
import type { TabStatus } from '../../shared/types'
import type { SessionState } from './sessionStore'

type Set = (fn: (s: SessionState) => Partial<SessionState>) => void
type Get = () => SessionState

/** Create the sendMessage action for the session store. */
export function createSendMessage(set: Set, get: Get, nextMsgId: () => string) {
  return (prompt: string, options?: { projectPath?: string; displayText?: string; maxTurns?: number }) => {
    const projectPath = options?.projectPath
    const displayText = options?.displayText
    const maxTurns = options?.maxTurns
    const { activeTabId, tabs, staticInfo, tabReady } = get()
    if (!tabReady) {
      window.showtime.logEvent('INFO', 'sendMessage.queued', { reason: 'tab not ready yet', activeTabId })
      set((s) => ({ pendingPrompts: [...s.pendingPrompts, { prompt, options }] }))
      return
    }
    const tab = tabs.find((t) => t.id === activeTabId)
    const resolvedPath = projectPath || (tab?.hasChosenDirectory ? tab.workingDirectory : (staticInfo?.homePath || tab?.workingDirectory || '~'))
    if (!tab) {
      window.showtime.logEvent('ERROR', 'sendMessage.dropped', { reason: 'no tab', activeTabId })
      return
    }
    // Don't drop messages while connecting — queue them instead.
    // The warmup (initSession) sets status to 'connecting' for 20-40s.
    // User prompts during this window must be queued, not silently discarded.
    window.showtime.logEvent('INFO', 'sendMessage.dispatching', { tabId: tab.id, status: tab.status, promptLength: prompt.length })

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
    window.showtime.prompt(activeTabId, requestId, {
      prompt,
      projectPath: resolvedPath,
      sessionId: tab.claudeSessionId || undefined,
      model: preferredModel || 'claude-sonnet-4-6',
      addDirs: tab.additionalDirs.length > 0 ? tab.additionalDirs : undefined,
      ...(maxTurns ? { maxTurns } : {}),
    }).catch((err: Error) => {
      get().handleError(activeTabId, {
        message: err.message,
        stderrTail: [],
        exitCode: null,
        elapsedMs: 0,
        toolCallCount: 0,
      })
    })
  }
}
