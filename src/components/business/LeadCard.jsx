import { Link, useNavigate } from 'react-router-dom'
import { CalendarClock, Building2 } from 'lucide-react'
import Badge from '../common/Badge'
import Avatar from '../common/Avatar'
import MoveToMenu from './MoveToMenu'
import ClientAvatar from './ClientAvatar'
import { formatCurrency, formatDate } from '../../utils/format'
import { LEAD_STAGES, cap, isPastDate, priorityTone } from '../../utils/workspace'
import { cn } from '../../utils/cn'

// Card body rendered inside a board column for the lead pipeline.
export default function LeadCard({ lead, onMove }) {
  const navigate = useNavigate()
  const overdue = lead.status !== 'won' && lead.status !== 'lost' && isPastDate(lead.nextFollowUp)

  return (
    <div onClick={() => navigate(`/admin/crm/leads/${lead.id}`)} className="cursor-pointer">
      <div className="flex items-start gap-2.5">
        <ClientAvatar name={lead.name} size="sm" />
        <div className="min-w-0 flex-1">
          <Link
            to={`/admin/crm/leads/${lead.id}`}
            draggable={false}
            onClick={(e) => e.stopPropagation()}
            className="focus-ring block truncate rounded text-sm font-semibold text-ink-800 hover:text-brand-600 dark:text-ink-100"
          >
            {lead.name}
          </Link>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-500">
            <Building2 size={12} aria-hidden="true" className="shrink-0" />
            <span className="truncate">{lead.company}</span>
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <Badge tone={priorityTone(lead.priority)}>{cap(lead.priority)}</Badge>
        <span className="inline-flex items-center rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
          {formatCurrency(lead.value)}
        </span>
        <span
          className={cn(
            'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
            overdue
              ? 'bg-danger-50 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400'
              : 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-400'
          )}
        >
          <CalendarClock size={11} aria-hidden="true" />
          {lead.nextFollowUp ? `Follow-up ${formatDate(lead.nextFollowUp, { year: undefined })}` : 'No follow-up set'}
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 dark:border-ink-800">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-500">
          <Avatar name={lead.owner || '?'} size="xs" />
          <span className="truncate">{lead.owner || 'Unassigned'}</span>
        </span>
        <MoveToMenu
          itemLabel={lead.name}
          current={lead.status}
          options={LEAD_STAGES}
          onSelect={(status) => onMove(lead.id, status)}
        />
      </div>
    </div>
  )
}
