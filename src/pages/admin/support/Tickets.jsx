import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, LifeBuoy, Download } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import TicketCard from '../../../components/business/TicketCard'
import TicketFormModal from '../../../components/business/TicketFormModal'
import Button from '../../../components/common/Button'
import Card from '../../../components/common/Card'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import DataTable from '../../../components/common/DataTable'
import FilterBar from '../../../components/common/FilterBar'
import StatusBadge from '../../../components/common/StatusBadge'
import Avatar from '../../../components/common/Avatar'
import Pagination from '../../../components/common/Pagination'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton } from '../../../components/common/Skeleton'
import { ticketService } from '../../../services/ticketService'
import { employees } from '../../../mockData/employees'
import { formatDate } from '../../../utils/format'
import { downloadCsv } from '../../../utils/exportCsv'
import { cn } from '../../../utils/cn'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useResetOnChange } from '../../../hooks/useResetOnChange'
import { useToast } from '../../../context/ToastContext'

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_client', label: 'Waiting for Client' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]
const STATUS_LABEL = Object.fromEntries(STATUS_CHIPS.map((s) => [s.value, s.label]))
const PRIORITY_OPTIONS = [
  { value: '', label: 'All priorities' },
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
]
const PAGE_SIZE = 8
const PRIORITY_RANK = { low: 0, medium: 1, high: 2, urgent: 3 }

const fetchTickets = () => ticketService.list()

function nextTicketNumber(list) {
  const max = list.reduce((m, t) => Math.max(m, Number(t.ticketId.replace(/\D/g, '')) || 0), 2300)
  return `TCK-${max + 1}`
}

