import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CheckCircle2,
  Receipt,
  Wallet,
  LifeBuoy,
  CalendarClock,
  Video,
  Phone,
  MapPin,
  Plus,
  Building2,
  Activity,
  FolderKanban,
  BadgeCheck,
  Hourglass,
  ChevronRight,
} from 'lucide-react'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import ActivityTimeline from '../../components/common/ActivityTimeline'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard, SkeletonChart, SkeletonText } from '../../components/common/Skeleton'
import { Panel, PanelHeader, PanelBody, PanelLink } from '../../components/portal/Panel'
import PortalStat from '../../components/portal/PortalStat'
import WelcomeBanner from '../../components/portal/WelcomeBanner'
import AnimatedBar from '../../components/portal/AnimatedBar'
import IconChip from '../../components/portal/IconChip'
import { toneOf, stagger, ROTATION } from '../../components/portal/tones'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { clientProjectUpdates } from '../../mockData/clientPortal'
import { TODAY } from '../../mockData/reference'
import { formatCurrency, formatDate, formatClockString } from '../../utils/format'
import { cn } from '../../utils/cn'

const TYPE_ICON = { 'Video Call': Video, 'Phone Call': Phone, 'In Person': MapPin }
const TYPE_TONE = { 'Video Call': 'brand', 'Phone Call': 'info', 'In Person': 'accent' }
const rupees = (v) => Math.round(v).toLocaleString('en-IN')

function DashboardSkeleton() {
  return (
    <div className="space-y-6 lg:space-y-8" role="status" aria-busy="true" aria-label="Loading dashboard">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-6">
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <SkeletonChart className="lg:col-span-2" height="h-40" />
        <SkeletonCard lines={3} />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
        <Panel className="p-4 sm:p-5 lg:col-span-2">
          <Skeleton className="mb-4 h-4 w-32" />
          <SkeletonText lines={5} />
        </Panel>
        <SkeletonCard lines={3} />
      </div>
    </div>
  )
}

