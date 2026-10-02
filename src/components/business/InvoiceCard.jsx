import { CalendarClock } from 'lucide-react'
import Card from '../common/Card'
import InvoiceStatusPill from './InvoiceStatusPill'
import { formatCurrency, formatDate } from '../../utils/format'

// Mobile-friendly invoice summary used in place of the wide invoices table.
export default function InvoiceCard({ invoice, onOpen }) {
  return (
    <Card hover className="relative overflow-hidden rounded-2xl border-ink-100 p-4 sm:p-5">
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 gradient-brand" />
      <button type="button" onClick={onOpen} className="focus-ring group block w-full rounded-lg pl-1 text-left" aria-label={`Open invoice ${invoice.number}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-bold text-ink-800 dark:text-ink-100">{invoice.number}</p>
            <p className="truncate text-xs text-ink-500">{invoice.client}</p>
          </div>
          <InvoiceStatusPill status={invoice.status} />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-ink-50 p-3 text-xs tabular-nums dark:bg-ink-800/50">
          <div className="min-w-0">
            <p className="text-ink-400">Amount</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{formatCurrency(invoice.amount)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-ink-400">Paid</p>
            <p className="mt-0.5 truncate text-sm font-semibold text-success-600 dark:text-success-400">{formatCurrency(invoice.paid)}</p>
          </div>
          <div className="min-w-0">
            <p className="text-ink-400">Balance</p>
            <p className={`mt-0.5 truncate text-sm font-semibold ${invoice.balance > 0 ? 'text-accent-600 dark:text-accent-300' : 'text-ink-500'}`}>{formatCurrency(invoice.balance)}</p>
          </div>
        </div>
        <p className="mt-3 flex items-center gap-1.5 border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800">
          <CalendarClock size={13} className="shrink-0 text-brand-500" />
          Issued {formatDate(invoice.issueDate)} · Due {formatDate(invoice.dueDate)}
        </p>
      </button>
    </Card>
  )
}
