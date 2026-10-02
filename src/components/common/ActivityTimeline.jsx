import { timeAgo } from '../../utils/format'
import { cn } from '../../utils/cn'

const TONE_DOT = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  warning: 'bg-warning-500',
  danger: 'bg-danger-500',
  info: 'bg-info-500',
  neutral: 'bg-ink-400',
}

export default function ActivityTimeline({ items = [], className }) {
  if (items.length === 0) return null
  return (
    <ol className={cn('relative space-y-5 pl-1', className)}>
      {items.map((item, idx) => (
        <li key={item.id || idx} className="animate-slide-up relative flex gap-3" style={{ animationDelay: `${Math.min(idx, 8) * 50}ms` }}>
          <div className="relative flex flex-col items-center">
            <span className={cn('mt-1 h-3 w-3 shrink-0 rounded-full shadow-sm ring-4 ring-white dark:ring-ink-900', TONE_DOT[item.tone || 'brand'] || TONE_DOT.brand)} />
            {idx !== items.length - 1 && <span className="w-0.5 flex-1 rounded-full bg-gradient-to-b from-ink-200 to-ink-100 dark:from-ink-700 dark:to-ink-800" />}
          </div>
          <div className="flex-1 pb-1">
            <p className="text-sm text-ink-700 dark:text-ink-200">
              {item.actor && <span className="font-semibold text-ink-800 dark:text-ink-50">{item.actor} </span>}
              {item.text}
            </p>
            <p className="mt-0.5 text-xs text-ink-400">
              {item.time instanceof Date || typeof item.time === 'string' ? timeAgo(item.time) : item.time}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
