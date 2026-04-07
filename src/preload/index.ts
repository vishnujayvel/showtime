import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { RunOptions, NormalizedEvent, HealthReport, EnrichedError, ViewMode, TrayShowState, CachedCalendarEvent, ShowStateSnapshot, TimelineEventInput, ActDriftResult, ClaudeContextPayload, ShowHistoryEntry, ShowDetailEntry, MetricsSummary } from '../shared/types'

/** Typed IPC bridge exposed to the renderer via contextBridge as window.showtime. */
export interface ShowtimeAPI {
  // ─── Request-response (renderer → main) ───
  start(): Promise<{ version: string; auth: { email?: string; subscriptionType?: string; authMethod?: string }; mcpServers: string[]; projectPath: string; homePath: string }>
  createTab(): Promise<{ tabId: string }>
  prompt(tabId: string, requestId: string, options: RunOptions): Promise<void>
  cancel(requestId: string): Promise<boolean>
  stopTab(tabId: string): Promise<boolean>
  retry(tabId: string, requestId: string, options: RunOptions): Promise<void>
  status(): Promise<HealthReport>
  tabHealth(): Promise<HealthReport>
  closeTab(tabId: string): Promise<void>
  respondPermission(tabId: string, questionId: string, optionId: string): Promise<boolean>
  initSession(tabId: string): void
  resetTabSession(tabId: string): void
  getTheme(): Promise<{ isDark: boolean }>
  onThemeChange(callback: (isDark: boolean) => void): () => void

  // ─── App lifecycle ───
  quit(): void
  openExternal(url: string): void

  // ─── Window management ───
  isVisible(): Promise<boolean>
  minimizeToTray(): void

  // ─── Event listeners (main → renderer) ───
  onEvent(callback: (tabId: string, event: NormalizedEvent) => void): () => void
  onTabStatusChange(callback: (tabId: string, newStatus: string, oldStatus: string) => void): () => void
  onError(callback: (tabId: string, error: EnrichedError) => void): () => void
  onSkillStatus(callback: (status: { name: string; state: string; error?: string; reason?: string }) => void): () => void

