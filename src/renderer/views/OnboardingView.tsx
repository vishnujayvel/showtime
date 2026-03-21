import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '../ui/button'

interface OnboardingViewProps {
  onComplete: () => void
  onSkip?: () => void
}

const steps = [
  {
    title: 'Welcome to the Show',
    content:
      'Your day is a Show. You are the Performer. Every task is an Act on your stage.',
    animationClass: 'spotlight-in',
  },
  {
    title: "The Writer's Room",
    content:
      "Each morning, you enter the Writer's Room. Tell Claude what's on your plate, and the writers draft tonight's lineup.",
    animationClass: 'spotlight-warm',
  },
  {
    title: 'Acts and the ON AIR Light',
    content:
      'When the show goes live, the ON AIR light ignites. Each Act has a timer \u2014 a broadcast clock counting down to the next moment.',
    animationClass: '',
  },
  {
    title: 'Beats: Moments of Presence',
    content:
      'A Beat is not productivity. A Beat is presence. Lock a Beat when you notice you are truly here.',
    animationClass: '',
  },
  {
    title: 'Ready for Your First Show?',
    content:
      "The stage is set. The spotlight is warm. The Writer's Room is waiting.",
    animationClass: '',
  },
]

const springTransition = { type: 'spring' as const, stiffness: 300, damping: 30 }

export function OnboardingView({ onComplete, onSkip }: OnboardingViewProps) {
  const [currentStep, setCurrentStep] = useState(0)

  const goNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }

  const goBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const step = steps[currentStep]

  return (
    <div
      className="bg-studio-bg w-[560px] min-h-[620px] flex flex-col items-center justify-between overflow-hidden relative"
    >
      {/* Invisible drag handle */}
      <div className="absolute top-0 left-0 right-0 h-8 drag-region z-10" />

      {/* Skip link */}
      <div className="w-full flex justify-end pt-5 pr-6">
        <button
          onClick={onSkip || onComplete}
          className="font-body text-sm text-txt-muted hover:text-txt-secondary transition-colors no-drag"
        >
          Skip
        </button>
      </div>

      {/* Step content area */}
      <div className="flex-1 flex flex-col items-center justify-center px-12 relative w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 }}
            transition={springTransition}
            className="flex flex-col items-center text-center w-full"
          >
            {/* Step 0: spotlight-in on the content block */}
            {currentStep === 0 && (
              <div className="spotlight-in flex flex-col items-center">
                <h1 className="font-body text-3xl font-light text-txt-primary tracking-tight">
                  {step.title}
                </h1>
                <p className="font-body text-base text-txt-secondary mt-4 max-w-[400px] leading-relaxed">
                  {step.content}
                </p>
              </div>
            )}

            {/* Step 1: spotlight-warm gradient overlay */}
            {currentStep === 1 && (
              <div className="relative flex flex-col items-center w-full">
                <div className="absolute inset-0 spotlight-warm pointer-events-none rounded-xl" />
                <h1 className="font-body text-3xl font-light text-txt-primary tracking-tight relative">
                  {step.title}
                </h1>
                <p className="font-body text-base text-txt-secondary mt-4 max-w-[400px] leading-relaxed relative">
                  {step.content}
                </p>
              </div>
            )}

            {/* Step 2: ON AIR sample indicator */}
            {currentStep === 2 && (
              <div className="flex flex-col items-center">
                <div className="onair-glow mb-6 px-3 py-1.5 border border-onair rounded font-mono text-[10px] font-bold tracking-[0.2em] text-onair uppercase">
                  ON AIR
                </div>
                <h1 className="font-body text-3xl font-light text-txt-primary tracking-tight">
                  {step.title}
                </h1>
                <p className="font-body text-base text-txt-secondary mt-4 max-w-[400px] leading-relaxed">
                  {step.content}
                </p>
              </div>
            )}

            {/* Step 3: Beat star sample */}
            {currentStep === 3 && (
              <div className="flex flex-col items-center">
                <span className="beat-ignite text-2xl mb-6">&#9733;</span>
                <h1 className="font-body text-3xl font-light text-txt-primary tracking-tight">
                  {step.title}
                </h1>
                <p className="font-body text-base text-txt-secondary mt-4 max-w-[400px] leading-relaxed">
                  {step.content}
                </p>
              </div>
            )}

            {/* Step 4: golden-glow on CTA title */}
            {currentStep === 4 && (
              <div className="flex flex-col items-center">
                <h1 className="golden-glow font-body text-3xl font-light text-beat tracking-tight">
                  {step.title}
                </h1>
                <p className="font-body text-base text-txt-secondary mt-4 max-w-[400px] leading-relaxed">
                  {step.content}
                </p>
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Bottom area: step dots + navigation */}
      <div className="w-full flex flex-col items-center pb-8 gap-6">
        {/* Step indicator dots */}
        <div className="flex items-center gap-2">
          {steps.map((_, index) => (
            <div
              key={index}
              className={`h-2 w-2 rounded-full transition-colors ${
                index === currentStep ? 'bg-accent' : 'bg-surface-hover'
              }`}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center gap-3 no-drag">
          {currentStep > 0 && (
            <Button variant="ghost_muted" onClick={goBack}>
              Back
            </Button>
          )}

          {currentStep < steps.length - 1 ? (
            <Button variant="accent" onClick={goNext}>
              Next
            </Button>
          ) : (
            <Button variant="primary" onClick={onComplete}>
              {"Enter the Writer's Room"}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
