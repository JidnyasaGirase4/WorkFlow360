import { useId } from 'react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import {
  ArrowUpRight,
  CheckCircle2,
  Users,
  Briefcase,
  IndianRupee,
  ListChecks,
  LayoutDashboard,
  Receipt,
  LifeBuoy,
  FileBarChart2,
  Search,
  Bell,
  TrendingUp,
  UserPlus,
} from 'lucide-react'
import { revenueTrend, recentActivities, clientGrowth } from '../../mockData/activities'
import { projects } from '../../mockData/projects'
import { formatCurrency } from '../../utils/format'
import { cn } from '../../utils/cn'
import '../public/public.css'

const chartData = revenueTrend.map((d) => ({ ...d, value: d.revenue }))

const TONE_DOT = {
  brand: 'bg-brand-500',
  success: 'bg-success-500',
  info: 'bg-info-500',
  warning: 'bg-warning-500',
  neutral: 'bg-ink-400',
}

const ACTIVITY_TIMES = ['2m ago', '18m ago', '1h ago', '3h ago']

const PANEL = 'rounded-xl border border-ink-100 bg-white p-3.5 shadow-card dark:border-ink-800 dark:bg-ink-900/60'

const CHIPS = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  info: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300',
}

function PanelTitle({ icon: Icon, tone = 'brand', children, aside }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-ink-500">
        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-lg', CHIPS[tone])}>
          <Icon size={13} />
        </span>
        <span className="truncate">{children}</span>
      </span>
      {aside}
    </div>
  )
}

