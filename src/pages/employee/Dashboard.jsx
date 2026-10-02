import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ListChecks,
  AlertTriangle,
  Briefcase,
  CalendarDays,
  Video,
  Phone,
  MapPin,
  CheckCircle2,
  Check,
  Sunrise,
  Sun,
  Moon,
  Clock,
  PartyPopper,
  Activity,
  Plane,
  CalendarClock,
} from 'lucide-react'
import StatusBadge from '../../components/common/StatusBadge'
import Badge from '../../components/common/Badge'
import Button from '../../components/common/Button'
import ActivityTimeline from '../../components/common/ActivityTimeline'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { SkeletonCard, SkeletonChart, SkeletonText } from '../../components/common/Skeleton'
import { Panel, PanelHeader, PanelBody, PanelLink } from '../../components/portal/Panel'
import PortalStat from '../../components/portal/PortalStat'
import WelcomeBanner from '../../components/portal/WelcomeBanner'
import ClockTile from '../../components/portal/ClockTile'
import ProgressRing from '../../components/portal/ProgressRing'
import AnimatedBar from '../../components/portal/AnimatedBar'
import IconChip from '../../components/portal/IconChip'
import { toneOf, stagger, PRIORITY_TONE_KEY } from '../../components/portal/tones'
import { useToast } from '../../context/ToastContext'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { useNow } from '../../hooks/useNow'
import { checkInNow, checkOutNow, setTaskStatus } from '../../utils/portalStores'
import { TODAY } from '../../mockData/reference'
import { formatDate, formatTime, formatClockString } from '../../utils/format'
import { cn } from '../../utils/cn'

const TYPE_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }
const TYPE_TONE = { 'Video Call': 'brand', 'Phone Call': 'info', 'In Person': 'accent' }
const PRIORITY_TONE = { urgent: 'danger', high: 'warning', medium: 'brand', low: 'neutral' }
const LEAVE_TONE = { 'Earned Leave': 'brand', 'Casual Leave': 'accent', 'Sick Leave': 'warning' }
const LEAVE_ROTATION = ['brand', 'accent', 'warning']

function greeting(hour) {
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

function duration(ms) {
  const totalMinutes = Math.max(0, Math.floor(ms / 60000))
  const h = Math.floor(totalMinutes / 60)
  const m = totalMinutes % 60
  return `${h}h ${String(m).padStart(2, '0')}m`
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8" role="status" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <SkeletonChart className="lg:col-span-2" height="h-40" />
        <SkeletonCard lines={3} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <Panel className="p-4 sm:p-5 lg:col-span-2">
          <SkeletonText lines={5} />
        </Panel>
        <SkeletonCard lines={3} />
      </div>
    </div>
  )
}

