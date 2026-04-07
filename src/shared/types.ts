// ─── Claude Code Stream Event Types (verified from v2.1.63) ───

/** Initialization event emitted when a Claude Code session starts. */
export interface InitEvent {
  type: 'system'
  subtype: 'init'
  cwd: string
  session_id: string
  tools: string[]
  mcp_servers: Array<{ name: string; status: string }>
  model: string
  permissionMode: string
  agents: string[]
  skills: string[]
  plugins: string[]
  claude_code_version: string
  fast_mode_state: string
  uuid: string
}

/** Wrapper for streaming sub-events from the Claude API response. */
export interface StreamEvent {
  type: 'stream_event'
  event: StreamSubEvent
  session_id: string
  parent_tool_use_id: string | null
  uuid: string
}

/** Discriminated union of all possible streaming sub-event types from the Claude API. */
export type StreamSubEvent =
  | { type: 'message_start'; message: AssistantMessagePayload }
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: ContentDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string | null }; usage: UsageData; context_management?: unknown }
  | { type: 'message_stop' }

/** A content block within an assistant message, either text or a tool use invocation. */
export interface ContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

/** Incremental delta for a streaming content block, either text or partial tool input JSON. */
export type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string }

/** Complete assistant message event emitted after all streaming is done. */
export interface AssistantEvent {
  type: 'assistant'
  message: AssistantMessagePayload
  parent_tool_use_id: string | null
  session_id: string
  uuid: string
}

/** Payload of an assistant message including content blocks and usage data. */
export interface AssistantMessagePayload {
  model: string
  id: string
  role: 'assistant'
  content: ContentBlock[]
  stop_reason: string | null
  usage: UsageData
}

/** Event indicating the session has been rate-limited by the API. */
export interface RateLimitEvent {
  type: 'rate_limit_event'
  rate_limit_info: {
    status: string
    resetsAt: number
    rateLimitType: string
  }
  session_id: string
  uuid: string
}

/** Final result event emitted when a Claude run completes or errors. */
export interface ResultEvent {
  type: 'result'
  subtype: 'success' | 'error'
  is_error: boolean
  duration_ms: number
  num_turns: number
  result: string
  total_cost_usd: number
  session_id: string
  usage: UsageData & {
    input_tokens: number
    output_tokens: number
    cache_read_input_tokens?: number
    cache_creation_input_tokens?: number
  }
  permission_denials: Array<{ tool_name: string; tool_use_id: string }>
  uuid: string
}

/** Token usage counters for a Claude API call. */
export interface UsageData {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  service_tier?: string
}

/** Event requesting user approval for a tool invocation. */
export interface PermissionEvent {
  type: 'permission_request'
  tool: { name: string; description?: string; input?: Record<string, unknown> }
  question_id: string
  options: Array<{ id: string; label: string; kind?: string }>
  session_id: string
  uuid: string
}

/** Union of all possible top-level Claude Code stream events. */
export type ClaudeEvent = InitEvent | StreamEvent | AssistantEvent | RateLimitEvent | ResultEvent | PermissionEvent | UnknownEvent

/** Catch-all for unrecognized event types from the Claude stream. */
export interface UnknownEvent {
  type: string
  [key: string]: unknown
}

// ─── Tab State Machine (v2 — from execution plan) ───

/** Lifecycle status of a Claude subprocess tab. */
export type TabStatus = 'connecting' | 'idle' | 'running' | 'completed' | 'failed' | 'dead'

/** A pending permission request awaiting user approval in the UI. */
export interface PermissionRequest {
  questionId: string
  toolTitle: string
  toolDescription?: string
  toolInput?: Record<string, unknown>
  options: Array<{ optionId: string; kind?: string; label: string }>
}

/** An image or file attachment associated with a tab message. */
export interface Attachment {
  id: string
  type: 'image' | 'file'
  name: string
  path: string
  mimeType?: string
  /** Base64 data URL for image previews */
  dataUrl?: string
  /** File size in bytes */
  size?: number
}

