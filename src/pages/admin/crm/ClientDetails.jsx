import { useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Mail, Phone, MapPin, Pencil, IndianRupee, Briefcase, Receipt, Calendar, Plus, CalendarPlus, FileText, Folder,
  CreditCard, LifeBuoy, Users, Video, Activity as ActivityIcon, Building2, Factory,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ClientFormModal from '../../../components/business/ClientFormModal'
import ContactFormModal from '../../../components/business/ContactFormModal'
import LogActivityModal from '../../../components/business/LogActivityModal'
import ScheduleMeetingModal from '../../../components/business/ScheduleMeetingModal'
import DetailSkeleton from '../../../components/business/DetailSkeleton'
import InfoRow from '../../../components/business/InfoRow'
import ClientAvatar from '../../../components/business/ClientAvatar'
import ProjectKpi from '../../../components/business/ProjectKpi'
import { TONES } from '../../../components/business/ProjectTones'
import { cn } from '../../../utils/cn'
import Card, { CardHeader, CardTitle, CardBody } from '../../../components/common/Card'
import Button from '../../../components/common/Button'
import Tabs from '../../../components/common/Tabs'
import Badge from '../../../components/common/Badge'
import StatusBadge from '../../../components/common/StatusBadge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { clientService } from '../../../services/clientService'
import { projectService } from '../../../services/projectService'
import { invoiceService } from '../../../services/invoiceService'
import { paymentService } from '../../../services/paymentService'
import { ticketService } from '../../../services/ticketService'
import { meetingService } from '../../../services/meetingService'
import { documentService } from '../../../services/documentService'
import { contactService } from '../../../services/contactService'
import { crmActivityService } from '../../../services/crmActivityService'
import { employeeService } from '../../../services/employeeService'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { useToast } from '../../../context/ToastContext'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format'
import { ACTIVITY_TYPE_CONFIG, ACTIVITY_DEFAULT_OUTCOME, newId } from '../../../utils/workspace'

export default function ClientDetails() {
  const { id } = useParams()
  return <ClientDetailsInner key={id} id={id} />
}

function Row({ children, to }) {
  const cls = 'flex flex-wrap items-center justify-between gap-3 rounded-xl border border-ink-100 p-3.5 dark:border-ink-800'
  return to ? (
    <Link to={to} className={`${cls} focus-ring transition-all duration-200 hover:-translate-y-px hover:border-brand-200 hover:bg-brand-50/40 hover:shadow-card dark:hover:bg-ink-800/40`}>{children}</Link>
  ) : (
    <div className={cls}>{children}</div>
  )
}

function ClientDetailsInner({ id }) {
  const navigate = useNavigate()
  const { toast } = useToast()

  const load = useCallback(
    () =>
      Promise.all([
        clientService.get(id),
        projectService.list(),
        invoiceService.list(),
        paymentService.list(),
        ticketService.list(),
        meetingService.list(),
        documentService.list(),
        contactService.list(),
        crmActivityService.list(),
        employeeService.list(),
      ]).then(([client, projects, invoices, payments, tickets, meetings, documents, contacts, activities, employees]) => ({
        client,
        projects: projects.filter((p) => p.clientId === id),
        invoices: invoices.filter((i) => i.clientId === id),
        payments: payments.filter((p) => p.client === client.company),
        tickets: tickets.filter((t) => t.client === client.company),
        meetings: meetings.filter((m) => m.client === client.company),
        documents: documents.filter((d) => d.client === client.company),
        contacts: contacts.filter((c) => c.clientId === id),
        activities: activities.filter((a) => a.clientId === id || a.company === client.company),
        employees,
      })),
    [id]
  )
  const { data, isLoading, isError, error, retry, setData } = useMockQuery(load)

  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [contactOpen, setContactOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const client = data?.client
  const owners = useMemo(() => (data?.employees ?? []).map((e) => e.name), [data])

  const outstandingInvoices = useMemo(
    () => (data?.invoices ?? []).filter((i) => i.balance > 0 && !['draft', 'cancelled', 'paid'].includes(i.status)),
    [data]
  )
  const recentActivities = useMemo(
    () => [...(data?.activities ?? [])].sort((a, b) => b.date.localeCompare(a.date)),
    [data]
  )
  const sortedMeetings = useMemo(
    () => [...(data?.meetings ?? [])].sort((a, b) => `${b.date}${b.time}`.localeCompare(`${a.date}${a.time}`)),
    [data]
  )

  if (isLoading) return <DetailSkeleton label="Loading client" />
  if (isError) {
    if (error?.code === 'NOT_FOUND') {
      return (
        <EmptyState
          title="Client not found"
          description="This client may have been removed."
          actionLabel="Back to Clients"
          onAction={() => navigate('/admin/crm/clients')}
        />
      )
    }
    return <ErrorState title="Couldn't load this client" onRetry={retry} />
  }

  const { projects, invoices, payments, tickets, documents, contacts } = data
  const activeProjects = projects.filter((p) => p.status === 'active' || p.status === 'planning')

  async function handleEdit(values) {
    setBusy(true)
    try {
      const updated = await clientService.update(id, values)
      setData((prev) => ({ ...prev, client: updated }))
      toast.success(`${values.company} updated successfully`)
      setEditOpen(false)
    } catch {
      toast.error('Could not update the client. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddContact(values) {
    setBusy(true)
    try {
      const created = await contactService.create({ id: newId('ct'), ...values, clientId: id, company: client.company })
      setData((prev) => ({ ...prev, contacts: [created, ...prev.contacts] }))
      toast.success(`${values.name} added to ${client.company}`)
      setContactOpen(false)
    } catch {
      toast.error('Could not add the contact. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddActivity(values) {
    setBusy(true)
    try {
      const created = await crmActivityService.create({
        id: newId('crm-act'),
        type: values.type,
        subject: values.subject,
        notes: values.notes,
        contact: client.contactPerson,
        company: client.company,
        leadId: null,
        clientId: id,
        owner: values.owner,
        date: `${values.date}T${values.time}:00`,
        outcome: ACTIVITY_DEFAULT_OUTCOME[values.type],
      })
      const updated = await clientService.update(id, { lastActivity: created.date })
      setData((prev) => ({ ...prev, client: updated, activities: [created, ...prev.activities] }))
      toast.success(`${ACTIVITY_TYPE_CONFIG[values.type].label} logged for ${client.company}`)
      setActivityOpen(false)
    } catch {
      toast.error('Could not log the activity. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleScheduleMeeting(values) {
    setBusy(true)
    try {
      const meeting = await meetingService.create({
        id: newId('mtg'),
        title: values.title,
        client: client.company,
        project: null,
        date: values.date,
        time: values.time,
        type: values.type,
        link: values.type === 'Video Call' ? values.link || `https://meet.workflow360.app/${id}-${values.date}` : null,
        participants: [values.host, client.contactPerson],
        status: 'upcoming',
        notes: values.notes,
      })
      setData((prev) => ({ ...prev, meetings: [meeting, ...prev.meetings] }))
      toast.success(`Meeting scheduled for ${formatDate(values.date)} at ${values.time}`)
      setMeetingOpen(false)
    } catch {
      toast.error('Could not schedule the meeting. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'projects', label: 'Projects', count: projects.length },
    { value: 'contacts', label: 'Contacts', count: contacts.length },
    { value: 'documents', label: 'Documents', count: documents.length },
    { value: 'invoices', label: 'Invoices', count: invoices.length },
    { value: 'payments', label: 'Payments', count: payments.length },
    { value: 'tickets', label: 'Tickets', count: tickets.length },
    { value: 'meetings', label: 'Meetings', count: sortedMeetings.length },
    { value: 'activity', label: 'Activity', count: recentActivities.length },
  ]

  return (
    <div>
      <PageHeader
        title={client.company}
        description={[client.industry, client.city].filter(Boolean).join(' · ') || undefined}
        breadcrumbItems={[{ label: 'CRM' }, { label: 'Clients', href: '/admin/crm/clients' }, { label: client.company }]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<CalendarPlus size={15} />} onClick={() => setMeetingOpen(true)}>Schedule Meeting</Button>
            <Button leftIcon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>Edit Client</Button>
          </div>
        }
      />

      <div className="mb-6 overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card lg:mb-8 dark:border-ink-800 dark:bg-ink-900">
        <div className="relative h-20 overflow-hidden bg-gradient-to-r from-brand-500 via-brand-400 to-accent-400 sm:h-28">
          <span aria-hidden="true" className="absolute -right-6 -top-10 h-40 w-40 rounded-full bg-white/15" />
          <span aria-hidden="true" className="absolute -bottom-12 right-24 h-28 w-28 rounded-full bg-white/10" />
        </div>
        <div className="px-4 pb-5 sm:px-6">
          <div className="-mt-9 flex flex-col gap-4 sm:-mt-10 sm:flex-row sm:items-end">
            <ClientAvatar name={client.company} size="xl" className="relative z-10 !ring-4" />
            <div className="min-w-0 flex-1 sm:pb-1">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={client.status} />
                {client.industry && (
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', TONES.info.chip)}>
                    <Factory size={12} aria-hidden="true" /> {client.industry}
                  </span>
                )}
                {client.city && (
                  <span className={cn('inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium', TONES.accent.chip)}>
                    <MapPin size={12} aria-hidden="true" /> {client.city}
                  </span>
                )}
              </div>
              <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-ink-500">
                <span className="inline-flex min-w-0 items-center gap-1.5"><Users size={14} aria-hidden="true" className="shrink-0 text-brand-500" /> <span className="truncate">{client.contactPerson}</span></span>
                <span className="inline-flex min-w-0 items-center gap-1.5"><Mail size={14} aria-hidden="true" className="shrink-0 text-brand-500" /> <span className="truncate">{client.email}</span></span>
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 lg:mb-8 lg:grid-cols-4 lg:gap-6">
        <ProjectKpi index={0} icon={IndianRupee} label="Total Revenue" value={formatCurrency(client.revenue)} tone="brand" />
        <ProjectKpi index={1} icon={Receipt} label="Outstanding" value={formatCurrency(client.outstanding)} tone="warning" />
        <ProjectKpi index={2} icon={Briefcase} label="Active Projects" value={activeProjects.length} tone="success" />
        <ProjectKpi index={3} icon={Calendar} label="Client Since" value={formatDate(client.since)} tone="info" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 lg:col-span-2">
          <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-4 sm:mb-5" />

          {tab === 'overview' && (
            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Company Information</CardTitle>
                  <StatusBadge status={client.status} />
                </CardHeader>
                <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
                  <InfoRow icon={Building2} label="Company" value={client.company} tone="brand" />
                  <InfoRow icon={Factory} label="Industry" value={client.industry} tone="info" />
                  <InfoRow icon={MapPin} label="City" value={client.city} tone="accent" />
                  <InfoRow icon={Calendar} label="Client since" value={formatDate(client.since)} tone="warning" />
                  <InfoRow icon={Mail} label="Email" tone="success">
                    <a href={`mailto:${client.email}`} className="focus-ring break-all rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">{client.email}</a>
                  </InfoRow>
                  <InfoRow icon={Phone} label="Phone" value={client.phone} tone="accent" />
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Outstanding Invoices</CardTitle>
                  <span className="rounded-full bg-warning-50 px-2.5 py-1 text-sm font-bold text-warning-700 dark:bg-warning-500/10 dark:text-warning-300">{formatCurrency(client.outstanding)}</span>
                </CardHeader>
                <CardBody className="space-y-2.5">
                  {outstandingInvoices.length === 0 ? (
                    <EmptyState icon={Receipt} title="No outstanding invoices" description="This client has no pending balance." className="py-6" />
                  ) : (
                    outstandingInvoices.map((i) => (
                      <Row key={i.id} to={`/admin/billing/invoices/${i.id}`}>
                        <div>
                          <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{i.number}</p>
                          <p className="text-xs text-ink-400">Due {formatDate(i.dueDate)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <StatusBadge status={i.status} />
                          <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">{formatCurrency(i.balance)}</span>
                        </div>
                      </Row>
                    ))
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Active Projects</CardTitle>
                  <button type="button" onClick={() => setTab('projects')} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">View all</button>
                </CardHeader>
                <CardBody className="space-y-2.5">
                  {activeProjects.length === 0 ? (
                    <EmptyState icon={Briefcase} title="No active projects" description="Active and planned projects will show up here." className="py-6" />
                  ) : (
                    activeProjects.map((p) => (
                      <Row key={p.id} to={`/admin/projects/${p.id}`}>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{p.name}</p>
                          <p className="text-xs text-ink-400">{p.progress}% complete · due {formatDate(p.deadline)}</p>
                        </div>
                        <StatusBadge status={p.status} />
                      </Row>
                    ))
                  )}
                </CardBody>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <button type="button" onClick={() => setTab('activity')} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">View all</button>
                </CardHeader>
                <CardBody>
                  {recentActivities.length === 0 ? (
                    <EmptyState icon={ActivityIcon} title="No activity yet" description="Calls, emails and meetings with this client will appear here." className="py-6" />
                  ) : (
                    <ul className="space-y-3">
                      {recentActivities.slice(0, 3).map((a) => (
                        <ActivityRow key={a.id} activity={a} />
                      ))}
                    </ul>
                  )}
                </CardBody>
              </Card>
            </div>
          )}

          {tab === 'projects' && (
            <Card>
              <CardBody className="space-y-2.5">
                {projects.length === 0 && <EmptyState icon={Briefcase} title="No projects yet" description="Projects for this client will appear here." />}
                {projects.map((p) => (
                  <Row key={p.id} to={`/admin/projects/${p.id}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{p.name}</p>
                      <p className="text-xs text-ink-400">Manager: {p.manager} · {p.progress}% complete · Budget {formatCurrency(p.budget, { compact: true })}</p>
                    </div>
                    <StatusBadge status={p.status} />
                  </Row>
                ))}
              </CardBody>
            </Card>
          )}

          {tab === 'contacts' && (
            <Card>
              <CardHeader>
                <CardTitle>People at {client.company}</CardTitle>
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setContactOpen(true)}>Add Contact</Button>
              </CardHeader>
              <CardBody className="space-y-2.5">
                {contacts.length === 0 && <EmptyState icon={Users} title="No contacts yet" description="Add the people you work with at this company." actionLabel="Add Contact" onAction={() => setContactOpen(true)} />}
                {contacts.map((c) => (
                  <Row key={c.id}>
                    <div className="flex items-center gap-3">
                      <ClientAvatar name={c.name} />
                      <div>
                        <p className="text-sm font-medium text-ink-800 dark:text-ink-100">
                          {c.name} {c.email === client.email && <Badge tone="brand" className="ml-1">Primary</Badge>}
                        </p>
                        <p className="text-xs text-ink-400">{c.role || 'No designation'}</p>
                      </div>
                    </div>
                    <div className="text-xs text-ink-500">
                      <p className="flex items-center gap-1.5"><Mail size={12} aria-hidden="true" /> {c.email}</p>
                      {c.phone && <p className="mt-0.5 flex items-center gap-1.5"><Phone size={12} aria-hidden="true" /> {c.phone}</p>}
                    </div>
                  </Row>
                ))}
              </CardBody>
            </Card>
          )}

          {tab === 'documents' && (
            <Card>
              <CardBody className="space-y-2.5">
                {documents.length === 0 && <EmptyState icon={Folder} title="No documents" description="Files shared with this client will appear here." />}
                {documents.map((d) => (
                  <Row key={d.id}>
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300"><FileText size={17} aria-hidden="true" /></span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{d.name}</p>
                        <p className="text-xs text-ink-400">{d.category} · uploaded by {d.uploadedBy} on {formatDate(d.uploadedDate)}</p>
                      </div>
                    </div>
                    <span className="text-xs text-ink-400">{d.size}</span>
                  </Row>
                ))}
              </CardBody>
            </Card>
          )}

          {tab === 'invoices' && (
            <Card>
              <CardBody className="space-y-2.5">
                {invoices.length === 0 && <EmptyState icon={Receipt} title="No invoices" description="Invoices for this client will appear here." />}
                {invoices.map((i) => (
                  <Row key={i.id} to={`/admin/billing/invoices/${i.id}`}>
                    <div>
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{i.number}</p>
                      <p className="text-xs text-ink-400">Issued {formatDate(i.issueDate)} · due {formatDate(i.dueDate)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={i.status} />
                      <div className="text-right">
                        <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{formatCurrency(i.amount)}</p>
                        {i.balance > 0 && <p className="text-xs text-warning-600">Balance {formatCurrency(i.balance)}</p>}
                      </div>
                    </div>
                  </Row>
                ))}
              </CardBody>
            </Card>
          )}

          {tab === 'payments' && (
            <Card>
              <CardBody className="space-y-2.5">
                {payments.length === 0 && <EmptyState icon={CreditCard} title="No payments" description="Payments received from this client will appear here." />}
                {payments.map((p) => (
                  <Row key={p.id}>
                    <div>
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{p.number} <span className="font-normal text-ink-400">· {p.invoice}</span></p>
                      <p className="text-xs text-ink-400">{p.method} · {formatDate(p.date)}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <StatusBadge status={p.status} />
                      <span className="text-sm font-semibold text-success-600 dark:text-success-400">{formatCurrency(p.amount)}</span>
                    </div>
                  </Row>
                ))}
              </CardBody>
            </Card>
          )}

          {tab === 'tickets' && (
            <Card>
              <CardBody className="space-y-2.5">
                {tickets.length === 0 && <EmptyState icon={LifeBuoy} title="No support tickets" description="Support requests from this client will appear here." />}
                {tickets.map((t) => (
                  <Row key={t.id} to={`/admin/support/${t.id}`}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{t.subject}</p>
                      <p className="text-xs text-ink-400">{t.ticketId} · assigned to {t.assignee}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={t.priority} />
                      <StatusBadge status={t.status} />
                    </div>
                  </Row>
                ))}
              </CardBody>
            </Card>
          )}

          {tab === 'meetings' && (
            <Card>
              <CardHeader>
                <CardTitle>Meetings</CardTitle>
                <Button size="sm" leftIcon={<CalendarPlus size={14} />} onClick={() => setMeetingOpen(true)}>Schedule Meeting</Button>
              </CardHeader>
              <CardBody className="space-y-2.5">
                {sortedMeetings.length === 0 && <EmptyState icon={Video} title="No meetings" description="Scheduled meetings with this client will appear here." actionLabel="Schedule Meeting" onAction={() => setMeetingOpen(true)} />}
                {sortedMeetings.map((m) => (
                  <Row key={m.id}>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{m.title}</p>
                      <p className="text-xs text-ink-400">{formatDate(m.date)} at {m.time} · {m.type}</p>
                    </div>
                    <StatusBadge status={m.status === 'upcoming' ? 'open' : m.status === 'completed' ? 'completed' : 'cancelled'} label={m.status.charAt(0).toUpperCase() + m.status.slice(1)} />
                  </Row>
                ))}
              </CardBody>
            </Card>
          )}

          {tab === 'activity' && (
            <Card>
              <CardHeader>
                <CardTitle>Activity</CardTitle>
                <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setActivityOpen(true)}>Add Activity</Button>
              </CardHeader>
              <CardBody>
                {recentActivities.length === 0 ? (
                  <EmptyState icon={ActivityIcon} title="No activity yet" description="Log a call, email or meeting to start the activity trail." actionLabel="Add Activity" onAction={() => setActivityOpen(true)} />
                ) : (
                  <ul className="space-y-3">
                    {recentActivities.map((a) => (
                      <ActivityRow key={a.id} activity={a} />
                    ))}
                  </ul>
                )}
              </CardBody>
            </Card>
          )}
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
          <Card>
            <CardHeader><CardTitle>Primary Contact</CardTitle></CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <ClientAvatar name={client.contactPerson} size="lg" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{client.contactPerson}</p>
                  <p className="truncate text-xs text-ink-400">{client.email}</p>
                </div>
              </div>
              <div className="space-y-2 text-sm text-ink-600 dark:text-ink-300">
                <p className="flex items-center gap-2"><Phone size={14} className="text-brand-500" aria-hidden="true" /> {client.phone || '—'}</p>
                <p className="flex items-center gap-2"><MapPin size={14} className="text-accent-500" aria-hidden="true" /> {client.city || '—'}</p>
              </div>
            </CardBody>
          </Card>
          <Card>
            <CardBody className="space-y-2">
              <Button variant="secondary" className="w-full justify-center" leftIcon={<Plus size={15} />} onClick={() => setActivityOpen(true)}>Add Activity</Button>
              <Button variant="secondary" className="w-full justify-center" leftIcon={<Users size={15} />} onClick={() => setContactOpen(true)}>Add Contact</Button>
              <Button as={Link} to="/admin/crm/clients" variant="ghost" className="w-full justify-center">Back to Clients</Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <ClientFormModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSubmit={handleEdit} initialValues={client} isSaving={busy} />
      <ContactFormModal isOpen={contactOpen} onClose={() => setContactOpen(false)} onSubmit={handleAddContact} isSaving={busy} lockedClient={client} />
      <LogActivityModal isOpen={activityOpen} onClose={() => setActivityOpen(false)} onSubmit={handleAddActivity} isSaving={busy} owners={owners} defaultOwner={owners[0]} relatedTo={`${client.contactPerson} (${client.company})`} />
      <ScheduleMeetingModal isOpen={meetingOpen} onClose={() => setMeetingOpen(false)} onSubmit={handleScheduleMeeting} isSaving={busy} hosts={owners} defaultHost={owners[0]} defaultTitle={`Catch-up with ${client.company}`} withWhom={`${client.contactPerson} (${client.company})`} />
    </div>
  )
}

function ActivityRow({ activity: a }) {
  const cfg = ACTIVITY_TYPE_CONFIG[a.type]
  const Icon = cfg.icon
  return (
    <li className="flex gap-3 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-brand-50/40 dark:border-ink-800 dark:hover:bg-ink-800/40">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONES[cfg.tone].chip)}>
        <Icon size={17} aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-ink-800 dark:text-ink-100">{a.subject}</p>
          <Badge tone={cfg.tone}>{cfg.label}</Badge>
        </div>
        {a.notes && <p className="mt-1 text-sm text-ink-500">{a.notes}</p>}
        <p className="mt-1.5 text-xs text-ink-400">{a.owner} · {formatDateTime(a.date)}{a.outcome ? ` · ${a.outcome}` : ''}</p>
      </div>
    </li>
  )
}
