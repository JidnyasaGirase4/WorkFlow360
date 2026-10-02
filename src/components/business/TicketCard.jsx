import { CalendarDays, Building2, ChevronRight, LifeBuoy } from 'lucide-react'
import Avatar from '../common/Avatar'
import StatusBadge from '../common/StatusBadge'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const PRIORITY_BAR = {
  low: 'bg-ink-300',
  medium: 'bg-brand-400',
  high: 'bg-warning-400',
  urgent: 'bg-danger-500',
}

// Mobile-friendly card representation of a ticket row.
export default function TicketCard({ ticket, onOpen, index = 0 }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(ticket)}
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
      className="focus-ring group relative w-full animate-slide-up overflow-hidden rounded-2xl border border-ink-100 bg-white p-4 pl-5 text-left shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.99] dark:border-ink-800 dark:bg-ink-900"
      aria-label={`Open ticket ${ticket.ticketId}: ${ticket.subject}`}
    >
      <span aria-hidden="true" className={cn('absolute inset-y-0 left-0 w-1.5', PRIORITY_BAR[ticket.priority] || 'bg-ink-300')} />
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5 text-xs font-semibold text-brand-600 dark:text-brand-300">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-500/15">
            <LifeBuoy size={13} />
          </span>
          <span className="truncate">{ticket.ticketId}</span>
        </span>
        <StatusBadge status={ticket.priority} />
      </div>
      <p className="mt-2.5 text-sm font-semibold text-ink-800 dark:text-ink-100">{ticket.subject}</p>
      <p className="mt-1 flex min-w-0 items-center gap-1.5 text-xs text-ink-500">
        <Building2 size={12} className="shrink-0" /> <span className="truncate">{ticket.client}</span>
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <StatusBadge status={ticket.status} />
        <span className="flex items-center gap-1 text-xs text-ink-400">
          <CalendarDays size={12} /> {formatDate(ticket.createdDate)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800">
        <Avatar name={ticket.assignee} size="xs" />
        <span className="min-w-0 flex-1 truncate">{ticket.assignee}</span>
        <ChevronRight size={16} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}
