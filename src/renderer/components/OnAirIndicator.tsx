import { cn } from '../lib/utils'

interface OnAirIndicatorProps {
  isLive: boolean
}

export function OnAirIndicator({ isLive }: OnAirIndicatorProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-[5px] rounded px-2 py-[2px]',
        'font-mono text-[10px] font-bold tracking-[0.12em]',
        isLive
          ? 'text-onair border-[1.5px] border-onair animate-onair-glow'
          : 'text-[#3a3a3e] border-[1.5px] border-[#3a3a3e]'
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          isLive ? 'bg-onair' : 'bg-[#3a3a3e]'
        )}
      />
      ON AIR
    </span>
  )
}