function AttendanceCard({ name, liveAttendance, lastDay }) {
  const { toast } = useToast()
  const now = useNow(1000)
  const checkedIn = Boolean(liveAttendance?.checkIn)
  const checkedOut = Boolean(liveAttendance?.checkOut)

  function handleAttendance() {
    if (!checkedIn) {
      checkInNow(name)
      toast.success(`Checked in at ${formatTime(new Date())}. Have a productive day!`)
    } else if (!checkedOut) {
      const worked = duration(Date.now() - new Date(liveAttendance.checkIn).getTime())
      checkOutNow(name)
      toast.success(`Checked out at ${formatTime(new Date())}. You worked ${worked} today.`)
    }
  }

  const workedMs = checkedIn ? (checkedOut ? new Date(liveAttendance.checkOut) : now).getTime() - new Date(liveAttendance.checkIn).getTime() : 0

  return (
    <ClockTile
      title="Attendance"
      headerRight={
        <Link to="/employee/attendance" className="focus-ring rounded-md bg-white/20 px-2.5 py-1 text-white hover:bg-white/30">
          History
        </Link>
      }
      timeText={now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
      dateText={formatDate(now, { weekday: 'long', day: 'numeric', month: 'long' })}
      checkInText={checkedIn ? formatTime(liveAttendance.checkIn) : '—'}
      checkOutText={checkedOut ? formatTime(liveAttendance.checkOut) : '—'}
      workedText={checkedIn ? `${duration(workedMs)} ${checkedOut ? 'worked today' : 'and counting'}` : null}
      state={checkedOut ? 'done' : checkedIn ? 'out' : 'in'}
      buttonLabel={checkedOut ? 'Done for today' : checkedIn ? 'Check Out' : 'Check In'}
      onAction={handleAttendance}
      footer={
        lastDay && !checkedIn ? (
          <>
            Last working day: {formatDate(lastDay.date, { day: 'numeric', month: 'short' })} ·{' '}
            {lastDay.checkIn ? `${formatClockString(lastDay.checkIn)} - ${formatClockString(lastDay.checkOut)}` : lastDay.status}
          </>
        ) : null
      }
    />
  )
}

export default function EmployeeDashboard() {
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const data = useEmployeeData()
  const [hour] = useState(() => new Date().getHours())
  const { name, tasks, projects, meetings, leaveBalance, liveAttendance, attendanceHistory } = data

  const { todaysTasks, overdueTasks, activeProjects, upcomingMeetings, recentActivity } = useMemo(() => {
    const open = tasks.filter((t) => t.status !== 'done')
    return {
      todaysTasks: open.filter((t) => t.dueDate === TODAY || t.status === 'in_progress'),
      overdueTasks: open.filter((t) => t.dueDate < TODAY),
      activeProjects: projects.filter((p) => p.status === 'active'),
      upcomingMeetings: meetings
        .filter((m) => m.status === 'upcoming')
        .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))
        .slice(0, 4),
      recentActivity: tasks
        .flatMap((t) =>
          t.history
            .filter((h) => h.actor === name)
            .map((h) => ({ id: `${t.id}-${h.id}`, text: `${h.text} - "${t.title}"`, time: h.time, tone: h.tone }))
        )
        .sort((a, b) => b.time.localeCompare(a.time))
        .slice(0, 6),
    }
  }, [tasks, projects, meetings, name])

  const leaveRemaining = leaveBalance.reduce((sum, l) => sum + l.remaining, 0)
  const lastDay = attendanceHistory.find((r) => !r.isLive)

  function markDone(task) {
    setTaskStatus(task.id, 'done', name)
    toast.success(`"${task.title}" marked as done`)
  }

  const statCards = [
    { icon: ListChecks, label: "Today's Tasks", value: todaysTasks.length, tone: 'brand' },
    { icon: AlertTriangle, label: 'Overdue Tasks', value: overdueTasks.length, tone: 'danger' },
    { icon: Briefcase, label: 'Active Projects', value: activeProjects.length, tone: 'info' },
    { icon: CalendarDays, label: 'Leave Days Left', value: leaveRemaining, tone: 'success' },
  ]

  const GreetIcon = hour < 12 ? Sunrise : hour < 17 ? Sun : Moon

  return (
    <div className="space-y-6 lg:space-y-8">
      <WelcomeBanner
        icon={GreetIcon}
        eyebrow={formatDate(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: undefined })}
        title={`${greeting(hour)}, ${(name || 'there').split(' ')[0]}`}
        description="Here's your day at a glance."
        action={
          <Button as={Link} to="/employee/tasks" leftIcon={<ListChecks size={16} />}>
            Open My Tasks
          </Button>
        }
      >
        {!isLoading && !isError && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-ink-800/80 dark:text-brand-300 dark:ring-ink-700">
              <ListChecks size={13} /> {todaysTasks.length} due today
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-accent-700 ring-1 ring-accent-100 dark:bg-ink-800/80 dark:text-accent-300 dark:ring-ink-700">
              <CalendarClock size={13} /> {upcomingMeetings.length} upcoming meeting{upcomingMeetings.length === 1 ? '' : 's'}
            </span>
          </>
        )}
      </WelcomeBanner>

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<DashboardSkeleton />}>
        <div className="space-y-6 lg:space-y-8">
          <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
            {statCards.map((card, i) => (
              <PortalStat key={card.label} index={i} {...card} />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
            <Panel className="lg:col-span-2">
              <PanelHeader icon={ListChecks} tone="brand" title="Today's Tasks" action={<PanelLink to="/employee/tasks">View all</PanelLink>} />
              <PanelBody className="space-y-3">
                {todaysTasks.length === 0 && (
                  <EmptyState icon={CheckCircle2} title="Nothing due today" description="You have no tasks due today or in progress. Enjoy the breathing room." className="py-8" />
                )}
                {todaysTasks.map((t, i) => (
                  <div
                    key={t.id}
                    style={stagger(i, 50)}
                    className="animate-slide-up relative flex flex-col gap-3 overflow-hidden rounded-xl border border-ink-100 bg-white p-3 pl-4 transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:bg-ink-900 dark:hover:bg-ink-800/40 sm:flex-row sm:items-center sm:justify-between sm:p-3.5 sm:pl-5"
                  >
                    <span className={cn('absolute inset-y-0 left-0 w-1', toneOf(PRIORITY_TONE_KEY[t.priority]).dot)} aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{t.title}</p>
                      <p className="mt-0.5 truncate text-xs text-ink-500">
                        {t.project} · Due {t.dueDate === TODAY ? 'today' : formatDate(t.dueDate)}
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Badge tone={PRIORITY_TONE[t.priority]} dot>
                        {t.priority}
                      </Badge>
                      <StatusBadge status={t.status} />
                      <Button size="sm" variant="outline" leftIcon={<Check size={14} />} onClick={() => markDone(t)}>
                        Mark done
                      </Button>
                    </div>
                  </div>
                ))}
              </PanelBody>
            </Panel>

            <AttendanceCard name={name} liveAttendance={liveAttendance} lastDay={lastDay} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
            <Panel>
              <PanelHeader
                icon={AlertTriangle}
                tone="danger"
                title="Overdue Tasks"
                action={overdueTasks.length > 0 ? <Badge tone="danger">{overdueTasks.length}</Badge> : null}
              />
              <PanelBody className="space-y-3">
                {overdueTasks.length === 0 && (
                  <div className="flex items-center gap-3 rounded-xl bg-success-50 p-3.5 dark:bg-success-500/10">
                    <IconChip icon={PartyPopper} tone="success" size="sm" />
                    <p className="text-sm text-success-700 dark:text-success-300">No overdue tasks. Nicely done.</p>
                  </div>
                )}
                {overdueTasks.map((t, i) => (
                  <div
                    key={t.id}
                    style={stagger(i, 50)}
                    className="animate-slide-up relative overflow-hidden rounded-xl border border-danger-100 bg-danger-50/50 p-3 pl-4 dark:border-danger-500/20 dark:bg-danger-500/5"
                  >
                    <span className="absolute inset-y-0 left-0 w-1 bg-danger-500" aria-hidden="true" />
                    <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{t.title}</p>
                    <p className="mt-0.5 flex items-center gap-1 text-xs font-medium text-danger-600 dark:text-danger-400">
                      <Clock size={12} /> Was due {formatDate(t.dueDate)}
                    </p>
                  </div>
                ))}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader icon={Video} tone="accent" title="Upcoming Meetings" action={<PanelLink to="/employee/meetings">View all</PanelLink>} />
              <PanelBody className="space-y-3">
                {upcomingMeetings.length === 0 && <p className="text-sm text-ink-500">No upcoming meetings.</p>}
                {upcomingMeetings.map((m, i) => {
                  const Icon = TYPE_ICON[m.type] || Video
                  const tone = toneOf(TYPE_TONE[m.type] || 'brand')
                  return (
                    <div
                      key={m.id}
                      style={stagger(i, 50)}
                      className="animate-slide-up flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/40"
                    >
                      <span className={cn('flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl', tone.chip)}>
                        <span className="text-xs font-bold uppercase leading-none">{formatDate(m.date, { month: 'short', year: undefined, day: undefined })}</span>
                        <span className="mt-0.5 text-base font-bold leading-none">{formatDate(m.date, { day: '2-digit', month: undefined, year: undefined })}</span>
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{m.title}</p>
                        <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-500">
                          <Icon size={12} className={cn('shrink-0', tone.text)} /> {formatClockString(m.time)}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader icon={Plane} tone="success" title="Leave Balance" action={<PanelLink to="/employee/leave">Apply</PanelLink>} />
              <PanelBody className="space-y-4">
                {leaveBalance.map((row, i) => {
                  const tone = LEAVE_TONE[row.type] || LEAVE_ROTATION[i % LEAVE_ROTATION.length]
                  const pct = row.total ? (row.remaining / row.total) * 100 : 0
                  return (
                    <div key={row.type} className="flex items-center gap-4">
                      <ProgressRing value={pct} size={60} stroke={7} tone={tone} label={`${row.type} remaining`}>
                        <span className="text-sm font-bold tabular-nums text-ink-800 dark:text-ink-100">{row.remaining}</span>
                      </ProgressRing>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{row.type}</p>
                        <p className="text-xs text-ink-500">
                          {row.remaining} <span className="text-ink-400">/ {row.total} days</span>
                        </p>
                      </div>
                    </div>
                  )
                })}
              </PanelBody>
            </Panel>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
            <Panel className="lg:col-span-2">
              <PanelHeader icon={Briefcase} tone="info" title="Active Projects" action={<PanelLink to="/employee/projects">View all</PanelLink>} />
              <PanelBody className="space-y-3">
                {activeProjects.length === 0 && <p className="text-sm text-ink-500">No active projects assigned to you.</p>}
                {activeProjects.map((p, i) => (
                  <div
                    key={p.id}
                    style={stagger(i, 50)}
                    className="animate-slide-up rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/40"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{p.name}</p>
                        <p className="truncate text-xs text-ink-500">
                          {p.client} · Due {formatDate(p.deadline)}
                        </p>
                      </div>
                      <StatusBadge status={p.status} />
                    </div>
                    <AnimatedBar value={p.progress} showValue label="Progress" className="mt-3" size="md" />
                  </div>
                ))}
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader icon={Activity} tone="warning" title="Recent Activity" action={<PanelLink to="/employee/activity">All</PanelLink>} />
              <PanelBody>
                {recentActivity.length > 0 ? <ActivityTimeline items={recentActivity} /> : <p className="text-sm text-ink-500">Your task updates will show up here.</p>}
              </PanelBody>
            </Panel>
          </div>
        </div>
      </AsyncState>
    </div>
  )
}
