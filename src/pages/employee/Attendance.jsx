import { useMemo, useState } from 'react'
import { CalendarCheck, UserX, Clock, Home, ChevronLeft, ChevronRight, ClipboardList, CalendarDays } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel, PanelHeader, PanelBody } from '../../components/portal/Panel'
import PortalStat from '../../components/portal/PortalStat'
import ClockTile from '../../components/portal/ClockTile'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import DataTable from '../../components/common/DataTable'
import Select from '../../components/common/Select'
import FilterBar from '../../components/common/FilterBar'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard, SkeletonTable } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { useNow } from '../../hooks/useNow'
import { checkInNow, checkOutNow } from '../../utils/portalStores'
import { holidays } from '../../mockData/attendance'
import { TODAY } from '../../mockData/reference'
import { formatDate, formatTime, formatClockString, toDateKey } from '../../utils/format'
import { workedMinutes, formatMinutes } from '../../utils/attendance'
import { cn } from '../../utils/cn'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const STATUS_OPTIONS = [
  { value: 'present', label: 'Present' },
  { value: 'wfh', label: 'Work from Home' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'On Leave' },
]
const CELL_TONE = {
  present: 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300',
  wfh: 'bg-info-100 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  late: 'bg-warning-100 text-warning-700 dark:bg-warning-500/15 dark:text-warning-300',
  absent: 'bg-danger-100 text-danger-700 dark:bg-danger-500/15 dark:text-danger-300',
  leave: 'bg-accent-100 text-accent-700 dark:bg-accent-500/15 dark:text-accent-300',
}
const LEGEND = [
  ['present', 'Present'],
  ['wfh', 'WFH'],
  ['late', 'Late'],
  ['absent', 'Absent'],
  ['leave', 'Leave'],
]

function workedLabel(rec) {
  return formatMinutes(workedMinutes(rec))
}

function fmtTime(value) {
  if (!value) return '—'
  return value.includes('T') ? formatTime(value) : formatClockString(value)
}

function AttendanceSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading attendance" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900 lg:col-span-2">
          <Skeleton className="mb-4 h-5 w-40" />
          <Skeleton className="h-64 w-full" />
        </div>
        <SkeletonCard lines={4} />
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  )
}

