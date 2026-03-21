import { cn } from '../lib/utils'
import { getCategoryClasses, SKETCH_CATEGORIES, type SketchCategory } from '../lib/category-colors'

interface ClapperboardBadgeProps {
  sketch: string
  actNumber: number
  duration?: string
  status?: 'active' | 'complete'
  size?: 'sm' | 'md'
}

const ACCENT_CLASSES = {
  text: 'text-accent',
  borderTint: 'border-accent/25',
}

function resolveColors(sketch: string) {
  const isKnown = (SKETCH_CATEGORIES as string[]).includes(sketch)
  if (isKnown) {
    const classes = getCategoryClasses(sketch)
    return { text: classes.text, borderTint: classes.borderTint }
  }
  return ACCENT_CLASSES
}

export function ClapperboardBadge({
  sketch,
  actNumber,
  duration,
  status,
  size = 'md',
}: ClapperboardBadgeProps) {
  const colors = resolveColors(sketch)

  const suffix = status === 'complete' ? 'COMPLETE' : duration

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded border px-2.5 py-[3px]',
        'font-mono font-semibold uppercase tracking-[0.08em]',
        size === 'sm' ? 'text-[10px]' : 'text-[11px]',
        colors.text,
        colors.borderTint,
      )}
    >
      <span>{sketch}</span>
      <span className="opacity-40">|</span>
      <span>ACT {actNumber}</span>
      {suffix && (
        <>
          <span className="opacity-40">|</span>
          <span>{suffix}</span>
        </>
      )}
    </span>
  )
}
