import { useState } from 'react'
import { CalendarDays, Clock, Building2, Briefcase, ExternalLink, Copy, Check, Video } from 'lucide-react'
import Drawer from '../common/Drawer'
import Badge from '../common/Badge'
import Button from '../common/Button'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Avatar from '../common/Avatar'
import ConfirmDialog from '../common/ConfirmDialog'
import { useToast } from '../../context/ToastContext'
import { formatDate } from '../../utils/format'
import { MEETING_STATUS, MEETING_STATUS_OPTIONS, MEETING_TYPE_ICON, canJoin, formatTime } from '../../utils/meetingUtils'

export default function MeetingDrawer({ meeting, onClose, onUpdate }) {
  return (
    <Drawer isOpen={Boolean(meeting)} onClose={onClose} title="Meeting details" width="max-w-lg">
      {meeting && <MeetingDetail key={meeting.id} meeting={meeting} onUpdate={onUpdate} />}
    </Drawer>
  )
}

function MeetingDetail({ meeting, onUpdate }) {
  const { toast } = useToast()
  const [notes, setNotes] = useState(meeting.notes || '')
  const [savingNotes, setSavingNotes] = useState(false)
  const [pendingStatus, setPendingStatus] = useState(null)
  const [savingStatus, setSavingStatus] = useState(false)
  const [copied, setCopied] = useState(false)

  const TypeIcon = MEETING_TYPE_ICON[meeting.type] || CalendarDays
  const status = MEETING_STATUS[meeting.status] || MEETING_STATUS.upcoming
  const notesDirty = notes !== (meeting.notes || '')

  async function saveNotes() {
    setSavingNotes(true)
    await onUpdate(meeting.id, { notes: notes.trim() })
    setSavingNotes(false)
    toast.success('Meeting notes saved')
  }

  async function applyStatus(next) {
    setSavingStatus(true)
    await onUpdate(meeting.id, { status: next })
    setSavingStatus(false)
    setPendingStatus(null)
    toast.success(`Meeting marked as ${MEETING_STATUS[next].label.toLowerCase()}`)
  }

  function handleStatusChange(e) {
    const next = e.target.value
    if (next === meeting.status) return
    if (next === 'cancelled') setPendingStatus(next)
    else applyStatus(next)
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(meeting.link)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      toast.error('Could not copy the link')
    }
  }

  return (
    <div className="space-y-6">
      <div className="gradient-soft rounded-2xl border border-ink-100 p-4 dark:border-ink-800">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
            <TypeIcon size={20} />
          </span>
          <h3 className="min-w-0 flex-1 text-lg font-semibold text-ink-800 dark:text-ink-50">{meeting.title}</h3>
          <Badge tone={status.tone} dot className="shrink-0">
            {status.label}
          </Badge>
        </div>
        {canJoin(meeting) && (
          <Button as="a" href={meeting.link} target="_blank" rel="noreferrer noopener" className="mt-4 w-full" leftIcon={<Video size={16} />} rightIcon={<ExternalLink size={14} />}>
            Join meeting
          </Button>
        )}
      </div>

      <dl className="grid grid-cols-1 gap-4 rounded-2xl border border-ink-100 bg-white p-4 text-sm shadow-card sm:grid-cols-2 dark:border-ink-800 dark:bg-ink-900">
        <Info icon={CalendarDays} label="Date" value={formatDate(meeting.date, { weekday: 'short' })} />
        <Info icon={Clock} label="Time" value={formatTime(meeting.time)} />
        <Info icon={TypeIcon} label="Meeting type" value={meeting.type} />
        <Info icon={Building2} label="Client" value={meeting.client} />
        <Info icon={Briefcase} label="Project" value={meeting.project || 'Not linked to a project'} className="sm:col-span-2" />
      </dl>

      {meeting.link && (
        <div>
          <p className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">Meeting link</p>
          <div className="flex items-center gap-2 rounded-xl border border-ink-200 bg-ink-50/60 px-3 py-2 dark:border-ink-700 dark:bg-ink-800/40">
            <span className="min-w-0 flex-1 truncate text-sm text-ink-600 dark:text-ink-300">{meeting.link}</span>
            <button type="button" onClick={copyLink} className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg text-ink-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-ink-800" aria-label="Copy meeting link">
              {copied ? <Check size={15} className="text-success-500" /> : <Copy size={15} />}
            </button>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-sm font-medium text-ink-700 dark:text-ink-200">Participants ({meeting.participants.length})</p>
        {meeting.participants.length === 0 ? (
          <p className="text-sm text-ink-400">No participants added.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {meeting.participants.map((name) => (
              <li key={name} className="flex min-w-0 items-center gap-2.5 rounded-xl border border-ink-100 px-3 py-2 transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40">
                <Avatar name={name} size="sm" />
                <span className="truncate text-sm text-ink-700 dark:text-ink-200">{name}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Select label="Meeting status" options={MEETING_STATUS_OPTIONS} value={meeting.status} onChange={handleStatusChange} disabled={savingStatus} />

      <div>
        <Textarea label="Meeting notes" rows={5} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Agenda, decisions and follow-ups…" />
        <div className="mt-2 flex items-center justify-end gap-2">
          {notesDirty && (
            <Button variant="ghost" size="sm" onClick={() => setNotes(meeting.notes || '')} disabled={savingNotes}>
              Discard
            </Button>
          )}
          <Button size="sm" onClick={saveNotes} isLoading={savingNotes} disabled={!notesDirty}>
            Save notes
          </Button>
        </div>
      </div>

      <ConfirmDialog
        isOpen={pendingStatus === 'cancelled'}
        onClose={() => setPendingStatus(null)}
        onConfirm={() => applyStatus('cancelled')}
        isLoading={savingStatus}
        title="Cancel this meeting?"
        description={`Participants of "${meeting.title}" will see it as cancelled. You can reschedule by creating a new meeting.`}
        confirmLabel="Cancel meeting"
        cancelLabel="Keep meeting"
      />
    </div>
  )
}

function Info({ icon: Icon, label, value, className }) {
  return (
    <div className={className}>
      <dt className="flex items-center gap-2 text-xs text-ink-400">
        <span className="flex h-6 w-6 items-center justify-center rounded-md bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><Icon size={13} /></span> {label}
      </dt>
      <dd className="mt-1 break-words pl-8 font-medium text-ink-800 dark:text-ink-100">{value}</dd>
    </div>
  )
}
