import { useEffect, useRef, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { Send, Paperclip, TicketX, CheckCircle2, RotateCcw, LifeBuoy, Info } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel, PanelHeader, PanelBody } from '../../components/portal/Panel'
import Badge from '../../components/common/Badge'
import StatusBadge from '../../components/common/StatusBadge'
import Avatar from '../../components/common/Avatar'
import Textarea from '../../components/common/Textarea'
import Button from '../../components/common/Button'
import ErrorState from '../../components/common/ErrorState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { addTicketMessage, setTicketStatus } from '../../utils/portalStores'
import { formatDate, formatDateTime } from '../../utils/format'
import { cn } from '../../utils/cn'

const PRIORITY_TONE = { urgent: 'danger', high: 'warning', medium: 'brand', low: 'neutral' }
const AGENT_REPLIES = [
  'Thanks for the additional details. I have shared them with the engineering team and will update you shortly.',
  'Understood. We are on it and will confirm as soon as this is fixed on staging.',
]

function DetailsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading ticket" className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
      <div className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900 lg:col-span-2">
        <Skeleton className="mb-4 h-5 w-40" />
        <Skeleton className="mb-3 h-16 w-full" />
        <Skeleton className="mb-3 h-16 w-3/4" />
        <Skeleton className="h-16 w-full" />
      </div>
      <SkeletonCard lines={4} />
    </div>
  )
}

