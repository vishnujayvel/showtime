// @vitest-environment node
import { Readable } from 'stream'
import { StreamParser } from '../main/stream-parser'
import {
  makeInitEvent,
  makeTextDelta,
  makeAssistantEvent,
  makeResultSuccess,
  toNdjson,
  toChunkedNdjson,
  makeSuccessSequence,
} from './mocks/claude-event-stream'
import type { ClaudeEvent } from '../shared/types'

describe('StreamParser', () => {
  let parser: StreamParser

  beforeEach(() => {
    parser = new StreamParser()
  })

  // ── 1. Single complete line ──

  it('emits an event for a single complete JSON line', () => {
    const event = makeInitEvent()
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    parser.feed(JSON.stringify(event) + '\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
  })

  // ── 2. Multiple complete lines ──

  it('emits all events for multiple complete JSON lines fed at once', () => {
    const init = makeInitEvent()
    const assistant = makeAssistantEvent()
    const result = makeResultSuccess()
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    const ndjson = [init, assistant, result].map((e) => JSON.stringify(e)).join('\n') + '\n'
    parser.feed(ndjson)

    expect(events).toHaveLength(3)
    expect(events[0]).toEqual(init)
    expect(events[1]).toEqual(assistant)
    expect(events[2]).toEqual(result)
  })

  // ── 3. Empty lines are skipped ──

  it('skips empty lines between valid JSON lines', () => {
    const init = makeInitEvent()
    const result = makeResultSuccess()
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    const input = JSON.stringify(init) + '\n\n\n' + JSON.stringify(result) + '\n'
    parser.feed(input)

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual(init)
    expect(events[1]).toEqual(result)
  })

  // ── 4. Partial line buffering ──

  it('buffers a partial line and emits once the rest arrives', () => {
    const event = makeInitEvent()
    const json = JSON.stringify(event)
    const half = Math.floor(json.length / 2)
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    parser.feed(json.slice(0, half))
    expect(events).toHaveLength(0)

    parser.feed(json.slice(half) + '\n')
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
  })

  // ── 5. Chunked input (simulated TCP fragmentation) ──

  it('correctly reassembles events from small chunked input', () => {
    const sequence = makeSuccessSequence()
    const chunks = toChunkedNdjson(sequence, 30)
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    for (const chunk of chunks) {
      parser.feed(chunk)
    }

    expect(events).toHaveLength(sequence.length)
    for (let i = 0; i < sequence.length; i++) {
      expect(events[i]).toEqual(sequence[i])
    }
  })

  // ── 6. flush() emits buffered partial ──

  it('emits a buffered partial line when flush() is called', () => {
    const event = makeAssistantEvent()
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    // Feed without trailing newline
    parser.feed(JSON.stringify(event))
    expect(events).toHaveLength(0)

    parser.flush()
    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
  })

  // ── 7. flush() with empty buffer ──

  it('does not emit anything when flush() is called on an empty buffer', () => {
    const events: ClaudeEvent[] = []
    const errors: string[] = []
    parser.on('event', (e) => events.push(e))
    parser.on('parse-error', (e) => errors.push(e))

    parser.flush()

    expect(events).toHaveLength(0)
    expect(errors).toHaveLength(0)
  })

  // ── 8. flush() with non-JSON buffer ──

  it('emits parse-error when flush() encounters non-JSON in the buffer', () => {
    const errors: string[] = []
    parser.on('parse-error', (e) => errors.push(e))

    parser.feed('this is not json')
    parser.flush()

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe('this is not json')
  })

  // ── 9. Non-JSON line triggers parse-error ──

  it('emits parse-error for a non-JSON line', () => {
    const errors: string[] = []
    parser.on('parse-error', (e) => errors.push(e))

    parser.feed('not json\n')

    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe('not json')
  })

  // ── 10. Mixed valid and invalid lines ──

  it('emits correct events and errors for mixed valid/invalid input', () => {
    const init = makeInitEvent()
    const result = makeResultSuccess()
    const events: ClaudeEvent[] = []
    const errors: string[] = []
    parser.on('event', (e) => events.push(e))
    parser.on('parse-error', (e) => errors.push(e))

    const input =
      JSON.stringify(init) + '\n' +
      'garbage line\n' +
      JSON.stringify(result) + '\n'
    parser.feed(input)

    expect(events).toHaveLength(2)
    expect(events[0]).toEqual(init)
    expect(events[1]).toEqual(result)
    expect(errors).toHaveLength(1)
    expect(errors[0]).toBe('garbage line')
  })

  // ── 11. fromStream() convenience ──

  it('parses events from a Readable stream via fromStream()', async () => {
    const sequence = makeSuccessSequence()
    const chunks = toChunkedNdjson(sequence, 40)

    const readable = new Readable({
      read() {
        for (const chunk of chunks) {
          this.push(chunk)
        }
        this.push(null)
      },
    })

    const streamParser = StreamParser.fromStream(readable)
    const events: ClaudeEvent[] = []
    streamParser.on('event', (e) => events.push(e))

    await new Promise<void>((resolve) => readable.on('end', () => resolve()))

    expect(events).toHaveLength(sequence.length)
    for (let i = 0; i < sequence.length; i++) {
      expect(events[i]).toEqual(sequence[i])
    }
  })

  // ── 12. fromStream() calls flush on stream end ──

  it('flushes remaining data when the stream ends', async () => {
    const event = makeResultSuccess()
    const json = JSON.stringify(event)

    // Push data without a trailing newline so it stays in the buffer
    const readable = new Readable({
      read() {
        this.push(json)
        this.push(null)
      },
    })

    const streamParser = StreamParser.fromStream(readable)
    const events: ClaudeEvent[] = []
    streamParser.on('event', (e) => events.push(e))

    await new Promise<void>((resolve) => readable.on('end', () => resolve()))

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
  })

  // ── 13. Large payload ──

  it('parses a JSON object with a very long string field', () => {
    const longText = 'a'.repeat(100_000)
    const event = makeAssistantEvent(longText)
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    parser.feed(JSON.stringify(event) + '\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
  })

  // ── 14. Unicode content ──

  it('correctly parses JSON containing emoji and unicode characters', () => {
    const unicodeText = 'Hello \u{1F680}\u{1F30D} world! \u00E9\u00E0\u00FC \u4F60\u597D \u{1F389}'
    const event = makeAssistantEvent(unicodeText)
    const events: ClaudeEvent[] = []
    parser.on('event', (e) => events.push(e))

    parser.feed(JSON.stringify(event) + '\n')

    expect(events).toHaveLength(1)
    expect(events[0]).toEqual(event)
    expect((events[0] as any).message.content[0].text).toBe(unicodeText)
  })
})
