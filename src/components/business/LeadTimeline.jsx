import { Circle } from 'lucide-react'
import { cn } from '../../utils/cn'
import { TONES, stagger } from './ProjectTones'
import { timeAgo } from '../../utils/format'

// Vertical timeline with coloured icon nodes.
// items: [{ id, actor, text, time (node | string | Date), tone, icon? }]
export default function LeadTimeline({ items = [], className }) {
  if (items.length === 0) return null
  return (
    <ol className={cn('relative', className)}>
      {items.map((item, idx) => {
        const tone = TONES[item.tone || 'brand'] || TONES.brand
        const Icon = item.icon || Circle
        const last = idx === items.length - 1
        return (
          <li key={item.id || idx} style={stagger(idx, 40, 10)} className="animate-slide-up relative flex gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ring-white dark:ring-ink-900',
                  tone.chip
                )}
              >
                <Icon size={item.icon ? 15 : 8} aria-hidden="true" fill={item.icon ? 'none' : 'currentColor'} />
              </span>
              {!last && <span className="-mb-1 mt-0.5 w-px flex-1 bg-gradient-to-b from-ink-200 to-ink-100 dark:from-ink-700 dark:to-ink-800" />}
            </div>
            <div className={cn('min-w-0 flex-1 pt-1', last ? 'pb-0' : 'pb-5')}>
              <p className="break-words text-sm text-ink-700 dark:text-ink-200">
                {item.actor && <span className="font-semibold text-ink-900 dark:text-ink-50">{item.actor} </span>}
                {item.text}
              </p>
              <p className="mt-0.5 text-xs text-ink-400">
                {item.time instanceof Date || typeof item.time === 'string' ? timeAgo(item.time) : item.time}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
