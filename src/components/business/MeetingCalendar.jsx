import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight, CalendarX, CalendarDays } from 'lucide-react'
import Card from '../common/Card'
import Button from '../common/Button'
import EmptyState from '../common/EmptyState'
import MeetingCard from './MeetingCard'
import { formatTime } from '../../utils/meetingUtils'
import { cn } from '../../utils/cn'

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const PILL_TONE = {
  upcoming: 'bg-info-50 text-info-600 hover:bg-info-100 dark:bg-info-500/15 dark:text-info-300',
  completed: 'bg-success-50 text-success-700 hover:bg-success-100 dark:bg-success-500/15 dark:text-success-300',
  cancelled: 'bg-danger-50 text-danger-600 line-through hover:bg-danger-100 dark:bg-danger-500/15 dark:text-danger-300',
}
const DOT_TONE = { upcoming: 'bg-info-500', completed: 'bg-success-500', cancelled: 'bg-danger-500' }

function pad(n) {
  return String(n).padStart(2, '0')
}
function dayKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`
}
function todayKey() {
  const d = new Date()
  return dayKey(d.getFullYear(), d.getMonth(), d.getDate())
}

// Month-grid calendar of meetings. Pills open a meeting; tapping a day lists its agenda below.
export default function MeetingCalendar({ meetings, initialDate, onOpen }) {
  const [cursor, setCursor] = useState(() => {
    const base = initialDate ? new Date(`${initialDate}T00:00:00`) : new Date()
    return { year: base.getFullYear(), month: base.getMonth() }
  })
  const [selected, setSelected] = useState(initialDate || todayKey())

  const byDay = useMemo(() => {
    const map = {}
    meetings.forEach((m) => {
      ;(map[m.date] = map[m.date] || []).push(m)
    })
    Object.values(map).forEach((list) => list.sort((a, b) => a.time.localeCompare(b.time)))
    return map
  }, [meetings])

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const offset = (first.getDay() + 6) % 7 // Monday-first
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const total = Math.ceil((offset + daysInMonth) / 7) * 7
    return Array.from({ length: total }, (_, i) => {
      const day = i - offset + 1
      return day >= 1 && day <= daysInMonth ? { day, key: dayKey(cursor.year, cursor.month, day) } : null
    })
  }, [cursor])

  const monthLabel = new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date(cursor.year, cursor.month, 1))
  const monthCount = cells.reduce((sum, c) => sum + (c ? (byDay[c.key]?.length || 0) : 0), 0)
  const today = todayKey()
  const agenda = byDay[selected] || []

  function shift(delta) {
    const d = new Date(cursor.year, cursor.month + delta, 1)
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
  }

  function goToday() {
    const d = new Date()
    setCursor({ year: d.getFullYear(), month: d.getMonth() })
    setSelected(todayKey())
  }

  return (
    <div className="space-y-6">
      <Card className="animate-fade-in overflow-hidden rounded-2xl">
        <div className="gradient-soft flex flex-wrap items-center justify-between gap-3 border-b border-ink-100 px-4 py-3 dark:border-ink-800 sm:px-5">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-ink-800 sm:text-lg dark:text-ink-100" aria-live="polite">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"><CalendarDays size={16} /></span>
              {monthLabel}
            </h2>
            <p className="text-xs text-ink-400">
              {monthCount} meeting{monthCount === 1 ? '' : 's'} this month
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="secondary" size="sm" onClick={goToday}>
              Today
            </Button>
            <Button variant="secondary" size="icon" onClick={() => shift(-1)} aria-label="Previous month" className="h-9 w-9">
              <ChevronLeft size={16} />
            </Button>
            <Button variant="secondary" size="icon" onClick={() => shift(1)} aria-label="Next month" className="h-9 w-9">
              <ChevronRight size={16} />
            </Button>
          </div>
        </div>

        <div role="grid" aria-label={`Meetings in ${monthLabel}`}>
          <div role="row" className="grid grid-cols-7 border-b border-ink-100 bg-ink-50 dark:border-ink-800 dark:bg-ink-800/40">
            {WEEKDAYS.map((d) => (
              <div key={d} role="columnheader" className="py-2 text-center text-xs font-semibold uppercase tracking-wide text-ink-500">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {cells.map((cell, idx) => {
              if (!cell) {
                return <div key={`blank-${idx}`} role="gridcell" className="min-h-14 border-b border-r border-ink-100 bg-ink-50/50 dark:border-ink-800 dark:bg-ink-950/30 sm:min-h-24" />
              }
              const list = byDay[cell.key] || []
              const isToday = cell.key === today
              const isSelected = cell.key === selected
              return (
                <div
                  key={cell.key}
                  role="gridcell"
                  aria-selected={isSelected}
                  className={cn(
                    'relative min-h-14 border-b border-r border-ink-100 p-1 transition-colors dark:border-ink-800 sm:min-h-24 sm:p-1.5',
                    isSelected ? 'bg-brand-50/80 shadow-[inset_0_0_0_2px_var(--color-brand-300)] dark:bg-brand-500/10' : 'hover:bg-brand-50/40 dark:hover:bg-ink-800/40'
                  )}
                >
                  <button
                    type="button"
                    onClick={() => setSelected(cell.key)}
                    className="focus-ring absolute inset-0 z-0"
                    aria-label={`${cell.day} ${monthLabel}, ${list.length} meeting${list.length === 1 ? '' : 's'}`}
                  />
                  <span
                    className={cn(
                      'pointer-events-none relative z-10 flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                      isToday ? 'gradient-brand bg-brand-600 text-white shadow-glow' : 'text-ink-600 dark:text-ink-300'
                    )}
                  >
                    {cell.day}
                  </span>
                  <div className="relative z-10 mt-1 hidden space-y-1 sm:block">
                    {list.slice(0, 2).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => onOpen(m)}
                        className={cn('focus-ring block w-full truncate rounded-md px-1.5 py-0.5 text-left text-xs font-medium transition-colors', PILL_TONE[m.status])}
                        title={`${formatTime(m.time)} - ${m.title}`}
                      >
                        {formatTime(m.time).replace(' ', '')} {m.title}
                      </button>
                    ))}
                    {list.length > 2 && <p className="px-1 text-xs font-medium text-ink-400">+{list.length - 2} more</p>}
                  </div>
                  {list.length > 0 && (
                    <div className="pointer-events-none relative z-10 mt-1 flex justify-center gap-0.5 sm:hidden" aria-hidden="true">
                      {list.slice(0, 3).map((m) => (
                        <span key={m.id} className={cn('h-1.5 w-1.5 rounded-full', DOT_TONE[m.status])} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-4 border-t border-ink-100 px-4 py-2.5 text-xs text-ink-500 dark:border-ink-800 sm:px-5">
          {[
            ['upcoming', 'Scheduled'],
            ['completed', 'Completed'],
            ['cancelled', 'Cancelled'],
          ].map(([key, label]) => (
            <span key={key} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', DOT_TONE[key])} /> {label}
            </span>
          ))}
        </div>
      </Card>

      <section aria-label="Selected day agenda">
        <h3 className="mb-3 text-base font-semibold text-ink-800 dark:text-ink-100">
          {new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${selected}T00:00:00`))}
        </h3>
        {agenda.length === 0 ? (
          <Card className="rounded-2xl">
            <EmptyState icon={CalendarX} title="No meetings on this day" description="Pick another date, or schedule a new meeting." className="py-8" />
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2">
            {agenda.map((m, i) => (
              <MeetingCard key={m.id} meeting={m} onOpen={onOpen} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
