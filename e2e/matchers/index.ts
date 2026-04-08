/**
 * Custom Playwright matchers for AI Visual QA.
 *
 * Re-exports all matchers and provides an extended `expect` that
 * includes them. Import `expect` from this module instead of
 * '@playwright/test' to use custom matchers.
 */
import { expect as baseExpect, type Locator } from '@playwright/test'
import { toBeUserClickable } from './toBeUserClickable'
import { toFitWithin } from './toFitWithin'

export { toBeUserClickable } from './toBeUserClickable'
export { toFitWithin } from './toFitWithin'

export const expect = baseExpect.extend({
  toBeUserClickable,
  toFitWithin,
})

// ─── Type Augmentation ───

export type CustomMatchers = {
  /**
   * Asserts that the element is truly clickable by a real user:
   * visible, within viewport, not obscured, and not pointer-events: none.
   */
  toBeUserClickable(): Promise<void>

  /**
   * Asserts that this locator's bounding box fits entirely within
   * the container locator's bounding box.
   */
  toFitWithin(container: Locator): Promise<void>
}

declare module '@playwright/test' {
  // eslint-disable-next-line @typescript-eslint/no-empty-interface
  interface Matchers<R, T> extends CustomMatchers {}
}
