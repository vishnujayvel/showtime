import { describe, it, expect } from 'vitest'
import { springDefault, springGentle, springSnappy } from '../renderer/constants/animations'

describe('animation spring presets', () => {
  const presets = { springDefault, springGentle, springSnappy }

  it.each(Object.entries(presets))('%s has type "spring"', (_name, preset) => {
    expect(preset.type).toBe('spring')
  })

  it.each(Object.entries(presets))('%s has positive stiffness', (_name, preset) => {
    expect(preset.stiffness).toBeGreaterThan(0)
  })

  it.each(Object.entries(presets))('%s has positive damping', (_name, preset) => {
    expect(preset.damping).toBeGreaterThan(0)
  })

  it('springSnappy is stiffer than springDefault', () => {
    expect(springSnappy.stiffness).toBeGreaterThan(springDefault.stiffness)
  })

  it('springGentle has the lowest stiffness', () => {
    expect(springGentle.stiffness).toBeLessThan(springDefault.stiffness)
    expect(springGentle.stiffness).toBeLessThan(springSnappy.stiffness)
  })
})
