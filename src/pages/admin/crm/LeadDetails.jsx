import { useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  Mail, Phone, Building2, Calendar, IndianRupee, UserCheck, Pencil, CalendarPlus, StickyNote, Plus, Target,
  Tag, User, Clock, CheckCircle2, BellRing, Video, Check, Sparkles, Flag,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import LeadFormModal from '../../../components/business/LeadFormModal'
import LogActivityModal from '../../../components/business/LogActivityModal'
import ScheduleMeetingModal from '../../../components/business/ScheduleMeetingModal'
import DetailSkeleton from '../../../components/business/DetailSkeleton'
import InfoRow from '../../../components/business/InfoRow'
import Card, { CardHeader, CardTitle, CardBody } from '../../../components/common/Card'
import Button from '../../../components/common/Button'
import Badge from '../../../components/common/Badge'
import StatusBadge from '../../../components/common/StatusBadge'
import Avatar from '../../../components/common/Avatar'
import Select from '../../../components/common/Select'
import Textarea from '../../../components/common/Textarea'
import LeadTimeline from '../../../components/business/LeadTimeline'
import ClientAvatar from '../../../components/business/ClientAvatar'
import { TONES, toneForDot, stagger } from '../../../components/business/ProjectTones'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { leadService } from '../../../services/leadService'
import { crmActivityService } from '../../../services/crmActivityService'
import { meetingService } from '../../../services/meetingService'
import { employeeService } from '../../../services/employeeService'
import { convertLeadToClient } from '../../../services/leadConversion'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format'
import {
  ACTIVITY_TYPE_CONFIG, ACTIVITY_DEFAULT_OUTCOME, LEAD_STAGES, LEAD_STAGE_LABEL, cap, isPastDate, newId, priorityTone,
} from '../../../utils/workspace'
import { cn } from '../../../utils/cn'

const MAX_NOTE = 500

export default function LeadDetails() {
  const { id } = useParams()
  return <LeadDetailsInner key={id} id={id} />
}

function LeadDetailsInner({ id }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const actor = user?.name || 'You'

  const load = useCallback(
    () =>
      Promise.all([leadService.get(id), crmActivityService.list(), meetingService.list(), employeeService.list()]).then(
        ([lead, activities, meetings, employees]) => ({
          lead,
          activities: activities.filter((a) => a.leadId === id),
          meetings: meetings.filter((m) => m.client === lead.company),
          employees,
        })
      ),
    [id]
  )
  const { data, isLoading, isError, error, retry, setData } = useMockQuery(load)

  const [editOpen, setEditOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [meetingOpen, setMeetingOpen] = useState(false)
  const [convertOpen, setConvertOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [noteText, setNoteText] = useState('')
  const [noteError, setNoteError] = useState('')

  const lead = data?.lead
  const activities = useMemo(() => data?.activities ?? [], [data])
  const meetings = useMemo(() => data?.meetings ?? [], [data])
  const owners = useMemo(() => (data?.employees ?? []).map((e) => e.name), [data])

  // Persist a patch on the lead and mirror it locally. `event` adds a timeline entry.
  async function patchLead(patch, event) {
    const events = event ? [{ id: newId('evt'), actor, time: new Date().toISOString(), ...event }, ...(lead.events || [])] : lead.events
    const full = event ? { ...patch, events } : patch
    setData((prev) => ({ ...prev, lead: { ...prev.lead, ...full } }))
    const updated = await leadService.update(id, full)
    return updated
  }

  async function handleEdit(values) {
    setBusy(true)
    try {
      await patchLead(values, { text: 'updated the lead details', tone: 'brand' })
      toast.success('Lead updated successfully')
      setEditOpen(false)
    } catch {
      toast.error('Could not update the lead. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function changeStatus(status) {
    if (status === lead.status) return
    try {
      await patchLead({ status }, { text: `moved this lead to ${LEAD_STAGE_LABEL[status]}`, tone: status === 'won' ? 'success' : status === 'lost' ? 'danger' : 'brand' })
      toast.success(`Status changed to ${LEAD_STAGE_LABEL[status]}`)
    } catch {
      toast.error('Could not change the status.')
    }
  }

  async function changeOwner(owner) {
    if (!owner || owner === lead.owner) return
    try {
      await patchLead({ owner }, { text: `reassigned this lead to ${owner}`, tone: 'info' })
      toast.success(`Lead assigned to ${owner}`)
    } catch {
      toast.error('Could not reassign the lead.')
    }
  }

  async function handleConvert() {
    setBusy(true)
    try {
      const result = await convertLeadToClient(lead)
      setData((prev) => ({ ...prev, lead: result.lead }))
      toast.success(`${lead.company} converted to a client`)
      setConvertOpen(false)
      navigate(`/admin/crm/clients/${result.client.id}`)
    } catch {
      toast.error('Could not convert this lead. Please try again.')
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
        contact: lead.name,
        company: lead.company,
        leadId: lead.id,
        clientId: lead.convertedClientId || null,
        owner: values.owner,
        date: `${values.date}T${values.time}:00`,
        outcome: ACTIVITY_DEFAULT_OUTCOME[values.type],
      })
      setData((prev) => ({ ...prev, activities: [created, ...prev.activities] }))
      const patch = values.type === 'follow_up' ? { nextFollowUp: values.date } : {}
      if (values.type !== 'note' && values.type !== 'follow_up') patch.lastContact = values.date
      if (Object.keys(patch).length > 0) await patchLead(patch)
      toast.success(`${ACTIVITY_TYPE_CONFIG[values.type].label} logged for ${lead.name}`)
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
        client: lead.company,
        project: null,
        date: values.date,
        time: values.time,
        type: values.type,
        link: values.type === 'Video Call' ? values.link || `https://meet.workflow360.app/${lead.id}-${values.date}` : null,
        participants: [values.host, lead.name],
        status: 'upcoming',
        notes: values.notes,
      })
      setData((prev) => ({ ...prev, meetings: [meeting, ...prev.meetings] }))
      await patchLead({ nextFollowUp: values.date }, { text: `scheduled "${values.title}" for ${formatDate(values.date)} at ${values.time}`, tone: 'success' })
      toast.success(`Meeting scheduled for ${formatDate(values.date)} at ${values.time}`)
      setMeetingOpen(false)
    } catch {
      toast.error('Could not schedule the meeting. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddNote(e) {
    e.preventDefault()
    const text = noteText.trim()
    if (!text) {
      setNoteError('Write a note before adding it')
      return
    }
    if (text.length > MAX_NOTE) {
      setNoteError(`Notes are limited to ${MAX_NOTE} characters`)
      return
    }
    const note = { id: newId('note'), author: actor, text, time: new Date().toISOString() }
    setNoteText('')
    setNoteError('')
    try {
      await patchLead({ noteList: [note, ...(lead.noteList || [])] })
      toast.success('Note added')
    } catch {
      toast.error('Could not save the note.')
    }
  }

  async function markFollowUpDone() {
    try {
      await patchLead({ nextFollowUp: null, lastContact: new Date().toISOString().slice(0, 10) }, { text: 'marked the follow-up as done', tone: 'success' })
      toast.success('Follow-up marked as done')
    } catch {
      toast.error('Could not update the follow-up.')
    }
  }

  const timeline = useMemo(() => {
    if (!lead) return []
    const items = [
      { id: 'created', actor: lead.owner, text: `created this lead from ${lead.source}`, at: `${lead.createdDate || lead.lastContact}T09:00:00`, tone: 'success', icon: Sparkles },
      ...(lead.noteList || []).map((n) => ({ id: n.id, actor: n.author, text: `added a note: "${n.text.length > 90 ? `${n.text.slice(0, 90)}...` : n.text}"`, at: n.time, tone: 'neutral', icon: StickyNote })),
      ...activities.map((a) => ({
        id: a.id,
        actor: a.owner,
        text: `${ACTIVITY_TYPE_CONFIG[a.type].verb} ${a.contact} — ${a.subject}`,
        at: a.date,
        tone: ACTIVITY_TYPE_CONFIG[a.type].tone,
        icon: ACTIVITY_TYPE_CONFIG[a.type].icon,
      })),
      ...meetings.map((m) => ({ id: m.id, actor: m.participants?.[0], text: `${m.status === 'completed' ? 'held' : 'scheduled'} "${m.title}"`, at: `${m.date}T${m.time}:00`, tone: 'info', icon: Video })),
      ...(lead.events || []).map((ev) => ({ id: ev.id, actor: ev.actor, text: ev.text, at: ev.time, tone: ev.tone })),
    ]
    return items
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((it) => ({ id: it.id, actor: it.actor, text: it.text, tone: it.tone, icon: it.icon, time: <>{formatDateTime(it.at)}</> }))
  }, [lead, activities, meetings])

  if (isLoading) return <DetailSkeleton label="Loading lead" stats={0} />

  if (isError) {
    if (error?.code === 'NOT_FOUND') {
      return (
        <EmptyState
          title="Lead not found"
          description="This lead may have been deleted or the link is incorrect."
          actionLabel="Back to Leads"
          onAction={() => navigate('/admin/crm/leads')}
        />
      )
    }
    return <ErrorState title="Couldn't load this lead" onRetry={retry} />
  }

  const isClosed = lead.status === 'won' || lead.status === 'lost'
  const stageIndex = LEAD_STAGES.findIndex((st) => st.value === lead.status)
  const followUpOverdue = !isClosed && isPastDate(lead.nextFollowUp)
  const followUps = activities.filter((a) => a.type === 'follow_up').sort((a, b) => b.date.localeCompare(a.date))
  const upcomingMeetings = meetings.filter((m) => m.status === 'upcoming')
  const sortedActivities = [...activities].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div>
      <PageHeader
        title={lead.name}
        description={`${lead.company} · ${formatCurrency(lead.value)} opportunity`}
        breadcrumbItems={[{ label: 'CRM' }, { label: 'Leads', href: '/admin/crm/leads' }, { label: lead.name }]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>Edit</Button>
            {lead.convertedClientId ? (
              <Button as={Link} to={`/admin/crm/clients/${lead.convertedClientId}`} leftIcon={<Building2 size={15} />}>View Client</Button>
            ) : (
              <Button leftIcon={<UserCheck size={15} />} onClick={() => setConvertOpen(true)}>Convert to Client</Button>
            )}
          </div>
        }
      />

      <div className="gradient-soft mb-6 overflow-hidden rounded-2xl border border-ink-100 p-4 shadow-card sm:p-5 lg:mb-8 lg:p-6 dark:border-ink-800">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ClientAvatar name={lead.name} size="xl" />
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-sm font-medium text-ink-500">
              <Building2 size={14} aria-hidden="true" className="shrink-0 text-brand-500" />
              <span className="truncate">{lead.company}</span>
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <StatusBadge status={lead.status} />
              <Badge tone={priorityTone(lead.priority)}>{cap(lead.priority)} priority</Badge>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                <IndianRupee size={12} aria-hidden="true" />
                {formatCurrency(lead.value)}
              </span>
              {lead.nextFollowUp && (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
                    followUpOverdue
                      ? 'bg-danger-50 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400'
                      : 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300'
                  )}
                >
                  <BellRing size={12} aria-hidden="true" />
                  Follow-up {formatDate(lead.nextFollowUp)}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2.5 sm:shrink-0">
            <Avatar name={lead.owner || '?'} />
            <div className="min-w-0">
              <p className="text-xs text-ink-400">Lead owner</p>
              <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{lead.owner || 'Unassigned'}</p>
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-ink-100 pt-4 dark:border-ink-800">
          <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500" id="stage-label">
            <Flag size={13} aria-hidden="true" className="text-brand-500" /> Pipeline stage
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-labelledby="stage-label">
            {LEAD_STAGES.map((stage, idx) => {
              const active = stage.value === lead.status
              const passed = idx < stageIndex && !isClosed
              const tone = TONES[toneForDot(stage.dot)]
              return (
                <button
                  key={stage.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => changeStatus(stage.value)}
                  className="focus-ring group min-w-[5.75rem] flex-1 shrink-0 rounded-xl text-left"
                >
                  <span className={cn('block h-1.5 w-full rounded-full transition-colors duration-300', active || passed ? tone.bar : 'bg-ink-200 group-hover:bg-ink-300 dark:bg-ink-700')} />
                  <span
                    className={cn(
                      'mt-2 flex items-center gap-1.5 rounded-lg px-1 py-1 text-sm font-semibold transition-colors',
                      active ? tone.text : passed ? 'text-ink-700 dark:text-ink-200' : 'text-ink-400 group-hover:text-ink-600 dark:group-hover:text-ink-200'
                    )}
                  >
                    <span
                      className={cn(
                        'flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                        active ? cn(tone.bar, 'text-white shadow-sm') : passed ? tone.chip : 'bg-ink-100 text-ink-400 dark:bg-ink-800'
                      )}
                    >
                      {passed ? <Check size={11} aria-hidden="true" /> : idx + 1}
                    </span>
                    {stage.label}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <div className="min-w-0 space-y-4 sm:space-y-5 lg:col-span-2 lg:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Lead Information</CardTitle>
              <StatusBadge status={lead.status} />
            </CardHeader>
            <CardBody className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6">
              <InfoRow icon={Building2} label="Company" value={lead.company} tone="brand" />
              <InfoRow icon={User} label="Contact person" value={lead.name} tone="accent" />
              <InfoRow icon={Mail} label="Email" tone="info">
                <a href={`mailto:${lead.email}`} className="focus-ring break-all rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">{lead.email}</a>
              </InfoRow>
              <InfoRow icon={Phone} label="Phone" tone="success">
                <a href={`tel:${lead.phone.replace(/\s/g, '')}`} className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">{lead.phone}</a>
              </InfoRow>
              <InfoRow icon={Tag} label="Source" value={lead.source} tone="warning" />
              <InfoRow icon={IndianRupee} label="Estimated value" value={formatCurrency(lead.value)} tone="success" />
              <InfoRow icon={Clock} label="Last contact" value={formatDate(lead.lastContact)} tone="info" />
              <InfoRow icon={Calendar} label="Next follow-up" tone={followUpOverdue ? 'danger' : 'accent'}>
                <p className={cn('mt-0.5 text-sm font-semibold', followUpOverdue ? 'text-danger-600 dark:text-danger-400' : 'text-ink-800 dark:text-ink-100')}>
                  {formatDate(lead.nextFollowUp)}
                  {followUpOverdue && ' (overdue)'}
                </p>
              </InfoRow>
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Notes</CardTitle>
              <span className="rounded-full bg-accent-50 px-2.5 py-1 text-xs font-semibold text-accent-600 dark:bg-accent-500/10 dark:text-accent-300">{(lead.noteList || []).length} saved</span>
            </CardHeader>
            <CardBody>
              <form onSubmit={handleAddNote} noValidate className="mb-5 space-y-2">
                <Textarea
                  aria-label="Add a note"
                  rows={2}
                  placeholder="Add a note about this lead..."
                  value={noteText}
                  error={noteError}
                  onChange={(e) => {
                    setNoteText(e.target.value)
                    setNoteError('')
                  }}
                />
                <div className="flex items-center justify-between">
                  <span className={cn('text-xs', noteText.length > MAX_NOTE ? 'text-danger-600' : 'text-ink-400')}>{noteText.length}/{MAX_NOTE}</span>
                  <Button type="submit" size="sm" leftIcon={<Plus size={14} />} disabled={!noteText.trim()}>Add Note</Button>
                </div>
              </form>
              {(lead.noteList || []).length === 0 ? (
                <EmptyState icon={StickyNote} title="No notes yet" description="Capture context from calls and meetings so the whole team stays aligned." className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {lead.noteList.map((n, i) => (
                    <li key={n.id} style={stagger(i, 50)} className="animate-slide-up rounded-xl border border-l-4 border-ink-100 border-l-accent-400 bg-accent-50/30 p-3.5 dark:border-ink-800 dark:border-l-accent-500 dark:bg-accent-500/5">
                      <p className="whitespace-pre-line text-sm text-ink-700 dark:text-ink-200">{n.text}</p>
                      <p className="mt-2 flex items-center gap-2 text-xs text-ink-400">
                        <Avatar name={n.author} size="xs" /> {n.author} · {formatDateTime(n.time)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Activities</CardTitle>
              <Button size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={() => setActivityOpen(true)}>Add Activity</Button>
            </CardHeader>
            <CardBody>
              {sortedActivities.length === 0 ? (
                <EmptyState title="No activities logged" description="Log a call, email or meeting to build the activity trail for this lead." actionLabel="Add Activity" onAction={() => setActivityOpen(true)} className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {sortedActivities.map((a) => {
                    const cfg = ACTIVITY_TYPE_CONFIG[a.type]
                    const Icon = cfg.icon
                    return (
                      <li key={a.id} className="flex gap-3 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-brand-50/40 dark:border-ink-800 dark:hover:bg-ink-800/40">
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
                  })}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Follow-ups & Meetings</CardTitle>
              <Button size="sm" variant="secondary" leftIcon={<CalendarPlus size={14} />} onClick={() => setMeetingOpen(true)}>Schedule Meeting</Button>
            </CardHeader>
            <CardBody>
              {!lead.nextFollowUp && followUps.length === 0 && upcomingMeetings.length === 0 ? (
                <EmptyState icon={BellRing} title="Nothing scheduled" description="Schedule a meeting or log a follow-up so this lead does not go cold." className="py-6" />
              ) : (
                <ul className="space-y-3">
                  {lead.nextFollowUp && (
                    <li className={cn('flex flex-wrap items-center justify-between gap-3 rounded-xl border p-3.5', followUpOverdue ? 'border-danger-200 bg-danger-50/60 dark:border-danger-500/30 dark:bg-danger-500/5' : 'border-warning-200 bg-warning-50/60 dark:border-warning-500/30 dark:bg-warning-500/5')}>
                      <div className="flex items-center gap-3">
                        <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', followUpOverdue ? TONES.danger.chip : TONES.warning.chip)}>
                          <BellRing size={16} aria-hidden="true" />
                        </span>
                        <div>
                          <p className="text-sm font-medium text-ink-800 dark:text-ink-100">Next follow-up with {lead.name}</p>
                          <p className="text-xs text-ink-500">{formatDate(lead.nextFollowUp)}{followUpOverdue && ' · overdue'}</p>
                        </div>
                      </div>
                      <Button size="sm" variant="secondary" leftIcon={<CheckCircle2 size={14} />} onClick={markFollowUpDone}>Mark done</Button>
                    </li>
                  )}
                  {upcomingMeetings.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3.5 dark:border-ink-800">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONES.info.chip)}>
                        <Video size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{m.title}</p>
                        <p className="text-xs text-ink-500">{formatDate(m.date)} at {m.time} · {m.type}</p>
                      </div>
                    </li>
                  ))}
                  {followUps.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3.5 dark:border-ink-800">
                      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', TONES.neutral.chip)}>
                        <BellRing size={16} aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{a.subject}</p>
                        <p className="text-xs text-ink-500">{formatDateTime(a.date)} · {a.owner}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Timeline</CardTitle>
            </CardHeader>
            <CardBody>
              <LeadTimeline items={timeline} />
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-4 sm:space-y-5 lg:space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Owner</CardTitle>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar name={lead.owner || '?'} />
                <div>
                  <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{lead.owner || 'Unassigned'}</p>
                  <p className="text-xs text-ink-400">Lead Owner</p>
                </div>
              </div>
              <Select
                label="Reassign owner"
                placeholder="Select a new owner"
                options={owners.map((o) => ({ value: o, label: o }))}
                value=""
                onChange={(e) => changeOwner(e.target.value)}
              />
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Priority & Source</CardTitle>
            </CardHeader>
            <CardBody className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Priority</span>
                <Badge tone={priorityTone(lead.priority)}>{cap(lead.priority)}</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Source</span>
                <span className="font-medium text-ink-700 dark:text-ink-200">{lead.source}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-500">Estimated value</span>
                <span className="rounded-full bg-brand-50 px-2.5 py-1 text-xs font-bold text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{formatCurrency(lead.value)}</span>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-2">
              <Button variant="secondary" className="w-full justify-center" leftIcon={<Target size={15} />} onClick={() => setActivityOpen(true)}>
                Add Activity
              </Button>
              <Button variant="secondary" className="w-full justify-center" leftIcon={<CalendarPlus size={15} />} onClick={() => setMeetingOpen(true)}>
                Schedule Meeting
              </Button>
              <Button as={Link} to="/admin/crm/leads" variant="ghost" className="w-full justify-center">
                Back to Leads
              </Button>
            </CardBody>
          </Card>
        </div>
      </div>

      <LeadFormModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSubmit={handleEdit} initialValues={lead} isSaving={busy} owners={owners.length ? owners : undefined} />
      <LogActivityModal isOpen={activityOpen} onClose={() => setActivityOpen(false)} onSubmit={handleAddActivity} isSaving={busy} owners={owners} defaultOwner={lead.owner} relatedTo={`${lead.name} (${lead.company})`} />
      <ScheduleMeetingModal isOpen={meetingOpen} onClose={() => setMeetingOpen(false)} onSubmit={handleScheduleMeeting} isSaving={busy} hosts={owners} defaultHost={lead.owner} defaultTitle={`Discussion with ${lead.name}`} withWhom={`${lead.name} (${lead.company})`} />
      <ConfirmDialog
        isOpen={convertOpen}
        onClose={() => setConvertOpen(false)}
        onConfirm={handleConvert}
        isLoading={busy}
        danger={false}
        title="Convert to client?"
        description={`${lead.company} will be added to your clients, this lead will be marked as won and you will be taken to the new client profile.`}
        confirmLabel="Convert to Client"
      />
    </div>
  )
}
