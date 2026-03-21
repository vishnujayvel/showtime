import React from 'react'
import { motion } from 'framer-motion'
import { Lightning, Sun, CloudSun, Moon } from '@phosphor-icons/react'
import type { EnergyLevel } from '../../shared/types'
import { useShowStore } from '../stores/showStore'
import { useColors } from '../theme'

const ENERGY_OPTIONS: Array<{ level: EnergyLevel; label: string; icon: typeof Lightning; color: string }> = [
  { level: 'high', label: 'High', icon: Lightning, color: '#f59e0b' },
  { level: 'medium', label: 'Medium', icon: Sun, color: '#22c55e' },
  { level: 'low', label: 'Low', icon: CloudSun, color: '#60a5fa' },
  { level: 'recovery', label: 'Recovery', icon: Moon, color: '#a78bfa' },
]

export function EnergySelector() {
  const energy = useShowStore((s) => s.energy)
  const setEnergy = useShowStore((s) => s.setEnergy)
  const colors = useColors()

  return (
    <div style={{ display: 'flex', gap: 10 }}>
      {ENERGY_OPTIONS.map(({ level, label, icon: Icon, color }) => {
        const isSelected = energy === level
        return (
          <motion.button
            key={level}
            onClick={() => setEnergy(level)}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 6,
              padding: '12px 16px',
              borderRadius: 12,
              border: `2px solid ${isSelected ? color : colors.border}`,
              background: isSelected ? `${color}18` : colors.cardBg,
              cursor: 'pointer',
              transition: 'border-color 0.2s, background 0.2s',
              minWidth: 72,
            }}
          >
            <Icon size={24} weight={isSelected ? 'fill' : 'regular'} color={isSelected ? color : colors.textSecondary} />
            <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 400, color: isSelected ? color : colors.textSecondary }}>
              {label}
            </span>
          </motion.button>
        )
      })}
    </div>
  )
}
