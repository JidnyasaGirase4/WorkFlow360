import { useEffect, useMemo, useState } from 'react'
import { Plus, Phone, Mail, Video, StickyNote, BellRing, List, History, Activity as ActivityIcon } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import Button from '../../../components/common/Button'
import Input from '../../../components/common/Input'
import Select from '../../../components/common/Select'
import Textarea from '../../../components/common/Textarea'
import Modal from '../../../components/common/Modal'
import SearchBar from '../../../components/common/SearchBar'
import DataTable from '../../../components/common/DataTable'
import Card, { CardBody } from '../../../components/common/Card'
import Badge from '../../../components/common/Badge'
import Avatar from '../../../components/common/Avatar'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import LeadTimeline from '../../../components/business/LeadTimeline'
import ProjectViewToggle from '../../../components/business/ProjectViewToggle'
import { TONES } from '../../../components/business/ProjectTones'
import { Skeleton } from '../../../components/common/Skeleton'
import { crmActivityService } from '../../../services/crmActivityService'
import { leadService } from '../../../services/leadService'
import { clientService } from '../../../services/clientService'
import { employeeService } from '../../../services/employeeService'
import { formatDateTime } from '../../../utils/format'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'

const ACTIVITY_TYPES = {
  call: { label: 'Call', icon: Phone, tone: 'info', verb: 'logged a call with' },
  email: { label: 'Email', icon: Mail, tone: 'brand', verb: 'emailed' },
  meeting: { label: 'Meeting', icon: Video, tone: 'success', verb: 'met with' },
  note: { label: 'Note', icon: StickyNote, tone: 'neutral', verb: 'added a note on' },
  follow_up: { label: 'Follow-up', icon: BellRing, tone: 'warning', verb: 'scheduled a follow-up with' },
}

const TYPE_OPTIONS = Object.entries(ACTIVITY_TYPES).map(([value, cfg]) => ({ value, label: cfg.label }))

const DEFAULT_OUTCOME = {
  call: 'Connected',
  email: 'Sent',
  meeting: 'Completed',
  note: 'Logged',
  follow_up: 'Pending',
}

const EMPTY_FORM = { type: 'call', subject: '', related: '', owner: '', date: '', time: '', notes: '' }

function pad(n) {
  return String(n).padStart(2, '0')
}

function TypeBadge({ type }) {
  const cfg = ACTIVITY_TYPES[type]
  if (!cfg) return null
  const Icon = cfg.icon
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap">
      <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl', TONES[cfg.tone].chip)}>
        <Icon size={15} aria-hidden="true" />
      </span>
      <span className={cn('text-sm font-semibold', TONES[cfg.tone].text)}>{cfg.label}</span>
    </span>
  )
}

