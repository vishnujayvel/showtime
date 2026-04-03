// ─── Claude Code Stream Event Types (verified from v2.1.63) ───

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

export interface StreamEvent {
  type: 'stream_event'
  event: StreamSubEvent
  session_id: string
  parent_tool_use_id: string | null
  uuid: string
}

export type StreamSubEvent =
  | { type: 'message_start'; message: AssistantMessagePayload }
  | { type: 'content_block_start'; index: number; content_block: ContentBlock }
  | { type: 'content_block_delta'; index: number; delta: ContentDelta }
  | { type: 'content_block_stop'; index: number }
  | { type: 'message_delta'; delta: { stop_reason: string | null }; usage: UsageData; context_management?: unknown }
  | { type: 'message_stop' }

export interface ContentBlock {
  type: 'text' | 'tool_use'
  text?: string
  id?: string
  name?: string
  input?: Record<string, unknown>
}

export type ContentDelta =
  | { type: 'text_delta'; text: string }
  | { type: 'input_json_delta'; partial_json: string }

export interface AssistantEvent {
  type: 'assistant'
  message: AssistantMessagePayload
  parent_tool_use_id: string | null
  session_id: string
  uuid: string
}

export interface AssistantMessagePayload {
  model: string
  id: string
  role: 'assistant'
  content: ContentBlock[]
  stop_reason: string | null
  usage: UsageData
}

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

export interface UsageData {
  input_tokens?: number
  output_tokens?: number
  cache_read_input_tokens?: number
  cache_creation_input_tokens?: number
  service_tier?: string
}

export interface PermissionEvent {
  type: 'permission_request'
  tool: { name: string; description?: string; input?: Record<string, unknown> }
  question_id: string
  options: Array<{ id: string; label: string; kind?: string }>
  session_id: string
  uuid: string
}

// Union of all possible top-level events
export type ClaudeEvent = InitEvent | StreamEvent | AssistantEvent | RateLimitEvent | ResultEvent | PermissionEvent | UnknownEvent

export interface UnknownEvent {
  type: string
  [key: string]: unknown
}

// ─── Tab State Machine (v2 — from execution plan) ───

export type TabStatus = 'connecting' | 'idle' | 'running' | 'completed' | 'failed' | 'dead'

export interface PermissionRequest {
  questionId: string
  toolTitle: string
  toolDescription?: string
  toolInput?: Record<string, unknown>
  options: Array<{ optionId: string; kind?: string; label: string }>
}

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

export interface Message {
  id: string
  role: 'user' | 'assistant' | 'tool' | 'system'
  content: string
  toolName?: string
  toolInput?: string
  toolStatus?: 'running' | 'completed' | 'error'
  timestamp: number
}

export interface RunResult {
  totalCostUsd: number
  durationMs: number
  numTurns: number
  usage: UsageData
  sessionId: string
}

// ─── Canonical Events (normalized from raw stream) ───

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

export interface SessionMeta {
  sessionId: string
  slug: string | null
  firstMessage: string | null
  lastTimestamp: string
  size: number
}

export interface SessionLoadMessage {
  role: string
  content: string
  toolName?: string
  timestamp: number
}

// ─── Marketplace / Plugin Types ───

export type PluginStatus = 'not_installed' | 'checking' | 'installing' | 'installed' | 'failed'

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

export type ShowPhase = 'no_show' | 'writers_room' | 'live' | 'intermission' | 'director' | 'strike'
export type EnergyLevel = 'high' | 'medium' | 'low' | 'recovery'
export type ActStatus = 'upcoming' | 'active' | 'completed' | 'skipped'
export type ShowVerdict = 'DAY_WON' | 'SOLID_SHOW' | 'GOOD_EFFORT' | 'SHOW_CALLED_EARLY'
export type WritersRoomStep = 'energy' | 'plan' | 'conversation' | 'lineup_ready'
export type ViewTier = 'micro' | 'compact' | 'dashboard' | 'expanded'
export type ViewMode = 'pill' | 'compact' | 'dashboard' | 'expanded' | 'full'

const VIEW_TIER_ORDER: ViewTier[] = ['micro', 'compact', 'dashboard', 'expanded']

export function nextViewTier(current: ViewTier): ViewTier {
  const idx = VIEW_TIER_ORDER.indexOf(current)
  return VIEW_TIER_ORDER[(idx + 1) % VIEW_TIER_ORDER.length]
}

export function expandTier(current: ViewTier): ViewTier {
  const idx = VIEW_TIER_ORDER.indexOf(current)
  return idx < VIEW_TIER_ORDER.length - 1 ? VIEW_TIER_ORDER[idx + 1] : current
}

export function collapseTier(current: ViewTier): ViewTier {
  const idx = VIEW_TIER_ORDER.indexOf(current)
  return idx > 0 ? VIEW_TIER_ORDER[idx - 1] : current
}

export interface CalendarEvent {
  title: string
  start: string  // "HH:MM"
  end: string    // "HH:MM"
  allDay: boolean
}

export type CalendarFetchStatus = 'idle' | 'fetching' | 'ready' | 'unavailable' | 'error'

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

export interface ShowState {
  phase: ShowPhase
  energy: EnergyLevel | null
  acts: Act[]
  currentActId: string | null
  beatsLocked: number
  beatThreshold: number
  timerEndAt: number | null
  timerPausedRemaining: number | null
  claudeSessionId: string | null
  showDate: string
  showStartedAt: number | null
  verdict: ShowVerdict | null
  viewTier: ViewTier
  beatCheckPending: boolean
  celebrationActive: boolean
  goingLiveActive: boolean
  writersRoomStep: WritersRoomStep
  writersRoomEnteredAt: number | null
  breathingPauseEndAt: number | null
}

export interface CachedCalendarEvent {
  id: string
  title: string
  startTime: number
  endTime: number
  isFixed: boolean
  category: string | null
  lastSynced: number
}

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
}

// ─── IPC Channel Names ───

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

  // App lifecycle
  APP_QUIT: 'app:quit',

  // Application logging (renderer → main)
  LOG_EVENT: 'showtime:log-event',

} as const

// ─── Data Persistence Types (shared across main/preload/renderer) ───

/** Snapshot of show state sent from renderer to main for persistence */
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

export interface ClaudeContextPayload {
  showId: string
  energy?: string | null
  planText?: string | null
  lineupJson?: string | null
  sessionId?: string | null
}

export interface ActDriftResult {
  actId: string | null
  actName: string | null
  driftSeconds: number
  plannedMs: number
  actualMs: number
}

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

export interface MetricsSummary {
  avg: number
  p95: number
  min: number
  max: number
  count: number
}

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
