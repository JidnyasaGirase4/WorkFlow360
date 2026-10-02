import { cn } from '../../utils/cn'
import { useMounted } from './useMounted'
import { toneOf } from './tones'

// Progress bar whose fill animates from 0 on mount and when the value changes.
export default function AnimatedBar({ value = 0, tone = 'brand', size = 'md', label = 'Progress', showValue = false, className }) {
  const mounted = useMounted()
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  const t = toneOf(tone)
  return (
    <div className={className}>
      {showValue && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
          <span>{label}</span>
          <span className="font-semibold tabular-nums text-ink-700 dark:text-ink-200">{pct}%</span>
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
        className={cn('w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3' : 'h-2')}
      >
        <div
          className={cn('h-full rounded-full bg-gradient-to-r transition-[width] duration-1000 ease-out', t.bar)}
          style={{ width: mounted ? `${pct}%` : '0%' }}
        />
      </div>
    </div>
  )
}
