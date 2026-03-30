// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs'

// Mock node:fs to avoid file system side effects
vi.mock('node:fs', () => ({
  mkdirSync: vi.fn(),
  writeFileSync: vi.fn(),
  appendFileSync: vi.fn(),
}))

// Minimal stubs matching Playwright Reporter types
function makeConfig(projects: Array<{ name: string; metadata?: Record<string, unknown> }>) {
  return { projects } as any
}

function makeSuite(testCount: number) {
  return { allTests: () => new Array(testCount) } as any
}

function makeTestCase(title: string, projectName: string, retries = 0) {
  return {
    title,
    retries,
    parent: { project: () => ({ name: projectName }) },
  } as any
}

function makeResult(status: string, duration: number, retry = 0) {
  return { status, duration, retry, errors: [] } as any
}

describe('ProgressReporter budget violations', () => {
  let ProgressReporter: any

  beforeEach(async () => {
    vi.clearAllMocks()
    // Dynamic import to get fresh module each test
    const mod = await import('../../reporters/progress-reporter')
    ProgressReporter = mod.default
  })

  it('reads durationBudgetMs from project metadata', () => {
    const reporter = new ProgressReporter()
    const config = makeConfig([
      { name: 'smoke', metadata: { durationBudgetMs: 10000 } },
      { name: 'core-flow', metadata: { durationBudgetMs: 15000 } },
      { name: 'no-budget' },
    ])

    reporter.onBegin(config, makeSuite(3))

    // Verify budgets are stored (access via any)
    expect((reporter as any).projectBudgets.get('smoke')).toBe(10000)
    expect((reporter as any).projectBudgets.get('core-flow')).toBe(15000)
    expect((reporter as any).projectBudgets.has('no-budget')).toBe(false)
  })

  it('tracks budget violations when test exceeds project budget', () => {
    const reporter = new ProgressReporter()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    reporter.onBegin(
      makeConfig([{ name: 'smoke', metadata: { durationBudgetMs: 5000 } }]),
      makeSuite(2),
    )

    // Test within budget
    reporter.onTestEnd(makeTestCase('fast test', 'smoke'), makeResult('passed', 3000))
    expect((reporter as any).budgetViolations).toHaveLength(0)

    // Test exceeding budget
    reporter.onTestEnd(makeTestCase('slow test', 'smoke'), makeResult('passed', 8000))
    expect((reporter as any).budgetViolations).toHaveLength(1)
    expect((reporter as any).budgetViolations[0]).toEqual({
      title: 'slow test',
      duration: 8000,
      budget: 5000,
      project: 'smoke',
    })

    consoleSpy.mockRestore()
  })

  it('includes budget violations in onEnd summary', () => {
    const reporter = new ProgressReporter()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    reporter.onBegin(
      makeConfig([{ name: 'smoke', metadata: { durationBudgetMs: 5000 } }]),
      makeSuite(1),
    )

    reporter.onTestEnd(makeTestCase('over-budget test', 'smoke'), makeResult('passed', 12000))
    reporter.onEnd({ status: 'passed' } as any)

    const allOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(allOutput).toContain('Budget violations')
    expect(allOutput).toContain('over-budget test')
    expect(allOutput).toContain('+140%')

    consoleSpy.mockRestore()
  })

  it('writes budget violations to log file', () => {
    const reporter = new ProgressReporter()
    vi.spyOn(console, 'log').mockImplementation(() => {})

    reporter.onBegin(
      makeConfig([{ name: 'core-flow', metadata: { durationBudgetMs: 10000 } }]),
      makeSuite(1),
    )

    reporter.onTestEnd(makeTestCase('budget test', 'core-flow'), makeResult('passed', 25000))
    reporter.onEnd({ status: 'passed' } as any)

    const logCalls = (appendFileSync as any).mock.calls
    const allLogs = logCalls.map((c: any) => c[1]).join('')
    expect(allLogs).toContain('BUDGET VIOLATIONS')
    expect(allLogs).toContain('budget test')

    vi.spyOn(console, 'log').mockRestore()
  })

  it('does not report budget violations when test is within budget', () => {
    const reporter = new ProgressReporter()
    vi.spyOn(console, 'log').mockImplementation(() => {})

    reporter.onBegin(
      makeConfig([{ name: 'smoke', metadata: { durationBudgetMs: 30000 } }]),
      makeSuite(1),
    )

    reporter.onTestEnd(makeTestCase('fast test', 'smoke'), makeResult('passed', 2000))
    reporter.onEnd({ status: 'passed' } as any)

    const logCalls = (appendFileSync as any).mock.calls
    const allLogs = logCalls.map((c: any) => c[1]).join('')
    expect(allLogs).not.toContain('BUDGET VIOLATIONS')

    vi.spyOn(console, 'log').mockRestore()
  })

  it('inline output shows OVER BUDGET tag for violating tests', () => {
    const reporter = new ProgressReporter()
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    reporter.onBegin(
      makeConfig([{ name: 'smoke', metadata: { durationBudgetMs: 5000 } }]),
      makeSuite(1),
    )

    reporter.onTestEnd(makeTestCase('slow test', 'smoke'), makeResult('passed', 10000))

    // The inline console output should contain OVER BUDGET
    const inlineOutput = consoleSpy.mock.calls.map((c) => c[0]).join('\n')
    expect(inlineOutput).toContain('OVER BUDGET')
    expect(inlineOutput).toContain('10.0s / 5.0s')

    consoleSpy.mockRestore()
  })
})
