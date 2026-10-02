import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, FileText, Download, Paperclip, Building2, Tag, CalendarDays, MessageSquare, AlignLeft, SlidersHorizontal, History, User } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ChatThread from '../../../components/business/ChatThread'
import Card, { CardHeader, CardTitle, CardBody } from '../../../components/common/Card'
import Button from '../../../components/common/Button'
import Select from '../../../components/common/Select'
import StatusBadge from '../../../components/common/StatusBadge'
import Avatar from '../../../components/common/Avatar'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import ActivityTimeline from '../../../components/common/ActivityTimeline'
import { Skeleton } from '../../../components/common/Skeleton'
import { ticketService } from '../../../services/ticketService'
import { employees } from '../../../mockData/employees'
import { formatDate } from '../../../utils/format'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'

const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_client', label: 'Waiting for Client' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]
const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]
const STATUS_LABEL = Object.fromEntries(STATUS_OPTIONS.map((s) => [s.value, s.label]))
const STATUS_TONE = { open: 'info', in_progress: 'brand', waiting_for_client: 'warning', resolved: 'success', closed: 'neutral' }

export default function TicketDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { data: ticket, loading, error, reload, setData } = useAsyncData(() => ticketService.get(id), id)

  return (
    <div>
      {loading && <DetailsSkeleton />}
      {error && (
        <Card>
          {error.code === 'NOT_FOUND' ? (
            <EmptyState
              title="Ticket not found"
              description="This ticket may have been removed or the link is incorrect."
              actionLabel="Back to Tickets"
              onAction={() => navigate('/admin/support')}
            />
          ) : (
            <ErrorState title="Couldn't load this ticket" onRetry={reload} />
          )}
        </Card>
      )}
      {ticket && <TicketView ticket={ticket} setData={setData} />}
    </div>
  )
}

const HEAD_TINT = {
  brand: 'bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300',
  accent: 'bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300',
  info: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
  warning: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-400',
  success: 'bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-400',
}

