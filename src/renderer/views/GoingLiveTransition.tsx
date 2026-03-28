import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { OnAirIndicator } from '../components/OnAirIndicator';
import { Button } from '../ui/button';
import { playAudioCue } from '../hooks/useAudio';

interface GoingLiveTransitionProps {
  onComplete: () => void;
}

export function GoingLiveTransition({ onComplete }: GoingLiveTransitionProps) {
  const [showButton, setShowButton] = useState(false);

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  useEffect(() => {
    playAudioCue('going-live');
    const timer = setTimeout(() => setShowButton(true), 1800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="fixed inset-0 bg-studio-bg flex flex-col items-center justify-center z-50">
      <div className="absolute inset-0 spotlight-stage pointer-events-none" />

      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.3 }}
        className="onair-glow rounded"
      >
        <OnAirIndicator isLive={true} />
      </motion.div>

      <motion.h1
        className="font-body text-3xl font-extrabold text-txt-primary tracking-tight mt-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.8 }}
      >
        Live from your desk, it&apos;s {formattedDate}!
      </motion.h1>

      <motion.p
        className="text-sm text-txt-secondary mt-2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 150, damping: 20, delay: 0.8 }}
      >
        The studio lights are on.
      </motion.p>

      {showButton && (
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          className="mt-8"
        >
          <Button
            variant="accent"
            className="text-lg px-8 py-3 font-bold"
            onClick={onComplete}
            data-testid="go-live-button"
          >
            Go Live
          </Button>
        </motion.div>
      )}
    </div>
  );
}