  // ─── Application logging ───
  logEvent(level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG', event: string, data?: Record<string, unknown>): void

  // ─── Showtime notifications ───
  notifyActComplete(actName: string, sketch: string): void
  notifyBeatCheck(actName: string): void
  notifyVerdict(verdict: string, message: string): void

  // ─── Showtime window management ───
  setViewMode(mode: ViewMode): void
  forceRepaint(): void
  onDayBoundary(callback: () => void): () => void
  onToggleExpanded(callback: () => void): () => void
  onResetShow(callback: () => void): () => void
  onOpenSettings(callback: () => void): () => void
  onTimerDisplayToggle(callback: () => void): () => void

  // ─── Showtime data persistence ───
  dataHydrate(): Promise<ShowStateSnapshot | null>
  dataSync(snapshot: ShowStateSnapshot): void
  dataFlush(snapshot?: ShowStateSnapshot): Promise<void>
  timelineRecord(event: TimelineEventInput): void
  getTimelineEvents(showId: string): Promise<TimelineEventInput[]>
  getTimelineDrift(showId: string): Promise<number>
  getTimelineDriftPerAct(showId: string): Promise<ActDriftResult[]>
  saveClaudeContext(ctx: ClaudeContextPayload): void
  getClaudeContext(showId: string): Promise<ClaudeContextPayload | null>
  getShowHistory(limit?: number): Promise<ShowHistoryEntry[]>
  getShowDetail(showId: string): Promise<ShowDetailEntry | null>
  recordMetricTiming(name: string, durationMs: number, metadata?: Record<string, string>): void
  getMetricsSummary(name: string, days?: number): Promise<MetricsSummary>

  // ─── Calendar cache ───
  getCalendarCache(dayStartMs: number, dayEndMs: number): Promise<CachedCalendarEvent[]>
  setCalendarCache(events: CachedCalendarEvent[]): void

  // ─── Subprocess pre-warm ───
  prewarmSubprocess(): void

  // ─── NDJSON file-based metrics ───
  emitMetric(metric: string, value: number, tags?: Record<string, string>): void

  // ─── Showtime tray state ───
  updateTrayState(state: TrayShowState): void
  updateTrayTimer(seconds: number): void

  // ─── Data reset ───
  resetAllData(): Promise<{ ok: boolean; error?: string }>

  // ─── Test-only (NODE_ENV=test) ───
  testGetWindowConfig?: () => Promise<{ alwaysOnTop: boolean; visibleOnAllWorkspaces: boolean; backgroundColor: string; bounds: { x: number; y: number; width: number; height: number } }>
  testGetTrayMenu?: () => Promise<string[]>
}

const api: ShowtimeAPI = {
  // ─── Request-response ───
  start: () => ipcRenderer.invoke(IPC.START),
  createTab: () => ipcRenderer.invoke(IPC.CREATE_TAB),
  prompt: (tabId, requestId, options) => ipcRenderer.invoke(IPC.PROMPT, { tabId, requestId, options }),
  cancel: (requestId) => ipcRenderer.invoke(IPC.CANCEL, requestId),
  stopTab: (tabId) => ipcRenderer.invoke(IPC.STOP_TAB, tabId),
  retry: (tabId, requestId, options) => ipcRenderer.invoke(IPC.RETRY, { tabId, requestId, options }),
  status: () => ipcRenderer.invoke(IPC.STATUS),
  tabHealth: () => ipcRenderer.invoke(IPC.TAB_HEALTH),
  closeTab: (tabId) => ipcRenderer.invoke(IPC.CLOSE_TAB, tabId),
  respondPermission: (tabId, questionId, optionId) =>
    ipcRenderer.invoke(IPC.RESPOND_PERMISSION, { tabId, questionId, optionId }),
  initSession: (tabId) => ipcRenderer.send(IPC.INIT_SESSION, tabId),
  resetTabSession: (tabId) => ipcRenderer.send(IPC.RESET_TAB_SESSION, tabId),
  getTheme: () => ipcRenderer.invoke(IPC.GET_THEME),
  onThemeChange: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, isDark: boolean) => callback(isDark)
    ipcRenderer.on(IPC.THEME_CHANGED, handler)
    return () => ipcRenderer.removeListener(IPC.THEME_CHANGED, handler)
  },

  // ─── App lifecycle ───
  quit: () => ipcRenderer.send(IPC.APP_QUIT),
  openExternal: (url: string) => ipcRenderer.send(IPC.OPEN_EXTERNAL, url),

  // ─── Window management ───
  isVisible: () => ipcRenderer.invoke(IPC.IS_VISIBLE),
  minimizeToTray: () => ipcRenderer.send(IPC.MINIMIZE_TO_TRAY),

  // ─── Event listeners ───
  onEvent: (callback) => {
    // Single unified handler — all normalized events come through one channel
    const handler = (_e: Electron.IpcRendererEvent, tabId: string, event: NormalizedEvent) => callback(tabId, event)
    ipcRenderer.on(IPC.NORMALIZED_EVENT, handler)
    return () => ipcRenderer.removeListener(IPC.NORMALIZED_EVENT, handler)
  },

  onTabStatusChange: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, tabId: string, newStatus: string, oldStatus: string) =>
      callback(tabId, newStatus, oldStatus)
    ipcRenderer.on(IPC.TAB_STATUS_CHANGE, handler)
    return () => ipcRenderer.removeListener(IPC.TAB_STATUS_CHANGE, handler)
  },

  onError: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, tabId: string, error: EnrichedError) =>
      callback(tabId, error)
    ipcRenderer.on(IPC.ENRICHED_ERROR, handler)
    return () => ipcRenderer.removeListener(IPC.ENRICHED_ERROR, handler)
  },

  onSkillStatus: (callback) => {
    const handler = (_e: Electron.IpcRendererEvent, status: any) => callback(status)
    ipcRenderer.on(IPC.SKILL_STATUS, handler)
    return () => ipcRenderer.removeListener(IPC.SKILL_STATUS, handler)
  },

  // ─── Application logging ───
  logEvent: (level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG', event: string, data?: Record<string, unknown>) =>
    ipcRenderer.send(IPC.LOG_EVENT, level, event, data),

  // ─── Showtime notifications ───
  notifyActComplete: (actName: string, sketch: string) => ipcRenderer.send(IPC.NOTIFY_ACT_COMPLETE, actName, sketch),
  notifyBeatCheck: (actName: string) => ipcRenderer.send(IPC.NOTIFY_BEAT_CHECK, actName),
  notifyVerdict: (verdict: string, message: string) => ipcRenderer.send(IPC.NOTIFY_VERDICT, verdict, message),

  // ─── Calendar cache ───
  getCalendarCache: (dayStartMs: number, dayEndMs: number) => ipcRenderer.invoke(IPC.CALENDAR_CACHE_GET, dayStartMs, dayEndMs),
  setCalendarCache: (events: CachedCalendarEvent[]) => ipcRenderer.send(IPC.CALENDAR_CACHE_SET, events),

  // ─── Subprocess pre-warm ───
  prewarmSubprocess: () => ipcRenderer.send(IPC.PREWARM_SUBPROCESS),

  // ─── NDJSON file-based metrics ───
  emitMetric: (metric: string, value: number, tags?: Record<string, string>) => ipcRenderer.send(IPC.EMIT_METRIC, metric, value, tags),

  // ─── Showtime tray state ───
  updateTrayState: (state: TrayShowState) => ipcRenderer.send(IPC.TRAY_STATE_UPDATE, state),
  updateTrayTimer: (seconds: number) => ipcRenderer.send(IPC.TRAY_TIMER_UPDATE, seconds),

  // ─── Showtime window management ───
  setViewMode: (mode) => ipcRenderer.send(IPC.SET_VIEW_MODE, mode),
  forceRepaint: () => ipcRenderer.send(IPC.FORCE_REPAINT),

  onDayBoundary: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.DAY_BOUNDARY, handler)
    return () => ipcRenderer.removeListener(IPC.DAY_BOUNDARY, handler)
  },

  onToggleExpanded: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.TOGGLE_EXPANDED, handler)
    return () => ipcRenderer.removeListener(IPC.TOGGLE_EXPANDED, handler)
  },

  onResetShow: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.RESET_SHOW, handler)
    return () => ipcRenderer.removeListener(IPC.RESET_SHOW, handler)
  },

  onOpenSettings: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.OPEN_SETTINGS, handler)
    return () => ipcRenderer.removeListener(IPC.OPEN_SETTINGS, handler)
  },

  onTimerDisplayToggle: (callback) => {
    const handler = () => callback()
    ipcRenderer.on(IPC.TIMER_DISPLAY_TOGGLE, handler)
    return () => ipcRenderer.removeListener(IPC.TIMER_DISPLAY_TOGGLE, handler)
  },

  // ─── Showtime data persistence ───
  dataHydrate: () => ipcRenderer.invoke(IPC.DATA_HYDRATE),
  dataSync: (snapshot: ShowStateSnapshot) => ipcRenderer.send(IPC.DATA_SYNC, snapshot),
  dataFlush: (snapshot?: ShowStateSnapshot) => ipcRenderer.invoke(IPC.DATA_FLUSH, snapshot),
  timelineRecord: (event: TimelineEventInput) => ipcRenderer.send(IPC.TIMELINE_RECORD, event),
  getTimelineEvents: (showId: string) => ipcRenderer.invoke(IPC.TIMELINE_EVENTS, showId),
  getTimelineDrift: (showId: string) => ipcRenderer.invoke(IPC.TIMELINE_DRIFT, showId),
  getTimelineDriftPerAct: (showId: string) => ipcRenderer.invoke(IPC.TIMELINE_DRIFT_PER_ACT, showId),
  saveClaudeContext: (ctx: ClaudeContextPayload) => ipcRenderer.send(IPC.CLAUDE_CONTEXT_SAVE, ctx),
  getClaudeContext: (showId: string) => ipcRenderer.invoke(IPC.CLAUDE_CONTEXT_GET, showId),
  getShowHistory: (limit?: number) => ipcRenderer.invoke(IPC.SHOW_HISTORY, limit),
  getShowDetail: (showId: string) => ipcRenderer.invoke(IPC.SHOW_DETAIL, showId),
  recordMetricTiming: (name: string, durationMs: number, metadata?: Record<string, string>) => ipcRenderer.send(IPC.METRICS_RECORD, name, durationMs, metadata),
  getMetricsSummary: (name: string, days?: number) => ipcRenderer.invoke(IPC.METRICS_SUMMARY, name, days),

  // ─── Data reset ───
  resetAllData: () => ipcRenderer.invoke(IPC.RESET_ALL_DATA),

  // Test-only IPC (NODE_ENV=test)
  ...(process.env.NODE_ENV === 'test' ? {
    testGetWindowConfig: () => ipcRenderer.invoke('test:get-window-config'),
    testGetTrayMenu: () => ipcRenderer.invoke('test:get-tray-menu'),
  } : {}),
}

contextBridge.exposeInMainWorld('showtime', api)