export default function Tickets() {
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const { data: tickets, loading, error, reload, setData } = useAsyncData(fetchTickets, 'tickets')

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [cardPage, setCardPage] = useState(1)
  const [modalOpen, setModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

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

  const list = useMemo(() => tickets || [], [tickets])

  const counts = useMemo(() => {
    const c = { '': list.length }
    list.forEach((t) => {
      c[t.status] = (c[t.status] || 0) + 1
    })
    return c
  }, [list])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return list.filter((t) => {
      const matchesSearch =
        !q || t.subject.toLowerCase().includes(q) || t.ticketId.toLowerCase().includes(q) || t.client.toLowerCase().includes(q) || t.assignee.toLowerCase().includes(q)
      return matchesSearch && (!statusFilter || t.status === statusFilter) && (!priorityFilter || t.priority === priorityFilter) && (!assigneeFilter || t.assignee === assigneeFilter)
    })
  }, [list, search, statusFilter, priorityFilter, assigneeFilter])

  // Reset mobile pagination whenever the filters change.
  useResetOnChange([search, statusFilter, priorityFilter, assigneeFilter], () => setCardPage(1))

  const cardTotalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const cardPageSafe = Math.min(cardPage, cardTotalPages)
  const cardRows = filtered.slice((cardPageSafe - 1) * PAGE_SIZE, cardPageSafe * PAGE_SIZE)

  const activeFilters = [
    statusFilter && { key: 'status', label: `Status: ${STATUS_LABEL[statusFilter]}`, onRemove: () => setStatusFilter('') },
    priorityFilter && { key: 'priority', label: `Priority: ${priorityFilter[0].toUpperCase()}${priorityFilter.slice(1)}`, onRemove: () => setPriorityFilter('') },
    assigneeFilter && { key: 'assignee', label: `Assignee: ${assigneeFilter}`, onRemove: () => setAssigneeFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setPriorityFilter('')
    setAssigneeFilter('')
  }

  async function handleCreate(values) {
    setIsSaving(true)
    try {
      const now = new Date().toISOString()
      const created = await ticketService.create({
        id: `tkt-${Date.now()}`,
        ticketId: nextTicketNumber(list),
        subject: values.subject,
        client: values.client,
        assignee: values.assignee,
        priority: values.priority,
        status: 'open',
        category: values.category,
        createdDate: now.slice(0, 10),
        description: values.description,
        attachments: values.attachment ? [values.attachment] : [],
        messages: [{ from: values.client, role: 'client', text: values.description, time: now, attachments: values.attachment ? [values.attachment] : undefined }],
        internalNotes: [],
      })
      setData((prev) => [created, ...(prev || [])])
      setModalOpen(false)
      toast.success(`Ticket ${created.ticketId} created and assigned to ${values.assignee}`)
    } catch {
      toast.error('Could not create the ticket. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  function exportCsv() {
    downloadCsv(
      'support-tickets',
      [
        { header: 'Ticket ID', accessor: (t) => t.ticketId },
        { header: 'Subject', accessor: (t) => t.subject },
        { header: 'Client', accessor: (t) => t.client },
        { header: 'Assigned employee', accessor: (t) => t.assignee },
        { header: 'Priority', accessor: (t) => t.priority },
        { header: 'Status', accessor: (t) => STATUS_LABEL[t.status] },
        { header: 'Created date', accessor: (t) => t.createdDate },
      ],
      filtered
    )
    toast.success(`Exported ${filtered.length} ticket${filtered.length === 1 ? '' : 's'} to CSV`)
  }

  const columns = [
    { key: 'ticketId', header: 'Ticket ID', sortable: true, render: (row) => <span className="font-semibold text-brand-600 dark:text-brand-300">{row.ticketId}</span> },
    { key: 'subject', header: 'Subject', sortable: true, render: (row) => <span className="line-clamp-2 min-w-[14rem] max-w-sm font-medium text-ink-800 dark:text-ink-100">{row.subject}</span> },
    { key: 'client', header: 'Client', sortable: true },
    {
      key: 'assignee',
      header: 'Assigned To',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={row.assignee} size="xs" />
          <span>{row.assignee}</span>
        </div>
      ),
    },
    { key: 'priority', header: 'Priority', sortable: true, sortAccessor: (r) => PRIORITY_RANK[r.priority], render: (row) => <StatusBadge status={row.priority} /> },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    { key: 'createdDate', header: 'Created', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.createdDate)}</span> },
  ]

  const openTicket = (row) => navigate(`/admin/support/${row.id}`)
  const hasFilters = Boolean(search) || activeFilters.length > 0

  return (
    <div>
      <PageHeader
        title="Support Tickets"
        description="Track, assign and respond to client support requests."
        breadcrumbItems={[{ label: 'Support', href: '/admin/support' }, { label: 'Tickets' }]}
        action={
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <Button variant="secondary" aria-label="Export tickets as CSV" leftIcon={<Download size={15} />} onClick={exportCsv} disabled={loading || filtered.length === 0}>
              <span className="hidden sm:inline">Export</span>
            </Button>
            <Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)} className="min-w-0 flex-1 sm:flex-none">
              Create Ticket
            </Button>
          </div>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4 lg:flex-row lg:items-center dark:border-ink-800 dark:bg-ink-900">
        <SearchBar value={search} onChange={setSearch} placeholder="Search by ID, subject, client or assignee..." className="lg:w-80" />
        <div className="grid grid-cols-2 gap-3 lg:flex">
          <Select aria-label="Filter by priority" options={PRIORITY_OPTIONS} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} wrapperClassName="lg:w-40" />
          <Select
            aria-label="Filter by assignee"
            options={[{ value: '', label: 'All assignees' }, ...employees.map((e) => ({ value: e.name, label: e.name }))]}
            value={assigneeFilter}
            onChange={(e) => setAssigneeFilter(e.target.value)}
            wrapperClassName="lg:w-48"
          />
        </div>
      </div>

      <div className="-mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0" role="group" aria-label="Filter by status">
        {STATUS_CHIPS.map((chip) => {
          const active = statusFilter === chip.value
          return (
            <button
              key={chip.value || 'all'}
              type="button"
              aria-pressed={active}
              onClick={() => setStatusFilter(chip.value)}
              className={cn(
                'focus-ring inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-200 active:scale-95',
                active
                  ? 'gradient-brand border-transparent bg-brand-600 text-white shadow-glow'
                  : 'border-ink-200 bg-white text-ink-600 hover:border-brand-300 hover:bg-brand-50/60 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-300 dark:hover:bg-ink-800'
              )}
            >
              {chip.label}
              <span className={cn('rounded-full px-1.5 text-xs tabular-nums', active ? 'bg-white/25' : 'bg-ink-100 dark:bg-ink-800')}>{counts[chip.value] || 0}</span>
            </button>
          )
        })}
      </div>

      {activeFilters.length > 0 && <FilterBar activeFilters={activeFilters} onClearAll={clearFilters} className="mb-4" />}

      {loading && (
        <Card className="space-y-3 rounded-2xl p-4" aria-busy="true" aria-label="Loading tickets">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </Card>
      )}

      {error && (
        <Card>
          <ErrorState title="Couldn't load tickets" description="There was a problem fetching support tickets. Please try again." onRetry={reload} />
        </Card>
      )}

      {!loading && !error && filtered.length === 0 && (
        <Card>
          <EmptyState
            icon={LifeBuoy}
            title={list.length === 0 ? 'No tickets yet' : 'No tickets match your filters'}
            description={list.length === 0 ? 'Create the first support ticket to start tracking client requests.' : 'Try a different search term or clear the filters.'}
            actionLabel={list.length === 0 ? 'Create Ticket' : hasFilters ? 'Clear filters' : undefined}
            onAction={list.length === 0 ? () => setModalOpen(true) : clearFilters}
          />
        </Card>
      )}

      {!loading && !error && filtered.length > 0 && (
        <>
          <div className="hidden md:block">
            <DataTable columns={columns} data={filtered} onRowClick={openTicket} pageSize={PAGE_SIZE} />
          </div>
          <div className="md:hidden">
            <div className="space-y-3">
              {cardRows.map((t, i) => (
                <TicketCard key={t.id} ticket={t} onOpen={openTicket} index={i} />
              ))}
            </div>
            <Pagination page={cardPageSafe} totalPages={cardTotalPages} onChange={setCardPage} totalItems={filtered.length} pageSize={PAGE_SIZE} />
          </div>
        </>
      )}

      <TicketFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} isSaving={isSaving} />
    </div>
  )
}
