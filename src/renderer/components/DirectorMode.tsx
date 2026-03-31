import { useState } from 'react'
import { useShowContext, useShowSend } from '../machines/ShowMachineProvider'
import { Button } from '../ui/button'
import { getTemporalShowLabel } from '../lib/utils'
import { motion } from 'framer-motion'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog'

export function DirectorMode() {
  const send = useShowSend()
  const currentActId = useShowContext((ctx) => ctx.currentActId)
  const [confirmReset, setConfirmReset] = useState(false)

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-[12px] z-50 flex items-center justify-center">
      <motion.div
        className="w-[420px] p-8 rounded-2xl bg-surface border border-card-border"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
      >
        <h2 className="font-body text-xl font-bold text-txt-primary mb-2">
          The Director is here.
        </h2>
        <p className="text-sm text-txt-secondary mb-8">
          What's the call?
        </p>

        <div className="flex flex-col gap-3">
          <Button
            className="w-full py-3 rounded-xl bg-surface-hover text-txt-primary text-sm font-medium border border-border-default hover:bg-[#2a2a2e] transition-colors"
            onClick={() => {
              send({ type: 'SKIP_ACT', actId: currentActId! })
              send({ type: 'EXIT_DIRECTOR' })
            }}
          >
            Skip this act, move on
          </Button>

          <Button
            className="w-full py-3 rounded-xl bg-onair/10 text-onair text-sm font-medium border border-onair/20 hover:bg-onair/15 transition-colors"
            onClick={() => {
              send({ type: 'CALL_SHOW_EARLY' })
            }}
          >
            Call the show early
          </Button>

          <Button
            className="w-full py-3 rounded-xl bg-purple-500/10 text-purple-400 text-sm font-medium border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
            onClick={() => {
              send({ type: 'ENTER_INTERMISSION' })
              send({ type: 'EXIT_DIRECTOR' })
            }}
          >
            Take a longer break
          </Button>

          <Button
            className="w-full py-3 rounded-xl bg-blue-500/10 text-blue-400 text-sm font-medium border border-blue-500/20 hover:bg-blue-500/15 transition-colors"
            onClick={() => {
              send({ type: 'START_BREATHING_PAUSE' })
              send({ type: 'EXIT_DIRECTOR' })
            }}
          >
            Just a moment
          </Button>

          <div className="border-t border-surface-hover my-1" />

          <Button
            className="w-full py-3 rounded-xl bg-txt-muted/10 text-txt-muted text-sm font-medium border border-txt-muted/20 hover:bg-txt-muted/15 transition-colors"
            onClick={() => setConfirmReset(true)}
          >
            Reset {getTemporalShowLabel()} show
          </Button>
        </div>
      </motion.div>

      <Dialog open={confirmReset} onOpenChange={setConfirmReset}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Reset {getTemporalShowLabel()} show?</DialogTitle>
            <DialogDescription>
              This clears your lineup, timer, and beats. It can't be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost_muted" onClick={() => setConfirmReset(false)}>
              Cancel
            </Button>
            <Button
              variant="accent"
              onClick={() => {
                setConfirmReset(false)
                send({ type: 'RESET' })
              }}
            >
              Reset Show
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
