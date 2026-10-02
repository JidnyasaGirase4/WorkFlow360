import { CalendarDays, Clock, ExternalLink, Building2 } from 'lucide-react'
import Card from '../common/Card'
import Badge from '../common/Badge'
import Avatar from '../common/Avatar'
import { formatDate } from '../../utils/format'
import { MEETING_STATUS, MEETING_TYPE_ICON, canJoin, formatTime } from '../../utils/meetingUtils'

// Each meeting type gets its own tint so a list of cards stays colourful but coherent.
const TYPE_TINT = {
  'Video Call': 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  'Phone Call': 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  'In Person': 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
}

export default function MeetingCard({ meeting, onOpen, index = 0 }) {
  const TypeIcon = MEETING_TYPE_ICON[meeting.type] || CalendarDays
  const status = MEETING_STATUS[meeting.status] || MEETING_STATUS.upcoming
  const visible = meeting.participants.slice(0, 4)
  const extra = meeting.participants.length - visible.length

  return (
    <Card
      hover
      className="group flex animate-slide-up flex-col overflow-hidden rounded-2xl"
      style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
    >
      <button
        type="button"
        onClick={() => onOpen(meeting)}
        className="focus-ring flex-1 rounded-t-2xl p-4 text-left sm:p-5"
        aria-label={`Open meeting ${meeting.title}`}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3 ${TYPE_TINT[meeting.type] || TYPE_TINT['Video Call']}`}
          >
            <TypeIcon size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-semibold text-ink-800 dark:text-ink-100">{meeting.title}</p>
              <Badge tone={status.tone} dot className="shrink-0">
                {status.label}
              </Badge>
            </div>
            <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-500">
              <Building2 size={12} className="shrink-0" />
              <span className="truncate">{meeting.client}{meeting.project ? ` · ${meeting.project}` : ''}</span>
            </p>
          </div>
        </div>
        <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-ink-500">
          <span className="flex items-center gap-1.5">
            <CalendarDays size={13} /> {formatDate(meeting.date)}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock size={13} /> {formatTime(meeting.time)}
          </span>
          <Badge tone="neutral" className="gap-1">
            <TypeIcon size={12} /> {meeting.type}
          </Badge>
        </div>
        {meeting.notes && <p className="mt-3 line-clamp-2 text-xs text-ink-500">{meeting.notes}</p>}
      </button>
      <div className="flex items-center justify-between gap-2 border-t border-ink-100 bg-ink-50/50 px-4 py-3 sm:px-5 dark:border-ink-800 dark:bg-ink-800/20">
        <div className="flex items-center -space-x-2" aria-label={`${meeting.participants.length} participants`}>
          {visible.map((name) => (
            <Avatar key={name} name={name} size="xs" className="ring-2 ring-white dark:ring-ink-900" />
          ))}
          {extra > 0 && (
            <span className="z-10 flex h-6 w-6 items-center justify-center rounded-full bg-ink-100 text-xs font-semibold text-ink-600 ring-2 ring-white dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-900">
              +{extra}
            </span>
          )}
        </div>
        {canJoin(meeting) ? (
          <a
            href={meeting.link}
            target="_blank"
            rel="noreferrer noopener"
            className="focus-ring gradient-brand inline-flex min-h-9 items-center gap-1.5 rounded-xl bg-brand-600 px-3.5 py-1.5 text-xs font-semibold text-white transition-all hover:shadow-glow active:scale-95"
          >
            Join <ExternalLink size={12} />
          </a>
        ) : (
          <button type="button" onClick={() => onOpen(meeting)} className="focus-ring min-h-9 rounded-xl px-3 py-1 text-xs font-semibold text-brand-600 hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-500/10">
            View details
          </button>
        )}
      </div>
    </Card>
  )
}
