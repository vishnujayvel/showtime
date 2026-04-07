/**
 * Shared spring transition presets for Framer Motion.
 *
 * These are the 3 most-used spring configs across the codebase.
 * Use these instead of defining per-file `springTransition` constants.
 */

/** Default spring — used for most UI transitions (cards, modals, panels) */
export const springDefault = { type: 'spring' as const, stiffness: 300, damping: 30 }

/** Gentle spring — used for staggered reveals and slow entrances (Strike, History, Settings) */
export const springGentle = { type: 'spring' as const, stiffness: 200, damping: 25 }

/** Snappy spring — used for fast-tracking elements (BurningFuse, progress fills) */
export const springSnappy = { type: 'spring' as const, stiffness: 400, damping: 40 }