function HeadIcon({ icon: Icon, tint }) {
  return (
    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${HEAD_TINT[tint]}`}>
      <Icon size={16} />
    </span>
  )
}

function DetailsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading ticket">
      <Skeleton className="mb-2 h-4 w-48" />
      <Skeleton className="mb-6 h-8 w-2/3" />
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 sm:space-y-5 lg:col-span-2 lg:space-y-6">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          <Skeleton className="h-80 rounded-2xl" />
          <Skeleton className="h-48 rounded-2xl" />
        </div>
      </div>
    </div>
  )
}

function TicketView({ ticket, setData }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const agentName = user?.name || 'You'
  const [typingName, setTypingName] = useState(null)
  const timers = useRef([])

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const conversation = useMemo(
    () =>
      [...ticket.messages, ...(ticket.internalNotes || []).map((n) => ({ ...n, internal: true }))].sort(
        (a, b) => new Date(a.time) - new Date(b.time)
      ),
    [ticket.messages, ticket.internalNotes]
  )

  const attachments = ticket.attachments || []
  const clientContact = ticket.messages.find((m) => m.role === 'client')?.from || ticket.client
  const isClosed = ticket.status === 'closed'

  function apply(changes, activityText, tone = 'brand') {
    const entry = activityText ? { id: `act-${Date.now()}`, actor: agentName, text: activityText, time: new Date().toISOString(), tone } : null
    const next = { ...changes, ...(entry ? { activity: [entry, ...(ticket.activity || [])] } : {}) }
    setData((prev) => ({ ...prev, ...next }))
    ticketService.update(ticket.id, next)
  }

  function handleStatus(e) {
    const status = e.target.value
    if (status === ticket.status) return
    apply({ status }, `changed status from ${STATUS_LABEL[ticket.status]} to ${STATUS_LABEL[status]}`, STATUS_TONE[status])
    toast.success(`Status updated to ${STATUS_LABEL[status]}`)
  }

  function handlePriority(e) {
    const priority = e.target.value
    if (priority === ticket.priority) return
    apply({ priority }, `changed priority from ${ticket.priority} to ${priority}`, priority === 'urgent' ? 'danger' : 'warning')
    toast.success(`Priority set to ${priority[0].toUpperCase()}${priority.slice(1)}`)
  }

  function handleAssignee(e) {
    const assignee = e.target.value
    if (assignee === ticket.assignee) return
    apply({ assignee }, `reassigned the ticket from ${ticket.assignee} to ${assignee}`, 'info')
    toast.success(`Reassigned to ${assignee}`)
  }

  function handleSend({ text, internal, attachments: sentFiles }) {
    const time = new Date().toISOString()
    const message = { from: agentName, role: 'employee', text, time, ...(sentFiles.length ? { attachments: sentFiles } : {}) }
    if (internal) {
      apply({ internalNotes: [...(ticket.internalNotes || []), message] }, 'added an internal note', 'neutral')
      toast.success('Internal note added')
      return
    }
    const nextStatus = ticket.status === 'open' ? 'in_progress' : ticket.status
    const messagesAfter = [...ticket.messages, message]
    apply(
      {
        messages: messagesAfter,
        attachments: [...attachments, ...sentFiles],
        status: nextStatus,
      },
      nextStatus !== ticket.status ? 'replied to the client and moved the ticket to In Progress' : 'replied to the client',
      'brand'
    )
    toast.success('Reply sent to client')

    // Demo only: the client "types" and acknowledges shortly after a reply.
    if (ticket.status !== 'closed' && ticket.status !== 'resolved') {
      timers.current.push(setTimeout(() => setTypingName(clientContact), 900))
      timers.current.push(
        setTimeout(() => {
          setTypingName(null)
          const ack = { from: clientContact, role: 'client', text: 'Thanks for the update — we will check on our side and get back to you.', time: new Date().toISOString() }
          setData((prev) => (prev ? { ...prev, messages: [...prev.messages, ack] } : prev))
          ticketService.update(ticket.id, { messages: [...messagesAfter, ack] })
        }, 3200)
      )
    }
  }

  const timelineItems = useMemo(() => {
    const items = [{ id: 'created', actor: ticket.client, text: `raised ticket ${ticket.ticketId}`, time: ticket.createdDate, tone: 'info', at: new Date(ticket.createdDate).getTime() }]
    const firstResponse = ticket.messages.find((m) => m.role === 'employee')
    if (firstResponse) {
      items.push({ id: 'first-response', actor: firstResponse.from, text: 'sent the first response', time: firstResponse.time, tone: 'brand', at: new Date(firstResponse.time).getTime() })
    }
    ;(ticket.activity || []).forEach((a) => items.push({ ...a, at: new Date(a.time).getTime() }))
    return items.sort((a, b) => b.at - a.at)
  }, [ticket])

  return (
    <>
      <PageHeader
        title={ticket.subject}
        breadcrumbItems={[{ label: 'Support', href: '/admin/support' }, { label: 'Tickets', href: '/admin/support' }, { label: ticket.ticketId }]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" leftIcon={<ArrowLeft size={15} />} onClick={() => navigate('/admin/support')}>
              <span className="hidden sm:inline">Back to Tickets</span>
              <span className="sm:hidden">Back</span>
            </Button>
            {ticket.status !== 'resolved' && !isClosed && (
              <Button leftIcon={<CheckCircle2 size={15} />} onClick={() => handleStatus({ target: { value: 'resolved' } })}>
                Mark Resolved
              </Button>
            )}
          </div>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-ink-100 bg-white px-3 py-2.5 shadow-card sm:px-4 dark:border-ink-800 dark:bg-ink-900">
        <span className="rounded-lg bg-brand-50 px-2 py-1 text-sm font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{ticket.ticketId}</span>
        <StatusBadge status={ticket.status} />
        <StatusBadge status={ticket.priority} label={`${ticket.priority[0].toUpperCase()}${ticket.priority.slice(1)} priority`} />
        <span className="flex min-w-0 items-center gap-1.5 text-sm text-ink-500">
          <Building2 size={14} className="shrink-0" /> <span className="truncate">{ticket.client}</span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 space-y-4 sm:space-y-5 lg:col-span-2 lg:space-y-6">
          <Card className="animate-slide-up overflow-hidden rounded-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeadIcon icon={AlignLeft} tint="brand" />Description</CardTitle>
              {ticket.category && (
                <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-700 dark:bg-accent-500/15 dark:text-accent-300">
                  <Tag size={11} /> {ticket.category}
                </span>
              )}
            </CardHeader>
            <CardBody>
              <p className="text-sm leading-relaxed text-ink-700 dark:text-ink-200">{ticket.description}</p>
            </CardBody>
          </Card>

          <Card className="animate-slide-up overflow-hidden rounded-2xl" style={{ animationDelay: '60ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeadIcon icon={MessageSquare} tint="info" />Conversation</CardTitle>
              <span className="text-xs text-ink-400">{conversation.length} message{conversation.length === 1 ? '' : 's'}</span>
            </CardHeader>
            <ChatThread messages={conversation} onSend={handleSend} typingName={typingName} disabled={isClosed} />
            {isClosed && <p className="border-t border-ink-100 px-5 py-3 text-center text-xs text-ink-400 dark:border-ink-800">This ticket is closed. Change the status to reopen the conversation.</p>}
          </Card>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
          <Card className="animate-slide-up rounded-2xl" style={{ animationDelay: '100ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeadIcon icon={SlidersHorizontal} tint="warning" />Ticket Details</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300"><User size={18} /></span>
                <div className="min-w-0">
                  <p className="text-xs text-ink-400">Client</p>
                  <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{ticket.client}</p>
                  <p className="truncate text-xs text-ink-500">Contact: {clientContact}</p>
                </div>
              </div>
              <div className="flex items-end gap-2">
                <Avatar name={ticket.assignee} size="sm" className="mb-1" />
                <div className="min-w-0 flex-1">
                  <Select label="Assigned to" options={employees.map((e) => ({ value: e.name, label: e.name }))} value={ticket.assignee} onChange={handleAssignee} />
                </div>
              </div>
              <Select label="Status" options={STATUS_OPTIONS} value={ticket.status} onChange={handleStatus} />
              <Select label="Priority" options={PRIORITY_OPTIONS} value={ticket.priority} onChange={handlePriority} />
              <div className="flex items-center gap-1.5 text-xs text-ink-500">
                <CalendarDays size={13} /> Created {formatDate(ticket.createdDate)}
              </div>
            </CardBody>
          </Card>

          <Card className="animate-slide-up rounded-2xl" style={{ animationDelay: '140ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeadIcon icon={Paperclip} tint="success" />Attachments</CardTitle>
              <span className="text-xs text-ink-400">{attachments.length}</span>
            </CardHeader>
            <CardBody>
              {attachments.length === 0 ? (
                <p className="flex items-center gap-2 text-sm text-ink-400">
                  <Paperclip size={14} /> No files attached yet.
                </p>
              ) : (
                <ul className="space-y-2">
                  {attachments.map((a, i) => (
                    <li key={`${a.name}-${i}`} className="flex items-center gap-3 rounded-xl border border-ink-100 px-3 py-2 transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><FileText size={16} /></span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200">{a.name}</p>
                        <p className="text-xs text-ink-400">{a.size}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toast.info(`Downloading ${a.name} (demo)`)}
                        className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-ink-800"
                        aria-label={`Download ${a.name}`}
                      >
                        <Download size={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card className="animate-slide-up rounded-2xl" style={{ animationDelay: '180ms' }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><HeadIcon icon={History} tint="accent" />Activity</CardTitle>
            </CardHeader>
            <CardBody>
              <ActivityTimeline items={timelineItems} />
            </CardBody>
          </Card>
        </div>
      </div>
    </>
  )
}
