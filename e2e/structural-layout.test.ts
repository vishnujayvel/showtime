import { test, expect, seedFixture, FIXTURES } from './fixtures'

// ─── Helpers ───

/** All fixture entries as [name, fixture] pairs for iteration */
const ALL_FIXTURES = Object.entries(FIXTURES) as [string, Readonly<Record<string, unknown>>][]

/** Key views for bounding box containment (3.3) */
const CONTAINMENT_FIXTURES: [string, Readonly<Record<string, unknown>>][] = [
  ['live_expanded', FIXTURES.live_expanded],
  ['live_compact', FIXTURES.live_compact],
  ['live_dashboard', FIXTURES.live_dashboard],
  ['live_micro', FIXTURES.live_micro],
]

// ─── 3.1 Overflow Detection ───

test.describe('Overflow Detection', () => {
  for (const [name, fixture] of ALL_FIXTURES) {
    test(`no unintentional overflow in ${name}`, async ({ mainPage: page }) => {
      await seedFixture(page, fixture)

      const overflows = await page.evaluate(() => {
        const app = document.querySelector('[data-testid="showtime-app"]')
        if (!app) return []

        const violations: string[] = []
        const elements = app.querySelectorAll('*')

        elements.forEach((el) => {
          const htmlEl = el as HTMLElement
          const hasHorizontalOverflow = htmlEl.scrollWidth > htmlEl.clientWidth
          const hasVerticalOverflow = htmlEl.scrollHeight > htmlEl.clientHeight

          if (!hasHorizontalOverflow && !hasVerticalOverflow) return

          const computed = window.getComputedStyle(htmlEl)
          const overflowX = computed.overflowX
          const overflowY = computed.overflowY

          // Intentional scroll containers use auto, hidden, or scroll -- skip those
          const intentionalX = ['auto', 'hidden', 'scroll'].includes(overflowX)
          const intentionalY = ['auto', 'hidden', 'scroll'].includes(overflowY)

          // Only flag if overflow is 'visible' (the default) on the overflowing axis
          if (hasHorizontalOverflow && !intentionalX) {
            const tag = htmlEl.tagName.toLowerCase()
            const id = htmlEl.id ? `#${htmlEl.id}` : ''
            const cls = htmlEl.className
              ? `.${String(htmlEl.className).split(' ').slice(0, 3).join('.')}`
              : ''
            const testId = htmlEl.getAttribute('data-testid') || ''
            violations.push(
              `horizontal: ${tag}${id}${cls}${testId ? `[data-testid="${testId}"]` : ''} ` +
              `(scrollW=${htmlEl.scrollWidth}, clientW=${htmlEl.clientWidth}, overflow-x=${overflowX})`
            )
          }

          if (hasVerticalOverflow && !intentionalY) {
            const tag = htmlEl.tagName.toLowerCase()
            const id = htmlEl.id ? `#${htmlEl.id}` : ''
            const cls = htmlEl.className
              ? `.${String(htmlEl.className).split(' ').slice(0, 3).join('.')}`
              : ''
            const testId = htmlEl.getAttribute('data-testid') || ''
            violations.push(
              `vertical: ${tag}${id}${cls}${testId ? `[data-testid="${testId}"]` : ''} ` +
              `(scrollH=${htmlEl.scrollHeight}, clientH=${htmlEl.clientHeight}, overflow-y=${overflowY})`
            )
          }
        })

        return violations
      })

      expect(overflows, `Unintentional overflow detected in ${name}:\n${overflows.join('\n')}`).toHaveLength(0)
    })
  }
})

// ─── 3.2 Z-Index Stacking Audit ───

