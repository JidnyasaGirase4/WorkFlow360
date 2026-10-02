import { useMounted } from './useMounted'
import { toneOf } from './tones'

// Circular progress ring with an animated stroke; children render in the centre.
export default function ProgressRing({ value = 0, size = 76, stroke = 8, tone = 'brand', label, children }) {
  const mounted = useMounted()
  const pct = Math.max(0, Math.min(100, Number(value) || 0))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} role="img" aria-label={label || `${Math.round(pct)} percent`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink-100 dark:stroke-ink-800" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={toneOf(tone).color}
          strokeDasharray={c}
          strokeDashoffset={mounted ? c * (1 - pct / 100) : c}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(0.16, 1, 0.3, 1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-center">{children}</div>
    </div>
  )
}
