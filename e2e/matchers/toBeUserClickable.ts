/**
 * Custom Playwright matcher: toBeUserClickable
 *
 * Asserts that an element is truly clickable by a real user — not just
 * "visible" in Playwright's auto-scrolling sense. Checks:
 * 1. Element is visible in the DOM
 * 2. Element is within the viewport (no scroll needed)
 * 3. Element is not obscured by another element (elementFromPoint at center)
 * 4. Element does not have pointer-events: none
 * 5. Element is not disabled (disabled attribute, aria-disabled)
 *
 * Usage:
 *   await expect(page.locator('#my-button')).toBeUserClickable()
 */
import type { Locator, ExpectMatcherState } from '@playwright/test'

interface ClickabilityResult {
  rect: { top: number; left: number; bottom: number; right: number; width: number; height: number }
  viewport: { width: number; height: number }
  inViewport: boolean
  topElementTag: string
  topElementId: string
  topElementClass: string
  isNotObscured: boolean
  pointerEvents: string
  isDisabled: boolean
}

export async function toBeUserClickable(
  this: ExpectMatcherState,
  locator: Locator,
) {
  const isNot = this.isNot
  const errors: string[] = []

  // 1. Check element is visible in the DOM
  const isVisible = await locator.isVisible().catch(() => false)
  if (!isVisible) {
    errors.push('Element is not visible in the DOM')
  }

  if (isVisible) {
    const result: ClickabilityResult = await locator.evaluate((el) => {
      const rect = el.getBoundingClientRect()
      const vw = window.innerWidth
      const vh = window.innerHeight

      // 2. Viewport check — element must be fully within visible area
      const inViewport =
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= vh &&
        rect.right <= vw &&
        rect.width > 0 &&
        rect.height > 0

      // 3. Obscured check — elementFromPoint at center must be the element or a child
      const centerX = rect.left + rect.width / 2
      const centerY = rect.top + rect.height / 2
      const topEl = document.elementFromPoint(centerX, centerY)
      const isNotObscured =
        topEl === el ||
        el.contains(topEl)

      // 4. Pointer-events check
      const computed = window.getComputedStyle(el)
      const pointerEvents = computed.pointerEvents

      // 5. Disabled control check
      const isDisabled =
        (el as HTMLButtonElement | HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).disabled === true ||
        el.getAttribute('disabled') !== null ||
        el.getAttribute('aria-disabled') === 'true'

      return {
        rect: {
          top: rect.top,
          left: rect.left,
          bottom: rect.bottom,
          right: rect.right,
          width: rect.width,
          height: rect.height,
        },
        viewport: { width: vw, height: vh },
        inViewport,
        topElementTag: topEl?.tagName ?? 'null',
        topElementId: (topEl as HTMLElement)?.id ?? '',
        topElementClass: (topEl as HTMLElement)?.className ?? '',
        isNotObscured,
        pointerEvents,
        isDisabled,
      }
    })

    if (!result.inViewport) {
      errors.push(
        `Element is outside the viewport. ` +
        `Bounding box: top=${result.rect.top.toFixed(1)}, left=${result.rect.left.toFixed(1)}, ` +
        `bottom=${result.rect.bottom.toFixed(1)}, right=${result.rect.right.toFixed(1)}. ` +
        `Viewport: ${result.viewport.width}x${result.viewport.height}`,
      )
    }

    if (!result.isNotObscured) {
      errors.push(
        `Element is obscured by another element at its center. ` +
        `Top element: <${result.topElementTag}` +
        `${result.topElementId ? ` id="${result.topElementId}"` : ''}` +
        `${result.topElementClass ? ` class="${result.topElementClass}"` : ''}>`,
      )
    }

    if (result.pointerEvents === 'none') {
      errors.push('Element has pointer-events: none')
    }

    if (result.isDisabled) {
      errors.push('Element is disabled (disabled attribute or aria-disabled="true")')
    }
  }

  const pass = errors.length === 0

  return {
    pass: isNot ? !pass : pass,
    message: () => {
      if (isNot) {
        return 'Expected element NOT to be user-clickable, but it passed all checks'
      }
      return `Expected element to be user-clickable, but:\n  - ${errors.join('\n  - ')}`
    },
    name: 'toBeUserClickable',
  }
}
