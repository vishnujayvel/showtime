import { useShowContext } from '../machines/ShowMachineProvider'
import { cn } from '../lib/utils'

interface BeatCounterProps {
  size?: 'sm' | 'md' | 'lg' | 'xl'
  showLabel?: boolean
  dimmed?: boolean
  justIgnitedIndex?: number | null
}

const sizeClasses: Record<NonNullable<BeatCounterProps['size']>, string> = {
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-2xl',
  xl: 'text-3xl',
}

/** Row of gold/gray star icons showing how many presence beats have been locked out of the threshold. */
export function BeatCounter({
  size = 'md',
  showLabel = false,
  dimmed = false,
  justIgnitedIndex = null,
}: BeatCounterProps) {
  const beatsLocked = useShowContext((ctx) => ctx.beatsLocked)
  const beatThreshold = useShowContext((ctx) => ctx.beatThreshold)

  const stars = Array.from({ length: beatThreshold }, (_, i) => i < beatsLocked)

  return (
    <div className={cn('inline-flex items-center gap-1', dimmed && 'opacity-35')}>
      {stars.map((filled, i) => (
        <span
          key={i}
          className={cn(
            sizeClasses[size],
            filled ? 'text-beat beat-lit' : 'text-txt-muted beat-dim',
            justIgnitedIndex === i && 'animate-beat-ignite',
          )}
        >
          {filled ? '\u2605' : '\u2606'}
        </span>
      ))}
      {showLabel && (
        <span className="text-sm text-txt-secondary ml-1">
          {beatsLocked}/{beatThreshold} Beats
        </span>
      )}
    </div>
  )
}
