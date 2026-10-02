import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, LayoutGrid, List as ListIcon, Pencil, Trash2, Eye, Paperclip, MessageSquare, GripVertical, CalendarClock } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import TaskFormModal from '../../../components/business/TaskFormModal'
import TaskCard from '../../../components/business/TaskCard'
import TaskDetailsDrawer from '../../../components/business/TaskDetailsDrawer'
import ActiveFilterChips from '../../../components/business/ActiveFilterChips'
import TaskBoard from '../../../components/business/TaskBoard'
import ProjectViewToggle from '../../../components/business/ProjectViewToggle'
import { PRIORITY_ACCENT, TONES } from '../../../components/business/ProjectTones'
import SelectionBar from '../../../components/business/SelectionBar'
import RecordActions from '../../../components/business/RecordActions'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import DataTable from '../../../components/common/DataTable'
import StatusBadge from '../../../components/common/StatusBadge'
import Badge from '../../../components/common/Badge'
import Avatar from '../../../components/common/Avatar'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton } from '../../../components/common/Skeleton'
import { taskService } from '../../../services/taskService'
import { projectService } from '../../../services/projectService'
import { employeeService } from '../../../services/employeeService'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { useResetOnChange } from '../../../hooks/useResetOnChange'
import { formatDate } from '../../../utils/format'
import { PRIORITY_OPTIONS, TASK_COLUMNS, TASK_COLUMN_DOT, TASK_STATUS_LABEL, cap, isPastDate, newId, priorityTone } from '../../../utils/workspace'
import { cn } from '../../../utils/cn'

const loadTasksPage = () =>
  Promise.all([taskService.list(), projectService.list(), employeeService.list()]).then(([tasks, projects, employees]) => ({ tasks, projects, employees }))

