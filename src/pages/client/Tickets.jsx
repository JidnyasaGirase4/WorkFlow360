import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, LifeBuoy, Paperclip, X } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import DataTable from '../../components/common/DataTable'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import Textarea from '../../components/common/Textarea'
import Badge from '../../components/common/Badge'
import StatusBadge from '../../components/common/StatusBadge'
import SearchBar from '../../components/common/SearchBar'
import FilterBar from '../../components/common/FilterBar'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonTable } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { createClientTicket } from '../../utils/portalStores'
import { TICKET_CATEGORIES } from '../../mockData/tickets'
import { formatDate, formatFileSize } from '../../utils/format'

const PRIORITY_OPTIONS = [
  { value: 'low', label: 'Low - general question' },
  { value: 'medium', label: 'Medium - needs attention' },
  { value: 'high', label: 'High - blocking some work' },
  { value: 'urgent', label: 'Urgent - business critical' },
]
const STATUS_OPTIONS = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_client', label: 'Waiting for You' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]
const PRIORITY_TONE = { urgent: 'danger', high: 'warning', medium: 'brand', low: 'neutral' }
const EMPTY_FORM = { subject: '', category: '', priority: 'medium', project: '', description: '' }
const MAX_ATTACHMENT_MB = 5

function TicketsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading tickets">
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={5} cols={5} />
      </div>
    </div>
  )
}

export default function ClientTickets() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { isLoading, isError, retry } = usePortalLoad()
  const { user, company, contactName, projects, tickets } = useClientData()

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [attachment, setAttachment] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  // "New Support Ticket" links elsewhere in the portal navigate here with { openCreate: true }.
  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) setModalOpen(true)
    },
    { immediate: true }
  )
  useEffect(() => {
    if (location.state?.openCreate) navigate(location.pathname, { replace: true, state: {} })
  }, [location, navigate])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tickets.filter((t) => (!q || t.subject.toLowerCase().includes(q) || t.ticketId.toLowerCase().includes(q)) && (!status || t.status === status))
  }, [tickets, search, status])

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }))
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }))
  }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setErrors({})
    setAttachment(null)
    setIsSaving(false)
  }

  function pickAttachment(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, attachment: `Attachment must be under ${MAX_ATTACHMENT_MB} MB (yours is ${formatFileSize(file.size)}).` }))
      return
    }
    setErrors((prev) => ({ ...prev, attachment: undefined }))
    setAttachment(file)
  }

  function validate() {
    const next = {}
    if (!form.subject.trim()) next.subject = 'Subject is required.'
    else if (form.subject.trim().length < 5) next.subject = 'Subject must be at least 5 characters.'
    if (!form.category) next.category = 'Choose a category.'
    if (!form.description.trim()) next.description = 'Please describe the issue.'
    else if (form.description.trim().length < 20) next.description = 'Add a little more detail (at least 20 characters).'
    if (errors.attachment) next.attachment = errors.attachment
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit(e) {
    e?.preventDefault()
    if (!validate()) return
    setIsSaving(true)
    setTimeout(() => {
      const author = user?.name || contactName
      const ticket = createClientTicket({
        subject: form.subject.trim(),
        client: company,
        category: form.category,
        priority: form.priority,
        project: form.project || null,
        description: form.description.trim(),
        attachments: attachment ? [{ name: attachment.name, size: formatFileSize(attachment.size) }] : [],
        messages: [
          {
            from: author,
            role: 'client',
            text: form.description.trim(),
            time: new Date().toISOString(),
            attachments: attachment ? [{ name: attachment.name, size: formatFileSize(attachment.size) }] : undefined,
          },
        ],
      })
      toast.success(`Ticket ${ticket.ticketId} created. We'll respond shortly.`)
      closeModal()
      navigate(`/client/tickets/${ticket.id}`)
    }, 600)
  }

  const columns = [
    { key: 'ticketId', header: 'Ticket', sortable: true, render: (row) => <span className="inline-flex items-center gap-2 font-semibold text-ink-800 dark:text-ink-100"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300" aria-hidden="true"><LifeBuoy size={14} /></span>{row.ticketId}</span> },
    { key: 'subject', header: 'Subject', render: (row) => <span className="line-clamp-2 max-w-sm">{row.subject}</span> },
    { key: 'category', header: 'Category', mobileHidden: true, render: (row) => row.category || '—' },
    { key: 'priority', header: 'Priority', render: (row) => <Badge tone={PRIORITY_TONE[row.priority]} dot>{row.priority}</Badge> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdDate', header: 'Created', sortable: true, render: (row) => formatDate(row.createdDate) },
  ]

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        description="Raise and track support requests with the WorkFlow360 team."
        breadcrumbItems={[{ label: 'Support' }, { label: 'Tickets' }]}
        homeHref="/client/dashboard"
        action={
          <Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
            New Ticket
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<TicketsSkeleton />}>
        {tickets.length === 0 ? (
          <EmptyState icon={LifeBuoy} title="No support tickets" description="Raise a ticket and our team will get back to you." actionLabel="New Ticket" onAction={() => setModalOpen(true)} />
        ) : (
          <>
            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search tickets..." />}
              chips={status ? [{ key: 'status', label: `Status: ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`, onRemove: () => setStatus('') }] : []}
              onClearAll={() => setStatus('')}
            >
              <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-48" />
            </FilterBar>
            <DataTable columns={columns} data={filtered} onRowClick={(row) => navigate(`/client/tickets/${row.id}`)} ariaLabel="Support tickets" emptyTitle="No tickets match" emptyDescription="Try a different search or clear the filter." />
          </>
        )}
      </AsyncState>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="New Support Ticket"
        description="Describe the issue and our team will respond shortly."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              Submit Ticket
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          <Input label="Subject" required value={form.subject} onChange={(e) => update('subject', e.target.value)} error={errors.subject} placeholder="Brief summary of the issue" />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Category" required placeholder="Select category" options={TICKET_CATEGORIES.map((c) => ({ value: c, label: c }))} value={form.category} onChange={(e) => update('category', e.target.value)} error={errors.category} />
            <Select label="Priority" options={PRIORITY_OPTIONS} value={form.priority} onChange={(e) => update('priority', e.target.value)} />
          </div>
          {projects.length > 0 && (
            <Select label="Related project" hint="Optional" options={[{ value: '', label: 'Not project specific' }, ...projects.map((p) => ({ value: p.name, label: p.name }))]} value={form.project} onChange={(e) => update('project', e.target.value)} />
          )}
          <Textarea label="Description" required rows={5} value={form.description} onChange={(e) => update('description', e.target.value)} error={errors.description} placeholder="What happened, what did you expect, and any steps to reproduce..." />
          <div>
            <label className="focus-ring has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-500 inline-flex h-9 cursor-pointer items-center gap-2 rounded-lg border border-ink-200 px-3 text-sm font-medium text-ink-700 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-200 dark:hover:bg-ink-800">
              <Paperclip size={14} /> Attach a file
              <input type="file" className="sr-only" onChange={pickAttachment} />
            </label>
            {attachment && (
              <span className="ml-3 inline-flex items-center gap-1.5 text-xs text-ink-500">
                {attachment.name} ({formatFileSize(attachment.size)})
                <button type="button" onClick={() => setAttachment(null)} aria-label="Remove attachment" className="focus-ring rounded p-0.5 hover:bg-ink-100 dark:hover:bg-ink-800">
                  <X size={12} />
                </button>
              </span>
            )}
            {errors.attachment && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">{errors.attachment}</p>}
          </div>
        </form>
      </Modal>
    </div>
  )
}