export default function ClientDashboard() {
  const { isLoading, isError, retry } = usePortalLoad()
  const data = useClientData()
  const { client, company, projects, invoices, payments, tickets, meetings } = data

  const {
    activeProjects,
    completedProjects,
    pendingAmount,
    paidAmount,
    openTickets,
    upcomingMeetings,
    pendingInvoices,
    recentUpdates,
  } = useMemo(() => {
    const pending = invoices.filter((i) => i.balance > 0)
    const updates = [
      ...projects.flatMap((p) => (clientProjectUpdates[p.id] || []).map((u) => ({ ...u, id: `${p.id}-${u.id}`, text: `${u.text} (${p.name})` }))),
      ...tickets.map((t) => {
        const last = t.messages[t.messages.length - 1]
        return {
          id: `tkt-${t.id}`,
          actor: last?.from,
          text: `${last?.role === 'employee' ? 'replied on' : 'updated'} ticket ${t.ticketId} - ${t.subject}`,
          time: last?.time || `${t.createdDate}T10:00:00`,
          tone: t.status === 'resolved' || t.status === 'closed' ? 'success' : 'brand',
        }
      }),
      ...payments.map((p) => ({
        id: `pay-${p.id}`,
        actor: 'Accounts',
        text: `${p.status === 'pending' ? 'logged a pending payment of' : 'recorded payment of'} ${formatCurrency(p.amount)} against ${p.invoice}`,
        time: `${p.date}T17:10:00`,
        tone: p.status === 'pending' ? 'warning' : 'success',
      })),
    ]
    return {
      activeProjects: projects.filter((p) => p.status === 'active'),
      completedProjects: projects.filter((p) => p.status === 'completed').length,
      pendingAmount: pending.reduce((sum, i) => sum + i.balance, 0),
      paidAmount: invoices.reduce((sum, i) => sum + i.paid, 0),
      openTickets: tickets.filter((t) => !['resolved', 'closed'].includes(t.status)),
      upcomingMeetings: meetings.filter((m) => m.status === 'upcoming').sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`)).slice(0, 3),
      pendingInvoices: pending,
      recentUpdates: updates.sort((a, b) => b.time.localeCompare(a.time)).slice(0, 6),
    }
  }, [projects, invoices, payments, tickets, meetings])

  const statCards = [
    { icon: Briefcase, label: 'Active Projects', value: activeProjects.length, tone: 'brand' },
    { icon: CheckCircle2, label: 'Completed Projects', value: completedProjects, tone: 'success' },
    { icon: Receipt, label: 'Pending Invoices', value: pendingAmount, tone: 'warning', prefix: '₹', format: rupees },
    { icon: Wallet, label: 'Paid Invoices', value: paidAmount, tone: 'info', prefix: '₹', format: rupees },
    { icon: LifeBuoy, label: 'Open Tickets', value: openTickets.length, tone: 'danger' },
    { icon: CalendarClock, label: 'Upcoming Meetings', value: upcomingMeetings.length, tone: 'accent' },
  ]

  const firstName = (data.user?.name || client?.contactPerson || 'there').split(' ')[0]

  return (
    <div className="space-y-6 lg:space-y-8">
      <WelcomeBanner
        icon={Building2}
        eyebrow={company || 'Client portal'}
        title={`Welcome back, ${firstName}`}
        description={company ? `Here's what's happening with ${company} on WorkFlow360.` : 'Here is your workspace overview.'}
        action={
          <Button as={Link} to="/client/tickets" state={{ openCreate: true }} leftIcon={<Plus size={16} />}>
            New Support Ticket
          </Button>
        }
      >
        {!isLoading && !isError && client && (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-warning-50 px-3 py-1 text-xs font-semibold text-warning-700 ring-1 ring-warning-200 dark:bg-warning-500/15 dark:text-warning-300 dark:ring-warning-500/30">
              <Hourglass size={13} /> ₹{rupees(pendingAmount)} pending
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-50 px-3 py-1 text-xs font-semibold text-success-700 ring-1 ring-success-200 dark:bg-success-500/15 dark:text-success-300 dark:ring-success-500/30">
              <BadgeCheck size={13} /> ₹{rupees(paidAmount)} paid
            </span>
          </>
        )}
      </WelcomeBanner>

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<DashboardSkeleton />}>
        {!client ? (
          <Panel>
            <EmptyState icon={Building2} title="No company profile linked" description="Your account is not linked to a client record yet. Contact your account manager at WorkFlow360." />
          </Panel>
        ) : (
          <div className="space-y-6 lg:space-y-8">
            <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-3 2xl:grid-cols-6">
              {statCards.map((card, i) => (
                <PortalStat key={card.label} index={i} {...card} />
              ))}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
              <Panel className="lg:col-span-2">
                <PanelHeader icon={FolderKanban} tone="brand" title="Project Progress" action={<PanelLink to="/client/projects">View all</PanelLink>} />
                <PanelBody className="space-y-3">
                  {projects.length === 0 && <p className="text-sm text-ink-500">Projects delivered for your company will appear here.</p>}
                  {projects.map((p, i) => {
                    const tone = ROTATION[i % ROTATION.length]
                    return (
                      <Link
                        key={p.id}
                        to={`/client/projects/${p.id}`}
                        style={stagger(i, 60)}
                        className="focus-ring group animate-slide-up block rounded-xl border border-ink-100 p-3.5 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-card dark:border-ink-800 dark:hover:bg-ink-800/40 sm:p-4"
                      >
                        <div className="flex items-start gap-3">
                          <IconChip icon={Briefcase} tone={tone} size="sm" className="group-hover:scale-110" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{p.name}</p>
                            <p className="truncate text-xs text-ink-500">
                              Manager: {p.manager} · Due {formatDate(p.deadline)}
                            </p>
                          </div>
                          <StatusBadge status={p.status} />
                        </div>
                        <AnimatedBar value={p.progress} tone={tone} showValue label="Progress" className="mt-3" />
                      </Link>
                    )
                  })}
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader icon={CalendarClock} tone="accent" title="Upcoming Meetings" action={<PanelLink to="/client/meetings">View all</PanelLink>} />
                <PanelBody className="space-y-3">
                  {upcomingMeetings.length === 0 && <p className="text-sm text-ink-500">No upcoming meetings scheduled.</p>}
                  {upcomingMeetings.map((m, i) => {
                    const Icon = TYPE_ICON[m.type] || CalendarClock
                    const tone = toneOf(TYPE_TONE[m.type] || 'brand')
                    return (
                      <div
                        key={m.id}
                        style={stagger(i, 60)}
                        className="animate-slide-up flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/40"
                      >
                        <span className={cn('flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl', tone.chip)}>
                          <span className="text-xs font-bold uppercase leading-none">{formatDate(m.date, { month: 'short', year: undefined, day: undefined })}</span>
                          <span className="mt-0.5 text-base font-bold leading-none">{formatDate(m.date, { day: '2-digit', month: undefined, year: undefined })}</span>
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{m.title}</p>
                          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-ink-500">
                            <Icon size={12} className={cn('shrink-0', tone.text)} /> {formatClockString(m.time)} · {m.type}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </PanelBody>
              </Panel>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:items-start lg:gap-6">
              <Panel>
                <PanelHeader icon={Receipt} tone="warning" title="Pending Invoices" action={<PanelLink to="/client/invoices">View all</PanelLink>} />
                <PanelBody className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="min-w-0 rounded-xl bg-warning-50 px-3 py-2.5 dark:bg-warning-500/10">
                      <p className="flex items-center gap-1 text-xs font-semibold text-warning-700 dark:text-warning-300">
                        <Hourglass size={12} /> Pending
                      </p>
                      <p className="mt-0.5 truncate text-base font-bold tabular-nums text-ink-800 dark:text-ink-50">{formatCurrency(pendingAmount)}</p>
                    </div>
                    <div className="min-w-0 rounded-xl bg-success-50 px-3 py-2.5 dark:bg-success-500/10">
                      <p className="flex items-center gap-1 text-xs font-semibold text-success-700 dark:text-success-300">
                        <BadgeCheck size={12} /> Paid
                      </p>
                      <p className="mt-0.5 truncate text-base font-bold tabular-nums text-ink-800 dark:text-ink-50">{formatCurrency(paidAmount)}</p>
                    </div>
                  </div>
                  {pendingInvoices.length === 0 && <p className="text-sm text-ink-500">You have no pending invoices. Thank you!</p>}
                  {pendingInvoices.map((i, idx) => (
                    <div
                      key={i.id}
                      style={stagger(idx, 50)}
                      className="animate-slide-up relative overflow-hidden rounded-xl border border-ink-100 p-3 pl-4 dark:border-ink-800"
                    >
                      <span className={cn('absolute inset-y-0 left-0 w-1', i.dueDate < TODAY && i.status !== 'paid' ? 'bg-danger-500' : 'bg-warning-500')} aria-hidden="true" />
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{i.number}</p>
                        <StatusBadge status={i.dueDate < TODAY && i.status !== 'paid' ? 'overdue' : i.status} />
                      </div>
                      <p className="mt-1 text-lg font-bold tabular-nums text-ink-900 dark:text-white">{formatCurrency(i.balance)}</p>
                      <p className="text-xs text-ink-500">Due {formatDate(i.dueDate)}</p>
                    </div>
                  ))}
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader icon={LifeBuoy} tone="danger" title="Open Tickets" action={<PanelLink to="/client/tickets">View all</PanelLink>} />
                <PanelBody className="space-y-3">
                  {openTickets.length === 0 && <p className="text-sm text-ink-500">No open tickets. Everything is resolved.</p>}
                  {openTickets.map((t, i) => (
                    <Link
                      key={t.id}
                      to={`/client/tickets/${t.id}`}
                      style={stagger(i, 50)}
                      className="focus-ring group animate-slide-up block rounded-xl border border-ink-100 p-3 transition-all hover:-translate-y-0.5 hover:border-brand-200 hover:bg-brand-50/40 dark:border-ink-800 dark:hover:bg-ink-800/40"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-ink-500">{t.ticketId}</span>
                        <StatusBadge status={t.status} />
                      </div>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <p className="min-w-0 text-sm font-semibold text-ink-800 dark:text-ink-100">{t.subject}</p>
                        <ChevronRight size={16} className="shrink-0 text-ink-300 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                      </div>
                    </Link>
                  ))}
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHeader icon={Activity} tone="info" title="Recent Updates" />
                <PanelBody>{recentUpdates.length === 0 ? <p className="text-sm text-ink-500">No recent activity to show yet.</p> : <ActivityTimeline items={recentUpdates} />}</PanelBody>
              </Panel>
            </div>
          </div>
        )}
      </AsyncState>
    </div>
  )
}
