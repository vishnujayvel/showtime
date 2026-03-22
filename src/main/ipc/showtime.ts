import { app, ipcMain, Notification, nativeTheme } from 'electron'
import { getMainWindow, getSyncEngine, log, broadcast } from '../state'
import { applyViewMode } from '../window'
import { DataService } from '../data/DataService'
import { IPC } from '../../shared/types'
import type { ShowStateSnapshot, TimelineEventInput, ClaudeContextPayload } from '../data/types'

export function registerShowtimeIpc(): void {
  // ─── Window management ───

  ipcMain.on(IPC.HIDE_WINDOW, () => {
    getMainWindow()?.hide()
  })

  ipcMain.on(IPC.APP_QUIT, () => {
    // Hide window first to avoid black flash during quit
    getMainWindow()?.hide()
    setTimeout(() => app.quit(), 100)
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

  ipcMain.on(IPC.SET_VIEW_MODE, (_event, mode: 'pill' | 'expanded' | 'full') => {
    applyViewMode(mode)
  })

  // ─── Showtime data persistence IPC ───

  ipcMain.handle(IPC.DATA_HYDRATE, () => {
    try {
      return getSyncEngine()?.hydrate() ?? null
    } catch (err: unknown) {
      log(`DATA_HYDRATE error: ${err instanceof Error ? err.message : String(err)}`)
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
    try {
      const data = DataService.getInstance()
      return data.shows.getRecentShows(limit ?? 30)
    } catch (err: unknown) {
      log(`SHOW_HISTORY error: ${err instanceof Error ? err.message : String(err)}`)
      return []
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
