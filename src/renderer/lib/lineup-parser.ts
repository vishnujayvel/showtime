import type { ShowLineup } from '../../shared/types'

/**
 * Strip tool_use / tool_result blocks that Claude may interleave when
 * MCP tool calls (e.g. Google Calendar) precede the lineup output.
 * These blocks look like: ```tool_use\n...\n``` or ```tool_result\n...\n```
 */
function stripToolBlocks(text: string): string {
  return text.replace(/```(?:tool_use|tool_result|tool_call)\s*\n[\s\S]*?```/g, '')
}

function isValidLineup(obj: unknown): obj is ShowLineup {
  if (!obj || typeof obj !== 'object') return false
  const o = obj as Record<string, unknown>
  return Array.isArray(o.acts) && typeof o.beatThreshold === 'number'
}

/** Extracts a ShowLineup from Claude's response text, trying fenced blocks then bare JSON fallbacks. */
export function tryParseLineup(text: string): ShowLineup | null {
  // Strip tool call blocks that may confuse the regex
  const cleaned = stripToolBlocks(text)

  // Try all showtime-lineup blocks, preferring the last one
  // (Claude may retry after a tool failure, so the last block is most likely correct)
  const blocks = [...cleaned.matchAll(/```showtime-lineup\s*\n([\s\S]*?)```/g)]
  for (let i = blocks.length - 1; i >= 0; i--) {
    try {
      const parsed = JSON.parse(blocks[i][1])
      if (isValidLineup(parsed)) return parsed
    } catch {}
  }

  // Fallback: look for any JSON object with an "acts" array in the text
  // This handles cases where Claude omits the showtime-lineup fence
  const jsonFallback = cleaned.match(/```(?:json)?\s*\n([\s\S]*?)```/)
  if (jsonFallback) {
    try {
      const parsed = JSON.parse(jsonFallback[1])
      if (isValidLineup(parsed)) return parsed
    } catch {}
  }

  // Last resort: try to find a bare JSON object with "acts" in the text
  const bareJson = cleaned.match(/\{[\s\S]*"acts"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
  if (bareJson) {
    try {
      const parsed = JSON.parse(bareJson[0])
      if (isValidLineup(parsed)) return parsed
    } catch {}
  }

  return null
}
