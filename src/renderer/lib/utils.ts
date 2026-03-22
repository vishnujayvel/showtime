import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDateLabel(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()
}

/**
 * Returns temporal-aware possessive for lineup/show references.
 * Before noon → "today's", noon–6 PM → "your next", after 6 PM → "tomorrow's"
 */
export function getTemporalShowLabel(now: Date = new Date()): string {
  const hour = now.getHours()
  if (hour < 12) return "today's"
  if (hour < 18) return "your next"
  return "tomorrow's"
}

/**
 * Same as getTemporalShowLabel but returns uppercase for monospaced labels.
 */
export function getTemporalShowLabelUpper(now: Date = new Date()): string {
  return getTemporalShowLabel(now).toUpperCase()
}
