import { Check, Flag, AlertTriangle, Loader } from 'lucide-react'
import Badge from '../common/Badge'
import { cn } from '../../utils/cn'

const NODE = {
  done: { cls: 'bg-success-500 text-white ring-4 ring-success-100 dark:ring-success-500/20', Icon: Check, tone: 'success', label: 'Completed' },
  in_progress: { cls: 'bg-brand-500 text-white ring-4 ring-brand-100 dark:ring-brand-500/25', Icon: Loader, tone: 'brand', label: 'In progress' },
  delayed: { cls: 'bg-danger-500 text-white ring-4 ring-danger-100 dark:ring-danger-500/20', Icon: AlertTriangle, tone: 'danger', label: 'Delayed' },
  upcoming: { cls: 'bg-ink-100 text-ink-400 dark:bg-ink-800', Icon: Flag, tone: 'neutral', label: 'Upcoming' },
}

// Vertical milestone stepper. items: [{ id, title, description, due, status, label? }]
export default function MilestoneStepper({ items, className }) {
  return (
    <ol className={cn('relative', className)}>
      {items.map((m, idx) => {
        const node = NODE[m.status] || NODE.upcoming
        const Icon = node.Icon
        const last = idx === items.length - 1
        return (
          <li key={m.id} className="relative flex gap-3.5 pb-6 last:pb-0 sm:gap-4">
            {!last && (
              <span
                className={cn('absolute left-[15px] top-8 h-[calc(100%-2rem)] w-0.5 rounded-full', m.status === 'done' ? 'bg-success-300 dark:bg-success-500/40' : 'bg-ink-200 dark:bg-ink-700')}
                aria-hidden="true"
              />
            )}
            <span className={cn('relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold', node.cls)} aria-hidden="true">
              <Icon size={15} />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                <p className="min-w-0 text-sm font-semibold text-ink-800 dark:text-ink-100">
                  {m.title}
                </p>
                <Badge tone={node.tone} dot>
                  {m.label || node.label}
                </Badge>
              </div>
              {m.description && <p className="mt-0.5 text-sm text-ink-500">{m.description}</p>}
              {m.due && <p className="mt-1 text-xs text-ink-400">Due {m.due}</p>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
