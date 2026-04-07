import { useRef, useEffect, useCallback, useMemo } from 'react'
import { cn } from '../lib/utils'

type FuseSize = 'pill' | 'compact' | 'expanded'

interface BurningFuseProps {
  /** Which view size: pill (2px), compact (4px), expanded (8px) */
  size: FuseSize
  /** Elapsed fraction 0-1 (0 = just started, 1 = time's up) */
  progress: number
}

// --- Size configs ---
const SIZE_CONFIG: Record<FuseSize, {
  height: number
  emberSize: number
  glowRadius: number
  particleCount: number
  particleSpacing: number
  particleSize: number
}> = {
  pill:     { height: 2,  emberSize: 6,  glowRadius: 6,  particleCount: 0, particleSpacing: 0,  particleSize: 0 },
  compact:  { height: 4,  emberSize: 8,  glowRadius: 8,  particleCount: 0, particleSpacing: 0,  particleSize: 0 },
  expanded: { height: 8,  emberSize: 14, glowRadius: 12, particleCount: 3, particleSpacing: 14, particleSize: 5 },
}

// --- Color math ---
function lerpColor(a: string, b: string, t: number): string {
  const ar = parseInt(a.slice(1, 3), 16), ag = parseInt(a.slice(3, 5), 16), ab = parseInt(a.slice(5, 7), 16)
  const br = parseInt(b.slice(1, 3), 16), bg = parseInt(b.slice(3, 5), 16), bb = parseInt(b.slice(5, 7), 16)
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const bl = Math.round(ab + (bb - ab) * t)
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${bl.toString(16).padStart(2, '0')}`
}

function getFuseColor(remaining: number): string {
  if (remaining > 0.50) {
    const t = 1 - ((remaining - 0.50) / 0.50)
    return lerpColor('#c8c6c0', '#d97757', t * 0.4)
  } else if (remaining > 0.30) {
    const t = 1 - ((remaining - 0.30) / 0.20)
    return lerpColor('#c8a080', '#d97757', t)
  } else if (remaining > 0.15) {
    const t = 1 - ((remaining - 0.15) / 0.15)
    return lerpColor('#d97757', '#f59e0b', t)
  } else {
    const t = 1 - (remaining / 0.15)
    return lerpColor('#f59e0b', '#ef4444', t)
  }
}

function getEmberColor(remaining: number): string {
  if (remaining > 0.30) return '#d97757'
  if (remaining > 0.15) return '#f59e0b'
  return '#ef4444'
}

function getPhase(remaining: number): 'normal' | 'warning' | 'critical' {
  if (remaining > 0.30) return 'normal'
  if (remaining > 0.15) return 'warning'
  return 'critical'
}

/**
 * Returns the urgency color class for timer text to match fuse state.
 * Use this to shift timer text color alongside the fuse.
 */
export function getFuseUrgencyClass(progress: number): string {
  const remaining = 1 - Math.min(1, Math.max(0, progress))
  if (remaining <= 0.15) return 'text-onair'
  if (remaining <= 0.30) return 'text-beat'
  return 'text-txt-primary'
}

/** Canvas-animated fuse that burns down with ember glow, color shifts, and spark particles as time runs out. */
export function BurningFuse({ size, progress }: BurningFuseProps) {
  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const sparkTimerRef = useRef(0)
  const lastTimeRef = useRef(0)

  const config = SIZE_CONFIG[size]
  const remaining = 1 - Math.min(1, Math.max(0, progress))
  const phase = getPhase(remaining)

  // Refs for imperative DOM updates (ember glow needs rAF for smooth pulsing)
  const burnedRef = useRef<HTMLDivElement>(null)
  const remainingRef = useRef<HTMLDivElement>(null)
  const emberRef = useRef<HTMLDivElement>(null)
  const particleRefs = useRef<(HTMLDivElement | null)[]>([])

  const fuseColor = useMemo(() => getFuseColor(remaining), [remaining])
  const emberColor = useMemo(() => getEmberColor(remaining), [remaining])

  // Compute ember glow with pulsing (called per rAF)
  const computeEmberGlow = useCallback((pct: number, radius: number): string => {
    const col = getEmberColor(pct)
    const r = parseInt(col.slice(1, 3), 16), g = parseInt(col.slice(3, 5), 16), b = parseInt(col.slice(5, 7), 16)
    const p = getPhase(pct)

    if (p === 'critical') {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 150)
      const intensity = 0.5 + pulse * 0.4
      return `0 0 ${radius}px rgba(${r},${g},${b},${intensity}), 0 0 ${radius * 2}px rgba(${r},${g},${b},${intensity * 0.6}), 0 0 ${radius * 3}px rgba(${r},${g},${b},${intensity * 0.2})`
    }
    if (p === 'warning') {
      const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 300)
      const intensity = 0.4 + pulse * 0.3
      return `0 0 ${radius}px rgba(${r},${g},${b},${intensity}), 0 0 ${radius * 1.8}px rgba(${r},${g},${b},${intensity * 0.5})`
    }
    const pulse = 0.5 + 0.5 * Math.sin(Date.now() / 500)
    const intensity = 0.3 + pulse * 0.2
    return `0 0 ${radius * 0.8}px rgba(${r},${g},${b},${intensity}), 0 0 ${radius * 1.5}px rgba(${r},${g},${b},${intensity * 0.4})`
  }, [])

  // Spawn spark particle (expanded critical only)
  const spawnSpark = useCallback((pct: number) => {
    const track = trackRef.current
    if (!track || size !== 'expanded') return
    const trackW = track.offsetWidth
    const burnedW = trackW * (1 - pct)

    for (let i = 0; i < 2; i++) {
      const spark = document.createElement('div')
      spark.className = 'fuse-spark'
      const dx = (Math.random() - 0.5) * 20
      const dy = -(Math.random() * 16 + 4)
      const sparkSize = 2 + Math.random() * 2
      const col = getEmberColor(pct)
      // Dynamic: spark position/trajectory are random per spawn — must be inline
      spark.style.cssText = `
        width:${sparkSize}px;height:${sparkSize}px;
        left:${burnedW}px;top:50%;
        background:${col};box-shadow:0 0 4px ${col};
        --spark-dx:${dx}px;--spark-dy:${dy}px;
        animation:spark-fly ${0.3 + Math.random() * 0.4}s ease-out forwards;
      `
      track.appendChild(spark)
      setTimeout(() => spark.remove(), 800)
    }
  }, [size])

  // Animation loop for ember glow pulsing + spark spawning
  useEffect(() => {
    const animate = (time: number) => {
      const dt = lastTimeRef.current ? time - lastTimeRef.current : 16
      lastTimeRef.current = time

      // Update ember glow
      const ember = emberRef.current
      if (ember) {
        ember.style.boxShadow = computeEmberGlow(remaining, config.glowRadius)
      }

      // Spark spawning (expanded + critical only)
      if (size === 'expanded' && phase === 'critical') {
        sparkTimerRef.current += dt
        if (sparkTimerRef.current > 120) {
          spawnSpark(remaining)
          sparkTimerRef.current = 0
        }
      }

      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [remaining, phase, size, config.glowRadius, computeEmberGlow, spawnSpark])

  // Build particle elements for expanded view
  const particles = useMemo(() => {
    if (config.particleCount === 0) return null
    return Array.from({ length: config.particleCount }, (_, i) => (
      <div
        key={i}
        ref={(el) => { particleRefs.current[i] = el }}
        className="fuse-particle"
        // Dynamic: particle position/size/opacity depend on runtime ember position
        style={{
          width: config.particleSize * (1 - i * 0.25),
          height: config.particleSize * (1 - i * 0.25),
          left: `calc(${(1 - remaining) * 100}% + ${(i + 1) * config.particleSpacing}px)`,
          backgroundColor: emberColor,
          opacity: Math.max(0.1, (0.6 - i * 0.18) * (phase === 'critical' ? 1.2 : 1)),
          boxShadow: `0 0 ${config.glowRadius * 0.4}px ${emberColor}66`,
        }}
      />
    ))
  }, [config, remaining, emberColor, phase])

  const burnedPercent = (1 - remaining) * 100
  const remainingPercent = remaining * 100

  return (
    <div
      ref={trackRef}
      className={cn('fuse-track relative overflow-visible w-full')}
      // Dynamic: track height depends on size prop
      style={{ height: config.height }}
      data-testid="burning-fuse"
      data-fuse-size={size}
      data-fuse-phase={phase}
    >
      {/* Background track */}
      <div
        className="absolute inset-0 rounded-full bg-white/[0.04]"
        // Dynamic: border radius must match exact height for pill shape
        style={{ borderRadius: config.height / 2 }}
      />

      {/* Burned section (left) */}
      <div
        ref={burnedRef}
        className="absolute top-0 left-0 bg-white/[0.02]"
        // Dynamic: width tracks elapsed time, border radius matches height
        style={{
          width: `${burnedPercent}%`,
          height: config.height,
          borderRadius: config.height / 2,
        }}
      />

      {/* Remaining fuse (right) — color shifts with urgency */}
      <div
        ref={remainingRef}
        className="absolute top-0"
        // Dynamic: position, width, gradient color all track remaining time
        style={{
          left: `${burnedPercent}%`,
          width: `${Math.max(0, remainingPercent)}%`,
          height: config.height,
          borderRadius: config.height / 2,
          background: `linear-gradient(90deg, ${fuseColor} 0%, ${fuseColor}88 70%, ${fuseColor}44 100%)`,
        }}
      />

      {/* Ember point — glowing dot at burn junction */}
      <div
        ref={emberRef}
        className={cn(
          'fuse-ember-point absolute top-1/2 rounded-full z-[3]',
          phase === 'critical' ? 'animate-[ember-wobble-critical_0.3s_ease-in-out_infinite]' : 'animate-[ember-wobble_0.8s_ease-in-out_infinite]'
        )}
        // Dynamic: ember size, position, and color all track remaining time
        style={{
          width: config.emberSize,
          height: config.emberSize,
          left: `${burnedPercent}%`,
          backgroundColor: emberColor,
          transform: 'translate(-50%, -50%)',
        }}
      />

      {/* Trail particles (expanded only) */}
      {particles}
    </div>
  )
}
