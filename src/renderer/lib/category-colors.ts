// ─── Category Color Utility ───
// Maps sketch categories to Tailwind token classes.
// Single source of truth — replaces duplicated SKETCH_COLORS objects.

/** Union of all recognized act sketch categories. */
export type SketchCategory = 'Deep Work' | 'Exercise' | 'Admin' | 'Creative' | 'Social' | 'Personal'

interface CategoryClasses {
  /** Solid text color, e.g. `text-cat-deep` */
  text: string
  /** Solid background, e.g. `bg-cat-deep` */
  bg: string
  /** Solid border, e.g. `border-cat-deep` */
  border: string
  /** Background tint at low opacity for card fills */
  bgTint: string
  /** Border at 25% opacity for subtle outlines */
  borderTint: string
}

interface CategoryConfig {
  token: string
  hex: string
  classes: CategoryClasses
}

const DEFAULT_CONFIG: CategoryConfig = {
  token: 'zinc-400',
  hex: '#94a3b8',
  classes: {
    text: 'text-zinc-400',
    bg: 'bg-zinc-400',
    border: 'border-zinc-400',
    bgTint: 'bg-zinc-400/5',
    borderTint: 'border-zinc-400/25',
  },
}

const CATEGORY_MAP: Record<SketchCategory, CategoryConfig> = {
  'Deep Work': {
    token: 'cat-deep',
    hex: '#8b5cf6',
    classes: {
      text: 'text-cat-deep',
      bg: 'bg-cat-deep',
      border: 'border-cat-deep',
      bgTint: 'bg-cat-deep/5',
      borderTint: 'border-cat-deep/25',
    },
  },
  'Exercise': {
    token: 'cat-exercise',
    hex: '#22c55e',
    classes: {
      text: 'text-cat-exercise',
      bg: 'bg-cat-exercise',
      border: 'border-cat-exercise',
      bgTint: 'bg-cat-exercise/5',
      borderTint: 'border-cat-exercise/25',
    },
  },
  'Admin': {
    token: 'cat-admin',
    hex: '#60a5fa',
    classes: {
      text: 'text-cat-admin',
      bg: 'bg-cat-admin',
      border: 'border-cat-admin',
      bgTint: 'bg-cat-admin/5',
      borderTint: 'border-cat-admin/25',
    },
  },
  'Creative': {
    token: 'cat-creative',
    hex: '#f59e0b',
    classes: {
      text: 'text-cat-creative',
      bg: 'bg-cat-creative',
      border: 'border-cat-creative',
      bgTint: 'bg-cat-creative/5',
      borderTint: 'border-cat-creative/25',
    },
  },
  'Social': {
    token: 'cat-social',
    hex: '#ec4899',
    classes: {
      text: 'text-cat-social',
      bg: 'bg-cat-social',
      border: 'border-cat-social',
      bgTint: 'bg-cat-social/5',
      borderTint: 'border-cat-social/25',
    },
  },
  'Personal': {
    token: 'cat-personal',
    hex: '#14b8a6',
    classes: {
      text: 'text-cat-personal',
      bg: 'bg-cat-personal',
      border: 'border-cat-personal',
      bgTint: 'bg-cat-personal/5',
      borderTint: 'border-cat-personal/25',
    },
  },
}

// ─── Public API ───

/** Returns Tailwind utility classes for the given sketch category, falling back to neutral gray. */
export function getCategoryClasses(sketch: string): CategoryClasses {
  return (CATEGORY_MAP[sketch as SketchCategory] ?? DEFAULT_CONFIG).classes
}

/** Ordered list of all known sketch category names. */
export const SKETCH_CATEGORIES: SketchCategory[] = [
  'Deep Work',
  'Exercise',
  'Admin',
  'Creative',
  'Social',
  'Personal',
]
