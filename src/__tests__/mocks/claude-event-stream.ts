/**
 * Mock Claude event stream library.
 *
 * Provides factory functions that produce raw ClaudeEvent objects matching
 * the real `claude -p --output-format stream-json` NDJSON format.
 * Used by EventNormalizer, StreamParser, ControlPlane, and sessionStore tests.
 */
import type {
  InitEvent,
  StreamEvent,
  AssistantEvent,
  ResultEvent,
  RateLimitEvent,
  PermissionEvent,
  ClaudeEvent,
} from '../../shared/types'

// ─── Init Event ───

export function makeInitEvent(overrides: Partial<InitEvent> = {}): InitEvent {
  return {
    type: 'system',
    subtype: 'init',
    cwd: '/test/project',
    session_id: 'sess-001',
    tools: ['Read', 'Edit', 'Bash'],
    mcp_servers: [{ name: 'filesystem', status: 'connected' }],
    model: 'claude-sonnet-4-6',
    permissionMode: 'default',
    agents: [],
    skills: ['commit'],
    plugins: [],
    claude_code_version: '2.1.63',
    fast_mode_state: 'off',
    uuid: 'uuid-init-001',
    ...overrides,
  }
}

// ─── Stream Events ───

export function makeTextDelta(text: string, index = 0): StreamEvent {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      index,
      delta: { type: 'text_delta', text },
    },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-text-${Date.now()}`,
  }
}

export function makeToolUseStart(name: string, id: string, index = 0): StreamEvent {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_start',
      index,
      content_block: { type: 'tool_use', id, name },
    },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-toolstart-${Date.now()}`,
  }
}

export function makeToolInputDelta(partialJson: string, index = 1): StreamEvent {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_delta',
      index,
      delta: { type: 'input_json_delta', partial_json: partialJson },
    },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-toolinput-${Date.now()}`,
  }
}

export function makeContentBlockStop(index = 0): StreamEvent {
  return {
    type: 'stream_event',
    event: { type: 'content_block_stop', index },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-stop-${Date.now()}`,
  }
}

export function makeTextBlockStart(index = 0): StreamEvent {
  return {
    type: 'stream_event',
    event: {
      type: 'content_block_start',
      index,
      content_block: { type: 'text', text: '' },
    },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-textstart-${Date.now()}`,
  }
}

export function makeMessageStart(): StreamEvent {
  return {
    type: 'stream_event',
    event: {
      type: 'message_start',
      message: {
        model: 'claude-sonnet-4-6',
        id: 'msg-001',
        role: 'assistant',
        content: [],
        stop_reason: null,
        usage: { input_tokens: 100, output_tokens: 0 },
      },
    },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-msgstart-${Date.now()}`,
  }
}

export function makeMessageDelta(): StreamEvent {
  return {
    type: 'stream_event',
    event: {
      type: 'message_delta',
      delta: { stop_reason: 'end_turn' },
      usage: { input_tokens: 100, output_tokens: 50 },
    },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-msgdelta-${Date.now()}`,
  }
}

export function makeMessageStop(): StreamEvent {
  return {
    type: 'stream_event',
    event: { type: 'message_stop' },
    session_id: 'sess-001',
    parent_tool_use_id: null,
    uuid: `uuid-msgstop-${Date.now()}`,
  }
}

// ─── Assistant Event (assembled message) ───

export function makeAssistantEvent(text = 'Hello! How can I help?'): AssistantEvent {
  return {
    type: 'assistant',
    message: {
      model: 'claude-sonnet-4-6',
      id: 'msg-002',
      role: 'assistant',
      content: [{ type: 'text', text }],
      stop_reason: 'end_turn',
      usage: { input_tokens: 100, output_tokens: 50 },
    },
    parent_tool_use_id: null,
    session_id: 'sess-001',
    uuid: 'uuid-assistant-001',
  }
}

// ─── Result Event ───

export function makeResultSuccess(overrides: Partial<ResultEvent> = {}): ResultEvent {
  return {
    type: 'result',
    subtype: 'success',
    is_error: false,
    duration_ms: 1500,
    num_turns: 2,
    result: 'Task completed successfully.',
    total_cost_usd: 0.012,
    session_id: 'sess-001',
    usage: { input_tokens: 200, output_tokens: 100 },
    permission_denials: [],
    uuid: 'uuid-result-001',
    ...overrides,
  }
}

export function makeResultError(message = 'Something went wrong'): ResultEvent {
  return {
    type: 'result',
    subtype: 'error',
    is_error: true,
    duration_ms: 500,
    num_turns: 1,
    result: message,
    total_cost_usd: 0.001,
    session_id: 'sess-001',
    usage: { input_tokens: 50, output_tokens: 10 },
    permission_denials: [],
    uuid: 'uuid-result-err-001',
  }
}

// ─── Rate Limit Event ───

export function makeRateLimitEvent(status = 'rate_limited', rateLimitType = 'token'): RateLimitEvent {
  return {
    type: 'rate_limit_event',
    rate_limit_info: {
      status,
      resetsAt: Date.now() + 60_000,
      rateLimitType,
    },
    session_id: 'sess-001',
    uuid: 'uuid-ratelimit-001',
  }
}

// ─── Permission Event ───

export function makePermissionEvent(
  toolName = 'Bash',
  questionId = 'q-001',
): PermissionEvent {
  return {
    type: 'permission_request',
    tool: {
      name: toolName,
      description: `Run a ${toolName} command`,
      input: { command: 'ls -la' },
    },
    question_id: questionId,
    options: [
      { id: 'allow', label: 'Allow', kind: 'allow' },
      { id: 'deny', label: 'Deny', kind: 'deny' },
    ],
    session_id: 'sess-001',
    uuid: `uuid-perm-${Date.now()}`,
  }
}

// ─── Full conversation sequences ───

/** Generates a typical successful run: init → text chunks → assistant → result */
export function makeSuccessSequence(text = 'Hello world'): ClaudeEvent[] {
  return [
    makeInitEvent(),
    makeMessageStart(),
    makeTextBlockStart(0),
    makeTextDelta(text, 0),
    makeContentBlockStop(0),
    makeMessageDelta(),
    makeMessageStop(),
    makeAssistantEvent(text),
    makeResultSuccess(),
  ]
}

/** Generates a tool-use sequence: init → tool_start → input deltas → stop → assistant → result */
export function makeToolUseSequence(): ClaudeEvent[] {
  return [
    makeInitEvent(),
    makeMessageStart(),
    makeToolUseStart('Read', 'tool-001', 0),
    makeToolInputDelta('{"file_path":', 0),
    makeToolInputDelta(' "/src/main.ts"}', 0),
    makeContentBlockStop(0),
    makeTextBlockStart(1),
    makeTextDelta('I read the file.', 1),
    makeContentBlockStop(1),
    makeMessageDelta(),
    makeMessageStop(),
    makeAssistantEvent('I read the file.'),
    makeResultSuccess(),
  ]
}

/** Converts events to NDJSON string (for StreamParser tests) */
export function toNdjson(events: ClaudeEvent[]): string {
  return events.map((e) => JSON.stringify(e)).join('\n') + '\n'
}

/** Converts events to chunked NDJSON (simulates TCP fragmentation) */
export function toChunkedNdjson(events: ClaudeEvent[], chunkSize = 50): string[] {
  const full = toNdjson(events)
  const chunks: string[] = []
  for (let i = 0; i < full.length; i += chunkSize) {
    chunks.push(full.slice(i, i + chunkSize))
  }
  return chunks
}
