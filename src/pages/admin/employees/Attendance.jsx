import { useMemo, useState } from 'react'
import { UserCheck, UserX, Clock, Home, Download, ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import { ActiveFilters } from '../../../components/business/ChipFilters'
import EmployeeKpiCard from '../../../components/business/EmployeeKpiCard'
import EmployeeAvatar from '../../../components/business/EmployeeAvatar'
import Select from '../../../components/common/Select'
import Input from '../../../components/common/Input'
import Button from '../../../components/common/Button'
import Card, { CardHeader, CardTitle, CardBody } from '../../../components/common/Card'
import Badge from '../../../components/common/Badge'
import DataTable from '../../../components/common/DataTable'
import { attendanceService } from '../../../services/attendanceService'
import { employeeService } from '../../../services/employeeService'
import { holidays } from '../../../mockData/attendance'
import { ATTENDANCE_REF_DATE, TODAY } from '../../../mockData/reference'
import { departments } from '../../../mockData/employees'
import { formatDate } from '../../../utils/format'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'

const BREADCRUMB = [{ label: 'People' }, { label: 'Attendance' }]

const STATUS_STYLE = {
  present: { label: 'Present', badge: 'success', dot: 'bg-success-500', cell: 'border-success-200 bg-success-50 text-success-700 dark:border-success-500/30 dark:bg-success-500/10 dark:text-success-300' },
  absent: { label: 'Absent', badge: 'danger', dot: 'bg-danger-500', cell: 'border-danger-200 bg-danger-50 text-danger-700 dark:border-danger-500/30 dark:bg-danger-500/10 dark:text-danger-300' },
  late: { label: 'Late', badge: 'warning', dot: 'bg-warning-500', cell: 'border-warning-200 bg-warning-50 text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-300' },
  wfh: { label: 'Work from Home', badge: 'info', dot: 'bg-info-500', cell: 'border-info-200 bg-info-50 text-info-600 dark:border-info-500/30 dark:bg-info-500/10 dark:text-info-300' },
  leave: { label: 'On Leave', badge: 'accent', dot: 'bg-accent-500', cell: 'border-accent-200 bg-accent-50 text-accent-700 dark:border-accent-500/30 dark:bg-accent-500/10 dark:text-accent-300' },
}
const SHORT = { present: 'P', absent: 'A', late: 'L', wfh: 'WFH', leave: 'Leave' }
const STATUS_ORDER = ['present', 'wfh', 'late', 'absent', 'leave']
const STATUS_OPTIONS = [{ value: '', label: 'All statuses' }, ...STATUS_ORDER.map((s) => ({ value: s, label: STATUS_STYLE[s].label }))]
const DEPARTMENT_OPTIONS = [{ value: '', label: 'All departments' }, ...departments.map((d) => ({ value: d, label: d }))]
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function loadAttendance() {
  return Promise.all([attendanceService.list(), employeeService.list()]).then(([records, employees]) => ({ records, employees }))
}

function workHours(row) {
  if (!row.checkIn || !row.checkOut) return null
  const [ih, im] = row.checkIn.split(':').map(Number)
  const [oh, om] = row.checkOut.split(':').map(Number)
  const mins = oh * 60 + om - (ih * 60 + im)
  return mins > 0 ? `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, '0')}m` : null
}

function monthLabel(ym) {
  return new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${ym}-01T00:00:00Z`))
}

function shiftMonth(ym, delta) {
  const d = new Date(`${ym}-01T00:00:00Z`)
  d.setUTCMonth(d.getUTCMonth() + delta)
  return d.toISOString().slice(0, 7)
}

function buildMonthGrid(ym) {
  const first = new Date(`${ym}-01T00:00:00Z`)
  const offset = (first.getUTCDay() + 6) % 7 // Monday-first
  const daysInMonth = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate()
  const cells = Array.from({ length: offset }, () => null)
  for (let d = 1; d <= daysInMonth; d += 1) cells.push(`${ym}-${String(d).padStart(2, '0')}`)
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

export default function Attendance() {
  const { status, data, retry } = useMockLoad(loadAttendance)
  if (status === 'loading') {
    return <PageSkeleton title="Attendance" description="Track daily attendance across the team." breadcrumbItems={BREADCRUMB} stats={4} cols={6} />
  }
  if (status === 'error') return <PageError title="Attendance" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <AttendanceView records={data.records} employees={data.employees} />
}

function AttendanceView({ records, employees }) {
  const { toast } = useToast()
  const [employeeFilter, setEmployeeFilter] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [dateFilter, setDateFilter] = useState(ATTENDANCE_REF_DATE)
  const [statusFilter, setStatusFilter] = useState('')
  const [viewMonth, setViewMonth] = useState(ATTENDANCE_REF_DATE.slice(0, 7))

  const deptByName = useMemo(() => Object.fromEntries(employees.map((e) => [e.name, e.department])), [employees])
  const withDept = useMemo(() => records.map((r) => ({ ...r, department: deptByName[r.employee] || '—' })), [records, deptByName])

  const employeeOptions = useMemo(
    () => [
      { value: '', label: 'All employees' },
      ...employees
        .filter((e) => !departmentFilter || e.department === departmentFilter)
        .filter((e) => e.status !== 'inactive')
        .map((e) => ({ value: e.name, label: e.name })),
    ],
    [employees, departmentFilter]
  )

  // Calendar reflects employee + department (a day is not a filter for itself).
  const calendarRecords = useMemo(
    () => withDept.filter((r) => (!employeeFilter || r.employee === employeeFilter) && (!departmentFilter || r.department === departmentFilter)),
    [withDept, employeeFilter, departmentFilter]
  )

  const filtered = useMemo(
    () =>
      calendarRecords.filter((r) => (!dateFilter || r.date === dateFilter) && (!statusFilter || r.status === statusFilter)),
    [calendarRecords, dateFilter, statusFilter]
  )

  const counts = useMemo(() => {
    const acc = { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 }
    filtered.forEach((r) => {
      acc[r.status] += 1
    })
    return acc
  }, [filtered])

  const byDate = useMemo(() => {
    const map = {}
    calendarRecords.forEach((r) => {
      if (statusFilter && r.status !== statusFilter) return
      ;(map[r.date] ||= []).push(r)
    })
    return map
  }, [calendarRecords, statusFilter])

  const cells = useMemo(() => buildMonthGrid(viewMonth), [viewMonth])

  const activeFilters = [
    employeeFilter && { key: 'employee', label: `Employee: ${employeeFilter}`, onRemove: () => setEmployeeFilter('') },
    departmentFilter && { key: 'department', label: `Department: ${departmentFilter}`, onRemove: () => { setDepartmentFilter(''); setEmployeeFilter('') } },
    dateFilter && { key: 'date', label: `Date: ${formatDate(dateFilter)}`, onRemove: () => setDateFilter('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_STYLE[statusFilter].label}`, onRemove: () => setStatusFilter('') },
  ].filter(Boolean)

  function clearAll() {
    setEmployeeFilter('')
    setDepartmentFilter('')
    setDateFilter('')
    setStatusFilter('')
  }

  function handleDepartmentChange(value) {
    setDepartmentFilter(value)
    if (employeeFilter && value && deptByName[employeeFilter] !== value) setEmployeeFilter('')
  }

  function pickDay(date) {
    setDateFilter((prev) => (prev === date ? '' : date))
  }

  function exportCsv() {
    if (filtered.length === 0) {
      toast.warning('There are no attendance records to export')
      return
    }
    const header = ['Employee', 'Department', 'Date', 'Status', 'Check-in', 'Check-out', 'Work hours']
    const rows = filtered.map((r) => [r.employee, r.department, r.date, STATUS_STYLE[r.status].label, r.checkIn || '', r.checkOut || '', workHours(r) || ''])
    const csv = [header, ...rows].map((row) => row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `attendance-${dateFilter || 'all-dates'}.csv`
    a.click()
    URL.revokeObjectURL(url)
    toast.success(`Exported ${filtered.length} attendance records`)
  }

  const singleEmployee = Boolean(employeeFilter)

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <EmployeeAvatar name={row.employee} size="sm" />
          <p className="whitespace-nowrap font-semibold text-ink-800 dark:text-ink-100">{row.employee}</p>
        </div>
      ),
    },
    { key: 'department', header: 'Department', sortable: true },
    { key: 'date', header: 'Date', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.date, { weekday: 'short' })}</span> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => <Badge tone={STATUS_STYLE[row.status].badge} dot>{STATUS_STYLE[row.status].label}</Badge>,
    },
    { key: 'checkIn', header: 'Check-in', render: (row) => row.checkIn || '—' },
    { key: 'checkOut', header: 'Check-out', render: (row) => row.checkOut || '—' },
    { key: 'hours', header: 'Work hours', render: (row) => workHours(row) || '—' },
  ]

  return (
    <div>
      <PageHeader
        title="Attendance"
        description="Track daily attendance across the team with a monthly calendar and detailed log."
        breadcrumbItems={BREADCRUMB}
        action={
          <Button variant="secondary" leftIcon={<Download size={16} />} onClick={exportCsv} className="w-full sm:w-auto">
            Export CSV
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <EmployeeKpiCard index={0} icon={UserCheck} label="Present" value={counts.present} tone="success" hint="On time today" />
        <EmployeeKpiCard index={1} icon={UserX} label="Absent" value={counts.absent} tone="danger" hint="Not checked in" />
        <EmployeeKpiCard index={2} icon={Clock} label="Late" value={counts.late} tone="warning" hint="Checked in late" />
        <EmployeeKpiCard index={3} icon={Home} label="Work from Home" value={counts.wfh} tone="info" hint="Working remotely" />
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:grid-cols-2 sm:gap-3 sm:p-4 xl:grid-cols-4">
        <Select aria-label="Filter by department" options={DEPARTMENT_OPTIONS} value={departmentFilter} onChange={(e) => handleDepartmentChange(e.target.value)} />
        <Select aria-label="Filter by employee" options={employeeOptions} value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} />
        <Input aria-label="Filter by date" type="date" min="2026-08-01" max={TODAY} value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
        <Select aria-label="Filter by status" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
      </div>
      <ActiveFilters filters={activeFilters} onClearAll={clearAll} className="mb-4" />

      <Card className="mb-6 overflow-hidden rounded-2xl border-ink-100 lg:mb-8">
        <CardHeader className="flex-wrap px-4 sm:px-5">
          <div>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><CalendarDays size={16} aria-hidden="true" /></span>{monthLabel(viewMonth)}</CardTitle>
            <p className="mt-0.5 text-xs text-ink-500">
              {singleEmployee ? `Daily status for ${employeeFilter}` : 'Daily headcount by status. Select a day to filter the log below.'}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <button type="button" onClick={() => setViewMonth((m) => shiftMonth(m, -1))} className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 text-ink-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-ink-700 dark:hover:bg-ink-800" aria-label="Previous month">
              <ChevronLeft size={16} />
            </button>
            <button type="button" onClick={() => setViewMonth(ATTENDANCE_REF_DATE.slice(0, 7))} className="focus-ring hidden h-10 items-center gap-1.5 rounded-xl border border-ink-200 px-3 text-xs font-semibold text-ink-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800 sm:flex">
              <CalendarDays size={13} /> This month
            </button>
            <button type="button" onClick={() => setViewMonth((m) => shiftMonth(m, 1))} className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl border border-ink-200 text-ink-500 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 dark:border-ink-700 dark:hover:bg-ink-800" aria-label="Next month">
              <ChevronRight size={16} />
            </button>
          </div>
        </CardHeader>
        <CardBody className="px-3 sm:px-5">
          <div className="grid grid-cols-7 gap-1 sm:gap-1.5" role="group" aria-label={`Attendance calendar for ${monthLabel(viewMonth)}`}>
            {WEEKDAYS.map((d) => (
              <div key={d} className="pb-1 text-center text-xs font-semibold uppercase tracking-wide text-ink-500">{d}</div>
            ))}
            {cells.map((date, idx) => {
              if (!date) return <div key={`empty-${idx}`} aria-hidden="true" />
              return (
                <CalendarDay
                  key={date}
                  date={date}
                  entries={byDate[date] || []}
                  single={singleEmployee}
                  selected={dateFilter === date}
                  onPick={pickDay}
                />
              )
            })}
          </div>
          <ul className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-4 text-xs text-ink-600 dark:border-ink-800 dark:text-ink-300" aria-label="Calendar legend">
            {STATUS_ORDER.map((s) => (
              <li key={s} className={cn('flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-medium', STATUS_STYLE[s].cell)}><span className={cn('h-2 w-2 rounded-full', STATUS_STYLE[s].dot)} /> {STATUS_STYLE[s].label}</li>
            ))}
            <li className="flex items-center gap-1.5 rounded-full bg-ink-100 px-2.5 py-1 font-medium dark:bg-ink-800"><span className="h-2 w-2 rounded-sm bg-ink-300 dark:bg-ink-600" /> Weekend</li>
            <li className="flex items-center gap-1.5 rounded-full bg-brand-50 px-2.5 py-1 font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"><span className="h-2 w-2 rounded-sm bg-brand-400" /> Holiday</li>
          </ul>
        </CardBody>
      </Card>

      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-semibold text-ink-800 dark:text-ink-100 sm:text-lg">Attendance log</h2>
        <p className="text-xs text-ink-500" aria-live="polite">{filtered.length} records{counts.leave > 0 && ` · ${counts.leave} on leave`}</p>
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-4">
      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="No attendance records"
        emptyDescription="Nothing matches the current filters. Try another date or clear the filters."
        emptyActionLabel={activeFilters.length ? 'Clear all filters' : undefined}
        onEmptyAction={clearAll}
      />
      </div>
    </div>
  )
}

