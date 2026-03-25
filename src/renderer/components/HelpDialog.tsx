import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog'

interface HelpDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function HelpDialog({ open, onOpenChange }: HelpDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>How Showtime Works</DialogTitle>
          <DialogDescription>Your day is a live show.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 text-sm text-txt-secondary">
          <section>
            <h3 className="font-body font-semibold text-txt-primary mb-1">Acts</h3>
            <p>Each task is an Act in your show. Start an act, work until the timer ends, then move on.</p>
          </section>

          <section>
            <h3 className="font-body font-semibold text-txt-primary mb-1">Beats</h3>
            <p>Moments of presence during an act. When the Beat Check appears, pause and notice how you feel. Lock it or skip — no wrong answer.</p>
          </section>

          <section>
            <h3 className="font-body font-semibold text-txt-primary mb-1">Show Phases</h3>
            <ul className="space-y-1 ml-4 list-disc">
              <li><span className="text-txt-primary">Dark Studio</span> — before the show starts</li>
              <li><span className="text-txt-primary">Writer&apos;s Room</span> — plan your lineup</li>
              <li><span className="text-txt-primary">ON AIR</span> — you&apos;re live, working acts</li>
              <li><span className="text-txt-primary">Intermission</span> — rest between acts (free)</li>
              <li><span className="text-txt-primary">Strike</span> — show&apos;s over, see your verdict</li>
            </ul>
          </section>

          <section>
            <h3 className="font-body font-semibold text-txt-primary mb-1">Keyboard Shortcuts</h3>
            <ul className="space-y-1 font-mono text-xs">
              <li><kbd className="bg-surface-hover px-1.5 py-0.5 rounded">Space</kbd> — pause / resume timer</li>
              <li><kbd className="bg-surface-hover px-1.5 py-0.5 rounded">S</kbd> — skip current act</li>
              <li><kbd className="bg-surface-hover px-1.5 py-0.5 rounded">⌘ ,</kbd> — settings</li>
            </ul>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}