/** Complete UI state for a single Claude subprocess tab. */
export interface TabState {
  id: string
  claudeSessionId: string | null
  status: TabStatus
  activeRequestId: string | null
  hasUnread: boolean
  currentActivity: string
  permissionQueue: PermissionRequest[]
  /** Fallback card when tools were denied and no interactive permission is available */
  permissionDenied: { tools: Array<{ toolName: string; toolUseId: string }> } | null
  attachments: Attachment[]
  messages: Message[]
  title: string
  /** Last run's result data (cost, tokens, duration) */
  lastResult: RunResult | null
  /** Session metadata from init event */
  sessionModel: string | null
  sessionTools: string[]
  sessionMcpServers: Array<{ name: string; status: string }>
  sessionSkills: string[]
  sessionVersion: string | null
  /** Prompts waiting behind the current run (display text only) */
  queuedPrompts: string[]
  /** Working directory for this tab's Claude sessions */
  workingDirectory: string
  /** Whether the user explicitly chose a directory (vs. using default home) */
  hasChosenDirectory: boolean
  /** Extra directories accessible via --add-dir (session-preserving) */
  additionalDirs: string[]
}

/** A single conversation message displayed in the tab UI. */
export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolName?: string
  toolInput?: string
  toolStatus?: 'running' | 'completed' | 'error'
  timestamp: number
}

/** Summary of a completed Claude run including cost, duration, and token usage. */
export interface RunResult {
  totalCostUsd: number
  durationMs: number
  numTurns: number
  usage: UsageData
  sessionId: string
}

// ─── Canonical Events (normalized from raw stream) ───

/** Discriminated union of all normalized events emitted by the ControlPlane to the renderer. */
export type NormalizedEvent =
  | { type: 'session_init'; sessionId: string; tools: string[]; model: string; mcpServers: Array<{ name: string; status: string }>; skills: string[]; version: string; isWarmup?: boolean }
  | { type: 'text_chunk'; text: string }
  | { type: 'tool_call'; toolName: string; toolId: string; index: number }
  | { type: 'tool_call_update'; toolId: string; partialInput: string }
  | { type: 'tool_call_complete'; index: number }
  | { type: 'task_update'; message: AssistantMessagePayload }
  | { type: 'task_complete'; result: string; costUsd: number; durationMs: number; numTurns: number; usage: UsageData; sessionId: string; permissionDenials?: Array<{ toolName: string; toolUseId: string }> }
  | { type: 'error'; message: string; isError: boolean; sessionId?: string }
  | { type: 'session_dead'; exitCode: number | null; signal: string | null; stderrTail: string[] }
  | { type: 'rate_limit'; status: string; resetsAt: number; rateLimitType: string }
  | { type: 'usage'; usage: UsageData }
  | { type: 'permission_request'; questionId: string; toolName: string; toolDescription?: string; toolInput?: Record<string, unknown>; options: Array<{ id: string; label: string; kind?: string }> }

// ─── Run Options ───

/** Configuration options for launching a Claude subprocess run. */
export interface RunOptions {
  prompt: string
  projectPath: string
  sessionId?: string
  allowedTools?: string[]
  maxTurns?: number
  maxBudgetUsd?: number
  systemPrompt?: string
  model?: string
  /** Path to CLUI-scoped settings file with hook config (passed via --settings) */
  hookSettingsPath?: string
  /** Extra directories to add via --add-dir (session-preserving) */
  addDirs?: string[]
  /** Name of VCR cassette file for playback mode (without .ndjson extension) */
  cassetteName?: string
}

// ─── Control Plane Types ───

/** Registry entry tracking a tab's subprocess metadata in the ControlPlane. */
export interface TabRegistryEntry {
  tabId: string
  claudeSessionId: string | null
  status: TabStatus
  activeRequestId: string | null
  runPid: number | null
  createdAt: number
  lastActivityAt: number
  promptCount: number
}

/** Health check report containing status of all tabs and the queue depth. */
export interface HealthReport {
  tabs: Array<{
    tabId: string
    status: TabStatus
    activeRequestId: string | null
    claudeSessionId: string | null
    alive: boolean
  }>
  queueDepth: number
}

/** An error enriched with subprocess diagnostics like stderr tail and exit code. */
export interface EnrichedError {
  message: string
  stderrTail: string[]
  stdoutTail?: string[]
  exitCode: number | null
  elapsedMs: number
  toolCallCount: number
  sawPermissionRequest?: boolean
  permissionDenials?: Array<{ tool_name: string; tool_use_id: string }>
}

// ─── Session History ───

/** Metadata for a stored Claude session used in history browsing. */
export interface SessionMeta {
  sessionId: string
  slug: string | null
  firstMessage: string | null
  lastTimestamp: string
  size: number
}

