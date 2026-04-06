import { useCallback } from 'react'
import { useShowPhase, useShowSend } from '../machines/ShowMachineProvider'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuGroup,
} from '../ui/dropdown-menu'
import { cn } from '../lib/utils'

interface ViewMenuProps {
  view: 'pill' | 'compact' | 'expanded' | 'writers_room'
}

export function ViewMenu({ view }: ViewMenuProps) {
  const phase = useShowPhase()
  const send = useShowSend()

  const editLineup = useCallback(() => send({ type: 'EDIT_LINEUP' }), [send])
  const enterDirector = useCallback(() => send({ type: 'ENTER_DIRECTOR' }), [send])
  const enterIntermission = useCallback(() => send({ type: 'ENTER_INTERMISSION' }), [send])

  const canEditLineup = phase === 'live' || phase === 'intermission'
  const canDirector = phase === 'live' || phase === 'intermission'
  const canBreak = phase === 'live'

  const isPill = view === 'pill'

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className={cn(
            'shrink-0 flex items-center justify-center transition-colors no-drag',
            'text-txt-secondary hover:text-txt-primary',
            isPill
              ? 'w-5 h-5 rounded-full border border-white/10 hover:border-white/20 text-[10px] font-mono leading-none'
              : 'w-7 h-7 rounded-lg hover:bg-surface-hover text-sm'
          )}
          aria-label="View menu"
          data-testid="view-menu-trigger"
        >
          {isPill ? '\u22EE' : '\u2699'}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isPill ? 'top' : 'bottom'}
        align="end"
        sideOffset={8}
        className="w-48 bg-surface border border-white/[0.06] rounded-xl shadow-lg"
      >
        {/* Action group */}
        <DropdownMenuGroup>
          {canEditLineup && (
            <DropdownMenuItem
              onClick={editLineup}
              data-testid="menu-edit-lineup"
              className="h-8 text-sm text-txt-primary hover:bg-surface-hover rounded-lg cursor-pointer"
            >
              <span className="text-txt-muted mr-2">&#9776;</span>
              Edit Lineup
            </DropdownMenuItem>
          )}
          {canDirector && (
            <DropdownMenuItem
              onClick={enterDirector}
              data-testid="menu-director"
              className="h-8 text-sm text-txt-primary hover:bg-surface-hover rounded-lg cursor-pointer"
            >
              <span className="text-txt-muted mr-2">&#127916;</span>
              Director Mode
            </DropdownMenuItem>
          )}
          {canBreak && (
            <DropdownMenuItem
              onClick={enterIntermission}
              data-testid="menu-take-break"
              className="h-8 text-sm text-txt-primary hover:bg-surface-hover rounded-lg cursor-pointer"
            >
              <span className="text-txt-muted mr-2">&#9749;</span>
              Take a Break
            </DropdownMenuItem>
          )}
          {isPill && (
            <DropdownMenuItem
              onClick={() => send({ type: 'SET_VIEW_TIER', tier: 'expanded' })}
              data-testid="menu-expand"
              className="h-8 text-sm text-txt-primary hover:bg-surface-hover rounded-lg cursor-pointer"
            >
              <span className="text-txt-muted mr-2">&#8599;</span>
              Expand View
            </DropdownMenuItem>
          )}
        </DropdownMenuGroup>

        {/* Navigation group */}
        <DropdownMenuSeparator className="bg-white/[0.06]" />
        <DropdownMenuGroup>
          <DropdownMenuItem
            onClick={() => send({ type: 'VIEW_HISTORY' })}
            data-testid="menu-history"
            className="h-8 text-sm text-txt-primary hover:bg-surface-hover rounded-lg cursor-pointer"
          >
            <span className="text-txt-muted mr-2">&#128218;</span>
            Show History
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => send({ type: 'VIEW_SETTINGS' })}
            data-testid="menu-settings"
            className="h-8 text-sm text-txt-primary hover:bg-surface-hover rounded-lg cursor-pointer"
          >
            <span className="text-txt-muted mr-2">&#9881;</span>
            Settings
          </DropdownMenuItem>
        </DropdownMenuGroup>

        {/* Quit group (pill view only) */}
        {isPill && (
          <>
            <DropdownMenuSeparator className="bg-white/[0.06]" />
            <DropdownMenuItem
              onClick={() => window.showtime.quit()}
              data-testid="menu-quit"
              className="h-8 text-sm text-txt-primary hover:bg-surface-hover rounded-lg cursor-pointer"
            >
              <span className="text-txt-muted mr-2">&#10005;</span>
              Quit
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
