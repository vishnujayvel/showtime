/**
 * ChatInput — footer area with chat textarea and action buttons for the Writer's Room.
 *
 * Extracted from WritersRoomView to keep the composition root focused on layout.
 * Handles the main chat input, "Build My Lineup" CTA, and mid-show edit confirm.
 */
import { Button } from '../ui/button'
import { cn } from '../lib/utils'

interface ChatInputProps {
  chatInput: string
  hasLineup: boolean
  editingMidShow: boolean
  actCount: number
  onChatInputChange: (value: string) => void
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  onSend: () => void
  onBuildLineup: () => void
  onFinalize: () => void
  onConfirmEdit: () => void
}

export function ChatInput({
  chatInput,
  hasLineup,
  editingMidShow,
  actCount,
  onChatInputChange,
  onKeyDown,
  onSend,
  onBuildLineup,
  onFinalize,
  onConfirmEdit,
}: ChatInputProps) {
  return (
    <div className="px-6 py-4 border-t border-surface-hover shrink-0">
      {/* Chat input */}
      <div className="flex items-end gap-2">
        <textarea
          value={chatInput}
          onChange={(e) => onChatInputChange(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={
            hasLineup
              ? 'Tell the writers to change something...'
              : 'What do you want to accomplish today?'
          }
          rows={1}
          className="flex-1 resize-none rounded-lg bg-titlebar border border-surface-hover px-3 py-2.5 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:border-accent/50 disabled:opacity-50"
          data-testid="chat-input"
        />
        <button
          onClick={onSend}
          disabled={!chatInput.trim()}
          className={cn(
            'rounded-lg px-3 py-2.5 text-sm font-medium transition-colors shrink-0',
            chatInput.trim()
              ? 'bg-accent/15 text-accent border border-accent/30 hover:bg-accent/25'
              : 'bg-surface-hover text-txt-muted border border-surface-hover',
            'disabled:opacity-50 disabled:cursor-not-allowed',
          )}
          data-testid="chat-send"
        >
          Send
        </button>
      </div>

      {/* Action buttons */}
      <div className="flex items-center gap-3 mt-3">
        {/* Mid-show editing: always show confirm & resume */}
        {editingMidShow && hasLineup && (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              window.showtime.logEvent('INFO', 'confirm_lineup_edit_clicked', { actCount })
              onConfirmEdit()
            }}
            data-testid="confirm-lineup-edit-btn"
          >
            Confirm & Resume Show
          </Button>
        )}

        {/* BUILD MY LINEUP — visible when no lineup and not mid-show editing */}
        {!hasLineup && !editingMidShow && (
          <button
            onClick={onBuildLineup}
            disabled={false}
            className="flex-1 py-2.5 rounded-lg border-2 border-dashed border-accent/30 text-sm text-accent font-medium hover:border-accent/50 hover:bg-accent/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-testid="build-lineup-btn"
          >
            BUILD MY LINEUP
          </button>
        )}

        {/* Finalize Lineup — visible when lineup exists but not in confirmation step and not mid-show */}
        {hasLineup && !editingMidShow && (
          <Button
            variant="primary"
            className="flex-1"
            onClick={() => {
              window.showtime.logEvent('INFO', 'finalize_lineup_clicked', { actCount })
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
