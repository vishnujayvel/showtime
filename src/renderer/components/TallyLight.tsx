import { cn } from '../lib/utils'

const sizeMap = {
  sm: 'w-1.5 h-1.5',
  md: 'w-2 h-2',
  lg: 'w-2.5 h-2.5',
} as const

interface TallyLightProps {
  isLive: boolean
  size?: 'sm' | 'md' | 'lg'
}

/** Pulsing red dot indicating the show is currently live. */
export function TallyLight({ isLive, size = 'lg' }: TallyLightProps) {
  return (
    <div
      className={cn(
        'rounded-full',
        sizeMap[size],
        isLive ? 'bg-onair animate-tally-pulse' : 'bg-[#3a3a3e]',
      )}
    />
  )
}