/** A message loaded from a persisted Claude session transcript. */
export interface SessionLoadMessage {
  role: string
  content: string
  toolName?: string
  timestamp: number
}

// ─── Marketplace / Plugin Types ───

/** Installation lifecycle status of a marketplace plugin. */
export type PluginStatus = 'not_installed' | 'checking' | 'installing' | 'installed' | 'failed'

/** A plugin entry from the marketplace catalog with install and source metadata. */
export interface CatalogPlugin {
  id: string              // unique: `${repo}/${skillPath}` e.g. 'anthropics/skills/skills/xlsx'
  name: string            // from SKILL.md or plugin.json
  description: string     // from SKILL.md or plugin.json
  version: string         // from plugin.json or '0.0.0'
  author: string          // from plugin.json or marketplace entry
  marketplace: string     // marketplace name from marketplace.json
  repo: string            // 'anthropics/skills'
  sourcePath: string      // path within repo, e.g. 'skills/xlsx'
  installName: string     // individual skill name for SKILL.md skills, bundle name for CLI plugins
  category: string        // 'Agent Skills' | 'Knowledge Work' | 'Financial Services'
  tags: string[]          // Semantic use-case tags derived from name/description (e.g. 'Design', 'Finance')
  isSkillMd: boolean      // true = individual SKILL.md (direct install), false = CLI plugin (bundle install)
}

// ─── Showtime SNL Types ───

/** Top-level phases of the SNL Day show lifecycle. */
export type ShowPhase = 'no_show' | 'writers_room' | 'live' | 'intermission' | 'director' | 'strike'
/** User's self-reported energy level at the start of a show. */
export type EnergyLevel = 'high' | 'medium' | 'low' | 'recovery'
/** Lifecycle status of an individual act within a show. */
export type ActStatus = 'upcoming' | 'active' | 'completed' | 'skipped'
/** End-of-show verdict reflecting overall performance. */
export type ShowVerdict = 'DAY_WON' | 'SOLID_SHOW' | 'GOOD_EFFORT' | 'SHOW_CALLED_EARLY'
/** Steps within the Writer's Room phase for show planning. */
export type WritersRoomStep = 'energy' | 'plan' | 'conversation' | 'lineup_ready'
/** Ordered window size tiers from smallest to largest. */
export type ViewTier = 'micro' | 'compact' | 'dashboard' | 'expanded'
/** Named view modes used for window sizing and layout selection. */
export type ViewMode = 'pill' | 'compact' | 'dashboard' | 'expanded' | 'full'

const VIEW_TIER_ORDER: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']

/** Cycles to the next view tier, wrapping from expanded back to micro. */
export function nextViewTier(current: ViewTier): ViewTier {
  const idx = VIEW_TIER_ORDER.indexOf(current)
  return VIEW_TIER_ORDER[(idx + 1) % VIEW_TIER_ORDER.length]
}

/** Returns the next larger view tier, clamping at expanded. */
export function expandTier(current: ViewTier): ViewTier {
  const idx = VIEW_TIER_ORDER.indexOf(current)
  return idx < VIEW_TIER_ORDER.length - 1 ? VIEW_TIER_ORDER[idx + 1] : current
}

/** Returns the next smaller view tier, clamping at micro. */
export function collapseTier(current: ViewTier): ViewTier {
  const idx = VIEW_TIER_ORDER.indexOf(current)
  return idx > 0 ? VIEW_TIER_ORDER[idx - 1] : current
}

/** A parsed calendar event with start/end times in HH:MM format. */
export interface CalendarEvent {
  title: string
  start: string  // "HH:MM"
  end: string    // "HH:MM"
  allDay: boolean
}

/** Status of the calendar data fetch lifecycle. */
export type CalendarFetchStatus = 'idle' | 'fetching' | 'ready' | 'unavailable' | 'error'

/** An act within a live show, with timing, status, and optional calendar pin. */
export interface Act {
  id: string
  name: string
  sketch: string
  durationMinutes: number
  status: ActStatus
  beatLocked: boolean
  startedAt?: number
  completedAt?: number
  order: number
  /** Wall-clock time from calendar — null means flexible (can shift with drift) */
  pinnedStartAt?: number | null
  /** Source calendar event ID — null means user-generated */
  calendarEventId?: string | null
}

