import { app, ipcMain, Notification, nativeTheme, shell } from 'electron'
import { getMainWindow, getSyncEngine, log, broadcast, controlPlane } from '../state'
import { applyViewMode, forceRepaint, isValidViewMode } from '../window'
import { DataService } from '../data/DataService'
import { IPC } from '../../shared/types'
import { appLog } from '../app-logger'
import { getMetricsWriter } from '../metrics'
import type { LogLevel } from '../app-logger'
import type { ShowStateSnapshot, TimelineEventInput, ClaudeContextPayload } from '../data/types'
import type { CachedCalendarEvent } from '../../shared/types'

export function registerShowtimeIpc(): void {
  // ─── Window management ───

  ipcMain.on(IPC.HIDE_WINDOW, () => {
    getMainWindow()?.hide()
  })

  ipcMain.on(IPC.MINIMIZE_TO_TRAY, () => {
    const win = getMainWindow()
    if (win && !win.isDestroyed()) {
      win.hide()
    }
  })

  ipcMain.on(IPC.APP_QUIT, () => {
    // Hide window first to avoid black flash during quit
    getMainWindow()?.hide()
    setTimeout(() => app.quit(), 100)
  })

  ipcMain.on(IPC.OPEN_EXTERNAL, (_event, url: string) => {
    // Only allow https URLs to prevent security issues
    if (typeof url === 'string' && url.startsWith('https://')) {
      shell.openExternal(url)
    }
  })

  ipcMain.handle(IPC.IS_VISIBLE, () => {
    return getMainWindow()?.isVisible() ?? false
  })

  // ─── Showtime notifications ───

  ipcMain.on(IPC.NOTIFY_ACT_COMPLETE, (_event, actName: string, sketch: string) => {
    log(`Showtime: Act Complete — ${actName} (${sketch})`)
    if (Notification.isSupported()) {
      new Notification({ title: `Act Complete: ${actName}`, body: `${sketch} — time for a Beat check!` }).show()
    }
  })

  ipcMain.on(IPC.NOTIFY_BEAT_CHECK, (_event, actName: string) => {
    log(`Showtime: Beat check — ${actName}`)
    if (Notification.isSupported()) {
      new Notification({ title: 'Beat Check', body: `Were you present during ${actName}?` }).show()
    }
  })

  ipcMain.on(IPC.NOTIFY_VERDICT, (_event, verdict: string, message: string) => {
    log(`Showtime: Verdict — ${verdict}`)
    if (Notification.isSupported()) {
      const fallbackMessages: Record<string, string> = {
        DAY_WON: 'Standing ovation! You showed up and you were present.',
        SOLID_SHOW: 'Not every sketch lands. The show was still great.',
        GOOD_EFFORT: 'You got on stage. That\'s the hardest part.',
        SHOW_CALLED_EARLY: 'A short show is still a show.',
      }
      new Notification({ title: 'Show Complete', body: message || fallbackMessages[verdict] || 'The show is over.' }).show()
    }
  })

  // ─── Showtime window management ───

  ipcMain.on(IPC.SET_VIEW_MODE, (_event, mode: unknown) => {
    if (!isValidViewMode(mode)) return
    appLog('DEBUG', 'view_mode_change', { mode })
    applyViewMode(mode)
  })

  ipcMain.on(IPC.FORCE_REPAINT, () => {
    forceRepaint()
  })

  // ─── Showtime data reset (truncates all tables + notifies renderer) ───

  ipcMain.handle(IPC.RESET_ALL_DATA, () => {
    try {
      const data = DataService.getInstance()
      data.resetAllData()
      broadcast(IPC.RESET_SHOW)
      log('Showtime: All data reset (tables truncated, renderer notified)')
      return { ok: true }
    } catch (err: unknown) {
      log(`RESET_ALL_DATA error: ${err instanceof Error ? err.message : String(err)}`)
      return { ok: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  // ─── Showtime data persistence IPC ───

  // ─── Renderer-side log events ───
  ipcMain.on(IPC.LOG_EVENT, (_event, level: LogLevel, eventName: string, data?: Record<string, unknown>) => {
    appLog(level, eventName, data)
  })

  ipcMain.handle(IPC.DATA_HYDRATE, () => {
    try {
      return getSyncEngine()?.hydrate() ?? null
    } catch (err: unknown) {
      log(`DATA_HYDRATE error: ${err instanceof Error ? err.message : String(err)}`)
      appLog('ERROR', 'data_hydrate_error', { error: err instanceof Error ? err.message : String(err) })
      return null
    }
  })

  ipcMain.on(IPC.DATA_SYNC, (_event, snapshot: ShowStateSnapshot) => {
    try {
      getSyncEngine()?.queueSync(snapshot)
    } catch (err: unknown) {
      log(`DATA_SYNC error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  ipcMain.handle(IPC.DATA_FLUSH, (_event, snapshot?: ShowStateSnapshot) => {
    try {
      getSyncEngine()?.flush(snapshot)
    } catch (err: unknown) {
      log(`DATA_FLUSH error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  ipcMain.on(IPC.TIMELINE_RECORD, (_event, event: TimelineEventInput) => {
    try {
      getSyncEngine()?.recordAndFlush(event)
    } catch (err: unknown) {
      log(`TIMELINE_RECORD error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  ipcMain.handle(IPC.TIMELINE_EVENTS, (_event, showId: string) => {
    try {
      const data = DataService.getInstance()
      return data.timeline.getEventsForShow(showId)
    } catch (err: unknown) {
      log(`TIMELINE_EVENTS error: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }
  })

  ipcMain.handle(IPC.TIMELINE_DRIFT, (_event, showId: string) => {
    try {
      const data = DataService.getInstance()
      return data.timeline.computeDrift(showId)
    } catch (err: unknown) {
      log(`TIMELINE_DRIFT error: ${err instanceof Error ? err.message : String(err)}`)
      return 0
    }
  })

  ipcMain.handle(IPC.TIMELINE_DRIFT_PER_ACT, (_event, showId: string) => {
    try {
      const data = DataService.getInstance()
      return data.timeline.getDriftPerAct(showId)
    } catch (err: unknown) {
      log(`TIMELINE_DRIFT_PER_ACT error: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }
  })

  ipcMain.on(IPC.CLAUDE_CONTEXT_SAVE, (_event, ctx: ClaudeContextPayload) => {
    try {
      const data = DataService.getInstance()
      data.claudeCtx.saveContext(ctx)
    } catch (err: unknown) {
      log(`CLAUDE_CONTEXT_SAVE error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  ipcMain.handle(IPC.CLAUDE_CONTEXT_GET, (_event, showId: string) => {
    try {
      const data = DataService.getInstance()
      return data.claudeCtx.getLatestContext(showId) ?? null
    } catch (err: unknown) {
      log(`CLAUDE_CONTEXT_GET error: ${err instanceof Error ? err.message : String(err)}`)
      return null
    }
  })

  ipcMain.handle(IPC.SHOW_HISTORY, (_event, limit?: number) => {
    const data = DataService.getInstance()
    return data.shows.getRecentShows(limit ?? 30)
  })

  ipcMain.handle(IPC.SHOW_DETAIL, (_event, showId: string) => {
    const data = DataService.getInstance()
    return data.shows.getShowDetail(showId)
  })

  ipcMain.on(IPC.METRICS_RECORD, (_event, name: string, durationMs: number, metadata?: Record<string, string>) => {
    try {
      const data = DataService.getInstance()
      data.metrics.recordTiming(name, durationMs, metadata)
    } catch (err: unknown) {
      log(`METRICS_RECORD error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  ipcMain.handle(IPC.METRICS_SUMMARY, (_event, name: string, days?: number) => {
    try {
      const data = DataService.getInstance()
      return data.metrics.getSummary(name, days)
    } catch (err: unknown) {
      log(`METRICS_SUMMARY error: ${err instanceof Error ? err.message : String(err)}`)
      return { avg: 0, p95: 0, min: 0, max: 0, count: 0 }
    }
  })

  // ─── Subprocess pre-warm ───

  ipcMain.on(IPC.PREWARM_SUBPROCESS, () => {
    try {
      controlPlane.preWarmSubprocess()
    } catch (err: unknown) {
      log(`PREWARM_SUBPROCESS error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── Calendar cache ───

  ipcMain.handle(IPC.CALENDAR_CACHE_GET, (_event, dayStartMs: number, dayEndMs: number) => {
    try {
      const data = DataService.getInstance()
      return data.calendarCache.getEventsForDay(dayStartMs, dayEndMs)
    } catch (err: unknown) {
      log(`CALENDAR_CACHE_GET error: ${err instanceof Error ? err.message : String(err)}`)
      return []
    }
  })

  ipcMain.on(IPC.CALENDAR_CACHE_SET, (_event, events: CachedCalendarEvent[]) => {
    try {
      const data = DataService.getInstance()
      data.calendarCache.upsertEvents(events)
    } catch (err: unknown) {
      log(`CALENDAR_CACHE_SET error: ${err instanceof Error ? err.message : String(err)}`)
    }
  })

  // ─── NDJSON file-based metrics (fire-and-forget) ───

  ipcMain.on(IPC.EMIT_METRIC, (_e, metric: string, value: number, tags?: Record<string, string>) => {
    try {
      getMetricsWriter().emit(metric, value, tags)
    } catch (err) {
      // silent — metrics should never crash the app
    }
  })

  // ─── Theme Detection ───

  ipcMain.handle(IPC.GET_THEME, () => {
    return { isDark: nativeTheme.shouldUseDarkColors }
  })

  nativeTheme.on('updated', () => {
    broadcast(IPC.THEME_CHANGED, nativeTheme.shouldUseDarkColors)
  })
}
