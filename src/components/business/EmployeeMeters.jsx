import { useEffect, useState } from 'react'
import { cn } from '../../utils/cn'

// Flips to true one frame after mount so width / dash transitions play.
function useGrown() {
  const [grown, setGrown] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setGrown(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return grown
}

// Horizontal bar whose fill grows from 0 on mount. `gradient` is a
// `from-* to-*` pair of Tailwind classes.
export function GrowBar({ value = 0, gradient = 'from-brand-400 to-brand-600', className, label, height = 'h-2', delay = 0 }) {
  const grown = useGrown()
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
      className={cn('w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', height, className)}
    >
      <div
        className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out', gradient)}
        style={{ width: grown ? `${pct}%` : '0%', transitionDelay: `${delay}ms` }}
      />
    </div>
  )
}

// Circular progress ring; `stroke` is a Tailwind stroke-* class.
export function ProgressRing({ value = 0, size = 64, strokeWidth = 7, stroke = 'stroke-brand-500', className, children }) {
  const grown = useGrown()
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const r = (size - strokeWidth) / 2
  const c = 2 * Math.PI * r
  return (
    <div className={cn('relative shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={strokeWidth} className="stroke-ink-100 dark:stroke-ink-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          className={cn('transition-[stroke-dashoffset] duration-1000 ease-out', stroke)}
          strokeDasharray={c}
          strokeDashoffset={grown ? c * (1 - pct / 100) : c}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  )
}
