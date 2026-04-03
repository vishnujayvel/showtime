/**
 * Dev-only Stately Browser Inspector integration.
 *
 * Lazy-imports @statelyai/inspect so it's tree-shaken from production builds.
 * The inspector opens the Stately Inspector in a new browser window,
 * showing a live, interactive state chart of the running machine.
 */
import type { InspectionEvent, Observer } from 'xstate'

let inspectorObserver: Observer<InspectionEvent> | null = null

/**
 * Initialize the Stately Browser Inspector (DEV mode only).
 * Dynamically imports @statelyai/inspect to avoid bundling in production.
 */
export async function initDevInspector(): Promise<void> {
  if (!import.meta.env.DEV) return
  // Skip in non-browser environments (jsdom, test runners) where window.open is not implemented
  if (typeof window === 'undefined' || typeof window.open !== 'function') return
  try {
    const { createBrowserInspector } = await import('@statelyai/inspect')
    const inspector = createBrowserInspector({ autoStart: true })
    inspectorObserver = inspector.inspect
    console.log('[showtime] Stately Inspector initialized — live state chart available')
  } catch (err) {
    console.warn('[showtime] Failed to initialize dev inspector:', err)
  }
}

/**
 * Forward an inspection event to the browser inspector, if initialized.
 */
export function forwardToDevInspector(event: InspectionEvent): void {
  inspectorObserver?.next?.(event)
}
