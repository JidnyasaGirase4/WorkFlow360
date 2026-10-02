import { useEffect, useMemo, useState } from 'react'
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Video,
  Phone,
  MapPin,
  ListChecks,
  Flag,
  PhoneCall,
  CalendarDays,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import Button from '../../../components/common/Button'
import Input from '../../../components/common/Input'
import Select from '../../../components/common/Select'
import Checkbox from '../../../components/common/Checkbox'
import Modal from '../../../components/common/Modal'
import Card, { CardHeader, CardBody, CardTitle } from '../../../components/common/Card'
import Badge from '../../../components/common/Badge'
import StatusBadge from '../../../components/common/StatusBadge'
import { Skeleton } from '../../../components/common/Skeleton'
import { meetingService } from '../../../services/meetingService'
import { taskService } from '../../../services/taskService'
import { projectService } from '../../../services/projectService'
import { leadService } from '../../../services/leadService'
import { employeeService } from '../../../services/employeeService'
import { formatDate } from '../../../utils/format'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MEETING_TYPES = ['Video Call', 'Phone Call', 'In Person']
const MEETING_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }

// Static class strings so Tailwind can detect every variant (incl. dark mode).
const EVENT_TYPES = {
  meeting: {
    label: 'Meetings',
    icon: Video,
    dot: 'bg-brand-500',
    pill: 'border-brand-500 bg-brand-50 dark:bg-brand-500/10',
    iconText: 'text-brand-600 dark:text-brand-400',
    tone: 'brand',
  },
  task: {
    label: 'Task due dates',
    icon: ListChecks,
    dot: 'bg-info-500',
    pill: 'border-info-500 bg-info-50 dark:bg-info-500/10',
    iconText: 'text-info-600 dark:text-info-400',
    tone: 'info',
  },
  deadline: {
    label: 'Project deadlines',
    icon: Flag,
    dot: 'bg-accent-500',
    pill: 'border-accent-500 bg-accent-50 dark:bg-accent-500/10',
    iconText: 'text-accent-600 dark:text-accent-400',
    tone: 'accent',
  },
  followup: {
    label: 'Lead follow-ups',
    icon: PhoneCall,
    dot: 'bg-warning-500',
    pill: 'border-warning-500 bg-warning-50 dark:bg-warning-500/10',
    iconText: 'text-warning-600 dark:text-warning-400',
    tone: 'warning',
  },
}
const TYPE_KEYS = Object.keys(EVENT_TYPES)

const EMPTY_DATA = { meetings: [], tasks: [], projects: [], leads: [], employees: [] }

function pad(n) {
  return String(n).padStart(2, '0')
}

