import type {
  FullConfig,
  FullResult,
  Reporter,
  Suite,
  TestCase,
  TestResult,
} from '@playwright/test/reporter'

const SLOW_THRESHOLD_MS = 5000

export default class ProgressReporter implements Reporter {
  private total = 0
  private completed = 0
  private passed = 0
  private failed = 0
  private skipped = 0
  private startTime = 0
  private slowTests: { title: string; duration: number; project: string }[] = []

  onBegin(_config: FullConfig, suite: Suite): void {
    this.total = suite.allTests().length
    this.startTime = Date.now()
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
    const status = result.status === 'passed' ? '\x1b[32m✓\x1b[0m'
      : isFailure ? '\x1b[31m✗\x1b[0m'
      : '\x1b[33m-\x1b[0m'
    const project = test.parent.project()?.name || ''

    if (result.status === 'passed') this.passed++
    else if (result.status === 'skipped') this.skipped++
    else this.failed++

    if (ms > SLOW_THRESHOLD_MS) {
      this.slowTests.push({ title: test.title, duration: ms, project })
    }

    console.log(
      `  ${status} [${this.completed}/${this.total}] (${pct}%) ${elapsed}s ` +
      `| ${project} > ${test.title} (${ms}ms)${slow}`
    )
  }

  onEnd(result: FullResult): void {
    const duration = ((Date.now() - this.startTime) / 1000).toFixed(1)
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
  }
}
