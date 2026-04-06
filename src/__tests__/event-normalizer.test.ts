// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { normalize } from '../../src/main/claude/event-normalizer'
import type { ClaudeEvent } from '../../src/shared/types'
import {
  makeInitEvent,
  makeTextDelta,
  makeToolUseStart,
  makeToolInputDelta,
  makeContentBlockStop,
  makeTextBlockStart,
  makeMessageStart,
  makeMessageDelta,
  makeMessageStop,
  makeAssistantEvent,
  makeResultSuccess,
  makeResultError,
  makeRateLimitEvent,
  makePermissionEvent,
} from './mocks/claude-event-stream'

describe('EventNormalizer', () => {
  // ── 1. system/init → session_init ──

  describe('system/init events', () => {
    it('maps init event to session_init with all fields', () => {
      const raw = makeInitEvent()
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'session_init',
        sessionId: 'sess-001',
        tools: ['Read', 'Edit', 'Bash'],
        model: 'claude-sonnet-4-6',
        mcpServers: [{ name: 'filesystem', status: 'connected' }],
        skills: ['commit'],
        version: '2.1.63',
      })
    })

    it('uses overridden fields from makeInitEvent', () => {
      const raw = makeInitEvent({
        session_id: 'sess-custom',
        model: 'claude-opus-4-6',
        tools: ['Read'],
        mcp_servers: [],
        skills: [],
        claude_code_version: '3.0.0',
      })
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'session_init',
        sessionId: 'sess-custom',
        model: 'claude-opus-4-6',
        tools: ['Read'],
        mcpServers: [],
        skills: [],
        version: '3.0.0',
      })
    })

    // ── 2. system with non-init subtype → empty ──

    it('returns empty array for system event with non-init subtype', () => {
      const raw = makeInitEvent({ subtype: 'heartbeat' as any })
      const result = normalize(raw)
      expect(result).toEqual([])
    })
  })

  // ── 3. stream_event/content_block_start (tool_use) → tool_call ──

  describe('stream_event — content_block_start', () => {
    it('maps tool_use content_block_start to tool_call', () => {
      const raw = makeToolUseStart('Bash', 'tool-42', 2)
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'tool_call',
        toolName: 'Bash',
        toolId: 'tool-42',
        index: 2,
      })
    })

    // ── 4. stream_event/content_block_start (text) → empty ──

    it('returns empty array for text content_block_start', () => {
      const raw = makeTextBlockStart(0)
      const result = normalize(raw)
      expect(result).toEqual([])
    })
  })

  // ── 5. stream_event/content_block_delta (text_delta) → text_chunk ──

  describe('stream_event — content_block_delta', () => {
    it('maps text_delta to text_chunk', () => {
      const raw = makeTextDelta('Hello, world!')
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'text_chunk',
        text: 'Hello, world!',
      })
    })

    it('preserves empty text in text_delta', () => {
      const raw = makeTextDelta('')
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'text_chunk',
        text: '',
      })
    })

    // ── 6. stream_event/content_block_delta (input_json_delta) → tool_call_update ──

    it('maps input_json_delta to tool_call_update', () => {
      const raw = makeToolInputDelta('{"file_path": "/src"}')
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'tool_call_update',
        toolId: '',
        partialInput: '{"file_path": "/src"}',
      })
    })
  })

  // ── 7. stream_event/content_block_stop → tool_call_complete ──

  describe('stream_event — content_block_stop', () => {
    it('maps content_block_stop to tool_call_complete', () => {
      const raw = makeContentBlockStop(3)
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'tool_call_complete',
        index: 3,
      })
    })

    it('uses default index of 0', () => {
      const raw = makeContentBlockStop()
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'tool_call_complete',
        index: 0,
      })
    })
  })

  // ── 8. message_start, message_delta, message_stop → empty ──

  describe('stream_event — structural message events', () => {
    it('returns empty array for message_start', () => {
      expect(normalize(makeMessageStart())).toEqual([])
    })

    it('returns empty array for message_delta', () => {
      expect(normalize(makeMessageDelta())).toEqual([])
    })

    it('returns empty array for message_stop', () => {
      expect(normalize(makeMessageStop())).toEqual([])
    })
  })

  // ── 9. stream_event with null event → empty ──

  describe('stream_event — null sub-event', () => {
    it('returns empty array when event field is null', () => {
      const raw = {
        type: 'stream_event' as const,
        event: null as any,
        session_id: 'sess-001',
        parent_tool_use_id: null,
        uuid: 'uuid-null',
      }
      const result = normalize(raw)
      expect(result).toEqual([])
    })

    it('returns empty array when event field is undefined', () => {
      const raw = {
        type: 'stream_event' as const,
        event: undefined as any,
        session_id: 'sess-001',
        parent_tool_use_id: null,
        uuid: 'uuid-undef',
      }
      const result = normalize(raw)
      expect(result).toEqual([])
    })
  })

  // ── 10. assistant → task_update ──

  describe('assistant events', () => {
    it('maps assistant event to task_update with message payload', () => {
      const raw = makeAssistantEvent('Here is my response.')
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'task_update',
        message: raw.message,
      })
    })

    it('preserves the full message structure', () => {
      const raw = makeAssistantEvent('Test')
      const result = normalize(raw)

      const event = result[0] as { type: 'task_update'; message: any }
      expect(event.message.model).toBe('claude-sonnet-4-6')
      expect(event.message.role).toBe('assistant')
      expect(event.message.content).toEqual([{ type: 'text', text: 'Test' }])
      expect(event.message.usage).toEqual({ input_tokens: 100, output_tokens: 50 })
    })
  })

  // ── 11. result success → task_complete ──

  describe('result events — success', () => {
    it('maps successful result to task_complete with cost, duration, turns, usage', () => {
      const raw = makeResultSuccess()
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'task_complete',
        result: 'Task completed successfully.',
        costUsd: 0.012,
        durationMs: 1500,
        numTurns: 2,
        usage: { input_tokens: 200, output_tokens: 100 },
        sessionId: 'sess-001',
      })
    })

    it('uses overridden result values', () => {
      const raw = makeResultSuccess({
        total_cost_usd: 0.5,
        duration_ms: 10000,
        num_turns: 5,
        session_id: 'sess-custom',
        result: 'All done.',
      })
      const result = normalize(raw)

      expect(result[0]).toMatchObject({
        type: 'task_complete',
        result: 'All done.',
        costUsd: 0.5,
        durationMs: 10000,
        numTurns: 5,
        sessionId: 'sess-custom',
      })
    })

    // ── 12. result with permission_denials → task_complete with permissionDenials ──

    it('maps permission_denials to permissionDenials array', () => {
      const raw = makeResultSuccess()
      // Manually add permission_denials with tool_name/tool_use_id shape
      ;(raw as any).permission_denials = [
        { tool_name: 'Bash', tool_use_id: 'tu-001' },
        { tool_name: 'Edit', tool_use_id: 'tu-002' },
      ]
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'task_complete',
        permissionDenials: [
          { toolName: 'Bash', toolUseId: 'tu-001' },
          { toolName: 'Edit', toolUseId: 'tu-002' },
        ],
      })
    })

    it('omits permissionDenials when array is empty', () => {
      const raw = makeResultSuccess()
      // Default factory has permission_denials: [] (empty string array)
      const result = normalize(raw)

      expect(result[0]).not.toHaveProperty('permissionDenials')
    })
  })

  // ── 13. result error → error event ──

  describe('result events — error', () => {
    it('maps error result to error event', () => {
      const raw = makeResultError('Process crashed')
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'error',
        message: 'Process crashed',
        isError: true,
        sessionId: 'sess-001',
      })
    })

    it('maps result with is_error=true even if subtype is not error', () => {
      const raw = makeResultSuccess({ is_error: true, result: 'Unexpected failure' })
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        type: 'error',
        message: 'Unexpected failure',
        isError: true,
      })
    })

    it('uses descriptive fallback when result string is empty', () => {
      const raw = makeResultError('')
      // makeResultError sets result to the message, so override
      raw.result = ''
      const result = normalize(raw)

      expect(result[0]).toMatchObject({
        type: 'error',
      })
      // Should contain subtype and diagnostic info, not just "Unknown error"
      expect((result[0] as any).message).toMatch(/Error \(error\):.*\d+ms.*turns/)
    })
  })

  // ── 14. rate_limit_event → rate_limit ──

  describe('rate_limit_event', () => {
    it('maps rate limit event with all info fields', () => {
      const raw = makeRateLimitEvent('rate_limited', 'token')
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      const event = result[0] as { type: 'rate_limit'; status: string; resetsAt: number; rateLimitType: string }
      expect(event.type).toBe('rate_limit')
      expect(event.status).toBe('rate_limited')
      expect(event.rateLimitType).toBe('token')
      expect(typeof event.resetsAt).toBe('number')
    })

    it('handles different rate limit types', () => {
      const raw = makeRateLimitEvent('throttled', 'request')
      const result = normalize(raw)

      expect(result[0]).toMatchObject({
        type: 'rate_limit',
        status: 'throttled',
        rateLimitType: 'request',
      })
    })

    // ── 15. rate_limit_event with no info → empty ──

    it('returns empty array when rate_limit_info is missing', () => {
      const raw = {
        type: 'rate_limit_event' as const,
        rate_limit_info: null as any,
        session_id: 'sess-001',
        uuid: 'uuid-rl-none',
      }
      const result = normalize(raw as any)
      expect(result).toEqual([])
    })

    it('returns empty array when rate_limit_info is undefined', () => {
      const raw = {
        type: 'rate_limit_event' as const,
        session_id: 'sess-001',
        uuid: 'uuid-rl-undef',
      }
      const result = normalize(raw as any)
      expect(result).toEqual([])
    })
  })

  // ── 16. permission_request → permission_request with mapped options ──

  describe('permission_request events', () => {
    it('maps permission event with tool info and options', () => {
      const raw = makePermissionEvent('Bash', 'q-123')
      const result = normalize(raw)

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        type: 'permission_request',
        questionId: 'q-123',
        toolName: 'Bash',
        toolDescription: 'Run a Bash command',
        toolInput: { command: 'ls -la' },
        options: [
          { id: 'allow', label: 'Allow', kind: 'allow' },
          { id: 'deny', label: 'Deny', kind: 'deny' },
        ],
      })
    })

    it('uses "unknown" when tool name is missing', () => {
      const raw = makePermissionEvent('Edit', 'q-456')
      ;(raw as any).tool = { description: 'Edit a file' }
      const result = normalize(raw)

      expect(result[0]).toMatchObject({
        type: 'permission_request',
        toolName: 'unknown',
      })
    })

    it('maps options preserving id, label, and kind', () => {
      const raw = makePermissionEvent()
      raw.options = [
        { id: 'allow_once', label: 'Allow once', kind: 'allow' },
        { id: 'allow_always', label: 'Allow always', kind: 'allow' },
        { id: 'deny', label: 'Deny', kind: 'deny' },
      ]
      const result = normalize(raw)

      const event = result[0] as { options: Array<{ id: string; label: string; kind?: string }> }
      expect(event.options).toHaveLength(3)
      expect(event.options[0]).toEqual({ id: 'allow_once', label: 'Allow once', kind: 'allow' })
      expect(event.options[1]).toEqual({ id: 'allow_always', label: 'Allow always', kind: 'allow' })
      expect(event.options[2]).toEqual({ id: 'deny', label: 'Deny', kind: 'deny' })
    })

    it('handles empty options array', () => {
      const raw = makePermissionEvent()
      raw.options = []
      const result = normalize(raw)

      const event = result[0] as { options: any[] }
      expect(event.options).toEqual([])
    })
  })

  // ── 17. Unknown event type → empty ──

  describe('unknown event types', () => {
    it('returns empty array for completely unknown event type', () => {
      const raw = { type: 'something_new', data: 'test' } as any as ClaudeEvent
      const result = normalize(raw)
      expect(result).toEqual([])
    })

    it('returns empty array for event with empty type', () => {
      const raw = { type: '' } as any as ClaudeEvent
      const result = normalize(raw)
      expect(result).toEqual([])
    })
  })

  // ── 18. Malformed input — should not crash ──

  describe('malformed input resilience', () => {
    it('does not crash on event with missing fields', () => {
      const raw = { type: 'system' } as any as ClaudeEvent
      expect(() => normalize(raw)).not.toThrow()
    })

    it('does not crash on stream_event with malformed sub-event', () => {
      const raw = {
        type: 'stream_event' as const,
        event: { type: 'content_block_start', index: 0, content_block: {} } as any,
        session_id: 'sess-001',
        parent_tool_use_id: null,
        uuid: 'uuid-malformed',
      }
      expect(() => normalize(raw)).not.toThrow()
    })

    it('does not crash on result event with missing cost fields', () => {
      const raw = {
        type: 'result' as const,
        subtype: 'success' as const,
        is_error: false,
        session_id: 'sess-001',
        uuid: 'uuid-minimal',
      } as any
      expect(() => normalize(raw)).not.toThrow()
      const result = normalize(raw)
      expect(result[0]).toMatchObject({
        type: 'task_complete',
        result: '',
        costUsd: 0,
        durationMs: 0,
        numTurns: 0,
      })
    })

    it('does not crash on permission event with missing tool', () => {
      const raw = {
        type: 'permission_request' as const,
        question_id: 'q-bad',
        options: [],
        session_id: 'sess-001',
        uuid: 'uuid-noperm',
      } as any
      expect(() => normalize(raw)).not.toThrow()
    })

    it('does not crash on assistant event with undefined message', () => {
      const raw = {
        type: 'assistant' as const,
        message: undefined,
        session_id: 'sess-001',
        uuid: 'uuid-nomsg',
      } as any
      expect(() => normalize(raw)).not.toThrow()
      const result = normalize(raw)
      expect(result[0]).toMatchObject({
        type: 'task_update',
        message: undefined,
      })
    })
  })
})
