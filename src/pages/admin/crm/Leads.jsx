import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List as ListIcon, Pencil, Trash2, UserCheck, Eye, Download, Building2, SlidersHorizontal, Tag } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import LeadFormModal from '../../../components/business/LeadFormModal'
import LeadCard from '../../../components/business/LeadCard'
import ActiveFilterChips from '../../../components/business/ActiveFilterChips'
import TaskBoard from '../../../components/business/TaskBoard'
import ProjectViewToggle from '../../../components/business/ProjectViewToggle'
import ClientAvatar from '../../../components/business/ClientAvatar'
import { PRIORITY_ACCENT } from '../../../components/business/ProjectTones'
import SelectionBar from '../../../components/business/SelectionBar'
import RecordActions from '../../../components/business/RecordActions'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import Input from '../../../components/common/Input'
import DataTable from '../../../components/common/DataTable'
import StatusBadge from '../../../components/common/StatusBadge'
import Avatar from '../../../components/common/Avatar'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton } from '../../../components/common/Skeleton'
import { leadService } from '../../../services/leadService'
import { employeeService } from '../../../services/employeeService'
import { convertLeadToClient } from '../../../services/leadConversion'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { formatDate } from '../../../utils/format'
import { useToast } from '../../../context/ToastContext'
import { useResetOnChange } from '../../../hooks/useResetOnChange'
import { LEAD_STAGES, LEAD_STAGE_DOT, LEAD_STAGE_LABEL, LEAD_SOURCES, downloadCsv, isPastDate, newId, todayKey } from '../../../utils/workspace'
import { cn } from '../../../utils/cn'

const loadLeadsPage = () => Promise.all([leadService.list(), employeeService.list()]).then(([leads, employees]) => ({ leads, employees }))

const EXPORT_COLUMNS = [
  { header: 'Lead', value: (l) => l.name },
  { header: 'Company', value: (l) => l.company },
  { header: 'Email', value: (l) => l.email },
  { header: 'Phone', value: (l) => l.phone },
  { header: 'Source', value: (l) => l.source },
  { header: 'Status', value: (l) => LEAD_STAGE_LABEL[l.status] },
  { header: 'Owner', value: (l) => l.owner },
  { header: 'Estimated Value (INR)', value: (l) => l.value },
  { header: 'Last Contact', value: (l) => l.lastContact },
  { header: 'Next Follow-up', value: (l) => l.nextFollowUp },
]

const ALL = ''

function PipelineSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" aria-busy="true" aria-label="Loading pipeline">
      {LEAD_STAGES.map((s) => (
        <div key={s.value} className="w-[82vw] max-w-[20rem] shrink-0 rounded-2xl border border-ink-100 bg-ink-50/70 p-3 sm:w-72 dark:border-ink-800 dark:bg-ink-900/40">
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="space-y-2.5">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Leads() {
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, isLoading, isError, retry, setData } = useMockQuery(loadLeadsPage)

  const [view, setView] = useState('table')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState(ALL)
  const [sourceFilter, setSourceFilter] = useState(ALL)
  const [ownerFilter, setOwnerFilter] = useState(ALL)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [selected, setSelected] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingLead, setEditingLead] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // lead | 'bulk'
  const [convertTarget, setConvertTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isWorking, setIsWorking] = useState(false)

  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) {
        setEditingLead(null)
        setModalOpen(true)
      }
    },
    { immediate: true }
  )

  useEffect(() => {
    if (location.state?.openCreate) {
      navigate(location.pathname, { replace: true, state: {} })
    }
  }, [location, navigate])

  const leads = useMemo(() => data?.leads ?? [], [data])
  const employees = useMemo(() => data?.employees ?? [], [data])
  const ownerNames = useMemo(() => employees.map((e) => e.name), [employees])
  const ownerOptions = useMemo(() => [...new Set([...leads.map((l) => l.owner), ...ownerNames])].filter(Boolean).sort(), [leads, ownerNames])

  function patchLeads(fn) {
    setData((prev) => ({ ...prev, leads: fn(prev.leads) }))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return leads.filter((lead) => {
      if (q && ![lead.name, lead.company, lead.email, lead.phone].some((v) => v?.toLowerCase().includes(q))) return false
      if (statusFilter && lead.status !== statusFilter) return false
      if (sourceFilter && lead.source !== sourceFilter) return false
      if (ownerFilter && lead.owner !== ownerFilter) return false
      if (dateFrom && (!lead.lastContact || lead.lastContact < dateFrom)) return false
      if (dateTo && (!lead.lastContact || lead.lastContact > dateTo)) return false
      return true
    })
  }, [leads, search, statusFilter, sourceFilter, ownerFilter, dateFrom, dateTo])

  const selectedIds = useMemo(() => {
    const visible = new Set(filtered.map((l) => l.id))
    return selected.filter((id) => visible.has(id))
  }, [selected, filtered])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    statusFilter && { key: 'status', label: `Status: ${LEAD_STAGE_LABEL[statusFilter]}`, onRemove: () => setStatusFilter(ALL) },
    sourceFilter && { key: 'source', label: `Source: ${sourceFilter}`, onRemove: () => setSourceFilter(ALL) },
    ownerFilter && { key: 'owner', label: `Owner: ${ownerFilter}`, onRemove: () => setOwnerFilter(ALL) },
    dateFrom && { key: 'from', label: `Last contact from ${formatDate(dateFrom)}`, onRemove: () => setDateFrom('') },
    dateTo && { key: 'to', label: `Last contact until ${formatDate(dateTo)}`, onRemove: () => setDateTo('') },
  ].filter(Boolean)

  function clearAllFilters() {
    setSearch('')
    setStatusFilter(ALL)
    setSourceFilter(ALL)
    setOwnerFilter(ALL)
    setDateFrom('')
    setDateTo('')
  }

  const kanbanColumns = useMemo(
    () => LEAD_STAGES.map((stage) => ({ key: stage.value, label: stage.label, items: filtered.filter((l) => l.status === stage.value) })),
    [filtered]
  )

  function openCreate() {
    setEditingLead(null)
    setModalOpen(true)
  }

  function openEdit(lead) {
    setEditingLead(lead)
    setModalOpen(true)
  }

  async function handleSave(values) {
    setIsSaving(true)
    try {
      if (editingLead) {
        const updated = await leadService.update(editingLead.id, values)
        patchLeads((prev) => prev.map((l) => (l.id === editingLead.id ? updated : l)))
        toast.success(`${values.name} updated successfully`)
      } else {
        const today = todayKey()
        const created = await leadService.create({
          ...values,
          id: newId('ld'),
          lastContact: today,
          createdDate: today,
          noteList: values.notes ? [{ id: newId('note'), author: values.owner, text: values.notes, time: new Date().toISOString() }] : [],
        })
        patchLeads((prev) => [created, ...prev])
        toast.success(`${values.name} added to your pipeline`)
      }
      setModalOpen(false)
      setEditingLead(null)
    } catch {
      toast.error('Could not save the lead. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function applyBulk(ids, patch, message) {
    const idSet = new Set(ids)
    patchLeads((prev) => prev.map((l) => (idSet.has(l.id) ? { ...l, ...patch } : l)))
    try {
      await Promise.all(ids.map((id) => leadService.update(id, patch)))
      toast.success(message)
    } catch {
      toast.error('Some changes could not be saved. Reloading leads.')
      retry()
    }
  }

  function handleBulkStatus(status) {
    if (!status) return
    applyBulk(selectedIds, { status }, `${selectedIds.length} lead${selectedIds.length === 1 ? '' : 's'} moved to ${LEAD_STAGE_LABEL[status]}`)
  }

  function handleBulkOwner(owner) {
    if (!owner) return
    applyBulk(selectedIds, { owner }, `${selectedIds.length} lead${selectedIds.length === 1 ? '' : 's'} assigned to ${owner}`)
  }

  function handleExport(rows) {
    downloadCsv(`workflow360-leads-${todayKey()}.csv`, rows, EXPORT_COLUMNS)
    toast.success(`Exported ${rows.length} lead${rows.length === 1 ? '' : 's'} to CSV`)
  }

  async function handleDelete() {
    const ids = deleteTarget === 'bulk' ? selectedIds : [deleteTarget.id]
    setIsWorking(true)
    try {
      await Promise.all(ids.map((id) => leadService.remove(id)))
      const idSet = new Set(ids)
      patchLeads((prev) => prev.filter((l) => !idSet.has(l.id)))
      setSelected((prev) => prev.filter((id) => !idSet.has(id)))
      toast.success(ids.length === 1 ? 'Lead deleted' : `${ids.length} leads deleted`)
      setDeleteTarget(null)
    } catch {
      toast.error('Could not delete. Please try again.')
    } finally {
      setIsWorking(false)
    }
  }

  function handleMove(leadId, newStatus) {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead || lead.status === newStatus) return
    patchLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l)))
    leadService.update(leadId, { status: newStatus }).then(
      () => toast.success(`${lead.name} moved to ${LEAD_STAGE_LABEL[newStatus]}`),
      () => {
        patchLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l)))
        toast.error(`Could not move ${lead.name}. Change reverted.`)
      }
    )
  }

  async function handleConvert() {
    const lead = convertTarget
    setIsWorking(true)
    try {
      const result = await convertLeadToClient(lead)
      patchLeads((prev) => prev.map((l) => (l.id === lead.id ? result.lead : l)))
      toast.success(`${lead.company} converted to a client`)
      setConvertTarget(null)
      navigate(`/admin/crm/clients/${result.client.id}`)
    } catch {
      toast.error('Could not convert this lead. Please try again.')
    } finally {
      setIsWorking(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Lead',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <ClientAvatar name={row.name} size="sm" />
          <Link
            to={`/admin/crm/leads/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="focus-ring whitespace-nowrap rounded font-medium text-ink-800 hover:text-brand-600 dark:text-ink-100"
          >
            {row.name}
          </Link>
        </div>
      ),
    },
    { key: 'company', header: 'Company', sortable: true, render: (row) => <span className="whitespace-nowrap font-medium">{row.company}</span> },
    { key: 'email', header: 'Email', render: (row) => <span className="text-ink-500">{row.email}</span> },
    { key: 'phone', header: 'Phone', render: (row) => <span className="whitespace-nowrap text-ink-500">{row.phone}</span> },
    {
      key: 'source',
      header: 'Source',
      sortable: true,
      render: (row) => (
        <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-600 dark:bg-ink-800 dark:text-ink-300">
          <Tag size={11} aria-hidden="true" /> {row.source}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'owner',
      header: 'Owner',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={row.owner || '?'} size="xs" />
          {row.owner || 'Unassigned'}
        </div>
      ),
    },
    { key: 'lastContact', header: 'Last Contact', sortable: true, sortAccessor: (r) => r.lastContact || '', render: (row) => <span className="whitespace-nowrap">{formatDate(row.lastContact)}</span> },
    {
      key: 'nextFollowUp',
      header: 'Next Follow-up',
      sortable: true,
      sortAccessor: (r) => r.nextFollowUp || '9999-12-31',
      render: (row) => {
        const overdue = row.status !== 'won' && row.status !== 'lost' && isPastDate(row.nextFollowUp)
        return (
          <span className={cn('whitespace-nowrap', overdue && 'font-semibold text-danger-600 dark:text-danger-400')}>
            {formatDate(row.nextFollowUp)}
            {overdue && <span className="ml-1 text-xs font-medium">(overdue)</span>}
          </span>
        )
      },
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <RecordActions
          actions={[
            { label: `View ${row.name}`, icon: <Eye size={15} />, onClick: () => navigate(`/admin/crm/leads/${row.id}`) },
            { label: `Edit ${row.name}`, icon: <Pencil size={15} />, onClick: () => openEdit(row) },
            row.convertedClientId
              ? { label: `View client for ${row.name}`, icon: <Building2 size={15} />, onClick: () => navigate(`/admin/crm/clients/${row.convertedClientId}`) }
              : { label: `Convert ${row.name} to client`, icon: <UserCheck size={15} />, onClick: () => setConvertTarget(row) },
            { label: `Delete ${row.name}`, icon: <Trash2 size={15} />, tone: 'danger', onClick: () => setDeleteTarget(row) },
          ]}
        />
      ),
    },
  ]

  const selectedLeads = leads.filter((l) => selectedIds.includes(l.id))

  return (
    <div>
      <PageHeader
        title="Leads"
        description="Track and convert leads through your sales pipeline."
        breadcrumbItems={[{ label: 'CRM' }, { label: 'Leads' }]}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<Download size={15} />} onClick={() => handleExport(filtered)} disabled={isLoading || filtered.length === 0}>
              Export
            </Button>
            <Button leftIcon={<Plus size={15} />} onClick={openCreate}>Add Lead</Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState title="Couldn't load leads" description="Something went wrong while fetching your pipeline. Please try again." onRetry={retry} />
      ) : (
        <>
          <div className="mb-4 space-y-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center gap-2 sm:justify-between sm:gap-3">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by name, company, email or phone..." className="min-w-0 flex-1 sm:w-96 sm:flex-none" />
              <ProjectViewToggle
                value={view}
                onChange={setView}
                ariaLabel="Lead view"
                options={[
                  { value: 'table', label: 'Table view', text: 'Table', icon: ListIcon },
                  { value: 'kanban', label: 'Pipeline view', text: 'Pipeline', icon: LayoutGrid },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
              <Select
                label="Status"
                options={[{ value: ALL, label: 'All statuses' }, ...LEAD_STAGES]}
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              />
              <Select
                label="Source"
                options={[{ value: ALL, label: 'All sources' }, ...LEAD_SOURCES.map((s) => ({ value: s, label: s }))]}
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
              />
              <Select
                label="Owner"
                options={[{ value: ALL, label: 'All owners' }, ...ownerOptions.map((o) => ({ value: o, label: o }))]}
                value={ownerFilter}
                onChange={(e) => setOwnerFilter(e.target.value)}
              />
              <Input label="Last contact from" type="date" max={dateTo || undefined} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input label="Last contact to" type="date" min={dateFrom || undefined} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </div>

          <ActiveFilterChips filters={activeFilters} onClearAll={clearAllFilters} className="mb-4" />

          {view === 'table' ? (
            <>
              <SelectionBar count={selectedIds.length} noun="lead" onClear={() => setSelected([])}>
                <Select
                  aria-label="Change status of selected leads"
                  wrapperClassName="w-44"
                  options={[{ value: '', label: 'Change status...' }, ...LEAD_STAGES]}
                  value=""
                  onChange={(e) => handleBulkStatus(e.target.value)}
                />
                <Select
                  aria-label="Assign owner to selected leads"
                  wrapperClassName="w-44"
                  options={[{ value: '', label: 'Assign owner...' }, ...ownerNames.map((n) => ({ value: n, label: n }))]}
                  value=""
                  onChange={(e) => handleBulkOwner(e.target.value)}
                />
                <Button variant="secondary" leftIcon={<Download size={14} />} onClick={() => handleExport(selectedLeads)}>
                  Export
                </Button>
                <Button variant="danger" leftIcon={<Trash2 size={14} />} onClick={() => setDeleteTarget('bulk')}>
                  Delete
                </Button>
              </SelectionBar>
              <DataTable
                columns={columns}
                data={filtered}
                isLoading={isLoading}
                pageSize={5}
                selectable
                selected={selectedIds}
                onSelectedChange={setSelected}
                onRowClick={(row) => navigate(`/admin/crm/leads/${row.id}`)}
                emptyTitle={activeFilters.length > 0 ? 'No leads match your filters' : 'No leads yet'}
                emptyDescription={activeFilters.length > 0 ? 'Try removing a filter or searching for something else.' : 'Add your first lead to start building your pipeline.'}
                emptyActionLabel={activeFilters.length > 0 ? 'Clear All' : 'Add Lead'}
                onEmptyAction={activeFilters.length > 0 ? clearAllFilters : openCreate}
              />
            </>
          ) : isLoading ? (
            <PipelineSkeleton />
          ) : (
            <>
              <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-500">
                <SlidersHorizontal size={13} aria-hidden="true" className="shrink-0 text-brand-500" />
                Drag cards between stages to update their status, or use the move button on a card.
              </p>
              <TaskBoard
                columns={kanbanColumns}
                onMove={handleMove}
                columnTone={LEAD_STAGE_DOT}
                cardAccent={(lead) => PRIORITY_ACCENT[lead.priority] || 'border-l-transparent!'}
                renderCard={(lead) => <LeadCard lead={lead} onMove={handleMove} />}
              />
            </>
          )}
        </>
      )}

      <LeadFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingLead(null)
        }}
        onSubmit={handleSave}
        initialValues={editingLead}
        isSaving={isSaving}
        owners={ownerNames.length ? ownerNames : undefined}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isWorking}
        title={deleteTarget === 'bulk' ? `Delete ${selectedIds.length} leads?` : 'Delete this lead?'}
        description={
          deleteTarget === 'bulk'
            ? 'The selected leads will be permanently removed from your pipeline.'
            : `This will permanently remove ${deleteTarget?.name} from your pipeline.`
        }
        confirmLabel={deleteTarget === 'bulk' ? 'Delete Leads' : 'Delete Lead'}
      />
      <ConfirmDialog
        isOpen={Boolean(convertTarget)}
        onClose={() => setConvertTarget(null)}
        onConfirm={handleConvert}
        isLoading={isWorking}
        danger={false}
        title="Convert to client?"
        description={`${convertTarget?.company} will be added to your clients and this lead will be marked as won.`}
        confirmLabel="Convert to Client"
      />
      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'Loading leads' : `${filtered.length} leads shown`}
      </span>
    </div>
  )
}
