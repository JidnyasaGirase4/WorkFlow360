import { TONES } from './ProjectTones'

// Circular progress ring with an animated sweep (SVG animate, no state).
export default function ProjectProgressRing({ value = 0, size = 56, stroke = 6, tone = 'brand', label, showValue = true, className }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const offset = c * (1 - pct / 100)
  const color = TONES[tone]?.stroke || TONES.brand.stroke
  return (
    <div
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progress'}
      className={`relative inline-flex shrink-0 items-center justify-center ${className || ''}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} className="stroke-ink-100 dark:stroke-ink-800" />
        <circle
          key={pct}
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={offset}
        >
          <animate attributeName="stroke-dashoffset" from={c} to={offset} dur="0.9s" calcMode="spline" keyTimes="0;1" keySplines="0.16 1 0.3 1" fill="freeze" />
        </circle>
      </svg>
      {showValue && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-ink-800 dark:text-ink-100">
          {pct}%
        </span>
      )}
    </div>
  )
}
