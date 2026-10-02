import { useMemo, useState } from 'react'
import { CalendarClock, Video, Phone, MapPin, Users, ExternalLink, Copy } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel } from '../../components/portal/Panel'
import IconChip from '../../components/portal/IconChip'
import { toneOf, stagger } from '../../components/portal/tones'
import Tabs from '../../components/common/Tabs'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import SearchBar from '../../components/common/SearchBar'
import Select from '../../components/common/Select'
import FilterBar from '../../components/common/FilterBar'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { formatDate, formatClockString } from '../../utils/format'
import { cn } from '../../utils/cn'

const TYPE_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }
const TYPE_TONE = { 'Video Call': 'brand', 'Phone Call': 'info', 'In Person': 'accent' }
const STATUS_TONE = { upcoming: 'brand', completed: 'success', cancelled: 'danger' }
const TYPES = ['Video Call', 'Phone Call', 'In Person']

function MeetingsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading meetings" className="space-y-4">
      <Skeleton className="h-10 w-72" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {[0, 1].map((i) => (
          <SkeletonCard key={i} lines={2} />
        ))}
      </div>
    </div>
  )
}

export default function ClientMeetings() {
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { meetings } = useClientData()
  const [tab, setTab] = useState('upcoming')
  const [search, setSearch] = useState('')
  const [type, setType] = useState('')

  const tabs = [
    { value: 'upcoming', label: 'Upcoming', count: meetings.filter((m) => m.status === 'upcoming').length },
    { value: 'past', label: 'Past', count: meetings.filter((m) => m.status !== 'upcoming').length },
    { value: 'all', label: 'All', count: meetings.length },
  ]

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return meetings
      .filter((m) => (tab === 'all' || (tab === 'upcoming' ? m.status === 'upcoming' : m.status !== 'upcoming')) && (!type || m.type === type) && (!q || m.title.toLowerCase().includes(q) || (m.project || '').toLowerCase().includes(q)))
      .sort((a, b) => (tab === 'upcoming' ? `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`) : `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)))
  }, [meetings, tab, type, search])

  async function copyLink(link) {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Meeting link copied')
    } catch {
      toast.error('Could not copy the link. Please copy it manually.')
    }
  }

  return (
    <div>
      <PageHeader
        title="Meetings"
        description="Scheduled and past meetings with the WorkFlow360 team."
        breadcrumbItems={[{ label: 'Meetings' }]}
        homeHref="/client/dashboard"
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<MeetingsSkeleton />}>
        {meetings.length === 0 ? (
          <EmptyState icon={CalendarClock} title="No meetings yet" description="Meetings scheduled with your team will appear here." />
        ) : (
          <>
            <Tabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Meeting timeline" className="mb-4" />
            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search meetings..." />}
              chips={type ? [{ key: 'type', label: `Type: ${type}`, onRemove: () => setType('') }] : []}
              onClearAll={() => setType('')}
            >
              <Select aria-label="Filter by type" placeholder="All types" options={TYPES.map((t) => ({ value: t, label: t }))} value={type} onChange={(e) => setType(e.target.value)} className="sm:w-44" />
            </FilterBar>

            {filtered.length === 0 ? (
              <EmptyState title="No meetings in this view" description="Try another tab or clear the filters." />
            ) : (
              <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6">
                {filtered.map((m, idx) => {
                  const Icon = TYPE_ICON[m.type] || CalendarClock
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
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-base font-semibold text-ink-800 dark:text-ink-100">{m.title}</p>
                                {m.project && <p className="text-sm text-ink-500">{m.project}</p>}
                              </div>
                              <Badge tone={STATUS_TONE[m.status] || 'neutral'} dot>{m.status}</Badge>
                            </div>
                          </div>
                        </div>

                        <div className="mt-4 space-y-2 text-sm text-ink-600 dark:text-ink-300">
                          <div className="flex items-center gap-2.5">
                            <IconChip icon={CalendarClock} tone="brand" size="xs" /> {formatDate(m.date)} at {formatClockString(m.time)}
                          </div>
                          <div className="flex items-center gap-2.5">
                            <IconChip icon={Icon} tone={TYPE_TONE[m.type] || 'brand'} size="xs" /> {m.type}
                          </div>
                          <div className="flex items-start gap-2.5">
                            <IconChip icon={Users} tone="warning" size="xs" /> <span className="min-w-0 pt-0.5">{m.participants.join(', ')}</span>
                          </div>
                        </div>

                        {m.notes && <p className="mt-3 rounded-xl bg-ink-50 px-3 py-2 text-xs text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">Agenda: {m.notes}</p>}

                        {m.type === 'Video Call' && m.link && m.status === 'upcoming' && (
                          <div className="mt-4 flex flex-wrap gap-2">
                            <Button as="a" href={m.link} target="_blank" rel="noopener noreferrer" size="sm" rightIcon={<ExternalLink size={13} />}>
                              Join Meeting
                            </Button>
                            <Button size="sm" variant="secondary" leftIcon={<Copy size={13} />} onClick={() => copyLink(m.link)}>
                              Copy link
                            </Button>
                          </div>
                        )}
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
