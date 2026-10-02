import { FilePen, Send, PieChart, CircleCheck, AlarmClock, Ban } from 'lucide-react'
import { cn } from '../../utils/cn'

const PILLS = {
  draft: { label: 'Draft', icon: FilePen, cls: 'border border-dashed border-ink-300 bg-white text-ink-600 dark:border-ink-600 dark:bg-ink-900 dark:text-ink-300' },
  sent: { label: 'Sent', icon: Send, cls: 'bg-info-50 text-info-600 ring-1 ring-inset ring-info-200/70 dark:bg-info-500/15 dark:text-info-300 dark:ring-info-500/20' },
  partially_paid: { label: 'Partially Paid', icon: PieChart, cls: 'bg-warning-50 text-warning-700 ring-1 ring-inset ring-warning-200/70 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/20' },
  paid: { label: 'Paid', icon: CircleCheck, cls: 'bg-success-50 text-success-700 ring-1 ring-inset ring-success-200/70 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/20' },
  overdue: { label: 'Overdue', icon: AlarmClock, cls: 'bg-danger-50 text-danger-700 ring-1 ring-inset ring-danger-200/70 dark:bg-danger-500/15 dark:text-danger-300 dark:ring-danger-500/20' },
  cancelled: { label: 'Cancelled', icon: Ban, cls: 'bg-ink-100 text-ink-500 ring-1 ring-inset ring-ink-200/70 line-through decoration-ink-400 dark:bg-ink-800 dark:text-ink-400 dark:ring-ink-700/60' },
}

// Status pill for the six invoice statuses, each with its own tint and icon.
export default function InvoiceStatusPill({ status, className }) {
  const pill = PILLS[status]
  if (!pill) return null
  const Icon = pill.icon
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold', pill.cls, className)}>
      <Icon size={12} aria-hidden="true" className="shrink-0" />
      {pill.label}
    </span>
  )
}
