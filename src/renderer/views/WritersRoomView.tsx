import React, { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Notebook, PaperPlaneRight, Play } from '@phosphor-icons/react'
import { useShowStore } from '../stores/showStore'
import { useSessionStore } from '../stores/sessionStore'
import { EnergySelector } from '../components/EnergySelector'
import { ActCard } from '../components/ActCard'
import { useColors } from '../theme'

type Step = 'energy' | 'plan' | 'preview'

export function WritersRoomView() {
  const energy = useShowStore((s) => s.energy)
  const acts = useShowStore((s) => s.acts)
  const startShow = useShowStore((s) => s.startShow)
  const phase = useShowStore((s) => s.phase)
  const skipAct = useShowStore((s) => s.skipAct)
  const reorderAct = useShowStore((s) => s.reorderAct)
  const sendMessage = useSessionStore((s) => s.sendMessage)
  const tabs = useSessionStore((s) => s.tabs)
  const activeTabId = useSessionStore((s) => s.activeTabId)
  const colors = useColors()

  const tab = tabs.find((t) => t.id === activeTabId)
  const isRunning = tab?.status === 'running' || tab?.status === 'connecting'

  const [planText, setPlanText] = useState('')

  const step: Step = !energy ? 'energy' : acts.length === 0 ? 'plan' : 'preview'

  const handleSubmitPlan = useCallback(() => {
    if (!planText.trim() || !energy) return
    const prompt = `[Showtime context: Writer's Room | Energy: ${energy}]

The user wants to plan their day. Structure their input into a Show Lineup.

User's day plan:
${planText.trim()}

Respond with a \`\`\`showtime-lineup JSON block containing the structured lineup. Schedule acts based on the user's ${energy} energy level.`

    sendMessage(prompt)
    setPlanText('')
  }, [planText, energy, sendMessage])

  const sorted = [...acts].sort((a, b) => a.order - b.order)

  return (
    <motion.div
      layoutId="showtime-container"
      style={{
        width: 420,
        maxHeight: 560,
        borderRadius: 20,
        background: colors.cardBg,
        border: `1px solid ${colors.border}`,
        padding: '24px 20px',
        position: 'absolute',
        bottom: 12,
        left: '50%',
        transform: 'translateX(-50%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
        overflowY: 'auto',
      }}
      data-clui-ui
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Notebook size={20} weight="duotone" color="#f59e0b" />
        <h2 style={{ fontSize: 18, fontWeight: 600, color: colors.text, margin: 0 }}>Writer's Room</h2>
      </div>

      <AnimatePresence mode="wait">
        {step === 'energy' && (
          <motion.div key="energy" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: '0 0 12px 0' }}>How's your energy?</p>
            <EnergySelector />
          </motion.div>
        )}

        {step === 'plan' && (
          <motion.div key="plan" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: '0 0 12px 0' }}>What's on the show today? Dump everything.</p>
            <textarea
              value={planText}
              onChange={(e) => setPlanText(e.target.value)}
              placeholder="project proposal, gym, review PRs, prep meeting..."
              rows={4}
              style={{
                width: '100%',
                resize: 'none',
                border: `1px solid ${colors.border}`,
                borderRadius: 12,
                padding: '10px 14px',
                fontSize: 14,
                color: colors.text,
                background: `${colors.cardBg}`,
                outline: 'none',
                fontFamily: 'inherit',
                lineHeight: 1.5,
                boxSizing: 'border-box',
              }}
              autoFocus
            />
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleSubmitPlan}
              disabled={!planText.trim() || isRunning}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '10px 20px', borderRadius: 10,
                border: 'none',
                background: planText.trim() && !isRunning ? '#8b5cf6' : colors.border,
                color: '#fff', fontWeight: 600, fontSize: 14,
                cursor: planText.trim() && !isRunning ? 'pointer' : 'default',
                marginTop: 12,
              }}
            >
              <PaperPlaneRight size={16} weight="fill" />
              {isRunning ? 'Planning...' : 'Plan my show'}
            </motion.button>
          </motion.div>
        )}

        {step === 'preview' && (
          <motion.div key="preview" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            <p style={{ fontSize: 14, color: colors.textSecondary, margin: '0 0 12px 0' }}>Your lineup is set. Ready to go live?</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 280, overflowY: 'auto' }}>
              {sorted.map((act, i) => (
                <ActCard
                  key={act.id}
                  act={act}
                  isActive={false}
                  onSkip={() => skipAct(act.id)}
                  onMoveUp={i > 0 ? () => reorderAct(act.id, 'up') : undefined}
                  onMoveDown={i < sorted.length - 1 ? () => reorderAct(act.id, 'down') : undefined}
                  showReorder
                />
              ))}
            </div>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={startShow}
              style={{
                display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'center',
                width: '100%',
                padding: '12px 20px', borderRadius: 12,
                border: 'none',
                background: '#22c55e',
                color: '#000', fontWeight: 700, fontSize: 15,
                cursor: 'pointer',
                marginTop: 16,
              }}
            >
              <Play size={18} weight="fill" /> We're live!
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
