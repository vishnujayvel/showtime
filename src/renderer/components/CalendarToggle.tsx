import { motion } from 'framer-motion'

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

interface CalendarToggleProps {
  checked: boolean
  onChange: (enabled: boolean) => void
  disabled?: boolean
}

export function CalendarToggle({ checked, onChange, disabled = false }: CalendarToggleProps) {
  return (
    <motion.label
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springTransition}
      className={`flex items-center gap-2 mb-4 cursor-pointer select-none ${
        disabled ? 'opacity-50 cursor-not-allowed' : ''
      }`}
      data-testid="calendar-toggle"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => {
          if (!disabled) onChange(e.target.checked)
        }}
        disabled={disabled}
        className="sr-only"
      />
      <span
        className={`flex items-center justify-center w-4 h-4 rounded border transition-colors ${
          checked
            ? 'bg-accent border-accent text-white'
            : 'bg-transparent border-txt-muted'
        }`}
      >
        {checked && (
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
      <span className="text-sm font-body text-txt-secondary">
        Import today&apos;s calendar events
      </span>
    </motion.label>
  )
}
