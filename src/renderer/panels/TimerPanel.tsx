import { useShowContext, useShowSend, useShowSelector, showSelectors } from '../machines/ShowMachineProvider'
import { useTimer } from '../hooks/useTimer'
import { ClapperboardBadge } from '../components/ClapperboardBadge'
import { BurningFuse, getFuseUrgencyClass } from '../components/BurningFuse'
import { Button } from '../ui/button'
import { getCategoryClasses } from '../lib/category-colors'

export function TimerPanel() {
  const currentAct = useShowSelector(showSelectors.currentAct)
  const acts = useShowContext((ctx) => ctx.acts)
  const currentActId = useShowContext((ctx) => ctx.currentActId)
  const send = useShowSend()
  const { minutes, seconds, isRunning, progress } = useTimer()

  if (!currentAct) {
    return (
      <div className="flex flex-col items-center flex-1 justify-center">
        <span className="text-txt-muted">No active act</span>
      </div>
    )
  }

  const actNumber = acts.findIndex((a) => a.id === currentAct.id) + 1
  const timerUrgencyClass = isRunning ? getFuseUrgencyClass(progress) : 'text-txt-primary'
  const categoryClasses = getCategoryClasses(currentAct.sketch)

  return (
    <div className="flex flex-col items-center flex-1 justify-center">
      <ClapperboardBadge
        sketch={currentAct.sketch}
        actNumber={actNumber}
        status="active"
      />

      <span className="font-body text-lg font-bold text-txt-primary mt-3">
        {currentAct.name}
      </span>

      <span
        className={`font-mono text-[64px] font-bold leading-none tracking-tight tabular-nums mt-4 transition-colors duration-500 ${timerUrgencyClass}`}
      >
        {minutes.toString().padStart(2, '0')}:{seconds.toString().padStart(2, '0')}
      </span>

      <div className="mt-6 w-full max-w-[280px]">
        <BurningFuse size="expanded" progress={progress} />
      </div>

      <div className="flex items-center gap-3 mt-8">
        <Button variant="neutral" size="sm" onClick={() => send({ type: 'EXTEND_ACT', minutes: 15 })}>
          +15m
        </Button>
        <Button variant="accent" size="sm" onClick={() => send({ type: 'COMPLETE_ACT', actId: currentActId! })}>
          End Act
        </Button>
        <button
          onClick={() => send({ type: 'ENTER_INTERMISSION' })}
          className="px-4 py-2 rounded-lg bg-purple-500/10 text-purple-400 text-sm font-medium border border-purple-500/20 hover:bg-purple-500/15 transition-colors"
        >
          Rest
        </button>
      </div>
    </div>
  )
}
