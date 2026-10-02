import { useMemo, useState } from 'react'
import { CheckSquare, CalendarCheck, Paperclip, MessageSquare, Clock, Activity as ActivityIcon, UserCheck } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel, PanelHeader, PanelBody } from '../../components/portal/Panel'
import PortalStat from '../../components/portal/PortalStat'
import { ROTATION, stagger } from '../../components/portal/tones'
import ActivityTimeline from '../../components/common/ActivityTimeline'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { SkeletonCard, SkeletonText } from '../../components/common/Skeleton'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { TODAY, addDays } from '../../mockData/reference'
import { workedMinutes } from '../../utils/attendance'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const TYPE_FILTERS = [
  { value: 'all', label: 'All activity' },
  { value: 'tasks', label: 'Tasks', icon: CheckSquare },
  { value: 'comments', label: 'Comments', icon: MessageSquare },
  { value: 'meetings', label: 'Meetings', icon: CalendarCheck },
  { value: 'files', label: 'Files', icon: Paperclip },
  { value: 'hr', label: 'HR', icon: UserCheck },
]

const EMPTY_COPY = {
  all: 'Your tasks, meetings, files and comments will show up here as you work.',
  tasks: 'No task activity yet. Updates on your tasks will appear here.',
  comments: 'No comments yet. Discussions on your tasks will appear here.',
  meetings: 'No meetings in your history yet.',
  files: 'No files uploaded yet.',
  hr: 'No leave or attendance activity yet.',
}

function dayLabel(key) {
  if (key === TODAY) return 'Today'
  if (key === addDays(TODAY, -1)) return 'Yesterday'
  return formatDate(new Date(`${key}T00:00:00`), { weekday: 'long' })
}

function clock(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}

function ActivitySkeleton() {
  return (
    <div aria-busy="true" role="status" aria-label="Loading activity">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="mt-6 rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonText lines={6} />
      </div>
    </div>
  )
}