export default function ClientTicketDetails() {
  const { id } = useParams()
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { user, contactName, tickets } = useClientData()

  // Only tickets that belong to the logged-in client's company resolve.
  const ticket = tickets.find((t) => t.id === id) || null

  const [reply, setReply] = useState('')
  const [replyError, setReplyError] = useState('')
  const [agentTyping, setAgentTyping] = useState(false)
  const timers = useRef([])
  const logRef = useRef(null)
  const messageCount = ticket?.messages.length || 0

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messageCount, agentTyping])

  function handleSend(e) {
    e?.preventDefault()
    const text = reply.trim()
    if (!text) {
      setReplyError('Write a message before sending.')
      return
    }
    if (ticket.status === 'closed') {
      setReplyError('This ticket is closed. Reopen it to send a message.')
      return
    }
    addTicketMessage(ticket.id, { from: user?.name || contactName, role: 'client', text })
    setReply('')
    setReplyError('')
    if (ticket.status === 'waiting_for_client') setTicketStatus(ticket.id, 'in_progress')

    // Simulated support reply so the conversation feels live.
    if (ticket.assignee !== 'Unassigned') {
      const assignee = ticket.assignee
      const ticketId = ticket.id
      const show = setTimeout(() => setAgentTyping(true), 800)
      const answer = setTimeout(() => {
        setAgentTyping(false)
        addTicketMessage(ticketId, { from: assignee, role: 'employee', text: AGENT_REPLIES[messageCount % AGENT_REPLIES.length] })
      }, 2800)
      timers.current.push(show, answer)
    }
  }

  function toggleClosed() {
    if (ticket.status === 'closed' || ticket.status === 'resolved') {
      setTicketStatus(ticket.id, 'open')
      toast.info('Ticket reopened')
    } else {
      setTicketStatus(ticket.id, 'resolved')
      toast.success('Ticket marked as resolved. You can reopen it any time.')
    }
  }

  const finished = ticket && (ticket.status === 'closed' || ticket.status === 'resolved')

  return (
    <div>
      <PageHeader
        title={ticket?.subject || 'Ticket'}
        breadcrumbItems={[{ label: 'Support Tickets', href: '/client/tickets' }, { label: ticket?.ticketId || 'Details' }]}
        homeHref="/client/dashboard"
        action={
          ticket && (
            <Button variant="secondary" leftIcon={finished ? <RotateCcw size={15} /> : <CheckCircle2 size={15} />} onClick={toggleClosed}>
              {finished ? 'Reopen ticket' : 'Mark as resolved'}
            </Button>
          )
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<DetailsSkeleton />}>
        {!ticket ? (
          <Panel>
            <ErrorState
              icon={TicketX}
              title="Ticket not found"
              description="This ticket doesn't exist or isn't part of your account."
              action={
                <Button as={Link} to="/client/tickets" size="sm">
                  Back to tickets
                </Button>
              }
            />
          </Panel>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            <div className="min-w-0 lg:col-span-2">
              <Panel>
                <PanelHeader
                  icon={LifeBuoy}
                  tone="accent"
                  title={ticket.ticketId}
                  action={
                    <div className="flex items-center gap-2">
                      <StatusBadge status={ticket.status} />
                      <Badge tone={PRIORITY_TONE[ticket.priority]} dot>{ticket.priority}</Badge>
                    </div>
                  }
                />
                <PanelBody>
                  <p className="rounded-xl bg-ink-50 px-4 py-3 text-sm leading-relaxed text-ink-600 dark:bg-ink-800/40 dark:text-ink-300">{ticket.description}</p>

                  <div ref={logRef} role="log" aria-live="polite" aria-label="Conversation" className="mt-5 max-h-[60dvh] space-y-4 overflow-y-auto rounded-2xl bg-ink-50/70 p-3 dark:bg-ink-950/40 sm:max-h-[28rem] sm:p-4">
                    {ticket.messages.map((m, idx) => {
                      const isClient = m.role === 'client'
                      return (
                        <div key={idx} className={cn('flex items-end gap-2.5', isClient && 'flex-row-reverse')}>
                          <Avatar name={m.from} size="sm" />
                          <div className={cn('min-w-0 max-w-[85%] animate-fade-in rounded-2xl px-4 py-2.5 text-sm shadow-sm sm:max-w-[80%]', isClient ? 'gradient-brand rounded-br-md bg-brand-600 text-white' : 'rounded-bl-md border border-ink-200 bg-white text-ink-700 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-200')}>
                            <p className={cn('mb-0.5 text-xs font-semibold', isClient ? 'text-white/90' : 'text-brand-600 dark:text-brand-300')}>{isClient ? 'You' : m.from}</p>
                            <p className="whitespace-pre-wrap break-words">{m.text}</p>
                            {m.attachments?.map((a) => (
                              <p key={a.name} className={cn('mt-1.5 inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs', isClient ? 'bg-white/20' : 'bg-ink-50 dark:bg-ink-700')}>
                                <Paperclip size={11} /> {a.name} · {a.size}
                              </p>
                            ))}
                            <p className={cn('mt-1 text-xs', isClient ? 'text-white/80' : 'text-ink-500')}>{formatDateTime(m.time)}</p>
                          </div>
                        </div>
                      )
                    })}
                    {agentTyping && (
                      <p role="status" className="flex items-center gap-2 text-xs text-ink-500">
                        <span className="flex gap-1 rounded-2xl rounded-bl-md border border-ink-200 bg-white px-3 py-2.5 dark:border-ink-700 dark:bg-ink-800" aria-hidden="true">
                          {[0, 1, 2].map((d) => (
                            <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style={{ animationDelay: `${d * 150}ms` }} />
                          ))}
                        </span>
                        {ticket.assignee.split(' ')[0]} is typing…
                      </p>
                    )}
                  </div>

                  <form onSubmit={handleSend} noValidate className="mt-5 flex flex-col gap-3 border-t border-ink-100 pt-4 dark:border-ink-800 sm:flex-row sm:items-start">
                    <Textarea
                      wrapperClassName="flex-1"
                      aria-label="Reply"
                      placeholder={ticket.status === 'closed' ? 'This ticket is closed.' : 'Type your reply...'}
                      rows={2}
                      value={reply}
                      onChange={(e) => {
                        setReply(e.target.value)
                        if (replyError) setReplyError('')
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(e)
                      }}
                      error={replyError}
                    />
                    <Button type="submit" leftIcon={<Send size={15} />} className="w-full sm:w-auto">
                      Send
                    </Button>
                  </form>
                </PanelBody>
              </Panel>
            </div>

            <div className="space-y-4 sm:space-y-5 lg:space-y-6">
              <Panel>
                <PanelHeader icon={Info} tone="info" title="Ticket details" />
                <PanelBody>
                  <dl className="space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-ink-500">Status</dt>
                      <dd>
                        <StatusBadge status={ticket.status} />
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-ink-500">Priority</dt>
                      <dd>
                        <Badge tone={PRIORITY_TONE[ticket.priority]}>{ticket.priority}</Badge>
                      </dd>
                    </div>
                    {ticket.category && (
                      <div className="flex items-center justify-between gap-3">
                        <dt className="text-ink-500">Category</dt>
                        <dd className="text-right font-medium text-ink-700 dark:text-ink-200">{ticket.category}</dd>
                      </div>
                    )}
                    <div className="flex items-center justify-between">
                      <dt className="text-ink-500">Created</dt>
                      <dd className="font-medium text-ink-700 dark:text-ink-200">{formatDate(ticket.createdDate)}</dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-ink-500">Assigned to</dt>
                      <dd className="font-medium text-ink-700 dark:text-ink-200">{ticket.assignee}</dd>
                    </div>
                  </dl>
                </PanelBody>
              </Panel>
              {ticket.attachments?.length > 0 && (
                <Panel>
                  <PanelHeader icon={Paperclip} tone="warning" title="Attachments" />
                  <PanelBody className="space-y-2">
                    {ticket.attachments.map((a) => (
                      <p key={a.name} className="flex items-center gap-2 rounded-xl bg-ink-50 px-3 py-2 text-sm text-ink-600 dark:bg-ink-800/40 dark:text-ink-300">
                        <Paperclip size={14} className="shrink-0 text-warning-600" /> <span className="min-w-0 flex-1 truncate">{a.name}</span> <span className="shrink-0 text-xs text-ink-500">{a.size}</span>
                      </p>
                    ))}
                  </PanelBody>
                </Panel>
              )}
            </div>
          </div>
        )}
      </AsyncState>
    </div>
  )
}
