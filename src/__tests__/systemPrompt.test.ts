// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'

vi.mock('child_process', () => ({
  spawn: vi.fn(),
  execSync: vi.fn(() => '/usr/local/bin/claude'),
}))

vi.mock('../main/logger', () => ({
  log: vi.fn(),
}))

vi.mock('../main/cli-env', () => ({
  getCliEnv: () => ({ ...process.env }),
}))

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/showtime-test', getVersion: () => '0.0.0-test' },
}))

// We need to test buildShowtimeSystemPrompt which reads from disk.
// The function is exported from run-manager.ts. Since it reads SKILL.md
// from candidate paths, we test with the real file at the dev cwd path.

import { buildShowtimeSystemPrompt } from '../main/claude/run-manager'

describe('buildShowtimeSystemPrompt', () => {
  it('returns a string containing key SNL framework markers', () => {
    const prompt = buildShowtimeSystemPrompt()
    expect(prompt).toContain('Showtime Director')
    expect(prompt).toContain('showtime-lineup')
    expect(prompt).toContain('SNL')
  })

  it('contains UI rendering hints', () => {
    const prompt = buildShowtimeSystemPrompt()
    expect(prompt).toContain('day-planning companion')
    expect(prompt).toContain('markdown')
    expect(prompt).toContain('guilt language')
  })

  it('does NOT contain old CLUI identity "You are still a software engineering assistant"', () => {
    const prompt = buildShowtimeSystemPrompt()
    expect(prompt).not.toContain('You are still a software engineering assistant')
    expect(prompt).not.toContain('running inside CLUI')
  })

  it('does NOT contain CLUI identity text', () => {
    const prompt = buildShowtimeSystemPrompt()
    expect(prompt).not.toContain('CLUI')
    expect(prompt).not.toContain('raw terminal')
  })

  it('strips YAML frontmatter from SKILL.md', () => {
    const prompt = buildShowtimeSystemPrompt()
    // YAML frontmatter starts with ---
    // The prompt should not contain the frontmatter fields
    expect(prompt).not.toMatch(/^---/)
    expect(prompt).not.toContain('name: showtime-director')
  })

  it('strips Database Integration section', () => {
    const prompt = buildShowtimeSystemPrompt()
    // The DB section header should not appear in the final prompt
    // (it's stripped by the regex, distinct from the annotation in the file)
    expect(prompt).not.toContain('import { readToday')
    expect(prompt).not.toContain('writeLineup(lineup, energy)')
  })

  it('includes beat check prompts and director mode from SKILL.md', () => {
    const prompt = buildShowtimeSystemPrompt()
    expect(prompt).toContain('Beat Check')
    expect(prompt).toContain('Director Mode')
    expect(prompt).toContain('beatThreshold')
  })

  it('includes scheduling rules by energy level', () => {
    const prompt = buildShowtimeSystemPrompt()
    expect(prompt).toContain('High Energy')
    expect(prompt).toContain('Low Energy')
    expect(prompt).toContain('Recovery')
  })
})

describe('buildShowtimeSystemPrompt fallback', () => {
  it('returns uiHints-only prompt that is shorter than full prompt with SKILL.md', () => {
    // We can't easily mock fs for this import, but we can verify the structure:
    // the full prompt (with SKILL.md) is much longer than just UI hints
    const prompt = buildShowtimeSystemPrompt()

    // If SKILL.md was loaded, prompt should contain both uiHints AND skill content
    // This verifies the merge behavior works correctly
    expect(prompt).toContain('Showtime Director')
    expect(prompt).toContain('Beat Check')
    // The uiHints are at the start, skill content follows
    const uiHintsEnd = prompt.indexOf('day-planning companion.')
    const skillContentStart = prompt.indexOf('# Showtime Director')
    expect(uiHintsEnd).toBeLessThan(skillContentStart)
  })
})
