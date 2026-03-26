import { motion } from 'framer-motion'
import type { CalendarFetchStatus } from '../../shared/types'

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

interface CalendarToggleProps {
  checked: boolean
  onChange: (enabled: boolean) => void
  fetchStatus?: CalendarFetchStatus
  eventCount?: number
  disabled?: boolean
}

function StatusLabel({ fetchStatus, eventCount }: { fetchStatus: CalendarFetchStatus; eventCount: number }) {
  switch (fetchStatus) {
    case 'fetching':
      return (
        <span className="flex items-center gap-1.5">
          <span className="inline-block w-3 h-3 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span>Checking calendar...</span>
        </span>
      )
    case 'ready':
      return (
        <span>
          {eventCount > 0
            ? `${eventCount} event${eventCount !== 1 ? 's' : ''} today`
            : 'No events today'}
        </span>
      )
    case 'unavailable':
      return <span>Calendar not available</span>
    case 'error':
      return <span>Couldn&apos;t reach calendar</span>
    default:
      return <span>Import today&apos;s calendar events</span>
  }
}

export function CalendarToggle({ checked, onChange, fetchStatus = 'idle', eventCount = 0, disabled = false }: CalendarToggleProps) {
  const isDisabled = disabled || fetchStatus === 'unavailable' || fetchStatus === 'error'

  return (
    <motion.label
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className={`flex items-center gap-2 mb-4 cursor-pointer select-none ${
        isDisabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      data-testid="calendar-toggle"
      title={
        fetchStatus === 'unavailable'
          ? 'Calendar access not available in this Claude session'
          : fetchStatus === 'error'
            ? 'Could not connect to calendar'
            : undefined
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          if (!isDisabled) onChange(e.target.checked)
        }}
        disabled={isDisabled}
        className="sr-only"
      />
      <span
        className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
          checked && !isDisabled
            ? 'bg-accent border-accent text-white'
            : 'bg-transparent border-txt-muted'
        }`}
      >
        {checked && !isDisabled && (
          <svg
            className="w-3 h-3"
            viewBox="0 0 12 12"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M2 6l3 3 5-5" />
          </svg>
        )}
      </span>
      <span className="text-sm font-body text-txt-secondary" data-testid="calendar-status">
        <StatusLabel fetchStatus={fetchStatus} eventCount={eventCount} />
      </span>
    </motion.label>
  )
}
