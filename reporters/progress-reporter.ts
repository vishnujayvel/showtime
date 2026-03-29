import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'
import { writeFileSync, appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const SLOW_THRESHOLD_MS = 5000
const LOG_DIR = join(process.cwd(), 'test-results')
const LOG_FILE = join(LOG_DIR, 'e2e-progress.log')

function ts(): string {
  return new Date().toLocaleTimeString('en-US', { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function logToFile(line: string): void {
  appendFileSync(LOG_FILE, line + '\n')
}

export default class ProgressReporter implements Reporter {
  private total = 0
  private completed = 0
  private passed = 0
  private failed = 0
  private skipped = 0
  private startTime = 0
  private slowTests: { title: string; duration: number; project: string }[] = []
  private failedTests: { title: string; project: string; error: string }[] = []

  onBegin(_config: FullConfig, suite: Suite): void {
    this.total = suite.allTests().length
    this.startTime = Date.now()

    mkdirSync(LOG_DIR, { recursive: true })

    const projects = _config.projects.map(p => p.name).join(', ')
    const header = [
      `${'━'.repeat(60)}`,
      `E2E RUN STARTED  ${ts()}`,
      `${this.total} tests | ${_config.projects.length} projects [${projects}]`,
      `${'━'.repeat(60)}`,
    ]
    writeFileSync(LOG_FILE, header.join('\n') + '\n')

    console.log(`\n  Running ${this.total} tests across ${_config.projects.length} projects...\n`)
  }

  onTestEnd(test: TestCase, result: TestResult): void {
    // Only count the final attempt (skip intermediate retries)
    if (result.retry < test.retries) return

    this.completed++
    const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(1)
    const pct = ((this.completed / this.total) * 100).toFixed(0)
    const ms = result.duration
    const slow = ms > SLOW_THRESHOLD_MS ? ' SLOW' : ''
    const isFailure = result.status === 'failed' || result.status === 'timedOut' || result.status === 'interrupted'
    const statusIcon = result.status === 'passed' ? '✓'
      : isFailure ? '✗'
      : '-'
    const colorStatus = result.status === 'passed' ? '\x1b[32m✓\x1b[0m'
      : isFailure ? '\x1b[31m✗\x1b[0m'
      : '\x1b[33m-\x1b[0m'
    const project = test.parent.project()?.name || ''

    if (result.status === 'passed') this.passed++
    else if (result.status === 'skipped') this.skipped++
    else this.failed++

    if (ms > SLOW_THRESHOLD_MS) {
      this.slowTests.push({ title: test.title, duration: ms, project })
    }

    if (isFailure) {
      const errorMsg = result.errors?.[0]?.message?.split('\n')[0] || 'unknown error'
      this.failedTests.push({ title: test.title, project, error: errorMsg })
    }

    // Console output (colored)
    console.log(
      `  ${colorStatus} [${this.completed}/${this.total}] (${pct}%) ${elapsed}s ` +
      `| ${project} > ${test.title} (${ms}ms)${slow}`
    )

    // File output (plain text, timestamped)
    const logLine = `${ts()}  ${statusIcon} [${this.completed}/${this.total}] (${pct}%) ` +
      `${project} > ${test.title} (${ms}ms)${slow}`
    logToFile(logLine)

    if (isFailure) {
      const errorMsg = result.errors?.[0]?.message?.split('\n')[0] || 'unknown error'
      logToFile(`         ↳ ${errorMsg}`)
    }
  }

  onEnd(result: FullResult): void {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1)

    // Console output
    console.log(`\n  ${'='.repeat(60)}`)
    console.log(`  ${result.status.toUpperCase()} in ${duration}s`)
    console.log(`  ${this.passed} passed | ${this.failed} failed | ${this.skipped} skipped`)

    if (this.slowTests.length > 0) {
      console.log(`\n  Slow tests (>${SLOW_THRESHOLD_MS}ms):`)
      for (const t of this.slowTests.sort((a, b) => b.duration - a.duration)) {
        console.log(`    ${t.project} > ${t.title} — ${t.duration}ms`)
      }
    }

    console.log()

    // File output — summary block
    const summary = [
      `${'━'.repeat(60)}`,
      `E2E RUN ${result.status.toUpperCase()}  ${ts()}  (${duration}s)`,
      `${this.passed} passed | ${this.failed} failed | ${this.skipped} skipped`,
    ]

    if (this.failedTests.length > 0) {
      summary.push('', 'FAILURES:')
      for (const t of this.failedTests) {
        summary.push(`  ✗ ${t.project} > ${t.title}`)
        summary.push(`    ${t.error}`)
      }
    }

    if (this.slowTests.length > 0) {
      summary.push('', `SLOW (>${SLOW_THRESHOLD_MS}ms):`)
      for (const t of this.slowTests.sort((a, b) => b.duration - a.duration)) {
        summary.push(`  ${t.project} > ${t.title} — ${t.duration}ms`)
      }
    }

    summary.push(`${'━'.repeat(60)}`)
    logToFile(summary.join('\n'))
  }
}
