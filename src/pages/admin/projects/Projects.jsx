import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List as ListIcon, Pencil, Trash2, Eye, FolderKanban, CalendarClock } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ProjectCard from '../../../components/business/ProjectCard'
import ProjectFormModal from '../../../components/business/ProjectFormModal'
import ActiveFilterChips from '../../../components/business/ActiveFilterChips'
import ProjectViewToggle from '../../../components/business/ProjectViewToggle'
import ProjectProgressRing from '../../../components/business/ProjectProgressRing'
import { progressTone, stagger } from '../../../components/business/ProjectTones'
import ClientAvatar from '../../../components/business/ClientAvatar'
import RecordActions from '../../../components/business/RecordActions'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import DataTable from '../../../components/common/DataTable'
import StatusBadge from '../../../components/common/StatusBadge'
import Avatar from '../../../components/common/Avatar'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { Skeleton } from '../../../components/common/Skeleton'
import { projectService } from '../../../services/projectService'
import { clientService } from '../../../services/clientService'
import { employeeService } from '../../../services/employeeService'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { useToast } from '../../../context/ToastContext'
import { useResetOnChange } from '../../../hooks/useResetOnChange'
import { formatDate } from '../../../utils/format'
import { PROJECT_STATUS_OPTIONS, isPastDate, newId, todayKey } from '../../../utils/workspace'
import { cn } from '../../../utils/cn'

const loadProjectsPage = () =>
  Promise.all([projectService.list(), clientService.list(), employeeService.list()]).then(([projects, clients, employees]) => ({ projects, clients, employees }))

const STATUS_LABEL = Object.fromEntries(PROJECT_STATUS_OPTIONS.map((s) => [s.value, s.label]))

function CardsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3 lg:gap-6" aria-busy="true" aria-label="Loading projects">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900">
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-5 h-2 w-full" />
          <div className="mt-5 flex justify-between">
            <Skeleton className="h-6 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Projects() {
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, isLoading, isError, retry, setData } = useMockQuery(loadProjectsPage)

  const [view, setView] = useState('grid')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [managerFilter, setManagerFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingProject, setEditingProject] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isSaving, setIsSaving] = useState(false)

  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) {
        setEditingProject(null)
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

  const projects = useMemo(() => data?.projects ?? [], [data])
  const clients = useMemo(() => data?.clients ?? [], [data])
  const employees = useMemo(() => data?.employees ?? [], [data])
  const managers = useMemo(() => [...new Set(projects.map((p) => p.manager))].sort(), [projects])

  function patchProjects(fn) {
    setData((prev) => ({ ...prev, projects: fn(prev.projects) }))
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects.filter((p) => {
      if (q && ![p.name, p.client, p.manager].some((v) => v?.toLowerCase().includes(q))) return false
      if (statusFilter && p.status !== statusFilter) return false
      if (clientFilter && p.clientId !== clientFilter) return false
      if (managerFilter && p.manager !== managerFilter) return false
      return true
    })
  }, [projects, search, statusFilter, clientFilter, managerFilter])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_LABEL[statusFilter]}`, onRemove: () => setStatusFilter('') },
    clientFilter && { key: 'client', label: `Client: ${clients.find((c) => c.id === clientFilter)?.company ?? clientFilter}`, onRemove: () => setClientFilter('') },
    managerFilter && { key: 'manager', label: `Manager: ${managerFilter}`, onRemove: () => setManagerFilter('') },
  ].filter(Boolean)

  function clearAllFilters() {
    setSearch('')
    setStatusFilter('')
    setClientFilter('')
    setManagerFilter('')
  }

  function openCreate() {
    setEditingProject(null)
    setModalOpen(true)
  }

  function openEdit(project) {
    setEditingProject(project)
    setModalOpen(true)
  }

  async function handleSave(values) {
    setIsSaving(true)
    try {
      if (editingProject) {
        const updated = await projectService.update(editingProject.id, values)
        patchProjects((prev) => prev.map((p) => (p.id === editingProject.id ? updated : p)))
        toast.success(`${values.name} updated successfully`)
      } else {
        const created = await projectService.create({
          ...values,
          id: newId('prj'),
          progress: 0,
          spent: 0,
          startDate: values.startDate || todayKey(),
        })
        patchProjects((prev) => [created, ...prev])
        toast.success(`${values.name} created successfully`)
      }
      setModalOpen(false)
      setEditingProject(null)
    } catch {
      toast.error('Could not save the project. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsSaving(true)
    try {
      await projectService.remove(deleteTarget.id)
      patchProjects((prev) => prev.filter((p) => p.id !== deleteTarget.id))
      toast.success(`${deleteTarget.name} deleted`)
      setDeleteTarget(null)
    } catch {
      toast.error('Could not delete the project. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Project',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <ProjectProgressRing value={row.progress} size={36} stroke={4} tone={progressTone(row.progress, row.status)} showValue={false} label={`${row.name} progress ring`} />
          <Link
            to={`/admin/projects/${row.id}`}
            onClick={(e) => e.stopPropagation()}
            className="focus-ring rounded font-semibold text-ink-800 hover:text-brand-600 dark:text-ink-100"
          >
            {row.name}
          </Link>
        </div>
      ),
    },
    {
      key: 'client',
      header: 'Client',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <ClientAvatar name={row.client} size="sm" className="!h-7 !w-7 !text-[10px]" />
          {row.client}
        </div>
      ),
    },
    {
      key: 'manager',
      header: 'Manager',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={row.manager} size="xs" /> {row.manager}
        </div>
      ),
    },
    {
      key: 'progress',
      header: 'Progress',
      sortable: true,
      render: (row) => (
        <div className="flex min-w-[9rem] items-center gap-2">
          <div
            className="h-2 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
            role="progressbar"
            aria-valuenow={row.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${row.name} progress`}
          >
            <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-500 transition-[width] duration-1000 ease-out starting:w-0" style={{ width: `${row.progress}%` }} />
          </div>
          <span className="w-9 text-right text-xs font-semibold text-ink-700 dark:text-ink-200">{row.progress}%</span>
        </div>
      ),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      sortable: true,
      render: (row) => {
        const overdue = row.status !== 'completed' && row.status !== 'cancelled' && isPastDate(row.deadline)
        return (
          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', overdue ? 'bg-danger-50 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400' : 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-300')}>
            <CalendarClock size={12} aria-hidden="true" /> {formatDate(row.deadline)}
          </span>
        )
      },
    },
    {
      key: 'team',
      header: 'Team',
      align: 'center',
      sortable: true,
      sortAccessor: (r) => r.team?.length ?? 0,
      render: (row) => <span className="inline-flex min-w-[1.75rem] justify-center rounded-full bg-info-50 px-2 py-1 text-xs font-bold text-info-600 dark:bg-info-500/15 dark:text-info-300">{row.team?.length ?? 0}</span>,
    },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <RecordActions
          actions={[
            { label: `View ${row.name}`, icon: <Eye size={15} />, onClick: () => navigate(`/admin/projects/${row.id}`) },
            { label: `Edit ${row.name}`, icon: <Pencil size={15} />, onClick: () => openEdit(row) },
            { label: `Delete ${row.name}`, icon: <Trash2 size={15} />, tone: 'danger', onClick: () => setDeleteTarget(row) },
          ]}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Projects"
        description="Every active, planned and completed project in one place."
        breadcrumbItems={[{ label: 'Projects' }]}
        action={<Button leftIcon={<Plus size={15} />} onClick={openCreate}>New Project</Button>}
      />

      {isError ? (
        <ErrorState title="Couldn't load projects" description="Something went wrong while fetching your projects. Please try again." onRetry={retry} />
      ) : (
        <>
          <div className="mb-4 space-y-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center gap-2 sm:justify-between sm:gap-3">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by project, client or manager..." className="min-w-0 flex-1 sm:w-96 sm:flex-none" />
              <ProjectViewToggle
                value={view}
                onChange={setView}
                ariaLabel="Project view"
                options={[
                  { value: 'grid', label: 'Card view', text: 'Cards', icon: LayoutGrid },
                  { value: 'table', label: 'Table view', text: 'Table', icon: ListIcon },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 min-[400px]:grid-cols-2 md:grid-cols-3">
              <Select aria-label="Filter by status" options={[{ value: '', label: 'All statuses' }, ...PROJECT_STATUS_OPTIONS]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
              <Select
                aria-label="Filter by client"
                options={[{ value: '', label: 'All clients' }, ...clients.map((c) => ({ value: c.id, label: c.company }))]}
                value={clientFilter}
                onChange={(e) => setClientFilter(e.target.value)}
              />
              <Select
                aria-label="Filter by manager"
                options={[{ value: '', label: 'All managers' }, ...managers.map((m) => ({ value: m, label: m }))]}
                value={managerFilter}
                onChange={(e) => setManagerFilter(e.target.value)}
              />
            </div>
          </div>

          <ActiveFilterChips filters={activeFilters} onClearAll={clearAllFilters} className="mb-4" />

          {view === 'table' ? (
            <DataTable
              columns={columns}
              data={filtered}
              isLoading={isLoading}
              pageSize={5}
              onRowClick={(row) => navigate(`/admin/projects/${row.id}`)}
              emptyTitle={activeFilters.length > 0 ? 'No projects match your filters' : 'No projects yet'}
              emptyDescription={activeFilters.length > 0 ? 'Try removing a filter or searching for something else.' : 'Create your first project to get started.'}
              emptyActionLabel={activeFilters.length > 0 ? 'Clear All' : 'New Project'}
              onEmptyAction={activeFilters.length > 0 ? clearAllFilters : openCreate}
            />
          ) : isLoading ? (
            <CardsSkeleton />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={FolderKanban}
              title={activeFilters.length > 0 ? 'No projects match your filters' : 'No projects yet'}
              description={activeFilters.length > 0 ? 'Try removing a filter or searching for something else.' : 'Create your first project to get started.'}
              actionLabel={activeFilters.length > 0 ? 'Clear All' : 'New Project'}
              onAction={activeFilters.length > 0 ? clearAllFilters : openCreate}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:gap-6 xl:grid-cols-3">
              {filtered.map((project, i) => (
                <div key={project.id} style={stagger(i)} className="animate-slide-up min-w-0 [&>*]:h-full">
                  <ProjectCard project={project} onEdit={openEdit} onDelete={setDeleteTarget} />
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <ProjectFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingProject(null)
        }}
        onSubmit={handleSave}
        initialValues={editingProject}
        isSaving={isSaving}
        clients={clients.length ? clients : undefined}
        employees={employees.length ? employees : undefined}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isSaving}
        title="Delete this project?"
        description={`This will permanently remove ${deleteTarget?.name} and its planning data.`}
        confirmLabel="Delete Project"
      />
      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'Loading projects' : `${filtered.length} projects shown`}
      </span>
    </div>
  )
}
