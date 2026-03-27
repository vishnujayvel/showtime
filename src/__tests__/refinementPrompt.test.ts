import { describe, it, expect } from 'vitest'
import { buildRefinementPrompt } from '../renderer/lib/refinement-prompt'

const SAMPLE_ACTS = [
  { name: 'Deep Work Session', sketch: 'Deep Work', durationMinutes: 45 },
  { name: 'Exercise Break', sketch: 'Exercise', durationMinutes: 25 },
  { name: 'Email & Slack', sketch: 'Admin', durationMinutes: 20 },
]

describe('buildRefinementPrompt', () => {
  it('includes current lineup JSON', () => {
    const prompt = buildRefinementPrompt('Add a coffee break', 'high', SAMPLE_ACTS)
    expect(prompt).toContain('"name": "Deep Work Session"')
    expect(prompt).toContain('"name": "Exercise Break"')
    expect(prompt).toContain('"name": "Email & Slack"')
    expect(prompt).toContain('showtime-lineup')
  })

  it('includes the energy level', () => {
    const prompt = buildRefinementPrompt('Add a coffee break', 'low', SAMPLE_ACTS)
    expect(prompt).toContain('energy level "low"')
  })

  it('includes category constraints', () => {
    const prompt = buildRefinementPrompt('Add a coffee break', 'high', SAMPLE_ACTS)
    expect(prompt).toContain('"Deep Work"')
    expect(prompt).toContain('"Exercise"')
    expect(prompt).toContain('"Admin"')
    expect(prompt).toContain('"Creative"')
    expect(prompt).toContain('"Social"')
  })

  it('explicitly prohibits MCP tools', () => {
    const prompt = buildRefinementPrompt('Add dinner date with Silas', 'medium', SAMPLE_ACTS)
    expect(prompt).toContain('Do NOT use any MCP tools')
    expect(prompt).toContain('Do NOT call any tools at all')
  })

  it('includes the user refinement message', () => {
    const prompt = buildRefinementPrompt('Add dinner date with Silas', 'high', SAMPLE_ACTS)
    expect(prompt).toContain('Add dinner date with Silas')
  })

  it('instructs to preserve existing acts', () => {
    const prompt = buildRefinementPrompt('Add a walk', 'high', SAMPLE_ACTS)
    expect(prompt).toContain('Preserve all existing acts')
  })

  it('only includes name, sketch, durationMinutes in lineup JSON (no extra fields)', () => {
    const actsWithExtras = [
      { name: 'Test', sketch: 'Admin', durationMinutes: 30, id: 'should-strip', status: 'active' },
    ] as any
    const prompt = buildRefinementPrompt('test', 'high', actsWithExtras)
    expect(prompt).not.toContain('should-strip')
    expect(prompt).not.toContain('"status"')
  })

  it('handles empty acts array', () => {
    const prompt = buildRefinementPrompt('Add something', 'high', [])
    expect(prompt).toContain('"acts": []')
    expect(prompt).toContain('energy level "high"')
  })
})
