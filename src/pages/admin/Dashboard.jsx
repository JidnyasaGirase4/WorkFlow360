import { Link } from 'react-router-dom'
import {
  IndianRupee, Receipt, Users, Briefcase, ListChecks, LifeBuoy, ArrowRight, Plus, Building2,
  CalendarClock, FileText, Video, Phone, MapPin, Sparkles, UserPlus, Zap, Clock, TrendingUp,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
} from 'recharts'
import PageHeader from '../../components/business/PageHeader'
import MetricCard from '../../components/business/MetricCard'
import ChartTooltip from '../../components/business/ChartTooltip'
import ChartCard from '../../components/common/ChartCard'
import Button from '../../components/common/Button'
import Badge from '../../components/common/Badge'
import Card, { CardHeader, CardTitle, CardBody } from '../../components/common/Card'
import Avatar from '../../components/common/Avatar'
import EmptyState from '../../components/common/EmptyState'
import ErrorState from '../../components/common/ErrorState'
import { Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { useAuth } from '../../context/AuthContext'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useChartColors } from '../../hooks/useChartColors'
import { dashboardService } from '../../services/dashboardService'
import { formatCurrency, formatDate, timeAgo } from '../../utils/format'

const KPI_ICONS = {
  revenue: IndianRupee,
  invoice: Receipt,
  clients: Users,
  projects: Briefcase,
  tasks: ListChecks,
  tickets: LifeBuoy,
}

const KIND_ICONS = {
  invoice: Receipt,
  task: ListChecks,
  ticket: LifeBuoy,
  lead: UserPlus,
  document: FileText,
  system: Sparkles,
}

// Coloured node for each activity kind in the feed.
const KIND_TINT = {
  invoice: 'bg-warning-50 text-warning-600 ring-warning-100 dark:bg-warning-500/15 dark:text-warning-400 dark:ring-warning-500/20',
  task: 'bg-info-50 text-info-600 ring-info-100 dark:bg-info-500/15 dark:text-info-300 dark:ring-info-500/20',
  ticket: 'bg-danger-50 text-danger-600 ring-danger-100 dark:bg-danger-500/15 dark:text-danger-400 dark:ring-danger-500/20',
  lead: 'bg-accent-50 text-accent-600 ring-accent-100 dark:bg-accent-500/15 dark:text-accent-300 dark:ring-accent-500/20',
  document: 'bg-success-50 text-success-600 ring-success-100 dark:bg-success-500/15 dark:text-success-400 dark:ring-success-500/20',
  system: 'bg-brand-50 text-brand-600 ring-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:ring-brand-500/20',
}

