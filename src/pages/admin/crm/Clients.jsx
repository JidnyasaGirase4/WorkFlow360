import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, Download, Power, Briefcase } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ClientFormModal from '../../../components/business/ClientFormModal'
import ActiveFilterChips from '../../../components/business/ActiveFilterChips'
import SelectionBar from '../../../components/business/SelectionBar'
import RecordActions from '../../../components/business/RecordActions'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import DataTable from '../../../components/common/DataTable'
import StatusBadge from '../../../components/common/StatusBadge'
import ClientAvatar from '../../../components/business/ClientAvatar'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import ErrorState from '../../../components/common/ErrorState'
import { clientService } from '../../../services/clientService'
import { projectService } from '../../../services/projectService'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { formatCurrency, formatDate } from '../../../utils/format'
import { useToast } from '../../../context/ToastContext'
import { useResetOnChange } from '../../../hooks/useResetOnChange'
import { downloadCsv, newId, todayKey } from '../../../utils/workspace'

const loadClientsPage = () => Promise.all([clientService.list(), projectService.list()]).then(([clients, projects]) => ({ clients, projects }))

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
]

export default function Clients() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()
  const { data, isLoading, isError, retry, setData } = useMockQuery(loadClientsPage)

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [industryFilter, setIndustryFilter] = useState('')
  const [selected, setSelected] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // client | 'bulk'
  const [isSaving, setIsSaving] = useState(false)

  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) {
        setEditingClient(null)
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

  const clients = useMemo(() => data?.clients ?? [], [data])

  const projectCounts = useMemo(() => {
    const counts = {}
    ;(data?.projects ?? []).forEach((p) => {
      const c = counts[p.clientId] || { total: 0, active: 0 }
      c.total += 1
      if (p.status === 'active' || p.status === 'planning') c.active += 1
      counts[p.clientId] = c
    })
    return counts
  }, [data])

  const industries = useMemo(() => [...new Set(clients.map((c) => c.industry).filter(Boolean))].sort(), [clients])

  function patchClients(fn) {
    setData((prev) => ({ ...prev, clients: fn(prev.clients) }))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return clients.filter((c) => {
      if (q && ![c.company, c.contactPerson, c.email, c.phone, c.city].some((v) => v?.toLowerCase().includes(q))) return false
      if (statusFilter && c.status !== statusFilter) return false
      if (industryFilter && c.industry !== industryFilter) return false
      return true
    })
  }, [clients, search, statusFilter, industryFilter])

  const selectedIds = useMemo(() => {
    const visible = new Set(filtered.map((c) => c.id))
    return selected.filter((id) => visible.has(id))
  }, [selected, filtered])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    statusFilter && { key: 'status', label: `Status: ${statusFilter === 'active' ? 'Active' : 'Inactive'}`, onRemove: () => setStatusFilter('') },
    industryFilter && { key: 'industry', label: `Industry: ${industryFilter}`, onRemove: () => setIndustryFilter('') },
  ].filter(Boolean)

  function clearAllFilters() {
    setSearch('')
    setStatusFilter('')
    setIndustryFilter('')
  }

  function openCreate() {
    setEditingClient(null)
    setModalOpen(true)
  }

  async function handleSave(values) {
    setIsSaving(true)
    try {
      if (editingClient) {
        const updated = await clientService.update(editingClient.id, values)
        patchClients((prev) => prev.map((c) => (c.id === editingClient.id ? updated : c)))
        toast.success(`${values.company} updated successfully`)
      } else {
        const created = await clientService.create({
          ...values,
          id: newId('cl'),
          logo: null,
          revenue: 0,
          outstanding: 0,
          activeProjects: 0,
          lastActivity: new Date().toISOString(),
          since: todayKey(),
        })
        patchClients((prev) => [created, ...prev])
        toast.success(`${values.company} added as a client`)
      }
      setModalOpen(false)
      setEditingClient(null)
    } catch {
      toast.error('Could not save the client. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    const ids = deleteTarget === 'bulk' ? selectedIds : [deleteTarget.id]
    setIsSaving(true)
    try {
      await Promise.all(ids.map((id) => clientService.remove(id)))
      const idSet = new Set(ids)
      patchClients((prev) => prev.filter((c) => !idSet.has(c.id)))
      setSelected((prev) => prev.filter((id) => !idSet.has(id)))
      toast.success(ids.length === 1 ? 'Client removed' : `${ids.length} clients removed`)
      setDeleteTarget(null)
    } catch {
      toast.error('Could not remove. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleBulkStatus(status) {
    const idSet = new Set(selectedIds)
    patchClients((prev) => prev.map((c) => (idSet.has(c.id) ? { ...c, status } : c)))
    try {
      await Promise.all(selectedIds.map((id) => clientService.update(id, { status })))
      toast.success(`${selectedIds.length} client${selectedIds.length === 1 ? '' : 's'} marked ${status}`)
    } catch {
      toast.error('Some changes could not be saved. Reloading clients.')
      retry()
    }
  }

  function handleExport(rows) {
    downloadCsv(`workflow360-clients-${todayKey()}.csv`, rows, [
      { header: 'Company', value: (c) => c.company },
      { header: 'Industry', value: (c) => c.industry },
      { header: 'Contact Person', value: (c) => c.contactPerson },
      { header: 'Email', value: (c) => c.email },
      { header: 'Phone', value: (c) => c.phone },
      { header: 'City', value: (c) => c.city },
      { header: 'Revenue (INR)', value: (c) => c.revenue },
      { header: 'Outstanding (INR)', value: (c) => c.outstanding },
      { header: 'Status', value: (c) => c.status },
    ])
    toast.success(`Exported ${rows.length} client${rows.length === 1 ? '' : 's'} to CSV`)
  }

  const columns = [
    {
      key: 'company',
      header: 'Company',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <ClientAvatar name={row.company} size="md" />
          <div className="min-w-0">
            <Link
              to={`/admin/crm/clients/${row.id}`}
              onClick={(e) => e.stopPropagation()}
              className="focus-ring whitespace-nowrap rounded font-semibold text-ink-800 hover:text-brand-600 dark:text-ink-100"
            >
              {row.company}
            </Link>
            <p className="text-xs text-ink-400">{[row.industry, row.city].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
      ),
    },
    { key: 'contactPerson', header: 'Contact Person', sortable: true, render: (row) => <span className="whitespace-nowrap">{row.contactPerson}</span> },
    { key: 'email', header: 'Email', render: (row) => <span className="text-ink-500">{row.email}</span> },
    { key: 'phone', header: 'Phone', render: (row) => <span className="whitespace-nowrap text-ink-500">{row.phone || '—'}</span> },
    {
      key: 'projects',
      header: 'Projects',
      align: 'center',
      sortable: true,
      sortAccessor: (r) => projectCounts[r.id]?.total ?? 0,
      render: (row) => {
        const c = projectCounts[row.id]
        return c ? (
          <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-info-50 px-2.5 py-1 text-xs dark:bg-info-500/15">
            <Briefcase size={12} aria-hidden="true" className="text-info-600 dark:text-info-300" />
            <span className="font-bold text-info-600 dark:text-info-300">{c.total}</span>
            {c.active > 0 && <span className="text-ink-500">({c.active} active)</span>}
          </span>
        ) : (
          <span className="text-ink-400">0</span>
        )
      },
    },
    { key: 'revenue', header: 'Revenue', align: 'right', sortable: true, render: (row) => (
        <span className="inline-flex whitespace-nowrap rounded-full bg-success-50 px-2.5 py-1 text-xs font-bold tabular-nums text-success-700 dark:bg-success-500/15 dark:text-success-300">
          {formatCurrency(row.revenue)}
        </span>
      ),
    },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    { key: 'lastActivity', header: 'Last Activity', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.lastActivity)}</span> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <RecordActions
          actions={[
            { label: `View ${row.company}`, icon: <Eye size={15} />, onClick: () => navigate(`/admin/crm/clients/${row.id}`) },
            {
              label: `Edit ${row.company}`,
              icon: <Pencil size={15} />,
              onClick: () => {
                setEditingClient(row)
                setModalOpen(true)
              },
            },
            { label: `Delete ${row.company}`, icon: <Trash2 size={15} />, tone: 'danger', onClick: () => setDeleteTarget(row) },
          ]}
        />
      ),
    },
  ]

  const selectedClients = clients.filter((c) => selectedIds.includes(c.id))

  return (
    <div>
      <PageHeader
        title="Clients"
        description="All companies you currently work with."
        breadcrumbItems={[{ label: 'CRM' }, { label: 'Clients' }]}
        action={
          <div className="flex gap-2">
            <Button variant="secondary" leftIcon={<Download size={15} />} onClick={() => handleExport(filtered)} disabled={isLoading || filtered.length === 0}>
              Export
            </Button>
            <Button leftIcon={<Plus size={15} />} onClick={openCreate}>Add Client</Button>
          </div>
        }
      />

      {isError ? (
        <ErrorState title="Couldn't load clients" description="Something went wrong while fetching your clients. Please try again." onRetry={retry} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-1 gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:grid-cols-2 sm:p-4 lg:grid-cols-[minmax(0,1fr)_12rem_14rem] dark:border-ink-800 dark:bg-ink-900">
            <SearchBar value={search} onChange={setSearch} placeholder="Search by company, contact, email or city..." className="self-end" />
            <Select aria-label="Filter by status" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
            <Select
              aria-label="Filter by industry"
              options={[{ value: '', label: 'All industries' }, ...industries.map((i) => ({ value: i, label: i }))]}
              value={industryFilter}
              onChange={(e) => setIndustryFilter(e.target.value)}
            />
          </div>

          <ActiveFilterChips filters={activeFilters} onClearAll={clearAllFilters} className="mb-4" />

          <SelectionBar count={selectedIds.length} noun="client" onClear={() => setSelected([])}>
            <Button variant="secondary" leftIcon={<Power size={14} />} onClick={() => handleBulkStatus('active')}>Mark Active</Button>
            <Button variant="secondary" onClick={() => handleBulkStatus('inactive')}>Mark Inactive</Button>
            <Button variant="secondary" leftIcon={<Download size={14} />} onClick={() => handleExport(selectedClients)}>Export</Button>
            <Button variant="danger" leftIcon={<Trash2 size={14} />} onClick={() => setDeleteTarget('bulk')}>Delete</Button>
          </SelectionBar>

          <DataTable
            columns={columns}
            data={filtered}
            isLoading={isLoading}
            pageSize={5}
            selectable
            selected={selectedIds}
            onSelectedChange={setSelected}
            onRowClick={(row) => navigate(`/admin/crm/clients/${row.id}`)}
            emptyTitle={activeFilters.length > 0 ? 'No clients match your filters' : 'No clients yet'}
            emptyDescription={activeFilters.length > 0 ? 'Try removing a filter or searching for something else.' : 'Add your first client to start tracking projects and invoices.'}
            emptyActionLabel={activeFilters.length > 0 ? 'Clear All' : 'Add Client'}
            onEmptyAction={activeFilters.length > 0 ? clearAllFilters : openCreate}
          />
        </>
      )}

      <ClientFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingClient(null)
        }}
        onSubmit={handleSave}
        initialValues={editingClient}
        isSaving={isSaving}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isSaving}
        title={deleteTarget === 'bulk' ? `Remove ${selectedIds.length} clients?` : 'Remove this client?'}
        description={
          deleteTarget === 'bulk'
            ? 'The selected clients and their associated records will be removed.'
            : `This will remove ${deleteTarget?.company} and its associated records.`
        }
        confirmLabel={deleteTarget === 'bulk' ? 'Remove Clients' : 'Remove Client'}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'Loading clients' : `${filtered.length} clients shown`}
      </span>
    </div>
  )
}
