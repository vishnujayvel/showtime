import type { ShowPhase } from '../../shared/types'

const DOCS_BASE = 'https://vishnujayvel.github.io/showtime'

const HELP_LINKS: Record<string, string> = {
  no_show: '/guide/getting-started',
  writers_room: '/guide/writers-room',
  live: '/guide/live-show',
  intermission: '/guide/live-show',
  director: '/guide/live-show',
  strike: '/guide/framework#strike',
  settings: '/guide/settings',
}

interface HelpButtonProps {
  phase: ShowPhase | 'settings'
  className?: string
}

/** Small circular "?" button that opens the phase-specific documentation page in the user's browser. */
export function HelpButton({ phase, className = '' }: HelpButtonProps) {
  const page = HELP_LINKS[phase] ?? '/guide/getting-started'

  return (
    <button
      onClick={() => window.showtime.openExternal(`${DOCS_BASE}${page}`)}
      className={`w-6 h-6 rounded-full bg-surface-hover/60 text-txt-muted hover:text-accent transition-colors text-xs font-body flex items-center justify-center no-drag z-50 ${className}`}
      title="Help"
      data-testid="help-button"
    >
      ?
    </button>
  )
}