const QUICK_ACTIONS = [
  { label: 'New Lead', icon: Users, to: '/admin/crm/leads', tint: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300' },
  { label: 'New Project', icon: Briefcase, to: '/admin/projects', tint: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300' },
  { label: 'Create Invoice', icon: Receipt, to: '/admin/billing/invoices', tint: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400' },
  { label: 'Add Task', icon: ListChecks, to: '/admin/tasks', tint: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300' },
  { label: 'Schedule Meeting', icon: CalendarClock, to: '/admin/meetings', tint: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400' },
  { label: 'Log Ticket', icon: LifeBuoy, to: '/admin/support', tint: 'bg-danger-50 text-danger-600 dark:bg-danger-500/15 dark:text-danger-400' },
  { label: 'Add Client', icon: Building2, to: '/admin/crm/clients', tint: 'bg-brand-50 text-brand-700 dark:bg-brand-500/15 dark:text-brand-300' },
]

const MEETING_TINT = [
  'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
]

const TYPE_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }
const AXIS_TICK = { fontSize: 12 }
const TEAL = '#1aa996'
const ROSE = '#ec4a7d'
const AMBER = '#f59e0b'
const VIOLET = '#8654ec'
const GREEN = '#22a559'

function formatKpi(kind) {
  return kind === 'currency' ? (v) => formatCurrency(v) : (v) => Math.round(v).toLocaleString('en-IN')
}

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening'
}

// Vertical gradient definition used by rounded chart bars.
function BarGradient({ id, color }) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stopColor={color} stopOpacity={1} />
      <stop offset="100%" stopColor={color} stopOpacity={0.55} />
    </linearGradient>
  )
}

export default function AdminDashboard() {
  const { data, loading, error, reload } = useAsyncData(dashboardService.getOverview, 'overview')

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Here's what's happening across your business today."
        breadcrumbItems={[{ label: 'Dashboard' }]}
        action={
          <Button leftIcon={<Plus size={15} />} as={Link} to="/admin/projects" state={{ openCreate: true }} className="w-full sm:w-auto">
            New Project
          </Button>
        }
      />

      {loading && <DashboardSkeleton />}
      {error && (
        <Card>
          <ErrorState
            title="Couldn't load the dashboard"
            description="We ran into a problem fetching your business overview. Please try again."
            onRetry={reload}
          />
        </Card>
      )}
      {data && <DashboardContent data={data} />}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading dashboard" className="space-y-6 lg:space-y-8">
      <Skeleton className="h-32 rounded-2xl sm:h-36" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

function DashboardContent({ data }) {
  const colors = useChartColors()
  const { user } = useAuth()
  const firstName = (user?.name || '').split(' ')[0]
  const axis = { ...AXIS_TICK, fill: colors.tick }
  const totalProjects = data.projectStatus.reduce((sum, s) => sum + s.value, 0)
  const revenueSummary = `Monthly revenue rose from ${formatCurrency(data.revenue[0].revenue)} in ${data.revenue[0].month} to ${formatCurrency(data.revenue.at(-1).revenue)} in ${data.revenue.at(-1).month}.`
  const revenueKpi = data.kpis.find((k) => k.key === 'revenue')

  return (
    <div className="space-y-6 lg:space-y-8">
      <section className="gradient-hero relative animate-fade-in overflow-hidden rounded-2xl p-5 text-white shadow-card sm:p-6 lg:p-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-white/10 blur-2xl" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-1/4 h-44 w-44 rounded-full bg-accent-300/25 blur-3xl" />
        <div className="relative flex min-w-0 flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-white/80">
              <Sparkles size={14} /> {formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long', year: undefined })}
            </p>
            <h2 className="mt-1.5 break-words text-xl min-[400px]:text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}{firstName ? `, ${firstName}` : ''}
            </h2>
            <p className="mt-1 max-w-xl text-sm text-white/85">Here&apos;s what&apos;s happening across your business today.</p>
          </div>
          {revenueKpi && (
            <div className="flex min-w-0 shrink-0 items-center gap-3 rounded-2xl bg-white/15 px-4 py-3 ring-1 ring-white/25 backdrop-blur">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/25">
                <TrendingUp size={20} />
              </span>
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-white/80">{revenueKpi.label}</p>
                <p className="truncate text-xl font-bold tabular-nums">{formatCurrency(revenueKpi.value)}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section aria-label="Quick actions" className="animate-slide-up">
        <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-ink-800 sm:text-lg dark:text-ink-100">
          <Zap size={16} className="text-warning-500" /> Quick actions
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {QUICK_ACTIONS.map((a, i) => (
            <Link
              key={a.label}
              to={a.to}
              state={{ openCreate: true }}
              style={{ animationDelay: `${i * 50}ms` }}
              className="focus-ring group animate-slide-up flex max-sm:last:odd:col-span-2 min-h-[5.5rem] min-w-0 flex-col items-center justify-center gap-2 rounded-2xl border border-ink-100 bg-white p-3 text-center shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover active:scale-[0.98] dark:border-ink-800 dark:bg-ink-900"
            >
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 ${a.tint}`}>
                <a.icon size={20} />
              </span>
              <span className="w-full truncate text-xs font-semibold text-ink-700 sm:text-sm dark:text-ink-200">{a.label}</span>
            </Link>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-6">
        {data.kpis.map((k, idx) => (
          <MetricCard
            key={k.key}
            icon={KPI_ICONS[k.icon]}
            label={k.label}
            value={k.value}
            format={formatKpi(k.kind)}
            change={k.change}
            higherIsBetter={k.higherIsBetter}
            compareLabel={k.compareLabel}
            trend={k.trend}
            tone={k.tone}
            delay={idx * 60}
          />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <ChartCard title="Revenue" subtitle="Monthly revenue, Apr - Sep 2026" className="animate-slide-up min-w-0 rounded-2xl lg:col-span-2" height={300}>
          <div role="img" aria-label={revenueSummary} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.revenue} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={TEAL} stopOpacity={0.4} />
                    <stop offset="70%" stopColor={ROSE} stopOpacity={0.08} />
                    <stop offset="100%" stopColor={ROSE} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dashRevenueLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={TEAL} />
                    <stop offset="100%" stopColor={ROSE} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} strokeOpacity={0.6} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} width={52} tickFormatter={(v) => `₹${v / 1000}k`} />
                <RTooltip content={<ChartTooltip formatter={(v) => formatCurrency(v)} />} />
                <Area type="monotone" name="Revenue" dataKey="revenue" stroke="url(#dashRevenueLine)" strokeWidth={3} fill="url(#dashRevenue)" animationDuration={900} activeDot={{ r: 5, fill: TEAL, stroke: '#fff', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Project Status" subtitle="Current pipeline breakdown" className="animate-slide-up min-w-0 rounded-2xl" height={300}>
          <div className="flex h-full flex-col">
            <div
              className="relative min-h-0 flex-1"
              role="img"
              aria-label={`Projects by status: ${data.projectStatus.map((s) => `${s.name} ${s.value}`).join(', ')}`}
            >
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.projectStatus} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={4} cornerRadius={6} stroke="none" animationDuration={900}>
                    {data.projectStatus.map((s) => (
                      <Cell key={s.name} fill={s.color} />
                    ))}
                  </Pie>
                  <RTooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-bold tabular-nums text-ink-800 dark:text-ink-50">{totalProjects}</span>
                <span className="text-xs font-medium text-ink-400">Projects</span>
              </div>
            </div>
            <ChartLegend items={data.projectStatus} />
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 md:grid-cols-2 lg:gap-6 xl:grid-cols-3">
        <ChartCard title="Task Overview" subtitle="Across all projects" className="animate-slide-up min-w-0 rounded-2xl" height={280}>
          <div role="img" aria-label={`Tasks by stage: ${data.taskOverview.map((s) => `${s.name} ${s.value}`).join(', ')}`} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.taskOverview} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  {data.taskOverview.map((s, i) => (
                    <BarGradient key={s.name} id={`dashTask${i}`} color={s.color} />
                  ))}
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} strokeOpacity={0.6} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} allowDecimals={false} />
                <RTooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip />} />
                <Bar name="Tasks" dataKey="value" radius={[8, 8, 0, 0]} maxBarSize={44} animationDuration={900}>
                  {data.taskOverview.map((s, i) => (
                    <Cell key={s.name} fill={`url(#dashTask${i})`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Client Growth" subtitle="Active clients over 6 months" className="animate-slide-up min-w-0 rounded-2xl" height={280}>
          <div role="img" aria-label={`Active clients grew from ${data.clientGrowth[0].clients} to ${data.clientGrowth.at(-1).clients}`} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.clientGrowth} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} strokeOpacity={0.6} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
                <YAxis tickLine={false} axisLine={false} tick={axis} allowDecimals={false} domain={['dataMin - 2', 'dataMax + 2']} />
                <RTooltip content={<ChartTooltip />} />
                <Line type="monotone" name="Clients" dataKey="clients" stroke={GREEN} strokeWidth={3} dot={{ r: 4, fill: '#fff', stroke: GREEN, strokeWidth: 2 }} activeDot={{ r: 6, fill: GREEN, stroke: '#fff', strokeWidth: 2 }} animationDuration={900} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Support Tickets" subtitle="Opened vs resolved per month" className="animate-slide-up min-w-0 rounded-2xl md:col-span-2 xl:col-span-1" height={280}>
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1" role="img" aria-label="Support tickets opened versus resolved per month">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.ticketTrend} margin={{ top: 4, right: 8, left: -16, bottom: 0 }} barGap={3}>
                  <defs>
                    <BarGradient id="dashOpened" color={AMBER} />
                    <BarGradient id="dashResolved" color={GREEN} />
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} strokeOpacity={0.6} />
                  <XAxis dataKey="month" tickLine={false} axisLine={false} tick={axis} />
                  <YAxis tickLine={false} axisLine={false} tick={axis} allowDecimals={false} />
                  <RTooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip />} />
                  <Bar name="Opened" dataKey="opened" fill="url(#dashOpened)" radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={900} />
                  <Bar name="Resolved" dataKey="resolved" fill="url(#dashResolved)" radius={[6, 6, 0, 0]} maxBarSize={22} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <ChartLegend items={[{ name: 'Opened', color: AMBER }, { name: 'Resolved', color: GREEN }]} />
          </div>
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <ChartCard title="Employee Workload" subtitle="Open tasks per employee" className="animate-slide-up min-w-0 rounded-2xl" height={300}>
          <div role="img" aria-label={`Open tasks per employee: ${data.employeeWorkload.map((e) => `${e.name} ${e.tasks}`).join(', ')}`} className="h-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.employeeWorkload} layout="vertical" margin={{ left: 0, right: 12, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="dashWorkload" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity={0.6} />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity={1} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={colors.grid} strokeOpacity={0.6} />
                <XAxis type="number" tickLine={false} axisLine={false} tick={axis} allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={104} tickLine={false} axisLine={false} tick={{ ...axis, fontSize: 12 }} />
                <RTooltip cursor={{ fill: colors.cursor }} content={<ChartTooltip />} />
                <Bar name="Open tasks" dataKey="tasks" radius={[0, 8, 8, 0]} fill="url(#dashWorkload)" maxBarSize={22} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <Card className="animate-slide-up min-w-0 rounded-2xl">
          <CardHeader>
            <CardTitle>Upcoming Meetings</CardTitle>
            <Link to="/admin/meetings" className="group inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
              View all <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardHeader>
          <CardBody className="space-y-3">
            {data.meetings.length === 0 && (
              <EmptyState icon={CalendarClock} title="No upcoming meetings" description="Scheduled meetings will show up here." />
            )}
            {data.meetings.map((m, i) => {
              const TypeIcon = TYPE_ICON[m.type] || CalendarClock
              return (
                <div
                  key={m.id}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className="animate-slide-up flex items-start gap-3 rounded-xl border border-ink-100 p-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/40 dark:border-ink-800 dark:hover:bg-ink-800/40"
                >
                  <div className={`flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl ${MEETING_TINT[i % MEETING_TINT.length]}`}>
                    <span className="text-xs font-bold uppercase leading-none">{formatDate(m.date, { day: undefined, year: undefined, month: 'short' })}</span>
                    <span className="mt-0.5 text-base font-bold leading-none">{formatDate(m.date, { month: undefined, year: undefined, day: '2-digit' })}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{m.title}</p>
                    <p className="mt-1 flex min-w-0 items-center gap-1.5 truncate text-xs text-ink-500">
                      <Clock size={12} className="shrink-0" /> <span className="shrink-0">{m.time}</span>
                      <span aria-hidden="true">·</span>
                      <TypeIcon size={12} className="shrink-0" /> <span className="truncate">{m.client}</span>
                    </p>
                  </div>
                </div>
              )
            })}
          </CardBody>
        </Card>

        <Card className="animate-slide-up min-w-0 rounded-2xl">
          <CardHeader>
            <CardTitle>Team Snapshot</CardTitle>
            <Link to="/admin/employees" className="group inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
              View all <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </CardHeader>
          <CardBody className="space-y-4">
            {data.employeeWorkload.slice(0, 5).map((member, i) => (
              <div key={member.name} className="flex items-center gap-3">
                <Avatar name={member.name} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{member.name}</p>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
                    <div
                      className={`h-full rounded-full transition-all duration-700 ${member.tasks >= 4 ? 'bg-gradient-to-r from-warning-300 to-warning-500' : 'bg-gradient-to-r from-brand-300 to-brand-500'}`}
                      style={{ width: `${Math.min(100, member.tasks * 20)}%`, transitionDelay: `${i * 80}ms` }}
                    />
                  </div>
                </div>
                <Badge tone={member.tasks >= 4 ? 'warning' : 'success'}>{member.tasks} open</Badge>
              </div>
            ))}
          </CardBody>
        </Card>
      </div>

      <Card className="animate-slide-up rounded-2xl">
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
          <Link to="/admin/notifications" className="group inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline dark:text-brand-400">
            All updates <ArrowRight size={12} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </CardHeader>
        <CardBody>
          {data.activities.length === 0 ? (
            <EmptyState title="No recent activity" description="Actions your team takes will appear here." />
          ) : (
            <ol className="relative">
              {data.activities.map((a, i) => {
                const KindIcon = KIND_ICONS[a.kind] || Sparkles
                const last = i === data.activities.length - 1
                return (
                  <li key={a.id} className="relative flex items-start gap-3 pb-5 last:pb-0 sm:gap-4">
                    {!last && <span aria-hidden="true" className="absolute left-[19px] top-10 bottom-0 w-px bg-ink-100 dark:bg-ink-800" />}
                    <span className={`relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-4 ${KIND_TINT[a.kind] || KIND_TINT.system}`}>
                      <KindIcon size={16} />
                    </span>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="text-sm text-ink-700 dark:text-ink-200">
                        <span className="font-semibold text-ink-800 dark:text-ink-50">{a.actor}</span> {a.text}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-400">{timeAgo(a.time)}</p>
                    </div>
                    <Badge tone={a.tone} dot className="shrink-0">
                      {a.status}
                    </Badge>
                  </li>
                )
              })}
            </ol>
          )}
        </CardBody>
      </Card>
    </div>
  )
}

function ChartLegend({ items }) {
  return (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
      {items.map((entry) => (
        <li key={entry.name} className="flex items-center gap-1.5 text-ink-500">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: entry.color }} />
          {entry.name}
          {entry.value !== undefined && <span className="font-semibold text-ink-700 dark:text-ink-200">{entry.value}</span>}
        </li>
      ))}
    </ul>
  )
}