test.describe('Z-Index Stacking Audit', () => {
  for (const [name, fixture] of ALL_FIXTURES) {
    test(`interactive elements are topmost in ${name}`, async ({ mainPage: page }) => {
      await seedFixture(page, fixture)

      const occluded = await page.evaluate(() => {
        const app = document.querySelector('[data-testid="showtime-app"]')
        if (!app) return []

        const selectors = 'button, a, input, [role="button"], [data-testid*="btn"]'
        const interactiveEls = app.querySelectorAll(selectors)
        const violations: string[] = []

        interactiveEls.forEach((el) => {
          const htmlEl = el as HTMLElement
          const rect = htmlEl.getBoundingClientRect()

          // Skip zero-dimension elements (hidden or not rendered)
          if (rect.width === 0 || rect.height === 0) return

          // Skip elements outside the viewport
          if (rect.top < 0 || rect.left < 0) return
          if (rect.bottom > window.innerHeight || rect.right > window.innerWidth) return

          // Skip elements that are not visible
          const computed = window.getComputedStyle(htmlEl)
          if (computed.display === 'none' || computed.visibility === 'hidden' || computed.opacity === '0') return

          // Skip disabled elements (they are intentionally non-interactive)
          if (htmlEl.hasAttribute('disabled') || htmlEl.getAttribute('aria-disabled') === 'true') return

          // Check if the element is topmost at its center point
          const centerX = rect.left + rect.width / 2
          const centerY = rect.top + rect.height / 2
          const topEl = document.elementFromPoint(centerX, centerY)

          if (!topEl) return

          // The topmost element should be the element itself or a descendant of it
          if (topEl !== htmlEl && !htmlEl.contains(topEl) && !topEl.contains(htmlEl)) {
            const tag = htmlEl.tagName.toLowerCase()
            const testId = htmlEl.getAttribute('data-testid') || ''
            const text = htmlEl.textContent?.trim().slice(0, 30) || ''
            const occluderTag = topEl.tagName.toLowerCase()
            const occluderTestId = topEl.getAttribute('data-testid') || ''
            const occluderClass = topEl.className
              ? `.${String(topEl.className).split(' ').slice(0, 3).join('.')}`
              : ''

            violations.push(
              `${tag}${testId ? `[data-testid="${testId}"]` : ''}("${text}") ` +
              `occluded by ${occluderTag}${occluderTestId ? `[data-testid="${occluderTestId}"]` : ''}${occluderClass} ` +
              `at (${Math.round(centerX)}, ${Math.round(centerY)})`
            )
          }
        })

        return violations
      })

      expect(occluded, `Interactive elements occluded in ${name}:\n${occluded.join('\n')}`).toHaveLength(0)
    })
  }
})

// ─── 3.3 Bounding Box Containment ───

test.describe('Bounding Box Containment', () => {
  for (const [name, fixture] of CONTAINMENT_FIXTURES) {
    test(`showtime-app fits within window in ${name}`, async ({ mainPage: page }) => {
      await seedFixture(page, fixture)

      const result = await page.evaluate(() => {
        const app = document.querySelector('[data-testid="showtime-app"]')
        if (!app) return { found: false, violations: [] as string[] }

        const rect = (app as HTMLElement).getBoundingClientRect()
        const winW = window.innerWidth
        const winH = window.innerHeight
        const violations: string[] = []

        if (rect.left < 0) {
          violations.push(`left edge overflows: ${rect.left}px (should be >= 0)`)
        }
        if (rect.top < 0) {
          violations.push(`top edge overflows: ${rect.top}px (should be >= 0)`)
        }
        if (rect.right > winW) {
          violations.push(`right edge overflows: ${rect.right}px > window width ${winW}px`)
        }
        if (rect.bottom > winH) {
          violations.push(`bottom edge overflows: ${rect.bottom}px > window height ${winH}px`)
        }

        return { found: true, violations }
      })

      expect(result.found, `[data-testid="showtime-app"] not found in ${name}`).toBe(true)
      expect(
        result.violations,
        `Bounding box violations in ${name}:\n${result.violations.join('\n')}`
      ).toHaveLength(0)
    })
  }
})