function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4" aria-busy="true" aria-label="Loading tasks">
      {TASK_COLUMNS.map((c) => (
        <div key={c.value} className="w-[82vw] max-w-[20rem] shrink-0 rounded-2xl border border-ink-100 bg-ink-50/70 p-3 sm:w-72 dark:border-ink-800 dark:bg-ink-900/40">
          <Skeleton className="mb-3 h-5 w-28" />
          <div className="space-y-2.5">
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
            <Skeleton className="h-28 w-full rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  )
}

export default function Tasks() {
  const { toast } = useToast()
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const { data, isLoading, isError, retry, setData } = useMockQuery(loadTasksPage)

  const [view, setView] = useState('kanban')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [assigneeFilter, setAssigneeFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState(null)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null) // task | 'bulk'
  const [isSaving, setIsSaving] = useState(false)

  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) {
        setEditingTask(null)
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

  const tasks = useMemo(() => data?.tasks ?? [], [data])
  const projects = useMemo(() => data?.projects ?? [], [data])
  const employees = useMemo(() => data?.employees ?? [], [data])
  const openTask = tasks.find((t) => t.id === openTaskId) || null
  const actor = user?.name || 'You'

  const assignees = useMemo(() => [...new Set([...tasks.map((t) => t.assignee), ...employees.map((e) => e.name)])].filter(Boolean).sort(), [tasks, employees])

  function patchTasks(fn) {
    setData((prev) => ({ ...prev, tasks: fn(prev.tasks) }))
  }

  // Optimistic update that reverts if the (mock) API call fails.
  async function updateTask(id, patch) {
    const before = tasks.find((t) => t.id === id)
    patchTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)))
    try {
      await taskService.update(id, patch)
    } catch (err) {
      patchTasks((prev) => prev.map((t) => (t.id === id ? before : t)))
      throw err
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      if (q && ![t.title, t.project, t.assignee].some((v) => v?.toLowerCase().includes(q))) return false
      if (priorityFilter && t.priority !== priorityFilter) return false
      if (projectFilter && t.projectId !== projectFilter) return false
      if (assigneeFilter && t.assignee !== assigneeFilter) return false
      if (statusFilter && t.status !== statusFilter) return false
      return true
    })
  }, [tasks, search, priorityFilter, projectFilter, assigneeFilter, statusFilter])

  const selectedIds = useMemo(() => {
    const visible = new Set(filtered.map((t) => t.id))
    return selected.filter((id) => visible.has(id))
  }, [selected, filtered])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    projectFilter && { key: 'project', label: `Project: ${projects.find((p) => p.id === projectFilter)?.name ?? projectFilter}`, onRemove: () => setProjectFilter('') },
    assigneeFilter && { key: 'assignee', label: `Assignee: ${assigneeFilter}`, onRemove: () => setAssigneeFilter('') },
    priorityFilter && { key: 'priority', label: `Priority: ${cap(priorityFilter)}`, onRemove: () => setPriorityFilter('') },
    statusFilter && { key: 'status', label: `Status: ${TASK_STATUS_LABEL[statusFilter]}`, onRemove: () => setStatusFilter('') },
  ].filter(Boolean)

  function clearAllFilters() {
    setSearch('')
    setPriorityFilter('')
    setProjectFilter('')
    setAssigneeFilter('')
    setStatusFilter('')
  }

  const kanbanColumns = useMemo(
    () => TASK_COLUMNS.map((c) => ({ key: c.value, label: c.label, items: filtered.filter((t) => t.status === c.value) })),
    [filtered]
  )

  function openCreate() {
    setEditingTask(null)
    setModalOpen(true)
  }

  function openEdit(task) {
    setEditingTask(task)
    setModalOpen(true)
  }

  async function handleSave(values) {
    setIsSaving(true)
    try {
      if (editingTask) {
        const patch = { ...values, history: [{ id: newId('h'), actor, text: 'edited the task details', time: new Date().toISOString(), tone: 'brand' }, ...(editingTask.history || [])] }
        await updateTask(editingTask.id, patch)
        toast.success('Task updated successfully')
      } else {
        const created = await taskService.create({
          ...values,
          id: newId('tsk'),
          comments: 0,
          attachments: 0,
          commentList: [],
          attachmentList: [],
          checklist: [],
          history: [{ id: newId('h'), actor, text: `created this task and assigned it to ${values.assignee}`, time: new Date().toISOString(), tone: 'success' }],
        })
        patchTasks((prev) => [created, ...prev])
        toast.success('Task created successfully')
      }
      setModalOpen(false)
      setEditingTask(null)
    } catch {
      toast.error('Could not save the task. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    const ids = deleteTarget === 'bulk' ? selectedIds : [deleteTarget.id]
    setIsSaving(true)
    try {
      await Promise.all(ids.map((id) => taskService.remove(id)))
      const idSet = new Set(ids)
      patchTasks((prev) => prev.filter((t) => !idSet.has(t.id)))
      setSelected((prev) => prev.filter((id) => !idSet.has(id)))
      if (openTaskId && idSet.has(openTaskId)) setOpenTaskId(null)
      toast.success(ids.length === 1 ? 'Task deleted' : `${ids.length} tasks deleted`)
      setDeleteTarget(null)
    } catch {
      toast.error('Could not delete. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  function moveTask(taskId, newStatus) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return
    const history = [{ id: newId('h'), actor, text: `moved this task to ${TASK_STATUS_LABEL[newStatus]}`, time: new Date().toISOString(), tone: newStatus === 'done' ? 'success' : 'brand' }, ...(task.history || [])]
    updateTask(taskId, { status: newStatus, history }).then(
      () => toast.success(`"${task.title}" moved to ${TASK_STATUS_LABEL[newStatus]}`),
      () => toast.error(`Could not move "${task.title}". Change reverted.`)
    )
  }

  function bulkStatus(status) {
    if (!status) return
    const count = selectedIds.length
    Promise.all(selectedIds.map((id) => updateTask(id, { status }))).then(
      () => toast.success(`${count} task${count === 1 ? '' : 's'} moved to ${TASK_STATUS_LABEL[status]}`),
      () => toast.error('Some tasks could not be updated.')
    )
  }

  function bulkAssign(assignee) {
    if (!assignee) return
    const count = selectedIds.length
    Promise.all(selectedIds.map((id) => updateTask(id, { assignee }))).then(
      () => toast.success(`${count} task${count === 1 ? '' : 's'} assigned to ${assignee}`),
      () => toast.error('Some tasks could not be updated.')
    )
  }

  const columns = [
    {
      key: 'title',
      header: 'Task',
      sortable: true,
      render: (row) => (
        <div className={cn('min-w-[14rem] rounded-r-lg border-l-4 pl-3', PRIORITY_ACCENT[row.priority])}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setOpenTaskId(row.id)
            }}
            className="focus-ring rounded text-left font-semibold text-ink-800 hover:text-brand-600 dark:text-ink-100"
          >
            {row.title}
          </button>
          <div className="mt-0.5 flex items-center gap-3 text-xs text-ink-400">
            <span className="flex items-center gap-1"><MessageSquare size={11} aria-hidden="true" /> {row.comments}</span>
            <span className="flex items-center gap-1"><Paperclip size={11} aria-hidden="true" /> {row.attachments}</span>
          </div>
        </div>
      ),
    },
    { key: 'project', header: 'Project', sortable: true, render: (row) => <span className="whitespace-nowrap">{row.project}</span> },
    {
      key: 'assignee',
      header: 'Assignee',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <Avatar name={row.assignee} size="xs" /> {row.assignee}
        </div>
      ),
    },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      sortAccessor: (r) => PRIORITY_OPTIONS.findIndex((p) => p.value === r.priority),
      render: (row) => <Badge tone={priorityTone(row.priority)}>{cap(row.priority)}</Badge>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      sortAccessor: (r) => TASK_COLUMNS.findIndex((c) => c.value === r.status),
      render: (row) => <StatusBadge status={row.status} label={TASK_STATUS_LABEL[row.status]} />,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (row) => {
        const overdue = row.status !== 'done' && isPastDate(row.dueDate)
        return (
          <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium', overdue ? 'bg-danger-50 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400' : TONES.neutral.chip)}>
            <CalendarClock size={12} aria-hidden="true" />
            {formatDate(row.dueDate)}
            {overdue && <span>(overdue)</span>}
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
            { label: `View ${row.title}`, icon: <Eye size={15} />, onClick: () => setOpenTaskId(row.id) },
            { label: `Edit ${row.title}`, icon: <Pencil size={15} />, onClick: () => openEdit(row) },
            { label: `Delete ${row.title}`, icon: <Trash2 size={15} />, tone: 'danger', onClick: () => setDeleteTarget(row) },
          ]}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Tasks"
        description="Everything your team is working on, across every project."
        breadcrumbItems={[{ label: 'Tasks' }]}
        action={<Button leftIcon={<Plus size={15} />} onClick={openCreate}>New Task</Button>}
      />

      {isError ? (
        <ErrorState title="Couldn't load tasks" description="Something went wrong while fetching your tasks. Please try again." onRetry={retry} />
      ) : (
        <>
          <div className="mb-4 space-y-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:p-4 dark:border-ink-800 dark:bg-ink-900">
            <div className="flex items-center gap-2 sm:justify-between sm:gap-3">
              <SearchBar value={search} onChange={setSearch} placeholder="Search by task, project or assignee..." className="min-w-0 flex-1 sm:w-96 sm:flex-none" />
              <ProjectViewToggle
                value={view}
                onChange={setView}
                ariaLabel="Task view"
                options={[
                  { value: 'kanban', label: 'Kanban view', text: 'Board', icon: LayoutGrid },
                  { value: 'table', label: 'List view', text: 'List', icon: ListIcon },
                ]}
              />
            </div>
            <div className="grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 md:grid-cols-4">
              <Select
                aria-label="Filter by project"
                options={[{ value: '', label: 'All projects' }, ...projects.map((p) => ({ value: p.id, label: p.name }))]}
                value={projectFilter}
                onChange={(e) => setProjectFilter(e.target.value)}
                wrapperClassName="min-[480px]:col-span-2 md:col-span-1"
              />
              <Select
                aria-label="Filter by assignee"
                options={[{ value: '', label: 'All assignees' }, ...assignees.map((a) => ({ value: a, label: a }))]}
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
              />
              <Select aria-label="Filter by priority" options={[{ value: '', label: 'All priorities' }, ...PRIORITY_OPTIONS]} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} />
              <Select aria-label="Filter by status" options={[{ value: '', label: 'All statuses' }, ...TASK_COLUMNS]} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} />
            </div>
          </div>

          <ActiveFilterChips filters={activeFilters} onClearAll={clearAllFilters} className="mb-4" />

          {view === 'table' ? (
            <>
              <SelectionBar count={selectedIds.length} noun="task" onClear={() => setSelected([])}>
                <Select
                  aria-label="Change status of selected tasks"
                  wrapperClassName="w-44"
                  options={[{ value: '', label: 'Change status...' }, ...TASK_COLUMNS]}
                  value=""
                  onChange={(e) => bulkStatus(e.target.value)}
                />
                <Select
                  aria-label="Assign selected tasks"
                  wrapperClassName="w-44"
                  options={[{ value: '', label: 'Assign to...' }, ...employees.map((a) => ({ value: a.name, label: a.name }))]}
                  value=""
                  onChange={(e) => bulkAssign(e.target.value)}
                />
                <Button variant="danger" leftIcon={<Trash2 size={14} />} onClick={() => setDeleteTarget('bulk')}>Delete</Button>
              </SelectionBar>
              <DataTable
                columns={columns}
                data={filtered}
                isLoading={isLoading}
                pageSize={8}
                selectable
                selected={selectedIds}
                onSelectedChange={setSelected}
                onRowClick={(row) => setOpenTaskId(row.id)}
                emptyTitle={activeFilters.length > 0 ? 'No tasks match your filters' : 'No tasks yet'}
                emptyDescription={activeFilters.length > 0 ? 'Try removing a filter or searching for something else.' : 'Create a task to get your team moving.'}
                emptyActionLabel={activeFilters.length > 0 ? 'Clear All' : 'New Task'}
                onEmptyAction={activeFilters.length > 0 ? clearAllFilters : openCreate}
              />
            </>
          ) : isLoading ? (
            <BoardSkeleton />
          ) : (
            <>
              <p className="mb-3 flex items-center gap-1.5 text-xs text-ink-500">
                <GripVertical size={13} aria-hidden="true" className="shrink-0 text-brand-500" />
                Drag cards between columns to change their status, or use the move button on a card.
              </p>
              <TaskBoard
                columns={kanbanColumns}
                onMove={moveTask}
                columnTone={TASK_COLUMN_DOT}
                cardAccent={(task) => PRIORITY_ACCENT[task.priority] || 'border-l-transparent!'}
                renderCard={(task) => <TaskCard task={task} onOpen={(t) => setOpenTaskId(t.id)} onMove={moveTask} />}
              />
            </>
          )}
        </>
      )}

      <TaskFormModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false)
          setEditingTask(null)
        }}
        onSubmit={handleSave}
        initialValues={editingTask}
        isSaving={isSaving}
        projects={projects.length ? projects : undefined}
        employees={employees.length ? employees : undefined}
      />
      <TaskDetailsDrawer task={openTask} onClose={() => setOpenTaskId(null)} onChange={updateTask} employees={employees} projects={projects.length ? projects : undefined} />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isSaving}
        title={deleteTarget === 'bulk' ? `Delete ${selectedIds.length} tasks?` : 'Delete this task?'}
        description={deleteTarget === 'bulk' ? 'The selected tasks will be permanently removed.' : `This will permanently remove "${deleteTarget?.title}".`}
        confirmLabel={deleteTarget === 'bulk' ? 'Delete Tasks' : 'Delete Task'}
      />
      <span className="sr-only" role="status" aria-live="polite">
        {isLoading ? 'Loading tasks' : `${filtered.length} tasks shown`}
      </span>
    </div>
  )
}