export default function Activities() {
  const { toast } = useToast()

  const [data, setData] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [ownerFilter, setOwnerFilter] = useState('')
  const [view, setView] = useState('table')
  const [modalOpen, setModalOpen] = useState(false)
  const [values, setValues] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([
      crmActivityService.list(),
      leadService.list(),
      clientService.list(),
      employeeService.list(),
    ]).then(
      ([activities, leads, clients, employees]) => {
        if (active) setData({ activities, leads, clients, employees })
      },
      () => {
        if (active) setLoadError(true)
      }
    )
    return () => {
      active = false
    }
  }, [attempt])

  function retryLoad() {
    setLoadError(false)
    setData(null)
    setAttempt((a) => a + 1)
  }

  const isLoading = data === null && !loadError
  const activities = useMemo(() => data?.activities ?? [], [data])

  const owners = useMemo(() => [...new Set(activities.map((a) => a.owner))].sort(), [activities])

  const relatedOptions = useMemo(() => {
    if (!data) return []
    return [
      ...data.leads.map((l) => ({ value: `lead:${l.id}`, label: `${l.name} — ${l.company} (Lead)` })),
      ...data.clients.map((c) => ({ value: `client:${c.id}`, label: `${c.contactPerson} — ${c.company} (Client)` })),
    ]
  }, [data])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return activities
      .filter((a) => {
        const matchesSearch =
          !q ||
          a.subject.toLowerCase().includes(q) ||
          a.contact.toLowerCase().includes(q) ||
          a.company.toLowerCase().includes(q) ||
          a.notes.toLowerCase().includes(q)
        return matchesSearch && (!typeFilter || a.type === typeFilter) && (!ownerFilter || a.owner === ownerFilter)
      })
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [activities, search, typeFilter, ownerFilter])

  const hasFilters = Boolean(search || typeFilter || ownerFilter)

  const timelineItems = useMemo(
    () =>
      filtered.map((a) => ({
        id: a.id,
        actor: a.owner,
        text: `${ACTIVITY_TYPES[a.type].verb} ${a.contact} (${a.company}) — ${a.subject}`,
        time: (
          <>
            {formatDateTime(a.date)} · {ACTIVITY_TYPES[a.type].label}
            {a.outcome ? ` · ${a.outcome}` : ''}
          </>
        ),
        tone: ACTIVITY_TYPES[a.type].tone,
        icon: ACTIVITY_TYPES[a.type].icon,
      })),
    [filtered]
  )

  function clearFilters() {
    setSearch('')
    setTypeFilter('')
    setOwnerFilter('')
  }

  function openModal() {
    const now = new Date()
    setValues({
      ...EMPTY_FORM,
      date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
      time: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
    })
    setErrors({})
    setModalOpen(true)
  }

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!values.subject.trim()) next.subject = 'Subject is required'
    else if (values.subject.trim().length < 5) next.subject = 'Subject should be at least 5 characters'
    if (!values.related) next.related = 'Select the lead or client this relates to'
    if (!values.owner) next.owner = 'Select an owner'
    if (!values.date) next.date = 'Please pick a date'
    if (!values.time) next.time = 'Please pick a time'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const [kind, id] = values.related.split(':')
    const lead = kind === 'lead' ? data.leads.find((l) => l.id === id) : null
    const client = kind === 'client' ? data.clients.find((c) => c.id === id) : null

    setIsSaving(true)
    crmActivityService
      .create({
        id: `crm-act-${Date.now()}`,
        type: values.type,
        subject: values.subject.trim(),
        notes: values.notes.trim(),
        contact: lead?.name ?? client?.contactPerson ?? '',
        company: lead?.company ?? client?.company ?? '',
        leadId: lead?.id ?? null,
        clientId: client?.id ?? null,
        owner: values.owner,
        date: `${values.date}T${values.time}:00`,
        outcome: DEFAULT_OUTCOME[values.type],
      })
      .then((item) => {
        setData((prev) => ({ ...prev, activities: [item, ...prev.activities] }))
        toast.success('Activity logged successfully')
        setModalOpen(false)
      })
      .finally(() => setIsSaving(false))
  }

  const columns = [
    {
      key: 'type',
      header: 'Type',
      sortable: true,
      render: (row) => <TypeBadge type={row.type} />,
    },
    {
      key: 'subject',
      header: 'Activity',
      sortable: true,
      render: (row) => (
        <div className="max-w-xs">
          <p className="font-medium text-ink-800 dark:text-ink-100">{row.subject}</p>
          {row.notes && <p className="mt-0.5 line-clamp-1 text-xs text-ink-400">{row.notes}</p>}
        </div>
      ),
    },
    {
      key: 'contact',
      header: 'Related to',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <div>
            <p className="font-medium text-ink-800 dark:text-ink-100">{row.contact}</p>
            <p className="text-xs text-ink-400">{row.company}</p>
          </div>
          <Badge tone={row.clientId ? 'success' : 'accent'}>{row.clientId ? 'Client' : 'Lead'}</Badge>
        </div>
      ),
    },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.owner} size="xs" />
          <span className="whitespace-nowrap">{row.owner}</span>
        </div>
      ),
    },
    {
      key: 'date',
      header: 'Date',
      sortable: true,
      render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.date)}</span>,
    },
    {
      key: 'outcome',
      header: 'Outcome',
      render: (row) => <span className="text-xs text-ink-500">{row.outcome || '—'}</span>,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Activities"
        description="Every call, email, meeting, note and follow-up logged against your leads and clients."
        breadcrumbItems={[{ label: 'CRM' }, { label: 'Activities' }]}
        action={
          <Button leftIcon={<Plus size={15} />} onClick={openModal} disabled={data === null}>
            Log activity
          </Button>
        }
      />

      {loadError ? (
        <ErrorState title="Couldn't load activities" description="Something went wrong while fetching your CRM activities. Please try again." onRetry={retryLoad} />
      ) : (
      <>
      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4 lg:flex-row lg:items-center dark:border-ink-800 dark:bg-ink-900">
        <SearchBar value={search} onChange={setSearch} placeholder="Search activities, contacts, companies..." className="lg:w-80" />
        <div className="grid grid-cols-1 gap-2 min-[480px]:grid-cols-2 sm:flex">
          <Select
            aria-label="Filter by type"
            placeholder="All types"
            options={TYPE_OPTIONS}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="sm:w-40"
          />
          <Select
            aria-label="Filter by owner"
            placeholder="All owners"
            options={owners.map((o) => ({ value: o, label: o }))}
            value={ownerFilter}
            onChange={(e) => setOwnerFilter(e.target.value)}
            className="sm:w-48"
          />
        </div>
        {hasFilters && (
          <button type="button" onClick={clearFilters} className="focus-ring min-h-[2.25rem] self-start rounded-lg px-2 text-xs font-semibold text-accent-600 transition-colors hover:bg-accent-50 lg:self-center dark:text-accent-300 dark:hover:bg-accent-500/10">
            Clear filters
          </button>
        )}
        <ProjectViewToggle
          className="lg:ml-auto"
          value={view}
          onChange={setView}
          ariaLabel="Activity view"
          options={[
            { value: 'table', label: 'Table', text: 'Table', icon: List },
            { value: 'timeline', label: 'Timeline', text: 'Timeline', icon: History },
          ]}
        />
      </div>

      {view === 'table' ? (
        <DataTable
          columns={columns}
          data={filtered}
          isLoading={isLoading}
          pageSize={8}
          emptyTitle="No activities found"
          emptyDescription={hasFilters ? 'No activity matches your filters. Try a different search or clear the filters.' : 'Log your first call, email or meeting to build the activity trail.'}
          emptyActionLabel={hasFilters ? 'Clear filters' : 'Log activity'}
          onEmptyAction={hasFilters ? clearFilters : openModal}
        />
      ) : (
        <Card>
          <CardBody>
            {isLoading ? (
              <div className="space-y-5" aria-busy="true" aria-label="Loading activities">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3.5 w-full" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                  </div>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={ActivityIcon}
                title="No activities found"
                description={hasFilters ? 'No activity matches your filters. Try a different search or clear the filters.' : 'Log your first call, email or meeting to build the activity trail.'}
                actionLabel={hasFilters ? 'Clear filters' : 'Log activity'}
                onAction={hasFilters ? clearFilters : openModal}
              />
            ) : (
              <LeadTimeline items={timelineItems} />
            )}
          </CardBody>
        </Card>
      )}
      </>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Log activity"
        description="Record an interaction with a lead or client"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              Log activity
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Select
            label="Type"
            required
            options={TYPE_OPTIONS}
            value={values.type}
            onChange={(e) => setField('type', e.target.value)}
          />
          <Select
            label="Owner"
            required
            placeholder="Select an owner"
            options={(data?.employees ?? []).map((emp) => ({ value: emp.name, label: emp.name }))}
            value={values.owner}
            error={errors.owner}
            onChange={(e) => setField('owner', e.target.value)}
          />
          <Input
            label="Subject"
            required
            wrapperClassName="sm:col-span-2"
            placeholder="e.g. Demo follow-up — pricing questions"
            value={values.subject}
            error={errors.subject}
            onChange={(e) => setField('subject', e.target.value)}
          />
          <Select
            label="Related lead or client"
            required
            wrapperClassName="sm:col-span-2"
            placeholder="Select a lead or client"
            options={relatedOptions}
            value={values.related}
            error={errors.related}
            onChange={(e) => setField('related', e.target.value)}
          />
          <Input
            label="Date"
            type="date"
            required
            value={values.date}
            error={errors.date}
            onChange={(e) => setField('date', e.target.value)}
          />
          <Input
            label="Time"
            type="time"
            required
            value={values.time}
            error={errors.time}
            onChange={(e) => setField('time', e.target.value)}
          />
          <Textarea
            label="Notes"
            wrapperClassName="sm:col-span-2"
            rows={3}
            placeholder="Key points discussed, decisions and next steps"
            value={values.notes}
            onChange={(e) => setField('notes', e.target.value)}
          />
        </form>
      </Modal>
    </div>
  )
}
