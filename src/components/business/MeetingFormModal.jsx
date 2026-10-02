import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import Modal from '../common/Modal'
import Button from '../common/Button'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Checkbox from '../common/Checkbox'
import { clients } from '../../mockData/clients'
import { contacts } from '../../mockData/contacts'
import { employees } from '../../mockData/employees'
import { projects } from '../../mockData/projects'
import { MEETING_TYPE_OPTIONS } from '../../utils/meetingUtils'
import { cn } from '../../utils/cn'

const EMPTY = { title: '', client: '', project: '', date: '', time: '', type: 'Video Call', link: '', participants: [], notes: '' }
const FORM_ID = 'create-meeting-form'

function isValidUrl(value) {
  try {
    const u = new URL(value)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}

export default function MeetingFormModal({ isOpen, onClose, onSubmit, isSaving = false }) {
  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title="Schedule Meeting"
      description="Set up a meeting with a client and your team."
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Cancel
          </Button>
          <Button type="submit" form={FORM_ID} isLoading={isSaving}>
            Schedule Meeting
          </Button>
        </>
      }
    >
      <MeetingForm onSubmit={onSubmit} disabled={isSaving} />
    </Modal>
  )
}

// Mounted only while the modal is open, so every open starts from a clean form.
function MeetingForm({ onSubmit, disabled }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})

  const clientProjects = useMemo(() => projects.filter((p) => p.client === values.client), [values.client])

  function update(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function handleClientChange(client) {
    setValues((v) => ({ ...v, client, project: '' }))
    if (errors.client) setErrors((e) => ({ ...e, client: undefined }))
  }

  function validate() {
    const next = {}
    if (!values.title.trim()) next.title = 'Meeting title is required'
    if (!values.client) next.client = 'Please select a client'
    if (!values.date) next.date = 'Please pick a date'
    if (!values.time) next.time = 'Please pick a time'
    if (values.participants.length === 0) next.participants = 'Add at least one participant'
    if (values.link.trim() && !isValidUrl(values.link.trim())) next.link = 'Enter a valid link starting with https://'
    return next
  }

  function handleSubmit(e) {
    e.preventDefault()
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit({ ...values, title: values.title.trim(), link: values.link.trim(), notes: values.notes.trim() })
  }

  return (
    <form id={FORM_ID} onSubmit={handleSubmit} noValidate className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      <Input
        label="Meeting title"
        required
        wrapperClassName="sm:col-span-2"
        placeholder="e.g. Sprint review - CRM Implementation"
        value={values.title}
        error={errors.title}
        disabled={disabled}
        onChange={(e) => update('title', e.target.value)}
      />
      <Select
        label="Client"
        required
        placeholder="Select a client"
        options={clients.map((c) => ({ value: c.company, label: c.company }))}
        value={values.client}
        error={errors.client}
        disabled={disabled}
        onChange={(e) => handleClientChange(e.target.value)}
      />
      <Select
        label="Project"
        placeholder={!values.client ? 'Select a client first' : clientProjects.length === 0 ? 'No projects for this client' : 'No project (optional)'}
        options={clientProjects.map((p) => ({ value: p.name, label: p.name }))}
        value={values.project}
        disabled={disabled || clientProjects.length === 0}
        onChange={(e) => update('project', e.target.value)}
      />
      <Input label="Date" type="date" required value={values.date} error={errors.date} disabled={disabled} onChange={(e) => update('date', e.target.value)} />
      <Input label="Time" type="time" required value={values.time} error={errors.time} disabled={disabled} onChange={(e) => update('time', e.target.value)} />
      <Select label="Meeting type" required options={MEETING_TYPE_OPTIONS} value={values.type} disabled={disabled} onChange={(e) => update('type', e.target.value)} />
      <Input
        label="Meeting link"
        type="url"
        placeholder={values.type === 'Video Call' ? 'Leave blank to auto-generate' : 'Only used for video calls'}
        value={values.link}
        error={errors.link}
        disabled={disabled || values.type !== 'Video Call'}
        onChange={(e) => update('link', e.target.value)}
      />

      <div className="sm:col-span-2">
        <ParticipantPicker selected={values.participants} onChange={(list) => update('participants', list)} error={errors.participants} disabled={disabled} />
      </div>

      <Textarea label="Notes" wrapperClassName="sm:col-span-2" rows={3} placeholder="Agenda or context for the meeting" value={values.notes} disabled={disabled} onChange={(e) => update('notes', e.target.value)} />
    </form>
  )
}

const TEAM = employees.map((e) => ({ name: e.name, sub: e.designation }))
const CLIENT_CONTACTS = contacts.map((c) => ({ name: c.name, sub: `${c.role}, ${c.company}` }))

function ParticipantPicker({ selected, onChange, error, disabled }) {
  const [query, setQuery] = useState('')
  const q = query.trim().toLowerCase()
  const filter = (list) => list.filter((p) => !q || p.name.toLowerCase().includes(q) || p.sub.toLowerCase().includes(q))
  const groups = [
    { title: 'Team', people: filter(TEAM) },
    { title: 'Client contacts', people: filter(CLIENT_CONTACTS) },
  ]

  function toggle(name) {
    onChange(selected.includes(name) ? selected.filter((n) => n !== name) : [...selected, name])
  }

  return (
    <fieldset disabled={disabled}>
      <legend className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">
        Participants<span className="ml-0.5 text-danger-500">*</span>
        <span className="ml-2 text-xs font-normal text-ink-400">{selected.length} selected</span>
      </legend>
      <div className={cn('rounded-xl border', error ? 'border-danger-400' : 'border-ink-200 dark:border-ink-700')}>
        {selected.length > 0 && (
          <ul className="flex flex-wrap gap-1.5 border-b border-ink-100 p-2.5 dark:border-ink-800">
            {selected.map((name) => (
              <li key={name} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-0.5 pl-2.5 pr-1 text-xs font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
                {name}
                <button type="button" onClick={() => toggle(name)} className="rounded-full p-0.5 hover:bg-brand-100 dark:hover:bg-brand-500/20" aria-label={`Remove ${name}`}>
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="relative border-b border-ink-100 dark:border-ink-800">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people..."
            aria-label="Search participants"
            className="h-9 w-full bg-transparent pl-9 pr-3 text-sm text-ink-800 placeholder:text-ink-400 focus:outline-none dark:text-ink-100"
          />
        </div>
        <div className="max-h-44 overflow-y-auto p-2.5">
          {groups.every((g) => g.people.length === 0) && <p className="py-3 text-center text-sm text-ink-400">No people match this search.</p>}
          {groups.map(
            (g) =>
              g.people.length > 0 && (
                <div key={g.title} className="mb-2 last:mb-0">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">{g.title}</p>
                  <div className="grid grid-cols-1 gap-x-3 gap-y-1.5 sm:grid-cols-2">
                    {g.people.map((p) => (
                      <Checkbox key={p.name} label={p.name} checked={selected.includes(p.name)} onChange={() => toggle(p.name)} />
                    ))}
                  </div>
                </div>
              )
          )}
        </div>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">{error}</p>}
    </fieldset>
  )
}
