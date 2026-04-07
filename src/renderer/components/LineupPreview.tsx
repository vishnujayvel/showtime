/**
 * LineupPreview — displays the parsed lineup with act cards, refinement controls, and go-live actions.
 *
 * Extracted from WritersRoomView to keep the composition root focused on layout.
 * Handles two modes: draft preview (below chat) and confirmation panel (lineup_ready step).
 */
import { ActCard } from './ActCard'
import { Button } from '../ui/button'
import { cn } from '../lib/utils'
import type { Act, WritersRoomStep } from '../../shared/types'

interface LineupPreviewProps {
  acts: Act[]
  writersRoomStep: WritersRoomStep
  lineupStatus: 'draft' | 'confirmed'
  editingMidShow: boolean
  chatInput: string
  onChatInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onReorder: (actId: string, direction: 'up' | 'down') => void
  onRemove: (actId: string) => void
  onUpdateName: (actId: string, name: string) => void
  onUpdateDuration: (actId: string, durationMinutes: number) => void
  onAddAct: () => void
  onRefine: () => void
  onFinalize: () => void
  onGoLive: () => void
  onConfirmEdit: () => void
}

/** Draft lineup preview — shown below chat when acts are parsed but not yet in lineup_ready. */
export function LineupDraftPreview({
  acts,
  onReorder,
  onRemove,
  onUpdateName,
  onUpdateDuration,
}: Pick<LineupPreviewProps, 'acts' | 'onReorder' | 'onRemove' | 'onUpdateName' | 'onUpdateDuration'>) {
  return (
    <div className="px-6 py-3 border-t border-surface-hover shrink-0" data-testid="lineup-preview">
      <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-txt-muted mb-2 block">
        LINEUP
      </span>
      <div className="flex flex-col gap-2">
        {[...acts].sort((a, b) => a.order - b.order).map((act, index) => (
          <ActCard
            key={act.id}
            act={act}
            variant="full"
            actNumber={index + 1}
            onReorder={(direction) => onReorder(act.id, direction)}
            onRemove={() => onRemove(act.id)}
            onUpdateName={(name) => onUpdateName(act.id, name)}
            onUpdateDuration={(durationMinutes) => onUpdateDuration(act.id, durationMinutes)}
          />
        ))}
      </div>
    </div>
  )
}

/** Lineup confirmation panel — shown when in lineup_ready step with finalize/go-live actions. */
export function LineupConfirmation({
  acts,
  lineupStatus,
  editingMidShow,
  chatInput,
  onChatInputChange,
  onKeyDown,
  onSend,
  onReorder,
  onRemove,
  onUpdateName,
  onUpdateDuration,
  onAddAct,
  onRefine,
  onFinalize,
  onGoLive,
  onConfirmEdit,
}: LineupPreviewProps) {
  return (
    <div className="px-6 py-4 border-t border-accent/20 bg-surface shrink-0" data-testid="lineup-confirmation">
      <div className="flex items-center justify-between mb-3">
        <span className="font-mono text-[10px] tracking-[0.12em] uppercase text-accent">
          CONFIRM LINEUP
        </span>
        <span className="text-[10px] text-txt-muted">
          {acts.length} act{acts.length !== 1 ? 's' : ''}
        </span>
      </div>
      <div className="flex flex-col gap-2 max-h-[240px] overflow-y-auto">
        {[...acts].sort((a, b) => a.order - b.order).map((act, index) => (
          <ActCard
            key={act.id}
            act={act}
            variant="full"
            actNumber={index + 1}
            onReorder={(direction) => onReorder(act.id, direction)}
            onRemove={() => onRemove(act.id)}
            onUpdateName={(name) => onUpdateName(act.id, name)}
            onUpdateDuration={(durationMinutes) => onUpdateDuration(act.id, durationMinutes)}
          />
        ))}
        {/* Add Act button */}
        <button
          onClick={onAddAct}
          className="flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-surface-hover text-xs text-txt-muted hover:text-txt-secondary hover:border-txt-muted transition-colors"
          data-testid="add-act-btn"
        >
          + Add Act
        </button>
      </div>
      {/* Chat input for Claude refinement in lineup_ready */}
      <div className="flex items-end gap-2 mt-3">
        <textarea
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Tell the writers to change something..."
          rows={1}
          className="flex-1 resize-none rounded-lg bg-titlebar border border-surface-hover px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent/50"
          data-testid="lineup-chat-input"
        />
        <button
          onClick={onSend}
          disabled={!chatInput.trim()}
          className={cn(
            'rounded-lg px-3 py-2 text-sm font-medium transition-colors shrink-0',
            chatInput.trim()
              ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
              : 'bg-surface-hover text-txt-muted border border-surface-hover',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          data-testid="lineup-chat-send"
        >
          Send
        </button>
      </div>
      <div className="flex items-center gap-3 mt-3">
        <button
          onClick={onRefine}
          className="px-4 py-2.5 rounded-lg border border-surface-hover text-sm text-txt-secondary hover:text-txt-primary hover:border-txt-muted transition-colors"
          data-testid="refine-lineup-btn"
        >
          Refine
        </button>
        {editingMidShow ? (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              window.showtime.logEvent('INFO', 'confirm_lineup_edit_clicked', { actCount: acts.length })
              onConfirmEdit()
            }}
            data-testid="confirm-lineup-edit-btn"
          >
            Confirm & Resume Show
          </Button>
        ) : lineupStatus === 'confirmed' ? (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              window.showtime.logEvent('INFO', 'go_live_clicked', { actCount: acts.length })
              onGoLive()
            }}
            data-testid="confirm-go-live-btn"
          >
            Confirm & Go Live
          </Button>
        ) : (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              window.showtime.logEvent('INFO', 'finalize_lineup_clicked', { actCount: acts.length })
              onFinalize()
            }}
            data-testid="finalize-lineup-btn"
          >
            Finalize Lineup
          </Button>
        )}
      </div>
    </div>
  )
}