/** The full lineup payload generated by Claude during the Writer's Room phase. */
export interface ShowLineup {
  acts: Array<{
    name: string
    sketch: string
    durationMinutes: number
    reason?: string
    /** Wall-clock pinned start time (epoch ms) — from calendar events */
    pinnedStartAt?: number | null
    /** Source calendar event ID */
    calendarEventId?: string | null
  }>
  beatThreshold: number
  openingNote: string
}

/** A calendar event stored in the local SQLite cache with sync metadata. */
export interface CachedCalendarEvent {
  id: string
  title: string
  startTime: number
  endTime: number
  isFixed: boolean
  category: string | null
  lastSynced: number
}

/** Snapshot of show state sent to the macOS tray for menu and title rendering. */
export interface TrayShowState {
  phase: ShowPhase
  currentActName: string | null
  currentActCategory: string | null
  timerSeconds: number | null
  beatsLocked: number
  beatThreshold: number
  actIndex: number
  totalActs: number
  nextActs: Array<{ name: string; sketch: string; durationMinutes: number }>
  windowVisible?: boolean
  /** When false, the menu bar title (next to tray icon) should not show the timer countdown.
   *  The dropdown menu still shows the timer regardless. */
  showMenuBarTimer?: boolean
}

// ─── IPC Channel Names ───

/** Centralized map of all IPC channel names used between main, preload, and renderer. */
export const IPC = {
  // Request-response (renderer → main)
  START: 'showtime:start',
  CREATE_TAB: 'showtime:create-tab',
  PROMPT: 'showtime:prompt',
  CANCEL: 'showtime:cancel',
  STOP_TAB: 'showtime:stop-tab',
  RETRY: 'showtime:retry',
  STATUS: 'showtime:status',
  TAB_HEALTH: 'showtime:tab-health',
  CLOSE_TAB: 'showtime:close-tab',
  RESPOND_PERMISSION: 'showtime:respond-permission',
  INIT_SESSION: 'showtime:init-session',
  RESET_TAB_SESSION: 'showtime:reset-tab-session',

  // Aggregated events (main → renderer, via ControlPlane)
  NORMALIZED_EVENT: 'showtime:normalized-event',
  TAB_STATUS_CHANGE: 'showtime:tab-status-change',
  ENRICHED_ERROR: 'showtime:enriched-error',

  // One-way events (main → renderer)
  TEXT_CHUNK: 'showtime:text-chunk',
  TOOL_CALL: 'showtime:tool-call',
  TOOL_CALL_UPDATE: 'showtime:tool-call-update',
  TOOL_CALL_COMPLETE: 'showtime:tool-call-complete',
  TASK_UPDATE: 'showtime:task-update',
  TASK_COMPLETE: 'showtime:task-complete',
  SESSION_DEAD: 'showtime:session-dead',
  SESSION_INIT: 'showtime:session-init',
  ERROR: 'showtime:error',
  RATE_LIMIT: 'showtime:rate-limit',

  // Window management
  HIDE_WINDOW: 'showtime:hide-window',
  WINDOW_SHOWN: 'showtime:window-shown',
  IS_VISIBLE: 'showtime:is-visible',
  MINIMIZE_TO_TRAY: 'showtime:minimize-to-tray',

  // Skill provisioning (main → renderer)
  SKILL_STATUS: 'showtime:skill-status',

  // Theme
  GET_THEME: 'showtime:get-theme',
  THEME_CHANGED: 'showtime:theme-changed',

  // Permission mode
  SET_PERMISSION_MODE: 'showtime:set-permission-mode',

  // Showtime notifications
  NOTIFY_ACT_COMPLETE: 'showtime:notify-act-complete',
  NOTIFY_BEAT_CHECK: 'showtime:notify-beat-check',
  NOTIFY_VERDICT: 'showtime:notify-verdict',

  // Showtime window management
  SET_VIEW_MODE: 'showtime:set-view-mode',
  FORCE_REPAINT: 'showtime:force-repaint',
  RESET_SHOW: 'showtime:reset-show',
  OPEN_SETTINGS: 'showtime:open-settings',

  // Open URL in default browser
  OPEN_EXTERNAL: 'showtime:open-external',

  // Timer display mode toggle (main → renderer)
  TIMER_DISPLAY_TOGGLE: 'showtime:timer-display-toggle',

  // Showtime tray state (renderer → main)
  TRAY_STATE_UPDATE: 'showtime:tray-state-update',
  TRAY_TIMER_UPDATE: 'showtime:tray-timer-update',

  // Showtime day boundary detection (main → renderer)
  DAY_BOUNDARY: 'showtime:day-boundary',

  // Showtime expanded toggle (main → renderer, triggered by global hotkey)
  TOGGLE_EXPANDED: 'showtime:toggle-expanded',

  // Showtime data reset (truncates all tables + notifies renderer)
  RESET_ALL_DATA: 'showtime:reset-all-data',

  // Showtime data persistence
  DATA_HYDRATE: 'showtime:data-hydrate',
  DATA_SYNC: 'showtime:data-sync',
  DATA_FLUSH: 'showtime:data-flush',
  TIMELINE_RECORD: 'showtime:timeline-record',
  TIMELINE_EVENTS: 'showtime:timeline-events',
  TIMELINE_DRIFT: 'showtime:timeline-drift',
  TIMELINE_DRIFT_PER_ACT: 'showtime:timeline-drift-per-act',
  CLAUDE_CONTEXT_SAVE: 'showtime:claude-context-save',
  CLAUDE_CONTEXT_GET: 'showtime:claude-context-get',
  SHOW_HISTORY: 'showtime:show-history',
  SHOW_DETAIL: 'showtime:show-detail',
  METRICS_SUMMARY: 'showtime:metrics-summary',
  METRICS_RECORD: 'showtime:metrics-record',

  // Calendar cache
  CALENDAR_CACHE_GET: 'showtime:calendar-cache-get',
  CALENDAR_CACHE_SET: 'showtime:calendar-cache-set',

  // Subprocess pre-warm
  PREWARM_SUBPROCESS: 'showtime:prewarm-subprocess',

  // NDJSON file-based metrics (renderer → main)
  EMIT_METRIC: 'showtime:emit-metric',

  // App lifecycle
  APP_QUIT: 'app:quit',

  // Application logging (renderer → main)
  LOG_EVENT: 'showtime:log-event',

} as const