function CalendarDay({ date, entries, single, selected, onPick }) {
  const dayNum = Number(date.slice(8))
  const d = new Date(`${date}T00:00:00Z`)
  const weekend = d.getUTCDay() === 0 || d.getUTCDay() === 6
  const holiday = holidays[date]
  const isToday = date === TODAY
  const future = date > TODAY

  const tally = STATUS_ORDER.map((s) => ({ s, n: entries.filter((e) => e.status === s).length })).filter((t) => t.n > 0)
  const solo = single && entries[0]
  const summary = holiday
    ? holiday
    : weekend
      ? 'Weekend'
      : solo
        ? STATUS_STYLE[solo.status].label
        : tally.length
          ? tally.map((t) => `${t.n} ${STATUS_STYLE[t.s].label}`).join(', ')
          : 'No records'

  return (
    <button
      type="button"
      onClick={() => onPick(date)}
      aria-pressed={selected}
      aria-label={`${formatDate(date, { weekday: 'long' })}: ${summary}`}
      title={summary}
      disabled={future}
      className={cn(
        'focus-ring relative flex min-h-[3.25rem] min-w-0 flex-col rounded-xl border p-1 text-left transition-all sm:min-h-[4.75rem] sm:p-1.5',
        solo
          ? STATUS_STYLE[solo.status].cell
          : holiday
            ? 'border-brand-200 bg-brand-50 text-brand-700 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300'
            : weekend
              ? 'border-transparent bg-ink-100/70 text-ink-400 dark:bg-ink-800/50'
              : 'border-ink-100 bg-white text-ink-700 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card dark:border-ink-800 dark:bg-ink-900 dark:text-ink-200',
        selected && 'ring-2 ring-brand-500 ring-offset-1 ring-offset-white dark:ring-offset-ink-900',
        future && 'cursor-default opacity-40'
      )}
    >
      <span className={cn('flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold sm:text-xs', isToday && 'gradient-brand bg-brand-600 text-white shadow-sm')}>{dayNum}</span>
      {holiday && <span className="mt-auto line-clamp-2 hidden text-xs font-medium leading-tight sm:block">{holiday}</span>}
      {!holiday && solo && <span className="mt-auto hidden text-xs font-semibold sm:block">{SHORT[solo.status]}</span>}
      {!holiday && !solo && tally.length > 0 && (
        <span className="mt-auto flex flex-wrap gap-x-1.5 gap-y-0.5">
          {tally.map((t) => (
            <span key={t.s} className="flex items-center gap-0.5 text-xs font-semibold text-ink-600 dark:text-ink-300">
              <span className={cn('h-1.5 w-1.5 rounded-full', STATUS_STYLE[t.s].dot)} />
              <span className="hidden sm:inline">{t.n}</span>
            </span>
          ))}
        </span>
      )}
      {holiday && <span className="mt-auto h-1.5 w-1.5 rounded-full bg-brand-500 sm:hidden" />}
    </button>
  )
}
