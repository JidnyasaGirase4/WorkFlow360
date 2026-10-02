import { cn } from '../../utils/cn'

const TONES = {
  brand: 'from-brand-400 to-brand-600',
  accent: 'from-accent-400 to-accent-500',
  success: 'from-success-400 to-success-500',
  warning: 'from-warning-400 to-warning-500',
  danger: 'from-danger-400 to-danger-500',
  info: 'from-info-400 to-info-500',
}

// Accessible progress bar with an animated fill.
export default function ProgressBar({ value = 0, label, showValue = false, hideLabel = false, tone = 'brand', size = 'md', className }) {
  const pct = Math.max(0, Math.min(100, Math.round(Number(value) || 0)))
  return (
    <div className={className}>
      {((label && !hideLabel) || showValue) && (
        <div className="mb-1.5 flex items-center justify-between text-xs text-ink-500">
          <span>{hideLabel ? '' : label}</span>
          {showValue && <span className="font-semibold text-ink-700 dark:text-ink-200">{pct}%</span>}
        </div>
      )}
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label || 'Progress'}
        className={cn('w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', size === 'sm' ? 'h-1.5' : size === 'lg' ? 'h-3.5' : 'h-2.5')}
      >
        <div
          className={cn('progress-fill h-full rounded-full bg-gradient-to-r shadow-[0_0_8px_rgb(26_169_150/0.25)] transition-all duration-700 ease-out', TONES[tone] || TONES.brand)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
