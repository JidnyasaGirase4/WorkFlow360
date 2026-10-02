import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Video, Phone, MapPin, ListChecks, Plane, PartyPopper, CalendarPlus, CalendarDays, CalendarClock } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton } from '../../components/common/Skeleton'
import { Panel, PanelHeader, PanelBody } from '../../components/portal/Panel'
import IconChip from '../../components/portal/IconChip'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { holidays } from '../../mockData/attendance'
import { TODAY } from '../../mockData/reference'
import { formatDate, formatClockString, toDateKey } from '../../utils/format'
import { cn } from '../../utils/cn'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const TYPE_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }

function CalendarSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading calendar" className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900 lg:col-span-2">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="h-96 w-full" />
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900">
        <Skeleton className="mb-4 h-5 w-32" />
        <Skeleton className="h-40 w-full" />
      </div>
    </div>
  )
}

export default function EmployeeCalendar() {
  const { isLoading, isError, retry } = usePortalLoad()
  const { meetings, tasks, leave } = useEmployeeData()

  const [cursor, setCursor] = useState(() => {
    const [y, m] = TODAY.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })
  const [selectedKey, setSelectedKey] = useState(TODAY)

  const monthLabel = cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const cells = useMemo(() => {
    const year = cursor.getFullYear()
    const month = cursor.getMonth()
    const startOffset = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const daysInPrevMonth = new Date(year, month, 0).getDate()
    const list = []
    for (let i = startOffset - 1; i >= 0; i--) list.push({ date: new Date(year, month - 1, daysInPrevMonth - i), inMonth: false })
    for (let d = 1; d <= daysInMonth; d++) list.push({ date: new Date(year, month, d), inMonth: true })
    while (list.length % 7 !== 0) {
      const last = list[list.length - 1].date
      list.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
    }
    return list
  }, [cursor])

  function eventsFor(key) {
    return {
      dayMeetings: meetings.filter((m) => m.date === key && m.status !== 'cancelled'),
      dayTasks: tasks.filter((t) => t.dueDate === key),
      dayLeave: leave.filter((l) => l.status !== 'rejected' && key >= l.from && key <= l.to),
      holiday: holidays[key],
    }
  }

  const selected = eventsFor(selectedKey)
  const selectedDate = new Date(`${selectedKey}T00:00:00`)

  return (
    <div>
      <PageHeader
        title="Calendar"
        description="Your meetings, task deadlines, approved leave and holidays at a glance."
        breadcrumbItems={[{ label: 'Work' }, { label: 'Calendar' }]}
        homeHref="/employee/dashboard"
        action={
          <Button as={Link} to="/employee/leave" leftIcon={<CalendarPlus size={15} />}>
            Apply for Leave
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<CalendarSkeleton />}>
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
          <Panel className="lg:col-span-2">
            <PanelHeader
              icon={CalendarDays}
              tone="brand"
              title={monthLabel}
              action={
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="Previous month">
                    <ChevronLeft size={16} />
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      const [y, m] = TODAY.split('-').map(Number)
                      setCursor(new Date(y, m - 1, 1))
                      setSelectedKey(TODAY)
                    }}
                  >
                    Today
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="Next month">
                    <ChevronRight size={16} />
                  </Button>
                </div>
              }
            />
            <PanelBody className="px-2.5 sm:px-5">
              <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-ink-500 sm:gap-1.5 sm:text-xs" aria-hidden="true">
                {WEEKDAYS.map((d, i) => (
                  <div key={d} className={cn('py-2', (i === 0 || i === 6) && 'text-accent-500')}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                {cells.map(({ date, inMonth }) => {
                  const key = toDateKey(date)
                  const { dayMeetings, dayTasks, dayLeave, holiday } = eventsFor(key)
                  const isSelected = selectedKey === key
                  const isToday = key === TODAY
                  const count = dayMeetings.length + dayTasks.length
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedKey(key)}
                      aria-pressed={isSelected}
                      aria-label={`${formatDate(key, { weekday: 'long' })}${count ? `, ${count} event${count === 1 ? '' : 's'}` : ''}${dayLeave.length ? ', on leave' : ''}${holiday ? `, ${holiday}` : ''}`}
                      className={cn(
                        'focus-ring flex h-14 min-w-0 flex-col items-center gap-1 rounded-xl border p-1 text-left transition-all duration-150 sm:h-20 sm:items-start sm:p-1.5',
                        isSelected
                          ? 'border-brand-500 bg-brand-50 shadow-sm ring-1 ring-brand-500/40 dark:bg-brand-500/15'
                          : 'border-ink-100 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40',
                        dayLeave.length > 0 && !isSelected && 'bg-accent-50/70 dark:bg-accent-500/5',
                        holiday && !isSelected && 'bg-success-50/70 dark:bg-success-500/5',
                        !inMonth && 'opacity-40'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                          isToday ? 'gradient-brand bg-brand-600 text-white shadow-sm' : 'text-ink-700 dark:text-ink-200'
                        )}
                      >
                        {date.getDate()}
                      </span>
                      <div className="flex flex-wrap items-center justify-center gap-0.5 sm:justify-start sm:gap-1">
                        {dayMeetings.length > 0 && <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" />}
                        {dayTasks.length > 0 && <span className="h-2 w-2 rounded-full bg-warning-500" aria-hidden="true" />}
                        {dayLeave.length > 0 && <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" />}
                        {holiday && <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" />}
                        {count > 1 && <span className="hidden text-xs font-semibold text-ink-500 sm:inline">{count}</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
              <ul className="mt-4 flex flex-wrap gap-2 text-xs font-medium">
                <li className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">
                  <span className="h-2 w-2 rounded-full bg-brand-500" aria-hidden="true" /> Meeting
                </li>
                <li className="flex items-center gap-1.5 rounded-full bg-warning-50 px-2.5 py-1 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300">
                  <span className="h-2 w-2 rounded-full bg-warning-500" aria-hidden="true" /> Task due
                </li>
                <li className="flex items-center gap-1.5 rounded-full bg-accent-50 px-2.5 py-1 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                  <span className="h-2 w-2 rounded-full bg-accent-500" aria-hidden="true" /> Leave
                </li>
                <li className="flex items-center gap-1.5 rounded-full bg-success-50 px-2.5 py-1 text-success-700 dark:bg-success-500/15 dark:text-success-300">
                  <span className="h-2 w-2 rounded-full bg-success-500" aria-hidden="true" /> Holiday
                </li>
              </ul>
            </PanelBody>
          </Panel>

          <Panel className="self-start">
            <PanelHeader icon={CalendarClock} tone="accent" title={formatDate(selectedDate, { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })} />
            <PanelBody className="space-y-5">
              {selected.holiday && (
                <p className="flex items-center gap-2 rounded-xl bg-success-50 px-3 py-2.5 text-sm font-medium text-success-700 dark:bg-success-500/10 dark:text-success-300">
                  <PartyPopper size={16} /> {selected.holiday}
                </p>
              )}
              {selected.dayLeave.map((l) => (
                <p key={l.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-accent-50 px-3 py-2.5 text-sm font-medium text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                  <Plane size={16} /> {l.type} <Badge tone={l.status === 'approved' ? 'success' : 'warning'}>{l.status}</Badge>
                </p>
              ))}
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Meetings</p>
                {selected.dayMeetings.length === 0 && <p className="text-sm text-ink-500">No meetings scheduled.</p>}
                <ul className="space-y-2">
                  {selected.dayMeetings.map((m) => {
                    const Icon = TYPE_ICON[m.type] || Video
                    return (
                      <li key={m.id} className="flex items-start gap-3 rounded-xl border border-ink-100 p-2.5 dark:border-ink-800">
                        <IconChip icon={Icon} tone="brand" size="sm" />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{m.title}</p>
                          <p className="truncate text-xs text-ink-500">
                            {formatClockString(m.time)} · {m.client}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Task due dates</p>
                {selected.dayTasks.length === 0 && <p className="text-sm text-ink-500">No tasks due.</p>}
                <ul className="space-y-2">
                  {selected.dayTasks.map((t) => (
                    <li key={t.id} className="flex items-start gap-3 rounded-xl border border-ink-100 p-2.5 dark:border-ink-800">
                      <IconChip icon={ListChecks} tone="warning" size="sm" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{t.title}</p>
                        <p className="truncate text-xs text-ink-500">{t.project}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </PanelBody>
          </Panel>
        </div>
      </AsyncState>
    </div>
  )
}
