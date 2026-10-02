import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, MessageSquare, Send } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel } from '../../components/portal/Panel'
import Avatar from '../../components/common/Avatar'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import StatusBadge from '../../components/common/StatusBadge'
import { useAuth } from '../../context/AuthContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton } from '../../components/common/Skeleton'
import { formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const TIME_FORMAT = new Intl.DateTimeFormat('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })

const AUTO_REPLIES = [
  "Thanks for the note! I'll check with the team and get back to you shortly.",
  'Noted. I have added this to our next sprint discussion and will update you by end of day.',
  'Got it. Happy to jump on a quick call if that is easier. Let me know what time suits you.',
  'Appreciate the feedback. The team will action it and share an update on the project board.',
]

function seedThread(project, contact, index) {
  const first = contact.split(' ')[0]
  const manager = project.manager.split(' ')[0]
  const day = (d, t) => `2026-09-${d}T${t}:00`
  const completed = `${project.progress}%`

  const templates = [
    [
      ['them', day('23', '10:12'), `Hi ${first}, quick update on ${project.name}: the latest build is live on the staging link. Could you review it by Friday?`],
      ['me', day('23', '11:40'), `Thanks ${manager}! I'll go through it tonight. Also, how far along are we against the plan?`],
      ['them', day('23', '11:52'), `So far ${completed} of the planned work is complete, and we are on track. The next invoice will follow the milestone sign-off.`],
      ['me', day('24', '09:05'), 'Sounds good. Our finance team needs the GST invoice by the 30th for this quarter.'],
      ['them', day('24', '09:30'), 'Understood, I will make sure accounts shares it by the 28th.'],
    ],
    [
      ['them', day('22', '15:20'), `Hello ${first}, we need your approval on the revised scope for ${project.name}. The document is under Documents > Contracts.`],
      ['me', day('22', '16:05'), `Hi ${manager}, saw it. Does the extra reporting module change the delivery date?`],
      ['them', day('22', '16:18'), `It adds about a week, so the new target is close to ${formatDate(project.deadline)}. It stays within the scope we agreed, so there is no change to your plan.`],
      ['me', day('25', '10:00'), 'Okay, please go ahead. I will send the written approval today.'],
    ],
    [
      ['me', day('21', '12:10'), `Hi ${manager}, can we schedule a review call for ${project.name} early next week?`],
      ['them', day('21', '12:34'), 'Sure! Monday at 11:00 AM or Tuesday at 4:30 PM work for me. I will send an invite once you pick.'],
      ['me', day('21', '12:41'), 'Tuesday 4:30 PM is perfect. The whole team from our side will join.'],
      ['them', day('21', '12:45'), 'Great, invite sent. I will also share the progress summary beforehand.'],
    ],
  ]

  return templates[index % templates.length].map(([from, time, text], i) => ({
    id: `${project.id}-seed-${i}`,
    from,
    text,
    time,
  }))
}

export default function ClientMessages() {
  const { user } = useAuth()
  const { client, projects: clientProjects } = useClientData()
  const { isLoading, isError, retry } = usePortalLoad({ delay: 500 })

  const [threads, setThreads] = useState(() =>
    Object.fromEntries(clientProjects.map((p, i) => [p.id, seedThread(p, client?.contactPerson || user?.name || 'there', i)]))
  )
  const [selectedId, setSelectedId] = useState(null)
  const [mobileView, setMobileView] = useState('list')
  const [drafts, setDrafts] = useState({})
  const [typing, setTyping] = useState({})
  const [readIds, setReadIds] = useState(() => new Set())

  const timers = useRef([])
  const replyCount = useRef(0)
  const scrollRef = useRef(null)

  useEffect(() => {
    const pending = timers.current
    return () => pending.forEach(clearTimeout)
  }, [])

  const activeId = clientProjects.some((p) => p.id === selectedId) ? selectedId : clientProjects[0]?.id
  const activeProject = clientProjects.find((p) => p.id === activeId)
  const activeMessages = (activeId && threads[activeId]) || []
  const isTyping = Boolean(activeId && typing[activeId])

  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [activeId, activeMessages.length, isTyping, mobileView])

  function openConversation(id) {
    setSelectedId(id)
    setReadIds((prev) => new Set(prev).add(id))
    setMobileView('thread')
  }

  function send() {
    if (!activeProject) return
    const text = (drafts[activeId] || '').trim()
    if (!text) return
    const projectId = activeId
    const manager = activeProject.manager

    setThreads((t) => ({
      ...t,
      [projectId]: [...(t[projectId] || []), { id: `${projectId}-${Date.now()}`, from: 'me', text, time: new Date().toISOString() }],
    }))
    setDrafts((d) => ({ ...d, [projectId]: '' }))

    const showTyping = setTimeout(() => setTyping((t) => ({ ...t, [projectId]: true })), 700)
    const reply = setTimeout(() => {
      const body = AUTO_REPLIES[replyCount.current % AUTO_REPLIES.length]
      replyCount.current += 1
      setTyping((t) => ({ ...t, [projectId]: false }))
      setThreads((t) => ({
        ...t,
        [projectId]: [...(t[projectId] || []), { id: `${projectId}-r-${Date.now()}`, from: 'them', text: body, time: new Date().toISOString(), author: manager }],
      }))
    }, 2600)
    timers.current.push(showTyping, reply)
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  if (clientProjects.length === 0) {
    return (
      <div>
        <PageHeader title="Messages" description="Chat with your account manager about your projects." breadcrumbItems={[{ label: 'Messages' }]} homeHref="/client/dashboard" />
        <Panel>
          <EmptyState
            icon={MessageSquare}
            title="No conversations yet"
            description="Once a project is set up for your company, you can message your account manager here."
          />
        </Panel>
      </div>
    )
  }

  const inThread = mobileView === 'thread'

  return (
    <div>
      <div className={cn(inThread && 'hidden md:block')}>
        <PageHeader title="Messages" description="Chat with your account manager about your projects." breadcrumbItems={[{ label: 'Messages' }]} homeHref="/client/dashboard" />
      </div>

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<Skeleton className="h-[30rem] w-full rounded-2xl" />}>
      <Panel
        className={cn(
          'grid min-h-[22rem] grid-cols-1 overflow-hidden md:h-[calc(100dvh-13rem)] md:min-h-[30rem] md:grid-cols-[19rem_1fr] lg:grid-cols-[21rem_1fr]',
          inThread ? 'h-[calc(100dvh-7rem)]' : 'h-[calc(100dvh-13rem)]'
        )}
      >
        {/* Conversation list */}
        <aside
          aria-label="Conversations"
          className={cn('min-h-0 flex-col border-ink-100 dark:border-ink-800 md:flex md:border-r', inThread ? 'hidden' : 'flex')}
        >
          <div className="gradient-soft border-b border-ink-100 px-4 py-3.5 dark:border-ink-800">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100">
              <MessageSquare size={15} className="text-brand-600 dark:text-brand-300" aria-hidden="true" /> Conversations
            </h2>
            <p className="text-xs text-ink-500">One thread per project</p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto">
            {clientProjects.map((p) => {
              const thread = threads[p.id] || []
              const last = thread[thread.length - 1]
              const active = p.id === activeId
              const unread = Boolean(last && last.from !== 'me' && !active && !readIds.has(p.id))
              return (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => openConversation(p.id)}
                    aria-current={active ? 'true' : undefined}
                    className={cn(
                      'focus-ring relative flex w-full items-start gap-3 border-b border-ink-50 px-4 py-3.5 text-left transition-colors dark:border-ink-800/60',
                      active ? 'bg-brand-50 dark:bg-brand-500/10' : 'hover:bg-ink-50 dark:hover:bg-ink-800/40'
                    )}
                  >
                    {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-brand-500" aria-hidden="true" />}
                    <Avatar name={p.manager} size="md" status="online" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn('truncate text-sm text-ink-800 dark:text-ink-100', unread ? 'font-bold' : 'font-semibold')}>{p.manager}</span>
                        {last && <span className="shrink-0 text-xs text-ink-500">{TIME_FORMAT.format(new Date(last.time))}</span>}
                      </span>
                      <span className="block truncate text-xs font-semibold text-brand-600 dark:text-brand-300">{p.name}</span>
                      {last && (
                        <span className={cn('mt-0.5 flex items-center gap-2 text-xs', unread ? 'font-medium text-ink-700 dark:text-ink-200' : 'text-ink-500')}>
                          <span className="min-w-0 flex-1 truncate">
                            {last.from === 'me' ? 'You: ' : ''}
                            {last.text}
                          </span>
                          {unread && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-accent-500 ring-2 ring-white dark:ring-ink-900" aria-label="Unread messages" role="img" />}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </aside>

        {/* Thread */}
        <section
          aria-label={`Conversation with ${activeProject.manager}`}
          className={cn('min-h-0 min-w-0 flex-col md:flex', inThread ? 'flex' : 'hidden')}
        >
          <header className="gradient-soft flex items-center gap-3 border-b border-ink-100 px-3 py-3 dark:border-ink-800 sm:px-4">
            <button
              type="button"
              onClick={() => setMobileView('list')}
              className="focus-ring -ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-600 hover:bg-white/70 md:hidden dark:text-ink-300 dark:hover:bg-ink-800"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={18} />
            </button>
            <Avatar name={activeProject.manager} size="md" status="online" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{activeProject.manager}</p>
              <p className="truncate text-xs text-ink-500">Account manager · {activeProject.name}</p>
            </div>
            <StatusBadge status={activeProject.status} />
          </header>

          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label="Messages"
            className="min-h-0 flex-1 space-y-3 overflow-y-auto bg-gradient-to-b from-ink-50 to-brand-50/30 px-3 py-4 dark:from-ink-950/40 dark:to-ink-950/20 sm:px-5"
          >
            {activeMessages.map((m, i) => {
              const prev = activeMessages[i - 1]
              const newDay = !prev || new Date(prev.time).toDateString() !== new Date(m.time).toDateString()
              const mine = m.from === 'me'
              return (
                <div key={m.id}>
                  {newDay && (
                    <div className="my-2 flex justify-center">
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-medium text-ink-500 shadow-sm ring-1 ring-ink-100 dark:bg-ink-800 dark:ring-ink-700">
                        {formatDate(m.time)}
                      </span>
                    </div>
                  )}
                  <div className={cn('flex animate-fade-in', mine ? 'justify-end' : 'justify-start')}>
                    <div className={cn('min-w-0 max-w-[85%] sm:max-w-[70%]', mine ? 'items-end' : 'items-start')}>
                      <p
                        className={cn(
                          'whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm',
                          mine
                            ? 'gradient-brand rounded-br-md bg-brand-600 text-white'
                            : 'rounded-bl-md border border-ink-200 bg-white text-ink-800 dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100'
                        )}
                      >
                        {m.text}
                      </p>
                      <p className={cn('mt-1 text-xs text-ink-500', mine && 'text-right')}>
                        {mine ? 'You' : activeProject.manager.split(' ')[0]} · {TIME_FORMAT.format(new Date(m.time))}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
            {isTyping && (
              <div className="flex items-center gap-2 text-xs text-ink-500" role="status">
                <span className="flex gap-1 rounded-2xl rounded-bl-md border border-ink-200 bg-white px-3 py-2.5 shadow-sm dark:border-ink-700 dark:bg-ink-800" aria-hidden="true">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand-400" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </span>
                <span>{activeProject.manager.split(' ')[0]} is typing…</span>
              </div>
            )}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
            className="flex items-end gap-2 border-t border-ink-100 bg-white p-2.5 dark:border-ink-800 dark:bg-ink-900 sm:p-3"
          >
            <label htmlFor="message-composer" className="sr-only">
              Message to {activeProject.manager}
            </label>
            <textarea
              id="message-composer"
              rows={1}
              value={drafts[activeId] || ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [activeId]: e.target.value }))}
              onKeyDown={handleKeyDown}
              placeholder="Type a message… (Enter to send, Shift+Enter for a new line)"
              className="focus-ring max-h-32 min-h-11 min-w-0 flex-1 resize-none rounded-2xl border border-ink-200 bg-ink-50 px-4 py-2.5 text-sm text-ink-800 placeholder:text-ink-400 hover:border-ink-300 focus:bg-white dark:border-ink-700 dark:bg-ink-800 dark:text-ink-100 dark:hover:border-ink-600 dark:focus:bg-ink-900"
            />
            <Button type="submit" disabled={!(drafts[activeId] || '').trim()} leftIcon={<Send size={15} />} aria-label="Send message" className="h-11 shrink-0">
              <span className="hidden sm:inline">Send</span>
            </Button>
          </form>
        </section>
      </Panel>
      </AsyncState>
    </div>
  )
}
