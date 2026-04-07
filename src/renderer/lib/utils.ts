import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

/** Merges class names using clsx and tailwind-merge to resolve Tailwind conflicts. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/** Formats the current date as an uppercase short label like "MON, APR 6". */
export function formatDateLabel(): string {
  return new Date()
    .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    .toUpperCase()
}

/** Returns a temporal-aware possessive label like "today's", "your next", or "tonight's" based on time of day. */
export function getTemporalShowLabel(now: Date = new Date(), hasCompletedShow = false): string {
  const hour = now.getHours()
  if (hour < 12) return "today's"
  if (hour < 18) return "your next"
  return hasCompletedShow ? "tomorrow's" : "tonight's"
}

/** Returns the temporal show label in uppercase for monospaced display contexts. */
export function getTemporalShowLabelUpper(now: Date = new Date(), hasCompletedShow = false): string {
  return getTemporalShowLabel(now, hasCompletedShow).toUpperCase()
}