function ClockPanel({ name, liveAttendance }) {
  const { toast } = useToast()
  const now = useNow(1000)
  const checkedIn = Boolean(liveAttendance?.checkIn)
  const checkedOut = Boolean(liveAttendance?.checkOut)
  const end = checkedOut ? new Date(liveAttendance.checkOut) : now
  const elapsed = checkedIn ? Math.max(0, Math.floor((end.getTime() - new Date(liveAttendance.checkIn).getTime()) / 60000)) : 0

  function handleCheck() {
    if (!checkedIn) {
      checkInNow(name)
      toast.success(`Checked in at ${formatTime(new Date())}`)
    } else if (!checkedOut) {
      checkOutNow(name)
      toast.success(`Checked out at ${formatTime(new Date())}. Worked ${Math.floor(elapsed / 60)}h ${String(elapsed % 60).padStart(2, '0')}m today.`)
    }
  }

  const stateLabel = checkedOut ? 'Day complete' : checkedIn ? 'Checked in' : 'Not checked in'

  return (
    <ClockTile
      title="Today"
      headerRight={
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 text-white">
          <span className={checkedIn && !checkedOut ? 'h-1.5 w-1.5 rounded-full bg-white' : 'h-1.5 w-1.5 rounded-full bg-white/60'} aria-hidden="true" />
          {stateLabel}
        </span>
      }
      timeText={now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      dateText={formatDate(now, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
      checkInText={checkedIn ? formatTime(liveAttendance.checkIn) : '—'}
      checkOutText={checkedOut ? formatTime(liveAttendance.checkOut) : '—'}
      workedText={checkedIn ? `${Math.floor(elapsed / 60)}h ${String(elapsed % 60).padStart(2, '0')}m ${checkedOut ? 'worked today' : 'and counting'}` : null}
      state={checkedOut ? 'done' : checkedIn ? 'out' : 'in'}
      buttonLabel={checkedOut ? 'Done for today' : checkedIn ? 'Check Out' : 'Check In'}
      onAction={handleCheck}
    />
  )
}

export default function EmployeeAttendance() {
  const { isLoading, isError, retry } = usePortalLoad()
  const { name, attendanceHistory, liveAttendance } = useEmployeeData()
  const { toast } = useToast()

  const [cursor, setCursor] = useState(() => {
    const [y, m] = TODAY.split('-').map(Number)
    return { year: y, month: m - 1 }
  })
  const [statusFilter, setStatusFilter] = useState('')

  const monthPrefix = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}`
  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  const byDate = useMemo(() => Object.fromEntries(attendanceHistory.map((r) => [r.date, r])), [attendanceHistory])
  const monthRecords = useMemo(() => attendanceHistory.filter((r) => r.date.startsWith(monthPrefix)), [attendanceHistory, monthPrefix])

  const counts = useMemo(
    () =>
      monthRecords.reduce(
        (acc, r) => {
          acc[r.status] = (acc[r.status] || 0) + 1
          return acc
        },
        { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 }
      ),
    [monthRecords]
  )

  const cells = useMemo(() => {
    const first = new Date(cursor.year, cursor.month, 1)
    const days = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const list = Array.from({ length: first.getDay() }, () => null)
    for (let d = 1; d <= days; d++) list.push(new Date(cursor.year, cursor.month, d))
    return list
  }, [cursor])

  const tableRows = useMemo(
    () => monthRecords.filter((r) => !statusFilter || r.status === statusFilter).sort((a, b) => b.date.localeCompare(a.date)),
    [monthRecords, statusFilter]
  )

  function shiftMonth(delta) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1)
      return { year: d.getFullYear(), month: d.getMonth() }
    })
  }

  const statCards = [
    { icon: CalendarCheck, label: 'Present Days', value: counts.present, tone: 'success' },
    { icon: UserX, label: 'Absent Days', value: counts.absent, tone: 'danger' },
    { icon: Clock, label: 'Late Arrivals', value: counts.late, tone: 'warning' },
    { icon: Home, label: 'Work From Home', value: counts.wfh, tone: 'info' },
  ]

  const columns = [
    { key: 'date', header: 'Date', sortable: true, render: (row) => <span className="font-medium text-ink-800 dark:text-ink-100">{formatDate(row.date)}</span> },
    { key: 'day', header: 'Day', mobileHidden: true, render: (row) => new Date(`${row.date}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long' }) },
    { key: 'checkIn', header: 'Check In', render: (row) => fmtTime(row.checkIn) },
    { key: 'checkOut', header: 'Check Out', render: (row) => fmtTime(row.checkOut) },
    { key: 'hours', header: 'Hours', render: (row) => workedLabel(row) },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
  ]

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Check in, check out and review your attendance record."
        breadcrumbItems={[{ label: 'HR' }, { label: 'Attendance' }]}
        homeHref="/employee/dashboard"
        action={
          <Button
            variant="secondary"
            leftIcon={<ClipboardList size={15} />}
            onClick={() => toast.info('Regularisation requests will be available once HR approvals go live.')}
          >
            Request regularisation
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<AttendanceSkeleton />}>
        <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
          {statCards.map((card, i) => (
            <PortalStat key={`${card.label}-${monthPrefix}`} index={i} {...card} hint={monthLabel} />
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 lg:mt-8 lg:grid-cols-3 lg:gap-6">
          <Panel className="lg:col-span-2">
            <PanelHeader
              icon={CalendarDays}
              tone="brand"
              title={monthLabel}
              action={
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
                    <ChevronLeft size={16} />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
                    <ChevronRight size={16} />
                  </Button>
                </div>
              }
            />
            <PanelBody className="px-3 sm:px-5">
              <div role="group" aria-label={`Attendance calendar for ${monthLabel}`}>
                <div className="mb-2 grid grid-cols-7 gap-1 text-center text-xs font-semibold uppercase tracking-wide text-ink-500 sm:gap-1.5">
                  {WEEKDAYS.map((d) => (
                    <span key={d}>
                      {d}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1 sm:gap-1.5">
                  {cells.map((date, idx) => {
                    if (!date) return <span key={`blank-${idx}`} />
                    const key = toDateKey(date)
                    const rec = byDate[key]
                    const holiday = holidays[key]
                    const weekend = date.getDay() === 0 || date.getDay() === 6
                    const isToday = key === TODAY
                    return (
                      <div
                        key={key}
                        role="img"
                        aria-label={`${formatDate(key)}${rec ? `, ${rec.status}` : ''}${holiday ? `, ${holiday}` : ''}`}
                        title={holiday || undefined}
                        className={cn(
                          'flex h-11 min-w-0 flex-col items-center justify-center rounded-xl border border-transparent text-xs font-semibold transition-transform hover:scale-105 sm:h-14 sm:text-sm',
                          rec ? CELL_TONE[rec.status] : holiday ? 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300' : weekend ? 'text-ink-300 dark:text-ink-600' : 'text-ink-500',
                          isToday && 'ring-2 ring-brand-500 ring-offset-2 ring-offset-white dark:ring-offset-ink-900'
                        )}
                      >
                        <span>{date.getDate()}</span>
                        {holiday && <span className="hidden text-xs leading-none sm:block">Holiday</span>}
                      </div>
                    )
                  })}
                </div>
              </div>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-medium text-ink-600 dark:text-ink-300">
                {LEGEND.map(([status, label]) => (
                  <li key={status} className="flex items-center gap-1.5">
                    <span className={cn('h-3.5 w-3.5 rounded-md', CELL_TONE[status])} aria-hidden="true" /> {label}
                  </li>
                ))}
                <li className="flex items-center gap-1.5">
                  <span className="h-3.5 w-3.5 rounded-md bg-ink-100 dark:bg-ink-800" aria-hidden="true" /> Holiday
                </li>
              </ul>
            </PanelBody>
          </Panel>

          <ClockPanel name={name} liveAttendance={liveAttendance} />
        </div>

        <div className="mt-6 lg:mt-8">
          <h2 className="mb-3 text-base font-semibold text-ink-800 dark:text-ink-100 sm:text-lg">Attendance history</h2>
          <FilterBar
            className="mb-3"
            chips={statusFilter ? [{ key: 'status', label: `Status: ${STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}`, onRemove: () => setStatusFilter('') }] : []}
            onClearAll={() => setStatusFilter('')}
          >
            <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48" />
          </FilterBar>
          {attendanceHistory.length === 0 ? (
            <EmptyState icon={ClipboardList} title="No attendance records" description="Check in to start building your attendance history." />
          ) : (
            <DataTable columns={columns} data={tableRows} pageSize={8} ariaLabel="Attendance history" emptyTitle="No records this month" emptyDescription="Try another month or clear the status filter." />
          )}
        </div>
      </AsyncState>
    </div>
  )
}
