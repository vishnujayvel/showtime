import type { ShowLineup } from '../../shared/types'

export function tryParseLineup(text: string): ShowLineup | null {
  const match = text.match(/```showtime-lineup\s*\n([\s\S]*?)```/)
  if (!match) return null
  try {
    const parsed = JSON.parse(match[1])
    if (parsed.acts && Array.isArray(parsed.acts) && typeof parsed.beatThreshold === 'number') {
      return parsed as ShowLineup
    }
  } catch {}
  return null
}
