import { useMemo, useState } from 'react'
import { LayoutGrid, List as ListIcon, Paperclip, MessageSquare, Download, ListChecks, Send, CalendarClock, Upload, SearchX } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import SearchBar from '../../components/common/SearchBar'
import Select from '../../components/common/Select'
import FilterBar from '../../components/common/FilterBar'
import DataTable from '../../components/common/DataTable'
import KanbanBoard from '../../components/common/KanbanBoard'
import Badge from '../../components/common/Badge'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import Drawer from '../../components/common/Drawer'
import Tabs from '../../components/common/Tabs'
import Textarea from '../../components/common/Textarea'
import Avatar from '../../components/common/Avatar'
import Checkbox from '../../components/common/Checkbox'
import ProgressBar from '../../components/common/ProgressBar'
import ActivityTimeline from '../../components/common/ActivityTimeline'
import EmptyState from '../../components/common/EmptyState'
import FileUploadModal from '../../components/common/FileUploadModal'
import FileTypeTile from '../../components/portal/FileTypeTile'
import { toneOf, PRIORITY_TONE_KEY } from '../../components/portal/tones'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { setTaskStatus, addTaskComment, addTaskAttachment, toggleTaskChecklist } from '../../utils/portalStores'
import { TODAY } from '../../mockData/reference'
import { TASK_STATUSES } from '../../mockData/tasks'
import { formatDate, formatDateTime, formatFileSize } from '../../utils/format'
import { downloadTextFile } from '../../utils/download'
import { cn } from '../../utils/cn'

const STATUS_LABEL = { todo: 'Todo', in_progress: 'In Progress', review: 'In Review', done: 'Done' }
const COLUMN_TONE = { todo: 'bg-warning-500', in_progress: 'bg-brand-500', review: 'bg-info-500', done: 'bg-success-500' }
const PRIORITY_TONE = { urgent: 'danger', high: 'warning', medium: 'brand', low: 'neutral' }
const PRIORITIES = ['urgent', 'high', 'medium', 'low']

const DRAWER_TABS = [
  { value: 'comments', label: 'Comments' },
  { value: 'files', label: 'Attachments' },
  { value: 'activity', label: 'Activity' },
]

function isOverdue(task) {
  return task.status !== 'done' && task.dueDate < TODAY
}

function TasksSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading tasks">
      <div className="mb-4 flex gap-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="w-72 shrink-0 space-y-3 rounded-xl border border-ink-200 p-3 dark:border-ink-800">
            <Skeleton className="h-4 w-24" />
            <SkeletonCard />
            <SkeletonCard />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function EmployeeTasks() {
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { name, tasks } = useEmployeeData()

  const [view, setView] = useState('kanban')
  const [search, setSearch] = useState('')
  const [priorityFilter, setPriorityFilter] = useState('')
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedId, setSelectedId] = useState(null)

  const projectOptions = useMemo(() => [...new Set(tasks.map((t) => t.project))], [tasks])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return tasks.filter((t) => {
      const matchesSearch = !q || t.title.toLowerCase().includes(q) || t.project.toLowerCase().includes(q)
      return matchesSearch && (!priorityFilter || t.priority === priorityFilter) && (!projectFilter || t.project === projectFilter) && (!statusFilter || t.status === statusFilter)
    })
  }, [tasks, search, priorityFilter, projectFilter, statusFilter])

  const kanbanColumns = useMemo(
    () => TASK_STATUSES.map((status) => ({ key: status, label: STATUS_LABEL[status], items: filtered.filter((t) => t.status === status) })),
    [filtered]
  )

  const chips = [
    priorityFilter && { key: 'priority', label: `Priority: ${priorityFilter}`, onRemove: () => setPriorityFilter('') },
    projectFilter && { key: 'project', label: `Project: ${projectFilter}`, onRemove: () => setProjectFilter('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_LABEL[statusFilter]}`, onRemove: () => setStatusFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setPriorityFilter('')
    setProjectFilter('')
    setStatusFilter('')
  }

  function handleMove(taskId, newStatus) {
    const task = tasks.find((t) => t.id === taskId)
    if (!task || task.status === newStatus) return
    setTaskStatus(taskId, newStatus, name)
    toast.success(`"${task.title}" moved to ${STATUS_LABEL[newStatus]}`)
  }

  function exportCsv() {
    const rows = [['Task', 'Project', 'Priority', 'Status', 'Due date']]
    filtered.forEach((t) => rows.push([t.title, t.project, t.priority, STATUS_LABEL[t.status], t.dueDate]))
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadTextFile('my-tasks.csv', csv, 'text/csv')
    toast.success(`Exported ${filtered.length} task${filtered.length === 1 ? '' : 's'} to CSV`)
  }

  const columns = [
    {
      key: 'title',
      header: 'Task',
      sortable: true,
      render: (row) => (
        <span className="flex items-center gap-2.5 font-medium text-ink-800 dark:text-ink-100">
          <span className={cn('h-2 w-2 shrink-0 rounded-full', toneOf(PRIORITY_TONE_KEY[row.priority]).dot)} aria-hidden="true" />
          {row.title}
        </span>
      ),
    },
    { key: 'project', header: 'Project', sortable: true },
    {
      key: 'priority',
      header: 'Priority',
      sortable: true,
      sortAccessor: (row) => PRIORITIES.indexOf(row.priority),
      render: (row) => <Badge tone={PRIORITY_TONE[row.priority]} dot>{row.priority}</Badge>,
    },
    {
      key: 'dueDate',
      header: 'Due Date',
      sortable: true,
      render: (row) => <span className={cn(isOverdue(row) && 'font-semibold text-danger-600 dark:text-danger-400')}>{formatDate(row.dueDate)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Select
            aria-label={`Status for ${row.title}`}
            value={row.status}
            onChange={(e) => handleMove(row.id, e.target.value)}
            options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
            className="w-36 text-xs"
          />
        </span>
      ),
    },
  ]

  const selected = tasks.find((t) => t.id === selectedId) || null

  return (
    <div>
      <PageHeader
        title="My Tasks"
        description="Work assigned to you across all projects."
        breadcrumbItems={[{ label: 'Work' }, { label: 'My Tasks' }]}
        homeHref="/employee/dashboard"
        action={
          <Button variant="secondary" leftIcon={<Download size={15} />} onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<TasksSkeleton />}>
        {tasks.length === 0 ? (
          <EmptyState icon={ListChecks} title="No tasks assigned yet" description="When your manager assigns work to you it will appear here." />
        ) : (
          <>
            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search tasks..." />}
              chips={chips}
              onClearAll={clearFilters}
              actions={
                <div role="group" aria-label="Task view" className="flex items-center gap-1 rounded-xl border border-ink-200 bg-white p-1 shadow-card dark:border-ink-700 dark:bg-ink-900">
                  <button
                    type="button"
                    onClick={() => setView('table')}
                    aria-pressed={view === 'table'}
                    className={cn('focus-ring flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all', view === 'table' ? 'gradient-brand bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-ink-800')}
                  >
                    <ListIcon size={14} /> List
                  </button>
                  <button
                    type="button"
                    onClick={() => setView('kanban')}
                    aria-pressed={view === 'kanban'}
                    className={cn('focus-ring flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-all', view === 'kanban' ? 'gradient-brand bg-brand-600 text-white shadow-sm' : 'text-ink-500 hover:bg-brand-50 hover:text-brand-700 dark:hover:bg-ink-800')}
                  >
                    <LayoutGrid size={14} /> Board
                  </button>
                </div>
              }
            >
              <Select aria-label="Filter by priority" placeholder="All priorities" options={PRIORITIES.map((p) => ({ value: p, label: p[0].toUpperCase() + p.slice(1) }))} value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="sm:w-36" />
              <Select aria-label="Filter by project" placeholder="All projects" options={projectOptions.map((p) => ({ value: p, label: p }))} value={projectFilter} onChange={(e) => setProjectFilter(e.target.value)} className="sm:w-48" />
              <Select aria-label="Filter by status" placeholder="All statuses" options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-36" />
            </FilterBar>

            {filtered.length === 0 ? (
              <EmptyState icon={SearchX} title="No tasks match your filters" description="Try a different search or clear the filters." actionLabel="Clear filters" onAction={() => { setSearch(''); clearFilters() }} />
            ) : view === 'table' ? (
              <DataTable columns={columns} data={filtered} onRowClick={(row) => setSelectedId(row.id)} ariaLabel="My tasks" emptyTitle="No tasks found" />
            ) : (
              <>
                <p className="mb-3 text-xs text-ink-500">Drag cards between columns, or focus a card and press Alt + Arrow keys. Click a card for details.</p>
                <KanbanBoard
                  columns={kanbanColumns}
                  onMove={handleMove}
                  columnTone={COLUMN_TONE}
                  onCardClick={(task) => setSelectedId(task.id)}
                  renderCard={(task) => (
                    <div>
                      <span className={cn('mb-2.5 block h-1 w-10 rounded-full', toneOf(PRIORITY_TONE_KEY[task.priority]).dot)} aria-hidden="true" />
                      <div className="flex items-start justify-between gap-2">
                        <p className="min-w-0 text-sm font-semibold text-ink-800 dark:text-ink-100">{task.title}</p>
                        <Badge tone={PRIORITY_TONE[task.priority]} dot>{task.priority}</Badge>
                      </div>
                      <p className="mt-1 truncate text-xs text-ink-500">{task.project}</p>
                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-3 text-xs text-ink-400">
                          <span className="flex items-center gap-1">
                            <MessageSquare size={12} /> {task.commentList.length}
                          </span>
                          <span className="flex items-center gap-1">
                            <Paperclip size={12} /> {task.attachmentList.length}
                          </span>
                        </div>
                        <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs', isOverdue(task) ? 'bg-danger-50 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400' : 'bg-ink-50 text-ink-500 dark:bg-ink-800')}>
                          <CalendarClock size={11} /> {formatDate(task.dueDate)}
                        </span>
                      </div>
                    </div>
                  )}
                />
              </>
            )}
          </>
        )}
      </AsyncState>

      <TaskDrawer task={selected} name={name} onClose={() => setSelectedId(null)} onStatusChange={handleMove} />
    </div>
  )
}

function TaskDrawer({ task, name, onClose, onStatusChange }) {
  const { toast } = useToast()
  const [tab, setTab] = useState('comments')
  const [comment, setComment] = useState('')
  const [commentError, setCommentError] = useState('')
  const [uploadOpen, setUploadOpen] = useState(false)

  useResetOnChange([task?.id], () => {
    setTab('comments')
    setComment('')
    setCommentError('')
  })

  if (!task) return null

  const done = task.checklist.filter((c) => c.done).length

  function postComment() {
    const text = comment.trim()
    if (!text) {
      setCommentError('Write a comment before posting.')
      return
    }
    addTaskComment(task.id, name, text)
    setComment('')
    setCommentError('')
    toast.success('Comment added')
  }

  function handleAttach({ file }) {
    addTaskAttachment(task.id, { name: file.name, size: file.size }, name)
    setUploadOpen(false)
    toast.success(`${file.name} attached`)
  }

  return (
    <>
      <Drawer isOpen onClose={onClose} title={task.title} description={task.project} width="max-w-xl">
        <div className="space-y-5">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} />
            <Badge tone={PRIORITY_TONE[task.priority]}>{task.priority} priority</Badge>
            <span className={cn('inline-flex items-center gap-1 text-xs', isOverdue(task) ? 'font-semibold text-danger-600 dark:text-danger-400' : 'text-ink-500')}>
              <CalendarClock size={13} /> Due {formatDate(task.dueDate)}
              {isOverdue(task) && ' (overdue)'}
            </span>
          </div>

          <Select
            label="Status"
            value={task.status}
            onChange={(e) => onStatusChange(task.id, e.target.value)}
            options={TASK_STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          />

          {task.description && (
            <div>
              <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Description</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600 dark:text-ink-300">{task.description}</p>
            </div>
          )}

          {task.checklist.length > 0 && (
            <div>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-semibold text-ink-800 dark:text-ink-100">Checklist</h3>
                <span className="text-xs text-ink-400">
                  {done}/{task.checklist.length}
                </span>
              </div>
              <ProgressBar value={(done / task.checklist.length) * 100} size="sm" hideLabel label="Checklist progress" className="mb-3" />
              <ul className="space-y-2">
                {task.checklist.map((item) => (
                  <li key={item.id}>
                    <Checkbox label={item.text} checked={item.done} onChange={() => toggleTaskChecklist(task.id, item.id)} />
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div>
            <Tabs
              idPrefix="task-drawer"
              ariaLabel="Task details"
              tabs={DRAWER_TABS.map((t) => ({
                ...t,
                count: t.value === 'comments' ? task.commentList.length : t.value === 'files' ? task.attachmentList.length : task.history.length,
              }))}
              active={tab}
              onChange={setTab}
            />

            <div role="tabpanel" id={`task-drawer-panel-${tab}`} aria-labelledby={`task-drawer-tab-${tab}`} className="pt-4">
              {tab === 'comments' && (
                <div className="space-y-4">
                  {task.commentList.length === 0 && <p className="text-sm text-ink-400">No comments yet. Start the conversation below.</p>}
                  {task.commentList.map((c) => (
                    <div key={c.id} className="flex gap-3">
                      <Avatar name={c.author} size="sm" />
                      <div className="min-w-0 flex-1 rounded-2xl rounded-tl-md bg-brand-50/60 px-3.5 py-2.5 dark:bg-ink-800/60">
                        <p className="flex flex-wrap items-baseline gap-x-2 text-xs">
                          <span className="font-semibold text-ink-800 dark:text-ink-100">{c.author}</span>
                          <span className="text-ink-400">{formatDateTime(c.time)}</span>
                        </p>
                        <p className="mt-1 text-sm text-ink-700 dark:text-ink-200">{c.text}</p>
                      </div>
                    </div>
                  ))}
                  <div className="flex items-start gap-2 border-t border-ink-100 pt-4 dark:border-ink-800">
                    <Textarea
                      wrapperClassName="flex-1"
                      rows={2}
                      aria-label="Add a comment"
                      placeholder="Add a comment..."
                      value={comment}
                      onChange={(e) => {
                        setComment(e.target.value)
                        if (commentError) setCommentError('')
                      }}
                      error={commentError}
                    />
                    <Button leftIcon={<Send size={14} />} onClick={postComment}>
                      Post
                    </Button>
                  </div>
                </div>
              )}

              {tab === 'files' && (
                <div className="space-y-3">
                  {task.attachmentList.length === 0 && <p className="text-sm text-ink-400">No attachments yet.</p>}
                  {task.attachmentList.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-3 transition-colors hover:bg-ink-50/70 dark:border-ink-800 dark:hover:bg-ink-800/40">
                      <FileTypeTile type={a.name.endsWith('.pdf') ? 'pdf' : a.name.endsWith('.xlsx') ? 'sheet' : a.name.endsWith('.zip') ? 'archive' : 'design'} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{a.name}</p>
                        <p className="text-xs text-ink-400">
                          {formatFileSize(a.size)} · {a.uploadedBy} · {formatDate(a.time)}
                        </p>
                      </div>
                    </div>
                  ))}
                  <Button variant="secondary" size="sm" leftIcon={<Upload size={14} />} onClick={() => setUploadOpen(true)}>
                    Attach file
                  </Button>
                </div>
              )}

              {tab === 'activity' && <ActivityTimeline items={task.history} />}
            </div>
          </div>
        </div>
      </Drawer>
      <FileUploadModal
        isOpen={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSubmit={handleAttach}
        title="Attach a file"
        description={`Add a file to "${task.title}".`}
        showNote={false}
        submitLabel="Attach"
      />
    </>
  )
}
