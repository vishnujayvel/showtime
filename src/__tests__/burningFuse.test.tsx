import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import { BurningFuse, getFuseUrgencyClass } from '../renderer/components/BurningFuse'

// Mock framer-motion (not used by BurningFuse, but prevents import errors from siblings)
vi.mock('framer-motion', () => ({
  motion: {
    div: React.forwardRef((props: any, ref: any) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props
      return <div ref={ref} {...rest} />
    }),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

// Mock requestAnimationFrame for the glow animation loop
let rafCallback: FrameRequestCallback | null = null
vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
  rafCallback = cb
  return 1
})
vi.stubGlobal('cancelAnimationFrame', vi.fn())

describe('BurningFuse', () => {
  describe('getFuseUrgencyClass', () => {
    it('returns text-txt-primary for normal phase (>70% remaining)', () => {
      expect(getFuseUrgencyClass(0.1)).toBe('text-txt-primary') // 90% remaining
      expect(getFuseUrgencyClass(0.5)).toBe('text-txt-primary') // 50% remaining
      expect(getFuseUrgencyClass(0.69)).toBe('text-txt-primary') // 31% remaining
    })

    it('returns text-beat for warning phase (15-30% remaining)', () => {
      expect(getFuseUrgencyClass(0.75)).toBe('text-beat') // 25% remaining
      expect(getFuseUrgencyClass(0.8)).toBe('text-beat')  // 20% remaining
    })

    it('returns text-onair for critical phase (<15% remaining)', () => {
      expect(getFuseUrgencyClass(0.9)).toBe('text-onair')  // 10% remaining
      expect(getFuseUrgencyClass(0.95)).toBe('text-onair') // 5% remaining
      expect(getFuseUrgencyClass(1.0)).toBe('text-onair')  // 0% remaining
    })

    it('handles edge cases at exact thresholds', () => {
      // 30% remaining = boundary between normal and warning
      expect(getFuseUrgencyClass(0.70)).toBe('text-txt-primary') // exactly 30% remaining
      // 15% remaining = boundary between warning and critical
      expect(getFuseUrgencyClass(0.85)).toBe('text-beat') // exactly 15% remaining
    })

    it('clamps out-of-range values', () => {
      expect(getFuseUrgencyClass(-0.5)).toBe('text-txt-primary') // clamped to 0
      expect(getFuseUrgencyClass(1.5)).toBe('text-onair')        // clamped to 1
    })
  })

  describe('rendering', () => {
    it('renders with data-testid and size attribute', () => {
      render(<BurningFuse size="pill" progress={0.5} />)
      const fuse = screen.getByTestId('burning-fuse')
      expect(fuse).toBeTruthy()
      expect(fuse.getAttribute('data-fuse-size')).toBe('pill')
    })

    it('sets correct phase attribute based on progress', () => {
      const { rerender } = render(<BurningFuse size="expanded" progress={0.2} />)
      expect(screen.getByTestId('burning-fuse').getAttribute('data-fuse-phase')).toBe('normal')

      rerender(<BurningFuse size="expanded" progress={0.75} />)
      expect(screen.getByTestId('burning-fuse').getAttribute('data-fuse-phase')).toBe('warning')

      rerender(<BurningFuse size="expanded" progress={0.9} />)
      expect(screen.getByTestId('burning-fuse').getAttribute('data-fuse-phase')).toBe('critical')
    })

    it('pill size has 2px height', () => {
      render(<BurningFuse size="pill" progress={0.5} />)
      const fuse = screen.getByTestId('burning-fuse')
      expect(fuse.style.height).toBe('2px')
    })

    it('compact size has 4px height', () => {
      render(<BurningFuse size="compact" progress={0.5} />)
      const fuse = screen.getByTestId('burning-fuse')
      expect(fuse.style.height).toBe('4px')
    })

    it('expanded size has 8px height', () => {
      render(<BurningFuse size="expanded" progress={0.5} />)
      const fuse = screen.getByTestId('burning-fuse')
      expect(fuse.style.height).toBe('8px')
    })

    it('expanded size renders particle elements', () => {
      render(<BurningFuse size="expanded" progress={0.5} />)
      const fuse = screen.getByTestId('burning-fuse')
      const particles = fuse.querySelectorAll('.fuse-particle')
      expect(particles.length).toBe(3) // expanded has 3 trail particles
    })

    it('pill size does not render particle elements', () => {
      render(<BurningFuse size="pill" progress={0.5} />)
      const fuse = screen.getByTestId('burning-fuse')
      const particles = fuse.querySelectorAll('.fuse-particle')
      expect(particles.length).toBe(0)
    })

    it('has ember-wobble-critical animation in critical phase', () => {
      render(<BurningFuse size="expanded" progress={0.92} />)
      const fuse = screen.getByTestId('burning-fuse')
      const ember = fuse.querySelector('.fuse-ember-point')
      expect(ember?.className).toContain('ember-wobble-critical')
    })

    it('has ember-wobble animation in normal phase', () => {
      render(<BurningFuse size="expanded" progress={0.3} />)
      const fuse = screen.getByTestId('burning-fuse')
      const ember = fuse.querySelector('.fuse-ember-point')
      expect(ember?.className).toContain('ember-wobble')
      expect(ember?.className).not.toContain('ember-wobble-critical')
    })
  })
})
