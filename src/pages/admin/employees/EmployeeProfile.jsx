import { useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Mail, Phone, Building2, BadgeCheck, CalendarDays, Pencil, Briefcase, ClipboardList, Clock, FileText,
  MapPin, User, Users, Cake, HeartPulse, IdCard, Laptop, ArrowLeft, Download, FolderKanban, CheckCircle2, ListChecks, Hourglass,
  CircleCheck, CircleX, AlarmClock, Home, Plane, TrendingUp,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import EmployeeFormModal from '../../../components/business/EmployeeFormModal'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import Card, { CardHeader, CardTitle, CardBody } from '../../../components/common/Card'
import Button from '../../../components/common/Button'
import Tabs from '../../../components/common/Tabs'
import Badge from '../../../components/common/Badge'
import StatusBadge from '../../../components/common/StatusBadge'
import EmployeeAvatar from '../../../components/business/EmployeeAvatar'
import { GrowBar, ProgressRing } from '../../../components/business/EmployeeMeters'
import { TINTS, tintAt } from '../../../components/business/employeeTints'
import EmptyState from '../../../components/common/EmptyState'
import ActivityTimeline from '../../../components/common/ActivityTimeline'
import { employeeService } from '../../../services/employeeService'
import { attendanceService, leaveService } from '../../../services/attendanceService'
import { documentService } from '../../../services/documentService'
import { projects } from '../../../mockData/projects'
import { tasks } from '../../../mockData/tasks'
import { TODAY, daysBetween } from '../../../mockData/reference'
import { formatDate } from '../../../utils/format'
import { computeLeaveBalance, leaveDays } from '../../../utils/leaveMath'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'

const ATTENDANCE_TONES = {
  present: { label: 'Present', badge: 'success', icon: CircleCheck, chip: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300' },
  absent: { label: 'Absent', badge: 'danger', icon: CircleX, chip: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-300' },
  late: { label: 'Late', badge: 'warning', icon: AlarmClock, chip: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300' },
  wfh: { label: 'Work from Home', badge: 'info', icon: Home, chip: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300' },
  leave: { label: 'On Leave', badge: 'accent', icon: Plane, chip: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300' },
}

function tenureLabel(joiningDate) {
  const days = Math.max(0, daysBetween(joiningDate, TODAY))
  const years = Math.floor(days / 365)
  const months = Math.floor((days % 365) / 30)
  if (years === 0 && months === 0) return 'Less than a month'
  return [years && `${years} yr${years > 1 ? 's' : ''}`, months && `${months} mo`].filter(Boolean).join(' ')
}

export default function EmployeeProfile() {
  const { id } = useParams()
  const navigate = useNavigate()

  const load = useCallback(async () => {
    const [employee, attendance, leaves, docs] = await Promise.all([
      employeeService.get(id).catch((e) => (e.code === 'NOT_FOUND' ? null : Promise.reject(e))),
      attendanceService.list(),
      leaveService.list(),
      documentService.list(),
    ])
    return { employee, attendance, leaves, docs }
  }, [id])

  const { status, data, retry } = useMockLoad(load)
  const crumbs = [{ label: 'People' }, { label: 'Employees', href: '/admin/employees' }, { label: 'Profile' }]

  if (status === 'loading') return <PageSkeleton title="Employee profile" breadcrumbItems={crumbs} stats={0} filters={false} cols={4} />
  if (status === 'error') return <PageError title="Employee profile" breadcrumbItems={crumbs} onRetry={retry} />
  if (!data.employee) {
    return (
      <div>
        <PageHeader title="Employee profile" breadcrumbItems={crumbs} />
        <Card>
          <EmptyState
            icon={User}
            title="Employee not found"
            description="This employee may have been removed, or the link is invalid."
            actionLabel="Back to Employees"
            onAction={() => navigate('/admin/employees')}
          />
        </Card>
      </div>
    )
  }
  return <ProfileView key={data.employee.id} initial={data.employee} attendance={data.attendance} leaves={data.leaves} docs={data.docs} />
}

const TABS = [
  { value: 'overview', label: 'Overview' },
  { value: 'projects', label: 'Projects' },
  { value: 'tasks', label: 'Tasks' },
  { value: 'attendance', label: 'Attendance' },
  { value: 'leave', label: 'Leave' },
  { value: 'documents', label: 'Documents' },
  { value: 'activity', label: 'Activity' },
]

function ProfileView({ initial, attendance, leaves, docs }) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const [employee, setEmployee] = useState(initial)
  const [tab, setTab] = useState('overview')
  const [modalOpen, setModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  const empProjects = useMemo(
    () => projects.filter((p) => p.team.includes(employee.name) || p.manager === employee.name),
    [employee.name]
  )
  const empTasks = useMemo(() => tasks.filter((t) => t.assignee === employee.name), [employee.name])
  const empDocs = useMemo(
    () => docs.filter((d) => d.employeeId === employee.id || (d.uploadedBy === employee.name && d.category !== 'Invoices')),
    [docs, employee.id, employee.name]
  )
  const empAttendance = useMemo(() => attendance.filter((a) => a.employee === employee.name), [attendance, employee.name])
  const empLeaves = useMemo(
    () => leaves.filter((l) => l.employee === employee.name).sort((a, b) => b.from.localeCompare(a.from)),
    [leaves, employee.name]
  )

  const monthRecords = useMemo(() => empAttendance.filter((a) => a.date.startsWith(TODAY.slice(0, 7))), [empAttendance])
  const monthCounts = useMemo(() => {
    const counts = { present: 0, absent: 0, late: 0, wfh: 0, leave: 0 }
    monthRecords.forEach((r) => {
      counts[r.status] += 1
    })
    return counts
  }, [monthRecords])
  const attendanceRate = monthRecords.length
    ? Math.round(((monthCounts.present + monthCounts.late + monthCounts.wfh) / monthRecords.length) * 100)
    : null

  const leaveUsage = useMemo(() => computeLeaveBalance(leaves, employee.name), [leaves, employee.name])

  const activity = useMemo(() => {
    const items = [{ id: 'join', text: `joined ${employee.department} as ${employee.designation}`, sort: employee.joiningDate, tone: 'success' }]
    empLeaves.forEach((l) => {
      items.push({ id: `l-${l.id}`, text: `applied for ${l.type.toLowerCase()} (${formatDate(l.from)}${l.from !== l.to ? ` to ${formatDate(l.to)}` : ''})`, sort: l.appliedOn || l.from, tone: 'info' })
      if (l.status !== 'pending') {
        items.push({ id: `ld-${l.id}`, text: `leave request was ${l.status}${l.decidedBy ? ` by ${l.decidedBy}` : ''}`, sort: l.decidedOn || l.from, tone: l.status === 'approved' ? 'success' : 'danger' })
      }
    })
    empDocs.forEach((d) => items.push({ id: `d-${d.id}`, text: d.uploadedBy === employee.name ? `uploaded ${d.name}` : `${d.name} was added to the profile`, sort: d.uploadedDate, tone: 'brand' }))
    empTasks
      .filter((t) => t.status === 'done')
      .forEach((t) => items.push({ id: `t-${t.id}`, text: `completed task "${t.title}"`, sort: t.dueDate, tone: 'success' }))
    empAttendance
      .filter((a) => a.status === 'late')
      .slice(0, 3)
      .forEach((a) => items.push({ id: `a-${a.id}`, text: `checked in late at ${a.checkIn}`, sort: a.date, tone: 'warning' }))
    return items
      .sort((a, b) => b.sort.localeCompare(a.sort))
      .map((i) => ({ ...i, time: <>{formatDate(i.sort)}</> }))
  }, [employee, empLeaves, empDocs, empTasks, empAttendance])

  async function handleSave(values) {
    setIsSaving(true)
    try {
      const updated = await employeeService.update(employee.id, values)
      setEmployee((prev) => ({ ...prev, ...updated }))
      toast.success('Employee updated successfully')
      setModalOpen(false)
    } catch {
      toast.error('Could not update the employee. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const openTasks = empTasks.filter((t) => t.status !== 'done').length
  const tabsWithCounts = TABS.map((t) => {
    const counts = { projects: empProjects.length, tasks: empTasks.length, documents: empDocs.length, leave: empLeaves.length }
    return counts[t.value] !== undefined ? { ...t, count: counts[t.value] } : t
  })

  return (
    <div>
      <PageHeader
        title={employee.name}
        description={`${employee.designation} · ${employee.department}`}
        breadcrumbItems={[{ label: 'People' }, { label: 'Employees', href: '/admin/employees' }, { label: employee.name }]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<ArrowLeft size={15} />} onClick={() => navigate('/admin/employees')}>Back</Button>
            <Button leftIcon={<Pencil size={15} />} onClick={() => setModalOpen(true)}>Edit Employee</Button>
          </div>
        }
      />

      <Card className="mb-6 overflow-hidden rounded-2xl border-ink-100 lg:mb-8">
        <div className="gradient-hero relative h-24 overflow-hidden sm:h-28" aria-hidden="true">
          <span className="absolute -right-8 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <span className="absolute right-24 top-8 h-20 w-20 rounded-full bg-white/10" />
          <span className="absolute -bottom-12 left-1/3 h-32 w-32 rounded-full bg-accent-300/20" />
        </div>
        <CardBody className="flex flex-col gap-5 pt-0 lg:flex-row lg:items-end lg:justify-between lg:pt-5">
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-end sm:gap-5">
            <EmployeeAvatar name={employee.name} src={employee.avatar} size="2xl" ring className="-mt-12 w-fit animate-scale-in sm:-mt-14" />
            <div className="min-w-0 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-2xl">{employee.name}</h2>
                <StatusBadge status={employee.status} />
              </div>
              <p className="mt-0.5 text-sm text-ink-500">{employee.designation} · {employee.department}</p>
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-500">
                <span className="flex min-w-0 items-center gap-1.5 break-all"><Mail size={13} className="shrink-0 text-brand-500" /> {employee.email}</span>
                <span className="flex items-center gap-1.5"><Phone size={13} className="shrink-0 text-accent-500" /> {employee.phone}</span>
              </div>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:max-w-md lg:shrink-0 lg:grid-cols-2 2xl:max-w-none 2xl:grid-cols-4">
            <HeroStat icon={FolderKanban} tint={TINTS[0]} label="Projects" value={empProjects.length} />
            <HeroStat icon={ListChecks} tint={TINTS[1]} label="Open tasks" value={openTasks} />
            <HeroStat icon={TrendingUp} tint={TINTS[4]} label="Attendance" value={attendanceRate === null ? '—' : `${attendanceRate}%`} />
            <HeroStat icon={Hourglass} tint={TINTS[3]} label="Tenure" value={tenureLabel(employee.joiningDate)} />
          </dl>
        </CardBody>
      </Card>

      <div className="-mx-4 mb-5 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <Tabs tabs={tabsWithCounts} active={tab} onChange={setTab} />
      </div>

      <div key={tab} className="animate-fade-in">

      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-2 lg:gap-6">
          <Card className="rounded-2xl border-ink-100">
            <CardHeader><CardTitle className="text-base sm:text-lg">Personal Information</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow icon={Mail} tint={0} label="Email" value={employee.email} />
              <InfoRow icon={Phone} tint={1} label="Phone" value={employee.phone} />
              <InfoRow icon={Cake} tint={2} label="Date of birth" value={employee.dob ? formatDate(employee.dob) : null} />
              <InfoRow icon={User} tint={3} label="Gender" value={employee.gender} />
              <InfoRow icon={MapPin} tint={4} label="Address" value={employee.address} className="sm:col-span-2" />
              <InfoRow
                icon={HeartPulse}
                tint={1}
                label="Emergency contact"
                value={employee.emergencyContact ? `${employee.emergencyContact.name} (${employee.emergencyContact.relation}) · ${employee.emergencyContact.phone}` : null}
                className="sm:col-span-2"
              />
            </CardBody>
          </Card>
          <Card className="rounded-2xl border-ink-100">
            <CardHeader><CardTitle className="text-base sm:text-lg">Professional Information</CardTitle></CardHeader>
            <CardBody className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <InfoRow icon={IdCard} tint={0} label="Employee ID" value={employee.employeeCode} />
              <InfoRow icon={Building2} tint={1} label="Department" value={employee.department} />
              <InfoRow icon={Briefcase} tint={2} label="Designation" value={employee.designation} />
              <InfoRow icon={Users} tint={3} label="Reporting manager" value={employee.manager} />
              <InfoRow icon={Laptop} tint={4} label="Work location" value={employee.location} />
              <InfoRow icon={BadgeCheck} tint={0} label="Employment type" value={employee.employmentType} />
              <InfoRow icon={CalendarDays} tint={1} label="Joining date" value={`${formatDate(employee.joiningDate)} (${tenureLabel(employee.joiningDate)})`} />
              <InfoRow icon={ClipboardList} tint={2} label="Active projects" value={empProjects.length} />
            </CardBody>
          </Card>
          <Card className="rounded-2xl border-ink-100 lg:col-span-2">
            <CardHeader><CardTitle className="text-base sm:text-lg">Skills</CardTitle></CardHeader>
            <CardBody>
              {(employee.skills || []).length === 0 ? (
                <p className="text-sm text-ink-400">No skills added yet. Use Edit Employee to add some.</p>
              ) : (
                <ul className="flex flex-wrap gap-2">
                  {employee.skills.map((skill, i) => (
                    <li key={skill} className="animate-scale-in" style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}>
                      <span className={cn('inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset transition-transform hover:-translate-y-0.5', tintAt(i).chip)}>{skill}</span>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'projects' && (
        <Card className="rounded-2xl border-ink-100">
          <CardBody>
            {empProjects.length === 0 ? (
              <EmptyState icon={FolderKanban} title="No projects assigned" description="Projects this employee manages or is part of will appear here." />
            ) : (
              <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
                {empProjects.map((p, i) => (
                  <li key={p.id} className="animate-slide-up rounded-2xl border border-ink-100 p-4 transition-all hover:-translate-y-0.5 hover:shadow-card-hover dark:border-ink-800" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{p.name}</p>
                        <p className="text-xs text-ink-400">{p.client}</p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <div className="mt-3">
                      <div className="mb-1 flex justify-between text-xs text-ink-500">
                        <span>{p.manager === employee.name ? 'Project manager' : 'Team member'}</span>
                        <span className="font-semibold tabular-nums text-ink-700 dark:text-ink-200">{p.progress}%</span>
                      </div>
                      <GrowBar value={p.progress} label={`${p.name} progress`} height="h-2" gradient={tintAt(i).bar} />
                      <p className="mt-2 text-xs text-ink-400">Deadline {formatDate(p.deadline)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'tasks' && (
        <Card className="rounded-2xl border-ink-100">
          <CardBody>
            {empTasks.length === 0 ? (
              <EmptyState icon={ClipboardList} title="No tasks assigned" description="Tasks assigned to this employee will appear here." />
            ) : (
              <ul className="space-y-2.5">
                {empTasks.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{t.title}</p>
                      <p className="text-xs text-ink-400">{t.project} · Due {formatDate(t.dueDate)}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={t.priority} />
                      <StatusBadge status={t.status} />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'attendance' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-5">
            {Object.entries(ATTENDANCE_TONES).map(([key, cfg], i) => (
              <Card key={key} hover className="animate-slide-up rounded-2xl border-ink-100 p-4" style={{ animationDelay: `${i * 60}ms` }}>
                <span className={cn('mb-2 flex h-9 w-9 items-center justify-center rounded-xl', cfg.chip)}><cfg.icon size={18} aria-hidden="true" /></span>
                <p className="text-2xl font-bold tabular-nums text-ink-800 dark:text-ink-50">{monthCounts[key]}</p>
                <p className="text-xs text-ink-500">{cfg.label}</p>
              </Card>
            ))}
          </div>
          <Card className="rounded-2xl border-ink-100">
            <CardHeader>
              <CardTitle>Recent attendance</CardTitle>
              <span className="text-xs text-ink-400">Month to date: {attendanceRate === null ? 'No records' : `${attendanceRate}% attendance`}</span>
            </CardHeader>
            <CardBody className="p-0">
              {empAttendance.length === 0 ? (
                <EmptyState icon={Clock} title="No attendance recorded" description="Attendance records for this employee will appear here." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-ink-100 bg-ink-50 text-xs uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-800/60">
                        <th className="px-5 py-3 font-semibold">Date</th>
                        <th className="px-5 py-3 font-semibold">Status</th>
                        <th className="px-5 py-3 font-semibold">Check-in</th>
                        <th className="px-5 py-3 font-semibold">Check-out</th>
                      </tr>
                    </thead>
                    <tbody>
                      {empAttendance.slice(0, 10).map((r) => (
                        <tr key={r.id} className="border-b border-ink-100 transition-colors last:border-0 hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40">
                          <td className="px-5 py-3 text-ink-700 dark:text-ink-200">{formatDate(r.date, { weekday: 'short' })}</td>
                          <td className="px-5 py-3"><Badge tone={ATTENDANCE_TONES[r.status].badge} dot>{ATTENDANCE_TONES[r.status].label}</Badge></td>
                          <td className="px-5 py-3 text-ink-500">{r.checkIn || '—'}</td>
                          <td className="px-5 py-3 text-ink-500">{r.checkOut || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'leave' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {leaveUsage.map((b, i) => (
              <Card key={b.type} hover className="animate-slide-up rounded-2xl border-ink-100 p-4" style={{ animationDelay: `${i * 60}ms` }}>
                <div className="flex items-center gap-4">
                  <ProgressRing value={b.total ? (b.used / b.total) * 100 : 0} size={60} strokeWidth={7} stroke={['stroke-brand-500', 'stroke-accent-500', 'stroke-warning-500'][i % 3]}>
                    <span className="text-xs font-bold tabular-nums text-ink-700 dark:text-ink-200">{b.remaining}</span>
                  </ProgressRing>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink-700 dark:text-ink-200">{b.type}</p>
                    <p className="text-xs text-ink-500">{b.used} of {b.total} used</p>
                    <p className="mt-1 text-lg font-bold tabular-nums text-ink-800 dark:text-ink-50">{b.remaining}<span className="ml-1 text-xs font-normal text-ink-500">days left</span></p>
                  </div>
                </div>
                {b.pending > 0 && <p className="mt-3 rounded-lg bg-warning-50 px-2.5 py-1.5 text-xs font-medium text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">{b.pending} day{b.pending > 1 ? 's' : ''} pending approval</p>}
              </Card>
            ))}
          </div>
          <Card className="rounded-2xl border-ink-100">
            <CardHeader><CardTitle className="text-base sm:text-lg">Leave history</CardTitle></CardHeader>
            <CardBody>
              {empLeaves.length === 0 ? (
                <EmptyState icon={CalendarDays} title="No leave requests" description="Leave requests submitted by this employee will appear here." />
              ) : (
                <ul className="space-y-2.5">
                  {empLeaves.map((l) => (
                    <li key={l.id} className="flex flex-col gap-2 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{l.type} · {leaveDays(l)} day{leaveDays(l) > 1 ? 's' : ''}</p>
                        <p className="text-xs text-ink-400">{formatDate(l.from)}{l.from !== l.to && ` – ${formatDate(l.to)}`} · {l.reason}</p>
                      </div>
                      <StatusBadge status={l.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      )}

      {tab === 'documents' && (
        <Card className="rounded-2xl border-ink-100">
          <CardBody>
            {empDocs.length === 0 ? (
              <EmptyState icon={FileText} title="No documents" description="Offer letters, KYC files and other documents for this employee will appear here." />
            ) : (
              <ul className="space-y-2.5">
                {empDocs.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300"><FileText size={18} /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{d.name}</p>
                        <p className="text-xs text-ink-400">{d.category} · {d.size} · {formatDate(d.uploadedDate)}</p>
                      </div>
                    </div>
                    <Button size="sm" variant="secondary" leftIcon={<Download size={13} />} onClick={() => toast.success(`Downloading ${d.name}...`)}>
                      <span className="hidden sm:inline">Download</span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'activity' && (
        <Card className="rounded-2xl border-ink-100">
          <CardHeader><CardTitle className="text-base sm:text-lg">Recent activity</CardTitle></CardHeader>
          <CardBody>
            {activity.length === 0 ? (
              <EmptyState icon={CheckCircle2} title="No activity yet" description="Actions taken by or for this employee will show up here." />
            ) : (
              <ActivityTimeline items={activity} />
            )}
          </CardBody>
        </Card>
      )}

      </div>

      <EmployeeFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleSave} initialValues={employee} isSaving={isSaving} />
    </div>
  )
}

function HeroStat({ icon: Icon, tint, label, value }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-3 py-2.5 shadow-card dark:border-ink-800 dark:bg-ink-900">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', tint.soft)} aria-hidden="true">
        <Icon size={17} />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-ink-500">{label}</dt>
        <dd className="break-words text-base font-bold leading-tight tabular-nums text-ink-800 dark:text-ink-50">{value}</dd>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, tint = 0, label, value, className }) {
  return (
    <div className={cn('flex items-start gap-3', className)}>
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', tintAt(tint).soft)} aria-hidden="true">
        <Icon size={16} />
      </span>
      <div className="min-w-0">
        <p className="text-xs text-ink-500">{label}</p>
        <p className="break-words text-sm font-medium text-ink-800 dark:text-ink-100">{value || '—'}</p>
      </div>
    </div>
  )
}