function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function formatTime(time) {
  if (!time) return 'All day'
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? 'PM' : 'AM'}`
}

function buildMonthCells(cursor) {
  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const startOffset = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells = []
  for (let i = startOffset; i > 0; i--) cells.push({ date: new Date(year, month, 1 - i), inMonth: false })
  for (let d = 1; d <= daysInMonth; d++) cells.push({ date: new Date(year, month, d), inMonth: true })
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date
    cells.push({ date: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), inMonth: false })
  }
  return cells
}

function buildWeekCells(cursor) {
  const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate() - cursor.getDay())
  return Array.from({ length: 7 }, (_, i) => ({
    date: new Date(start.getFullYear(), start.getMonth(), start.getDate() + i),
    inMonth: true,
  }))
}

function buildEvents({ meetings, tasks, projects, leads }) {
  const list = []
  meetings.forEach((m) =>
    list.push({
      id: `meeting-${m.id}`,
      type: 'meeting',
      title: m.title,
      subtitle: [m.type, m.client].filter(Boolean).join(' · '),
      date: m.date,
      time: m.time,
      people: m.participants,
      meetingType: m.type,
    })
  )
  tasks.forEach((t) =>
    list.push({
      id: `task-${t.id}`,
      type: 'task',
      title: t.title,
      subtitle: `${t.project} · ${t.assignee}`,
      date: t.dueDate,
      status: t.status,
    })
  )
  projects
    .filter((p) => p.status !== 'cancelled' && p.deadline)
    .forEach((p) =>
      list.push({
        id: `deadline-${p.id}`,
        type: 'deadline',
        title: `Deadline: ${p.name}`,
        subtitle: `${p.client} · PM ${p.manager}`,
        date: p.deadline,
        status: p.status,
      })
    )
  leads
    .filter((l) => l.nextFollowUp && l.status !== 'won' && l.status !== 'lost')
    .forEach((l) =>
      list.push({
        id: `followup-${l.id}`,
        type: 'followup',
        title: `Follow up with ${l.name}`,
        subtitle: `${l.company} · ${l.owner}`,
        date: l.nextFollowUp,
        status: l.status,
      })
    )
  return list
}

function sortEvents(a, b) {
  if (!a.time && !b.time) return a.title.localeCompare(b.title)
  if (!a.time) return -1
  if (!b.time) return 1
  return a.time.localeCompare(b.time)
}

function CalendarSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading calendar">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900 lg:col-span-2">
          <Skeleton className="mb-4 h-6 w-48" />
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-14 w-full" />
          <Skeleton className="h-14 w-full" />
        </div>
      </div>
    </div>
  )
}

function EventRow({ event }) {
  const cfg = EVENT_TYPES[event.type]
  const Icon = event.type === 'meeting' ? MEETING_ICON[event.meetingType] || cfg.icon : cfg.icon
  return (
    <li className={cn('animate-slide-up rounded-xl border-l-4 p-3 transition-transform duration-200 hover:-translate-y-0.5', cfg.pill)}>
      <div className="flex items-start gap-2.5">
        <Icon size={16} className={cn('mt-0.5 shrink-0', cfg.iconText)} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{event.title}</p>
          <p className="mt-0.5 text-xs text-ink-500">{event.subtitle}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Badge tone={cfg.tone}>{cfg.label}</Badge>
            {event.type === 'meeting' && <span className="text-xs font-medium text-ink-600 dark:text-ink-300">{formatTime(event.time)}</span>}
            {event.status && event.type !== 'meeting' && <StatusBadge status={event.status} />}
          </div>
          {event.people?.length > 0 && <p className="mt-2 text-xs text-ink-400">With {event.people.join(', ')}</p>}
        </div>
      </div>
    </li>
  )
}

export default function AdminCalendar() {
  const { toast } = useToast()

  const [data, setData] = useState(null)
  const [extraMeetings, setExtraMeetings] = useState([])
  const [today] = useState(() => new Date())
  const todayKey = toKey(today)
  const [view, setView] = useState('month')
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), today.getDate()))
  const [selectedKey, setSelectedKey] = useState(todayKey)
  const [hiddenTypes, setHiddenTypes] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [values, setValues] = useState({ title: '', date: '', time: '', type: 'Video Call', participants: [] })
  const [errors, setErrors] = useState({})

  useEffect(() => {
    let active = true
    Promise.all([
      meetingService.list(),
      taskService.list(),
      projectService.list(),
      leadService.list(),
      employeeService.list(),
    ]).then(([meetings, tasks, projects, leads, employees]) => {
      if (active) setData({ meetings, tasks, projects, leads, employees })
    })
    return () => {
      active = false
    }
  }, [])

  const source = data ?? EMPTY_DATA

  const allEvents = useMemo(
    () => buildEvents({ ...source, meetings: [...extraMeetings, ...source.meetings] }),
    [source, extraMeetings]
  )

  const visibleEvents = useMemo(() => allEvents.filter((e) => !hiddenTypes.includes(e.type)), [allEvents, hiddenTypes])

  const eventsByDay = useMemo(() => {
    const map = new Map()
    visibleEvents.forEach((e) => {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date).push(e)
    })
    map.forEach((list) => list.sort(sortEvents))
    return map
  }, [visibleEvents])

  const cells = useMemo(() => (view === 'month' ? buildMonthCells(cursor) : buildWeekCells(cursor)), [view, cursor])

  const periodCounts = useMemo(() => {
    const keys = new Set(cells.filter((c) => c.inMonth).map((c) => toKey(c.date)))
    const counts = Object.fromEntries(TYPE_KEYS.map((k) => [k, 0]))
    allEvents.forEach((e) => {
      if (keys.has(e.date)) counts[e.type] += 1
    })
    return counts
  }, [cells, allEvents])

  const periodLabel = useMemo(() => {
    if (view === 'month') return cursor.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    const first = cells[0].date
    const last = cells[6].date
    return `${formatDate(first, { year: undefined })} – ${formatDate(last)}`
  }, [view, cursor, cells])

  const selectedDate = fromKey(selectedKey)
  const selectedEvents = eventsByDay.get(selectedKey) ?? []

  function shift(direction) {
    setCursor((c) =>
      view === 'month'
        ? new Date(c.getFullYear(), c.getMonth() + direction, 1)
        : new Date(c.getFullYear(), c.getMonth(), c.getDate() + 7 * direction)
    )
  }

  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), today.getDate()))
    setSelectedKey(todayKey)
  }

  function changeView(next) {
    if (next === view) return
    setView(next)
    setCursor(fromKey(selectedKey))
  }

  function toggleType(type) {
    setHiddenTypes((prev) => (prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]))
  }

  function openModal() {
    setValues({ title: '', date: selectedKey, time: '', type: 'Video Call', participants: [] })
    setErrors({})
    setModalOpen(true)
  }

  function toggleParticipant(name) {
    setValues((v) => ({
      ...v,
      participants: v.participants.includes(name) ? v.participants.filter((p) => p !== name) : [...v.participants, name],
    }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!values.title.trim()) next.title = 'Meeting title is required'
    if (!values.date) next.date = 'Please pick a date'
    if (!values.time) next.time = 'Please pick a time'
    if (values.participants.length === 0) next.participants = 'Select at least one participant'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const meeting = {
      id: `mtg-${Date.now()}`,
      title: values.title.trim(),
      client: null,
      project: null,
      date: values.date,
      time: values.time,
      type: values.type,
      participants: values.participants,
      status: 'upcoming',
    }
    setExtraMeetings((prev) => [meeting, ...prev])
    setHiddenTypes((prev) => prev.filter((t) => t !== 'meeting'))
    setSelectedKey(values.date)
    setCursor(fromKey(values.date))
    setModalOpen(false)
    toast.success(`Meeting scheduled for ${formatDate(fromKey(values.date))} at ${formatTime(values.time)}`)
  }

  if (data === null) return <CalendarSkeleton />

  return (
    <div>
      <PageHeader
        title="Company Calendar"
        description="Meetings, task due dates, project deadlines and lead follow-ups across the company."
        breadcrumbItems={[{ label: 'Calendar' }]}
        action={
          <Button leftIcon={<Plus size={15} />} onClick={openModal} className="w-full sm:w-auto">
            Schedule meeting
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2" role="group" aria-label="Filter events by type">
        {TYPE_KEYS.map((key) => {
          const cfg = EVENT_TYPES[key]
          const active = !hiddenTypes.includes(key)
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleType(key)}
              className={cn(
                'focus-ring inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95',
                active
                  ? 'border-ink-200 bg-white text-ink-700 shadow-card hover:shadow-card-hover dark:border-ink-600 dark:bg-ink-900 dark:text-ink-100'
                  : 'border-ink-200 bg-transparent text-ink-400 line-through hover:bg-ink-50 dark:border-ink-800 dark:hover:bg-ink-800/40'
              )}
            >
              <span className={cn('h-2.5 w-2.5 rounded-full', cfg.dot, !active && 'opacity-40')} aria-hidden="true" />
              {cfg.label}
              <span className="rounded-full bg-ink-100 px-1.5 text-xs tabular-nums text-ink-500 dark:bg-ink-800">{periodCounts[key]}</span>
            </button>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="animate-fade-in min-w-0 rounded-2xl lg:col-span-2">
          <CardHeader className="flex-wrap">
            <CardTitle aria-live="polite">{periodLabel}</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-xl border border-ink-200 bg-ink-50 p-0.5 dark:border-ink-700 dark:bg-ink-800/50" role="group" aria-label="Calendar view">
                {['month', 'week'].map((v) => (
                  <button
                    key={v}
                    type="button"
                    aria-pressed={view === v}
                    onClick={() => changeView(v)}
                    className={cn(
                      'focus-ring min-h-8 rounded-lg px-3.5 py-1 text-xs font-semibold capitalize transition-all duration-200',
                      view === v
                        ? 'gradient-brand bg-brand-600 text-white shadow-sm'
                        : 'text-ink-500 hover:bg-white hover:text-brand-700 dark:hover:bg-ink-800'
                    )}
                  >
                    {v}
                  </button>
                ))}
              </div>
              <Button variant="secondary" size="sm" onClick={goToday}>
                Today
              </Button>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => shift(-1)} aria-label={`Previous ${view}`}>
                  <ChevronLeft size={16} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => shift(1)} aria-label={`Next ${view}`}>
                  <ChevronRight size={16} />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardBody>
            {view === 'month' ? (
              <>
                <div className="grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-ink-500">
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-2">
                      {d}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {cells.map(({ date, inMonth }) => {
                    const key = toKey(date)
                    const dayEvents = eventsByDay.get(key) ?? []
                    const isSelected = key === selectedKey
                    const isToday = key === todayKey
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        aria-pressed={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                        aria-label={`${formatDate(date, { weekday: 'long', month: 'long' })}, ${dayEvents.length} ${dayEvents.length === 1 ? 'event' : 'events'}`}
                        className={cn(
                          'focus-ring flex h-16 min-w-0 flex-col items-start gap-1 rounded-xl border p-1 text-left transition-all duration-150 md:h-24 md:p-1.5',
                          isSelected
                            ? 'border-brand-500 bg-brand-50 shadow-[0_0_0_2px_var(--color-brand-200)] dark:bg-brand-500/10 dark:shadow-none'
                            : 'border-ink-100 hover:border-brand-200 hover:bg-brand-50/40 dark:border-ink-800 dark:hover:bg-ink-800/40',
                          !inMonth && 'opacity-40'
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold',
                            isToday ? 'gradient-brand bg-brand-600 text-white shadow-glow' : 'text-ink-700 dark:text-ink-200'
                          )}
                        >
                          {date.getDate()}
                        </span>
                        {dayEvents.length > 0 && (
                          <>
                            <span className="flex flex-wrap items-center gap-0.5 md:hidden" aria-hidden="true">
                              {[...new Set(dayEvents.map((e) => e.type))].map((t) => (
                                <span key={t} className={cn('h-1.5 w-1.5 rounded-full', EVENT_TYPES[t].dot)} />
                              ))}
                            </span>
                            <span className="hidden w-full min-w-0 flex-col gap-0.5 md:flex" aria-hidden="true">
                              {dayEvents.slice(0, 2).map((e) => (
                                <span
                                  key={e.id}
                                  className={cn('truncate rounded border-l-2 px-1 py-px text-xs leading-4 text-ink-700 dark:text-ink-200', EVENT_TYPES[e.type].pill)}
                                >
                                  {e.title}
                                </span>
                              ))}
                              {dayEvents.length > 2 && <span className="px-1 text-xs text-ink-400">+{dayEvents.length - 2} more</span>}
                            </span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </div>
              </>
            ) : (
              <div className="grid grid-cols-1 gap-2 md:grid-cols-7">
                {cells.map(({ date }) => {
                  const key = toKey(date)
                  const dayEvents = eventsByDay.get(key) ?? []
                  const isSelected = key === selectedKey
                  const isToday = key === todayKey
                  return (
                    <div
                      key={key}
                      className={cn(
                        'flex min-h-24 min-w-0 flex-col rounded-xl border p-2 transition-colors md:min-h-72',
                        isSelected ? 'border-brand-500 bg-brand-50/60 dark:bg-brand-500/5' : 'border-ink-100 dark:border-ink-800'
                      )}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedKey(key)}
                        aria-pressed={isSelected}
                        aria-current={isToday ? 'date' : undefined}
                        className="focus-ring mb-2 flex items-center gap-2 rounded-lg text-left md:flex-col md:items-start md:gap-0.5"
                      >
                        <span className="text-xs font-semibold uppercase tracking-wide text-ink-400">{WEEKDAYS[date.getDay()]}</span>
                        <span
                          className={cn(
                            'flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold',
                            isToday ? 'bg-brand-600 text-white' : 'text-ink-800 dark:text-ink-100'
                          )}
                        >
                          {date.getDate()}
                        </span>
                      </button>
                      {dayEvents.length === 0 ? (
                        <p className="text-xs text-ink-400">No events</p>
                      ) : (
                        <ul className="space-y-1.5">
                          {dayEvents.map((e) => (
                            <li key={e.id}>
                              <button
                                type="button"
                                onClick={() => setSelectedKey(key)}
                                className={cn('focus-ring w-full rounded-md border-l-2 px-1.5 py-1 text-left', EVENT_TYPES[e.type].pill)}
                              >
                                <span className="block text-xs font-medium text-ink-500">{formatTime(e.time)}</span>
                                <span className="block text-xs leading-snug text-ink-800 dark:text-ink-100">{e.title}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-ink-100 pt-4 text-xs text-ink-500 dark:border-ink-800">
              <span className="font-semibold uppercase tracking-wide text-ink-400">Legend</span>
              {TYPE_KEYS.map((key) => (
                <span key={key} className="inline-flex items-center gap-1.5">
                  <span className={cn('h-2 w-2 rounded-full', EVENT_TYPES[key].dot)} aria-hidden="true" />
                  {EVENT_TYPES[key].label}
                </span>
              ))}
            </div>
          </CardBody>
        </Card>

        <Card className="animate-fade-in min-w-0 self-start rounded-2xl" aria-live="polite">
          <CardHeader>
            <div>
              <CardTitle>{formatDate(selectedDate, { weekday: 'long', year: undefined })}</CardTitle>
              <p className="mt-0.5 text-xs text-ink-400">
                {selectedEvents.length} {selectedEvents.length === 1 ? 'event' : 'events'}
                {selectedKey === todayKey && ' · Today'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={openModal}>
              Add
            </Button>
          </CardHeader>
          <CardBody>
            {selectedEvents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <span className="gradient-soft flex h-14 w-14 items-center justify-center rounded-2xl border border-brand-100 text-brand-500 dark:border-brand-500/20">
                  <CalendarDays size={24} />
                </span>
                <p className="text-sm font-medium text-ink-700 dark:text-ink-100">Nothing scheduled</p>
                <p className="max-w-xs text-xs text-ink-500">
                  {hiddenTypes.length > 0 ? 'No events on this day for the selected types.' : 'This day is clear. Schedule a meeting to fill it.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2.5">
                {selectedEvents.map((e) => (
                  <EventRow key={e.id} event={e} />
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Schedule meeting"
        description="Add an internal or client meeting to the company calendar"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Schedule meeting</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Input
            label="Title"
            required
            wrapperClassName="sm:col-span-2"
            placeholder="e.g. Quarterly business review — Zenith Financial"
            value={values.title}
            error={errors.title}
            onChange={(e) => setValues((v) => ({ ...v, title: e.target.value }))}
          />
          <Input
            label="Date"
            type="date"
            required
            value={values.date}
            error={errors.date}
            onChange={(e) => setValues((v) => ({ ...v, date: e.target.value }))}
          />
          <Input
            label="Time"
            type="time"
            required
            value={values.time}
            error={errors.time}
            onChange={(e) => setValues((v) => ({ ...v, time: e.target.value }))}
          />
          <Select
            label="Meeting type"
            wrapperClassName="sm:col-span-2"
            options={MEETING_TYPES.map((t) => ({ value: t, label: t }))}
            value={values.type}
            onChange={(e) => setValues((v) => ({ ...v, type: e.target.value }))}
          />
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-200">
              Participants<span className="ml-0.5 text-danger-500">*</span>
            </legend>
            <div
              className={cn(
                'grid grid-cols-2 gap-2 rounded-xl border p-3 sm:grid-cols-3',
                errors.participants ? 'border-danger-400' : 'border-ink-200 dark:border-ink-700'
              )}
            >
              {source.employees.map((emp) => (
                <Checkbox
                  key={emp.id}
                  label={emp.name}
                  checked={values.participants.includes(emp.name)}
                  onChange={() => toggleParticipant(emp.name)}
                />
              ))}
            </div>
            {errors.participants && <p className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">{errors.participants}</p>}
          </fieldset>
        </form>
      </Modal>
    </div>
  )
}
