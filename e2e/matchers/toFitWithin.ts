/**
 * Custom Playwright matcher: toFitWithin
 *
 * Asserts that one locator's bounding box is fully contained within
 * another locator's bounding box. Error messages include exact pixel
 * coordinates for debugging.
 *
 * Usage:
 *   await expect(childLocator).toFitWithin(containerLocator)
 */
import type { Locator, ExpectMatcherState } from '@playwright/test'

interface BBox {
  top: number
  left: number
  bottom: number
  right: number
  width: number
  height: number
}

function formatBox(label: string, box: BBox): string {
  return (
    `${label}: top=${box.top.toFixed(1)}, left=${box.left.toFixed(1)}, ` +
    `bottom=${box.bottom.toFixed(1)}, right=${box.right.toFixed(1)} ` +
    `(${box.width.toFixed(1)}x${box.height.toFixed(1)})`
  )
}

export async function toFitWithin(
  this: ExpectMatcherState,
  child: Locator,
  container: Locator,
) {
  const isNot = this.isNot

  const childBox = await child.boundingBox()
  const containerBox = await container.boundingBox()

  if (!childBox) {
    return {
      pass: isNot ? true : false,
      message: () => 'Child element has no bounding box (not visible or not attached)',
      name: 'toFitWithin',
    }
  }

  if (!containerBox) {
    return {
      pass: isNot ? true : false,
      message: () => 'Container element has no bounding box (not visible or not attached)',
      name: 'toFitWithin',
    }
  }

  // Compute derived bottom/right for both boxes
  // boundingBox() returns { x, y, width, height }
  const childRect: BBox = {
    top: childBox.y,
    left: childBox.x,
    bottom: childBox.y + childBox.height,
    right: childBox.x + childBox.width,
    width: childBox.width,
    height: childBox.height,
  }

  const containerRect: BBox = {
    top: containerBox.y,
    left: containerBox.x,
    bottom: containerBox.y + containerBox.height,
    right: containerBox.x + containerBox.width,
    width: containerBox.width,
    height: containerBox.height,
  }

  // Sub-pixel tolerance to prevent flakiness from floating-point rounding
  const EPSILON = 0.5

  const overflows: string[] = []

  if (childRect.top < containerRect.top - EPSILON) {
    overflows.push(`top overflows by ${(containerRect.top - childRect.top).toFixed(1)}px`)
  }
  if (childRect.left < containerRect.left - EPSILON) {
    overflows.push(`left overflows by ${(containerRect.left - childRect.left).toFixed(1)}px`)
  }
  if (childRect.bottom > containerRect.bottom + EPSILON) {
    overflows.push(`bottom overflows by ${(childRect.bottom - containerRect.bottom).toFixed(1)}px`)
  }
  if (childRect.right > containerRect.right + EPSILON) {
    overflows.push(`right overflows by ${(childRect.right - containerRect.right).toFixed(1)}px`)
  }

  const pass = overflows.length === 0

  return {
    pass: isNot ? !pass : pass,
    message: () => {
      if (isNot) {
        return (
          `Expected child NOT to fit within container, but it does.\n` +
          `  ${formatBox('Child', childRect)}\n` +
          `  ${formatBox('Container', containerRect)}`
        )
      }
      return (
        `Expected child to fit within container, but:\n` +
        `  - ${overflows.join('\n  - ')}\n` +
        `  ${formatBox('Child', childRect)}\n` +
        `  ${formatBox('Container', containerRect)}`
      )
    },
    name: 'toFitWithin',
  }
}