function RevenueCard({ compact = false }) {
  const gradientId = `rev-${useId().replace(/:/g, '')}`
  return (
    <div className={PANEL}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 text-xs font-medium text-ink-400">
            <span className={cn('flex h-6 w-6 items-center justify-center rounded-lg', CHIPS.success)}>
              <TrendingUp size={13} />
            </span>
            Total Revenue
          </p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-ink-800 dark:text-ink-50">{formatCurrency(1125000, { compact: true })}</p>
        </div>
        <span className="flex items-center gap-1 rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-600 dark:bg-success-500/10 dark:text-success-400">
          <ArrowUpRight size={12} /> 18.2%
        </span>
      </div>
      <div className={cn('mt-2', compact ? 'h-11' : 'h-28')} aria-hidden="true">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <AreaChart data={chartData} margin={{ top: 4, right: 0, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-brand-500)" stopOpacity={0.4} />
                <stop offset="100%" stopColor="var(--color-accent-400)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <Area type="monotone" dataKey="value" stroke="var(--color-brand-500)" strokeWidth={2.5} fill={`url(#${gradientId})`} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-1 flex justify-between text-[10px] font-medium text-ink-400" aria-hidden="true">
        {revenueTrend.map((d) => (
          <span key={d.month}>{d.month}</span>
        ))}
      </div>
    </div>
  )
}

function ProjectsCard({ limit = 3, compact = false }) {
  const active = projects.filter((p) => p.status === 'active').slice(0, limit)
  const bars = ['from-brand-400 to-brand-600', 'from-accent-400 to-accent-500', 'from-warning-300 to-warning-500']
  return (
    <div className={PANEL}>
      <PanelTitle icon={Briefcase} tone="brand" aside={<span className="text-lg font-bold text-ink-800 dark:text-ink-50">18</span>}>
        Active Projects
      </PanelTitle>
      <ul className={cn(compact ? 'mt-2 space-y-2' : 'mt-3 space-y-2.5')}>
        {active.map((p, i) => (
          <li key={p.id}>
            <div className="flex items-center justify-between gap-2 text-[11px] text-ink-500">
              <span className="truncate">{p.name}</span>
              <span className="font-semibold text-ink-700 dark:text-ink-200">{p.progress}%</span>
            </div>
            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
              <div className={cn('h-full rounded-full bg-gradient-to-r', bars[i % bars.length])} style={{ width: `${p.progress}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TaskProgress() {
  const value = 72
  const radius = 26
  const circumference = 2 * Math.PI * radius
  return (
    <div className={PANEL}>
      <PanelTitle icon={ListChecks} tone="accent">Task Progress</PanelTitle>
      <div className="mt-2.5 flex items-center gap-3">
        <div className="relative h-[68px] w-[68px] shrink-0">
          <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" role="img" aria-label={`${value}% of tasks complete`}>
            <circle cx="32" cy="32" r={radius} fill="none" strokeWidth="7" className="stroke-ink-100 dark:stroke-ink-800" />
            <circle
              cx="32"
              cy="32"
              r={radius}
              fill="none"
              strokeWidth="7"
              strokeLinecap="round"
              stroke="var(--color-accent-500)"
              strokeDasharray={circumference}
              strokeDashoffset={circumference * (1 - value / 100)}
            />
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-ink-800 dark:text-ink-50">{value}%</span>
        </div>
        <ul className="space-y-1 text-[11px] text-ink-500">
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent-500" /> 36 done</li>
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-warning-500" /> 9 in progress</li>
          <li className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-ink-300" /> 5 to do</li>
        </ul>
      </div>
    </div>
  )
}

function ClientActivity({ compact = false }) {
  const max = Math.max(...clientGrowth.map((d) => d.clients))
  return (
    <div className={PANEL}>
      <PanelTitle icon={Users} tone="info" aside={<span className="text-lg font-bold text-ink-800 dark:text-ink-50">16</span>}>
        Client Activity
      </PanelTitle>
      <div className={cn('flex items-end gap-1.5', compact ? 'mt-2 h-8' : 'mt-3 h-12')} aria-hidden="true">
        {clientGrowth.map((d, i) => (
          <span
            key={d.month}
            className={cn('flex-1 rounded-t', i === clientGrowth.length - 1 ? 'gradient-brand' : 'bg-brand-100 dark:bg-brand-500/30')}
            style={{ height: `${(d.clients / max) * 100}%` }}
          />
        ))}
      </div>
      <p className="mt-2 text-[11px] text-ink-500">
        <span className="font-semibold text-success-600 dark:text-success-400">+2 new</span> clients this month
      </p>
    </div>
  )
}

function RecentActivities({ count = 3 }) {
  return (
    <div className={PANEL}>
      <p className="text-xs font-medium text-ink-500">Recent Activities</p>
      <ul className="mt-2.5 space-y-2.5">
        {recentActivities.slice(0, count).map((a, i) => (
          <li key={a.id} className="flex items-start gap-2">
            <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE_DOT[a.tone] || TONE_DOT.neutral)} />
            <p className="min-w-0 flex-1 text-[11px] leading-snug text-ink-500">
              <span className="font-semibold text-ink-700 dark:text-ink-200">{a.actor}</span> {a.text}
              <span className="ml-1 text-ink-400">· {ACTIVITY_TIMES[i]}</span>
            </p>
          </li>
        ))}
      </ul>
    </div>
  )
}

function FloatingChip({ icon: Icon, tone, title, subtitle, className, delayed, visibility = 'hidden sm:flex' }) {
  return (
    <div
      className={cn(
        'absolute items-center gap-2.5 rounded-2xl border border-white/70 bg-white/95 px-3.5 py-2.5 shadow-panel backdrop-blur-sm dark:border-ink-700 dark:bg-ink-900/95',
        visibility,
        delayed ? 'wf-float-delay' : 'wf-float',
        className
      )}
    >
      <span className={cn('flex h-8 w-8 items-center justify-center rounded-xl', tone)}>
        <Icon size={16} />
      </span>
      <div>
        <p className="text-xs font-semibold text-ink-800 dark:text-ink-100">{title}</p>
        <p className="text-[11px] text-ink-400">{subtitle}</p>
      </div>
    </div>
  )
}

const SIDEBAR = [
  { icon: LayoutDashboard, label: 'Dashboard', active: true },
  { icon: Users, label: 'CRM' },
  { icon: Briefcase, label: 'Projects' },
  { icon: ListChecks, label: 'Tasks' },
  { icon: Receipt, label: 'Billing' },
  { icon: LifeBuoy, label: 'Support' },
  { icon: FileBarChart2, label: 'Reports' },
]

function BrowserBar({ url }) {
  return (
    <div className="flex items-center gap-3 border-b border-ink-100 bg-ink-50 px-4 py-2.5 dark:border-ink-800 dark:bg-ink-950">
      <div className="flex gap-1.5" aria-hidden="true">
        <span className="h-2.5 w-2.5 rounded-full bg-danger-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-warning-300" />
        <span className="h-2.5 w-2.5 rounded-full bg-success-300" />
      </div>
      <div className="mx-auto min-w-0 max-w-xs flex-1 truncate rounded-md bg-white px-3 py-1 text-center text-[11px] text-ink-400 dark:bg-ink-900">
        {url}
      </div>
      <span className="w-[42px] shrink-0" aria-hidden="true" />
    </div>
  )
}

const KPIS = [
  { label: 'Revenue', value: '₹11.3L', delta: '+18.2%', icon: IndianRupee, tone: 'success' },
  { label: 'Active Projects', value: '18', delta: '+3', icon: Briefcase, tone: 'brand' },
  { label: 'Open Tasks', value: '42', delta: '-6', icon: ListChecks, tone: 'accent' },
  { label: 'Active Clients', value: '16', delta: '+2', icon: Users, tone: 'info' },
]

function FullPreview() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-4 rounded-[2rem] bg-gradient-to-br from-brand-200/50 via-transparent to-accent-200/50 blur-2xl dark:from-brand-500/10 dark:to-accent-500/10" aria-hidden="true" />
      <div className="relative overflow-hidden rounded-2xl border border-ink-200 bg-white shadow-panel dark:border-ink-800 dark:bg-ink-900">
        <BrowserBar url="app.workflow360.in/admin/dashboard" />
        <div className="flex">
          <aside className="hidden w-44 shrink-0 border-r border-ink-100 p-3 md:block dark:border-ink-800">
            <ul className="space-y-1">
              {SIDEBAR.map((item) => (
                <li
                  key={item.label}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium',
                    item.active ? 'gradient-brand text-white shadow-glow' : 'text-ink-500'
                  )}
                >
                  <item.icon size={14} /> {item.label}
                </li>
              ))}
            </ul>
          </aside>
          <div className="min-w-0 flex-1 bg-gradient-to-br from-brand-50/50 via-ink-50/50 to-accent-50/40 p-3 dark:from-transparent dark:via-transparent dark:to-transparent sm:p-3 dark:bg-ink-950/40">
            <div className="mb-2.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-ink-800 dark:text-ink-50">Good morning, Jidnyasa</p>
                <p className="truncate text-[11px] text-ink-400">Here is what is happening across TechNova Solutions today.</p>
              </div>
              <div className="hidden items-center gap-2 text-ink-400 sm:flex" aria-hidden="true">
                <span className="flex h-7 items-center gap-2 rounded-lg border border-ink-200 bg-white px-2.5 text-[11px] dark:border-ink-700 dark:bg-ink-900">
                  <Search size={12} /> Search
                </span>
                <Bell size={15} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {KPIS.map((k) => (
                <div key={k.label} className="flex items-center gap-2.5 rounded-xl border border-ink-100 bg-white px-3 py-2 shadow-card dark:border-ink-800 dark:bg-ink-900/60">
                  <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', CHIPS[k.tone])}>
                    <k.icon size={15} />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-ink-400">{k.label}</p>
                    <p className="flex items-baseline gap-1.5 text-base font-bold leading-tight text-ink-800 dark:text-ink-50">
                      {k.value}
                      <span className="text-[11px] font-semibold text-success-600 dark:text-success-400">{k.delta}</span>
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 lg:grid-cols-3">
              <div className="lg:col-span-2">
                <RevenueCard compact />
              </div>
              <TaskProgress />
            </div>
            <div className="mt-2.5 grid grid-cols-1 gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
              <ProjectsCard limit={2} compact />
              <ClientActivity compact />
              <RecentActivities count={2} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function DashboardPreview({ variant = 'hero' }) {
  if (variant === 'full') return <FullPreview />

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="pointer-events-none absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-300/40 via-accent-200/30 to-info-200/30 blur-3xl dark:from-brand-500/15 dark:to-accent-500/10" aria-hidden="true" />
      <div className="wf-float relative">
        <div className="animate-slide-up overflow-hidden rounded-2xl border border-ink-200/80 bg-white shadow-panel dark:border-ink-800 dark:bg-ink-900">
          <BrowserBar url="app.workflow360.in/dashboard" />
          <div className="space-y-2.5 bg-gradient-to-b from-brand-50/40 to-accent-50/30 p-3 dark:from-transparent dark:to-transparent">
            <RevenueCard compact />
            <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
              <ProjectsCard limit={2} compact />
              <TaskProgress />
            </div>
            <div className="grid grid-cols-1 gap-2.5 min-[420px]:grid-cols-2">
              <ClientActivity compact />
              <RecentActivities count={2} />
            </div>
          </div>
        </div>
      </div>

      <FloatingChip
        icon={CheckCircle2}
        tone="bg-success-50 text-success-600 dark:bg-success-500/15"
        title="Invoice Paid"
        subtitle="₹2,50,000 · BrightPixel"
        className="-left-3 -top-5 lg:-left-8"
      />
      <FloatingChip
        icon={UserPlus}
        tone="bg-accent-50 text-accent-600 dark:bg-accent-500/15"
        title="New Client Added"
        subtitle="Meridian Retail Pvt Ltd"
        className="-bottom-6 -right-3 lg:-right-4"
        delayed
      />
      <FloatingChip
        icon={ListChecks}
        tone="bg-info-50 text-info-600 dark:bg-info-500/15"
        title="72% tasks done"
        subtitle="Website Redesign"
        className="-right-3 top-16 lg:-right-4"
        visibility="hidden xl:flex"
      />
    </div>
  )
}
