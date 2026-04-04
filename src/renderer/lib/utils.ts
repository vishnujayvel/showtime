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
 * Before noon → "today's", noon–6 PM → "your next",
 * after 6 PM → "tonight's" (default) or "tomorrow's" (if today's show is completed)
 */
export function getTemporalShowLabel(now: Date = new Date(), hasCompletedShow = false): string {
  const hour = now.getHours()
  if (hour < 12) return "today's"
  if (hour < 18) return "your next"
  return hasCompletedShow ? "tomorrow's" : "tonight's"
}

/**
 * Same as getTemporalShowLabel but returns uppercase for monospaced labels.
 */
export function getTemporalShowLabelUpper(now: Date = new Date(), hasCompletedShow = false): string {
  return getTemporalShowLabel(now, hasCompletedShow).toUpperCase()
}