// ─── Data Persistence Types (shared across main/preload/renderer) ───

/** Snapshot of show state sent from renderer to main for SQLite persistence. */
export interface ShowStateSnapshot {
  showId: string
  phase: string
  energy?: string | null
  verdict?: string | null
  beatsLocked?: number
  beatThreshold?: number
  startedAt?: number | null
  endedAt?: number | null
  planText?: string | null
  acts?: ActSnapshot[]
}

/** Snapshot of a single act's state for persistence. */
export interface ActSnapshot {
  id: string
  name: string
  sketch: string
  category?: string | null
  plannedDurationMs: number
  actualDurationMs?: number | null
  sortOrder: number
  status: string
  beatLocked?: number
  plannedStartAt?: number | null
  actualStartAt?: number | null
  actualEndAt?: number | null
}

/** Input payload for recording a timeline event with planned vs actual timing. */
export interface TimelineEventInput {
  showId: string
  actId?: string | null
  eventType: string
  plannedStart?: number | null
  plannedEnd?: number | null
  actualStart?: number | null
  actualEnd?: number | null
  driftSeconds?: number | null
  metadata?: Record<string, unknown> | null
}

/** Payload for persisting Claude session context tied to a specific show. */
export interface ClaudeContextPayload {
  showId: string
  energy?: string | null
  planText?: string | null
  lineupJson?: string | null
  sessionId?: string | null
}

/** Schedule drift result for a single act comparing planned vs actual duration. */
export interface ActDriftResult {
  actId: string | null
  actName: string | null
  driftSeconds: number
  plannedMs: number
  actualMs: number
}

/** Summary row for a past show displayed in the history view. */
export interface ShowHistoryEntry {
  showId: string
  phase: string
  energy: string | null
  verdict: string | null
  beatsLocked: number
  beatThreshold: number
  startedAt: number | null
  endedAt: number | null
  actCount: number
  completedActCount: number
}

/** Aggregated statistics for a named performance metric over a time window. */
export interface MetricsSummary {
  avg: number
  p95: number
  min: number
  max: number
  count: number
}

/** Full detail of a show including plan text, lineup JSON, and all act snapshots. */
export interface ShowDetailEntry {
  showId: string
  phase: string
  energy: string | null
  verdict: string | null
  beatsLocked: number
  beatThreshold: number
  startedAt: number | null
  endedAt: number | null
  planText: string | null
  lineupJson: string | null
  acts: ActSnapshot[]
}