export default function EmployeeActivity() {
  const { isLoading, isError, retry } = usePortalLoad()
  const { name, tasks, meetings, documents, leave, attendanceHistory } = useEmployeeData()
  const [typeFilter, setTypeFilter] = useState('all')

  const events = useMemo(() => {
    const list = []
    tasks.forEach((t) => {
      t.history
        .filter((h) => h.actor === name && !h.text.startsWith('commented'))
        .forEach((h) => list.push({ id: `${t.id}-${h.id}`, type: 'tasks', tone: h.tone, text: `${h.text} - "${t.title}"`, time: h.time }))
      t.commentList
        .filter((c) => c.author === name)
        .forEach((c) => list.push({ id: c.id, type: 'comments', tone: 'warning', text: `Commented on "${t.title}": ${c.text.length > 90 ? `${c.text.slice(0, 90)}...` : c.text}`, time: c.time }))
      t.attachmentList
        .filter((a) => a.uploadedBy === name)
        .forEach((a) => list.push({ id: a.id, type: 'files', tone: 'brand', text: `Attached ${a.name} to "${t.title}"`, time: a.time }))
    })
    meetings
      .filter((m) => m.status === 'completed')
      .forEach((m) => list.push({ id: `mtg-${m.id}`, type: 'meetings', tone: 'brand', text: `Attended "${m.title}"`, time: `${m.date}T${m.time}:00` }))
    documents
      .filter((d) => d.uploadedBy === name)
      .forEach((d) => list.push({ id: `doc-${d.id}`, type: 'files', tone: 'brand', text: `Uploaded ${d.name}${d.project ? ` to ${d.project}` : ''}`, time: `${d.uploadedDate}T10:30:00` }))
    leave.forEach((l) => {
      list.push({ id: `lv-a-${l.id}`, type: 'hr', tone: 'neutral', text: `Applied for ${l.type.toLowerCase()} (${formatDate(l.from)} - ${formatDate(l.to)})`, time: `${l.appliedOn || l.from}T10:00:00` })
      if (l.decidedOn) {
        list.push({ id: `lv-d-${l.id}`, type: 'hr', tone: l.status === 'approved' ? 'success' : 'danger', text: `Your ${l.type.toLowerCase()} request was ${l.status}`, time: `${l.decidedOn}T15:00:00` })
      }
    })
    attendanceHistory
      .filter((r) => r.checkIn && !r.isLive)
      .slice(0, 5)
      .forEach((r) => list.push({ id: `att-${r.id}`, type: 'hr', tone: r.status === 'late' ? 'warning' : 'info', text: `Checked in at ${r.checkIn}${r.status === 'late' ? ' (late)' : ''}`, time: `${r.date}T${r.checkIn}:00` }))

    const seen = new Set()
    return list
      .filter((e) => e.time.slice(0, 10) <= TODAY && !seen.has(e.id) && seen.add(e.id))
      .sort((a, b) => b.time.localeCompare(a.time))
  }, [tasks, meetings, documents, leave, attendanceHistory, name])

  const stats = useMemo(() => {
    const monthPrefix = TODAY.slice(0, 7)
    const monthMinutes = attendanceHistory.filter((r) => r.date.startsWith(monthPrefix)).reduce((sum, r) => sum + workedMinutes(r), 0)
    return {
      completed: tasks.filter((t) => t.status === 'done').length,
      attended: meetings.filter((m) => m.status === 'completed').length,
      hours: Math.round(monthMinutes / 60),
    }
  }, [tasks, meetings, attendanceHistory])

  const counts = useMemo(() => {
    const c = { all: events.length, tasks: 0, comments: 0, meetings: 0, files: 0, hr: 0 }
    events.forEach((e) => {
      c[e.type] += 1
    })
    return c
  }, [events])

  const groups = useMemo(() => {
    const map = new Map()
    events
      .filter((e) => typeFilter === 'all' || e.type === typeFilter)
      .forEach((e) => {
        const key = e.time.slice(0, 10)
        if (!map.has(key)) map.set(key, [])
        map.get(key).push({ id: e.id, tone: e.tone, text: e.text, time: <time dateTime={e.time}>{clock(e.time)}</time> })
      })
    return [...map.entries()].slice(0, 30).map(([key, items]) => ({ key, label: dayLabel(key), items }))
  }, [events, typeFilter])

  const statCards = [
    { icon: CheckSquare, label: 'Tasks Completed', value: stats.completed, tone: 'success' },
    { icon: CalendarCheck, label: 'Meetings Attended', value: stats.attended, tone: 'brand' },
    { icon: Clock, label: 'Hours Logged This Month', value: stats.hours, suffix: ' h', tone: 'info' },
  ]

  return (
    <div>
      <PageHeader
        title="My Activity"
        description="A running log of your tasks, comments, meetings, files and HR updates."
        breadcrumbItems={[{ label: 'Activity' }]}
        homeHref="/employee/dashboard"
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<ActivitySkeleton />}>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
          {statCards.map((card, i) => (
            <PortalStat key={card.label} index={i} {...card} className={i === 2 ? 'col-span-2 sm:col-span-1' : undefined} />
          ))}
        </div>

        <div className="mt-6 flex flex-wrap gap-2 lg:mt-8" role="group" aria-label="Filter activity by type">
          {TYPE_FILTERS.map((f) => {
            const active = typeFilter === f.value
            const Icon = f.icon
            return (
              <button
                key={f.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTypeFilter(f.value)}
                className={cn(
                  'focus-ring inline-flex min-h-10 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition-all',
                  active
                    ? 'gradient-brand border-transparent bg-brand-600 text-white shadow-glow'
                    : 'border-ink-200 bg-white text-ink-600 hover:-translate-y-0.5 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800'
                )}
              >
                {Icon && <Icon size={14} />}
                {f.label}
                <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-white/25 text-white' : 'bg-ink-100 text-ink-500 dark:bg-ink-800')}>{counts[f.value]}</span>
              </button>
            )
          })}
        </div>

        <div className="mt-5 space-y-4 sm:space-y-5">
          {groups.length === 0 ? (
            <Panel>
              <EmptyState icon={ActivityIcon} title="No activity to show" description={EMPTY_COPY[typeFilter]} />
            </Panel>
          ) : (
            groups.map((group, gi) => (
              <Panel key={group.key} style={stagger(gi, 50)} className="animate-slide-up">
                <PanelHeader
                  icon={Clock}
                  tone={ROTATION[gi % ROTATION.length]}
                  title={group.label}
                  action={
                    <span className="rounded-full bg-ink-100 px-2.5 py-0.5 text-xs font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                      {group.items.length} {group.items.length === 1 ? 'update' : 'updates'}
                    </span>
                  }
                />
                <PanelBody>
                  <ActivityTimeline items={group.items} />
                </PanelBody>
              </Panel>
            ))
          )}
        </div>
      </AsyncState>
    </div>
  )
}
