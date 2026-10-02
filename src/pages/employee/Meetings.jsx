import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Video, Phone, MapPin, ExternalLink, Users, CalendarDays, CalendarClock, Clock } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import Tabs from '../../components/common/Tabs'
import { Panel } from '../../components/portal/Panel'
import { toneOf, stagger } from '../../components/portal/tones'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import SearchBar from '../../components/common/SearchBar'
import Select from '../../components/common/Select'
import FilterBar from '../../components/common/FilterBar'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { TODAY } from '../../mockData/reference'
import { formatDate, formatClockString, inclusiveDays } from '../../utils/format'
import { cn } from '../../utils/cn'

const TYPE_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }
const TYPE_TONE = { 'Video Call': 'brand', 'Phone Call': 'info', 'In Person': 'accent' }
const STATUS_TONE = { upcoming: 'brand', completed: 'success', cancelled: 'danger' }
const TYPES = ['Video Call', 'Phone Call', 'In Person']

function relativeDay(date) {
  const diff = inclusiveDays(TODAY, date) - 1
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff > 1) return `In ${diff} days`
  if (diff === -1) return 'Yesterday'
  return `${Math.abs(diff)} days ago`
}

function MeetingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading meetings" className="space-y-3">
      <Skeleton className="h-10 w-72" />
      {[0, 1, 2].map((i) => (
        <SkeletonCard key={i} lines={1} />
      ))}
    </div>
  )
}

export default function EmployeeMeetings() {
  const { isLoading, isError, retry } = usePortalLoad()
  const { name, meetings } = useEmployeeData()
  const [tab, setTab] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const sorted = useMemo(
    () => [...meetings].sort((a, b) => (tab === 'upcoming' ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`))),
    [meetings, tab]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return sorted.filter(
      (m) =>
        (tab === 'all' || m.status === tab) &&
        (!type || m.type === type) &&
        (!q || m.title.toLowerCase().includes(q) || m.client.toLowerCase().includes(q) || (m.project || '').toLowerCase().includes(q))
    )
  }, [sorted, tab, type, search])

  const tabs = [
    { value: 'upcoming', label: 'Upcoming', count: meetings.filter((m) => m.status === 'upcoming').length },
    { value: 'completed', label: 'Completed', count: meetings.filter((m) => m.status === 'completed').length },
    { value: 'all', label: 'All', count: meetings.length },
  ]

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Meetings you're invited to."
        breadcrumbItems={[{ label: 'Work' }, { label: 'Meetings' }]}
        homeHref="/employee/dashboard"
        action={
          <Button as={Link} to="/employee/calendar" variant="secondary" leftIcon={<CalendarDays size={15} />}>
            Open Calendar
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<MeetingsSkeleton />}>
        {meetings.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No meetings yet" description="Meetings you are invited to will show up here." />
        ) : (
          <>
            <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Meeting status" className="mb-4" />
            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search meetings..." />}
              chips={type ? [{ key: 'type', label: `Type: ${type}`, onRemove: () => setType('') }] : []}
              onClearAll={() => setType('')}
            >
              <Select aria-label="Filter by type" placeholder="All types" options={TYPES.map((t) => ({ value: t, label: t }))} value={type} onChange={(e) => setType(e.target.value)} className="sm:w-44" />
            </FilterBar>

            {filtered.length === 0 ? (
              <EmptyState title="No meetings found" description="There are no meetings in this view. Try another tab or clear filters." />
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:gap-5 xl:grid-cols-2">
                {filtered.map((m, idx) => {
                  const Icon = TYPE_ICON[m.type] || Video
                  const tone = toneOf(TYPE_TONE[m.type] || 'brand')
                  return (
                    <li key={m.id} style={stagger(idx, 50)} className="animate-slide-up">
                      <Panel hover className="relative h-full overflow-hidden p-4 sm:p-5">
                        <span className={cn('absolute inset-y-0 left-0 w-1', tone.dot)} aria-hidden="true" />
                        <div className="flex items-start gap-3 sm:gap-4">
                          <span className={cn('flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-2xl', tone.chip)}>
                            <span className="text-xs font-bold uppercase leading-none">{formatDate(m.date, { month: 'short', year: undefined, day: undefined })}</span>
                            <span className="mt-1 text-xl font-bold leading-none">{formatDate(m.date, { day: '2-digit', month: undefined, year: undefined })}</span>
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1.5">
                              <p className="min-w-0 text-sm font-semibold text-ink-800 dark:text-ink-100 sm:text-base">{m.title}</p>
                              <div className="flex items-center gap-1.5">
                                <Badge tone={TYPE_TONE[m.type] || 'neutral'}>
                                  <Icon size={12} /> {m.type}
                                </Badge>
                                <Badge tone={STATUS_TONE[m.status] || 'neutral'} dot>
                                  {m.status}
                                </Badge>
                              </div>
                            </div>
                            <p className="mt-0.5 text-xs text-ink-500 sm:text-sm">
                              {m.client}
                              {m.project ? ` · ${m.project}` : ''}
                            </p>
                            <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-600 dark:text-ink-300 sm:text-sm">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock size={13} className={tone.text} /> {formatDate(m.date)} · {formatClockString(m.time)}
                              </span>
                              {m.status === 'upcoming' && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{relativeDay(m.date)}</span>}
                            </p>
                          </div>
                        </div>
                        {m.notes && <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">Agenda: {m.notes}</p>}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-1.5 text-xs text-ink-500">
                            <Users size={13} className="shrink-0" /> <span className="min-w-0 truncate">{m.participants.map((p) => (p === name ? 'You' : p)).join(', ')}</span>
                          </div>
                          {m.type === 'Video Call' && m.link && m.status === 'upcoming' && (
                            <Button as="a" href={m.link} target="_blank" rel="noreferrer noopener" size="sm" rightIcon={<ExternalLink size={13} />}>
                              Join
                            </Button>
                          )}
                        </div>
                      </Panel>
                    </li>
                  )
                })}
              </ul>
            )}
          </>
        )}
      </AsyncState>
    </div>
  )
}
