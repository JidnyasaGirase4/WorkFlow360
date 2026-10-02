import { useEffect, useMemo, useState } from 'react'
import { Plus, Flag, CheckCircle2, Circle, CalendarClock, AlertTriangle } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ProjectProgressRing from '../../../components/business/ProjectProgressRing'
import { PROJECT_STATUS_TONE, stagger } from '../../../components/business/ProjectTones'
import Button from '../../../components/common/Button'
import Input from '../../../components/common/Input'
import Select from '../../../components/common/Select'
import Textarea from '../../../components/common/Textarea'
import Modal from '../../../components/common/Modal'
import SearchBar from '../../../components/common/SearchBar'
import Tabs from '../../../components/common/Tabs'
import Card from '../../../components/common/Card'
import Badge from '../../../components/common/Badge'
import StatusBadge from '../../../components/common/StatusBadge'
import Avatar from '../../../components/common/Avatar'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton } from '../../../components/common/Skeleton'
import { milestoneService } from '../../../services/milestoneService'
import { projectService } from '../../../services/projectService'
import { employeeService } from '../../../services/employeeService'
import { formatDate } from '../../../utils/format'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'

const STATUS_CONFIG = {
  upcoming: { label: 'Upcoming', tone: 'info' },
  in_progress: { label: 'In progress', tone: 'brand' },
  done: { label: 'Done', tone: 'success' },
  delayed: { label: 'Delayed', tone: 'danger' },
}
const STATUS_KEYS = Object.keys(STATUS_CONFIG)

const EMPTY_FORM = { title: '', description: '', projectId: '', dueDate: '', owner: '', status: 'upcoming' }

function pad(n) {
  return String(n).padStart(2, '0')
}

function toKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function fromKey(key) {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

function daysBetween(fromKeyStr, toKeyStr) {
  return Math.round((fromKey(toKeyStr) - fromKey(fromKeyStr)) / 86400000)
}

function MilestonesSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading milestones">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-7 w-40" />
        <Skeleton className="h-4 w-80" />
      </div>
      <Skeleton className="mb-5 h-10 w-full max-w-lg" />
      <div className="space-y-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card dark:border-ink-800 dark:bg-ink-900">
            <Skeleton className="h-5 w-56" />
            <Skeleton className="mt-3 h-2 w-full" />
            <div className="mt-5 space-y-3">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Milestones() {
  const { toast } = useToast()

  const [data, setData] = useState(null)
  const [today] = useState(() => toKey(new Date()))
  const [tab, setTab] = useState('all')
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [values, setValues] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let active = true
    Promise.all([milestoneService.list(), projectService.list(), employeeService.list()]).then(
      ([milestones, projects, employees]) => {
        if (active) setData({ milestones, projects, employees })
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

  const milestones = useMemo(() => data?.milestones ?? [], [data])
  const projects = useMemo(() => data?.projects ?? [], [data])

  function isOverdue(m) {
    return m.status !== 'done' && m.dueDate < today
  }

  const counts = useMemo(() => {
    const c = { all: milestones.length }
    STATUS_KEYS.forEach((s) => {
      c[s] = milestones.filter((m) => m.status === s).length
    })
    return c
  }, [milestones])

  const overdueCount = useMemo(
    () => milestones.filter((m) => m.status !== 'done' && m.dueDate < today).length,
    [milestones, today]
  )

  const tabs = [
    { value: 'all', label: 'All', count: counts.all },
    ...STATUS_KEYS.map((s) => ({ value: s, label: STATUS_CONFIG[s].label, count: counts[s] })),
  ]

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    return projects
      .map((project) => {
        const all = milestones.filter((m) => m.projectId === project.id)
        const visible = all
          .filter((m) => {
            const matchesTab = tab === 'all' || m.status === tab
            const matchesSearch =
              !q ||
              m.title.toLowerCase().includes(q) ||
              m.owner.toLowerCase().includes(q) ||
              project.name.toLowerCase().includes(q) ||
              project.client.toLowerCase().includes(q)
            return matchesTab && matchesSearch
          })
          .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
        const done = all.filter((m) => m.status === 'done').length
        return { project, total: all.length, done, visible }
      })
      .filter((g) => g.visible.length > 0)
  }, [projects, milestones, tab, search])

  const hasFilters = Boolean(search) || tab !== 'all'

  function clearFilters() {
    setSearch('')
    setTab('all')
  }

  function openModal() {
    setValues(EMPTY_FORM)
    setErrors({})
    setModalOpen(true)
  }

  function setField(field, value) {
    setValues((v) => ({ ...v, [field]: value }))
  }

  function toggleDone(m) {
    const nextStatus = m.status === 'done' ? 'in_progress' : 'done'
    setData((prev) => ({
      ...prev,
      milestones: prev.milestones.map((x) => (x.id === m.id ? { ...x, status: nextStatus } : x)),
    }))
    milestoneService.update(m.id, { status: nextStatus }).then(
      () => toast.success(nextStatus === 'done' ? `"${m.title}" marked as done` : `"${m.title}" reopened`),
      () => {
        setData((prev) => ({
          ...prev,
          milestones: prev.milestones.map((x) => (x.id === m.id ? { ...x, status: m.status } : x)),
        }))
        toast.error('Could not update the milestone. Change reverted.')
      }
    )
  }

  function handleSubmit(e) {
    e.preventDefault()
    const next = {}
    if (!values.title.trim()) next.title = 'Milestone title is required'
    else if (values.title.trim().length < 4) next.title = 'Title should be at least 4 characters'
    if (!values.projectId) next.projectId = 'Please select a project'
    if (!values.dueDate) next.dueDate = 'Please pick a due date'
    if (!values.owner) next.owner = 'Please select an owner'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setIsSaving(true)
    milestoneService
      .create({
        id: `ms-${Date.now()}`,
        projectId: values.projectId,
        title: values.title.trim(),
        description: values.description.trim(),
        dueDate: values.dueDate,
        status: values.status,
        owner: values.owner,
      })
      .then((item) => {
        setData((prev) => ({ ...prev, milestones: [item, ...prev.milestones] }))
        toast.success('Milestone added successfully')
        setModalOpen(false)
      })
      .finally(() => setIsSaving(false))
  }

  if (loadError) {
    return (
      <div>
        <PageHeader title="Milestones" breadcrumbItems={[{ label: 'Projects' }, { label: 'Milestones' }]} />
        <ErrorState title="Couldn't load milestones" description="Something went wrong while fetching milestones. Please try again." onRetry={retryLoad} />
      </div>
    )
  }

  if (data === null) return <MilestonesSkeleton />

  return (
    <div>
      <PageHeader
        title="Milestones"
        description="Track delivery milestones across every project and spot slippage early."
        breadcrumbItems={[{ label: 'Projects' }, { label: 'Milestones' }]}
        action={
          <Button leftIcon={<Plus size={15} />} onClick={openModal}>
            Add milestone
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-between sm:p-4 dark:border-ink-800 dark:bg-ink-900">
        <SearchBar value={search} onChange={setSearch} placeholder="Search milestones, owners, projects..." className="sm:w-80" />
        {overdueCount > 0 ? (
          <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-danger-50 px-3 py-1.5 text-sm font-semibold text-danger-600 sm:self-auto dark:bg-danger-500/10 dark:text-danger-400" role="status">
            <AlertTriangle size={15} aria-hidden="true" />
            {overdueCount} overdue {overdueCount === 1 ? 'milestone' : 'milestones'}
          </p>
        ) : (
          <p className="inline-flex items-center gap-1.5 self-start rounded-full bg-success-50 px-3 py-1.5 text-sm font-medium text-success-700 sm:self-auto dark:bg-success-500/10 dark:text-success-300">
            <CheckCircle2 size={15} aria-hidden="true" /> Nothing overdue
          </p>
        )}
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />

      {groups.length === 0 ? (
        <EmptyState
          icon={Flag}
          title="No milestones found"
          description={hasFilters ? 'No milestone matches the current status or search. Try clearing the filters.' : 'Add a milestone to start tracking delivery.'}
          actionLabel={hasFilters ? 'Clear filters' : 'Add milestone'}
          onAction={hasFilters ? clearFilters : openModal}
        />
      ) : (
        <div className="space-y-5">
          {groups.map(({ project, total, done, visible }, gi) => {
            const pct = total ? Math.round((done / total) * 100) : 0
            return (
              <Card key={project.id} style={stagger(gi)} className="animate-slide-up overflow-hidden">
                <div className="gradient-soft border-b border-ink-100 px-4 py-4 sm:px-5 dark:border-ink-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <ProjectProgressRing value={pct} size={48} stroke={5} tone={PROJECT_STATUS_TONE[project.status] === 'success' ? 'success' : 'brand'} label={`${project.name} milestone completion`} />
                      <div className="min-w-0">
                        <h2 className="truncate text-base font-bold text-ink-800 sm:text-lg dark:text-ink-100">{project.name}</h2>
                        <p className="mt-0.5 text-xs text-ink-500">
                          {project.client} · PM {project.manager} · Deadline {formatDate(project.deadline)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={project.status} />
                  </div>
                  <div className="mt-3">
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="text-ink-500">
                        {done} of {total} milestones complete
                      </span>
                      <span className="font-semibold text-ink-700 dark:text-ink-200">{pct}%</span>
                    </div>
                    <div
                      className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800"
                      role="progressbar"
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${project.name} milestone progress`}
                    >
                      <div className="h-full rounded-full bg-gradient-to-r from-brand-400 to-accent-500 transition-[width] duration-1000 ease-out starting:w-0" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                </div>

                <ul>
                  {visible.map((m) => {
                    const overdue = isOverdue(m)
                    const cfg = STATUS_CONFIG[m.status]
                    const late = overdue ? daysBetween(m.dueDate, today) : 0
                    return (
                      <li
                        key={m.id}
                        className={cn(
                          'relative flex flex-col gap-3 border-b border-l-4 border-b-ink-100 px-4 py-3.5 transition-colors before:absolute before:bottom-0 before:left-[2.05rem] before:top-0 before:w-px before:bg-ink-200 first:before:top-1/2 last:before:bottom-1/2 last:border-b-0 hover:bg-brand-50/40 sm:flex-row sm:items-center sm:px-5 sm:before:left-[2.3rem] dark:border-b-ink-800 dark:before:bg-ink-700 dark:hover:bg-ink-800/30',
                          overdue
                            ? 'border-l-danger-500! bg-danger-50/60 dark:bg-danger-500/5'
                            : 'border-l-transparent'
                        )}
                      >
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          <button
                            type="button"
                            onClick={() => toggleDone(m)}
                            aria-pressed={m.status === 'done'}
                            aria-label={m.status === 'done' ? `Reopen ${m.title}` : `Mark ${m.title} as done`}
                            className={cn(
                              'focus-ring relative z-10 mt-0.5 shrink-0 rounded-full bg-white transition-all duration-200 hover:scale-110 dark:bg-ink-900',
                              m.status === 'done'
                                ? 'text-success-500'
                                : m.status === 'delayed'
                                  ? 'text-danger-500 hover:text-success-500'
                                  : m.status === 'in_progress'
                                    ? 'text-brand-500 hover:text-success-500'
                                    : 'text-info-300 hover:text-success-500 dark:text-info-400'
                            )}
                          >
                            {m.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                          </button>
                          <div className="min-w-0">
                            <p
                              className={cn(
                                'text-sm font-medium text-ink-800 dark:text-ink-100',
                                m.status === 'done' && 'text-ink-500 line-through decoration-ink-300 dark:text-ink-400'
                              )}
                            >
                              {m.title}
                            </p>
                            {m.description && <p className="mt-0.5 text-xs text-ink-500">{m.description}</p>}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-8 sm:justify-end sm:pl-0">
                          <span className="inline-flex items-center gap-1.5 text-xs text-ink-500">
                            <Avatar name={m.owner} size="xs" />
                            {m.owner}
                          </span>
                          <span
                            className={cn(
                              'inline-flex items-center gap-1.5 whitespace-nowrap text-xs',
                              overdue ? 'font-semibold text-danger-600 dark:text-danger-400' : 'text-ink-500'
                            )}
                          >
                            <CalendarClock size={13} aria-hidden="true" />
                            {formatDate(fromKey(m.dueDate))}
                            {overdue && ` · ${late} ${late === 1 ? 'day' : 'days'} overdue`}
                          </span>
                          <Badge tone={cfg.tone} dot>
                            {cfg.label}
                          </Badge>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </Card>
            )
          })}
        </div>
      )}

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add milestone"
        description="Define a delivery checkpoint for a project"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              Add milestone
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
          <Input
            label="Milestone title"
            required
            wrapperClassName="sm:col-span-2"
            placeholder="e.g. UAT sign-off with client"
            value={values.title}
            error={errors.title}
            onChange={(e) => setField('title', e.target.value)}
          />
          <Select
            label="Project"
            required
            placeholder="Select a project"
            options={projects.map((p) => ({ value: p.id, label: p.name }))}
            value={values.projectId}
            error={errors.projectId}
            onChange={(e) => setField('projectId', e.target.value)}
          />
          <Select
            label="Owner"
            required
            placeholder="Select an owner"
            options={data.employees.map((emp) => ({ value: emp.name, label: emp.name }))}
            value={values.owner}
            error={errors.owner}
            onChange={(e) => setField('owner', e.target.value)}
          />
          <Input
            label="Due date"
            type="date"
            required
            value={values.dueDate}
            error={errors.dueDate}
            onChange={(e) => setField('dueDate', e.target.value)}
          />
          <div role="radiogroup" aria-label="Status" className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-ink-700 dark:text-ink-200">Status</span>
            <div className="grid grid-cols-2 gap-1 rounded-lg border border-ink-200 p-0.5 sm:grid-cols-4 dark:border-ink-700">
              {STATUS_KEYS.map((s) => (
                <button
                  key={s}
                  type="button"
                  role="radio"
                  aria-checked={values.status === s}
                  onClick={() => setField('status', s)}
                  className={cn(
                    'focus-ring rounded-md px-2 py-1.5 text-xs font-medium transition-colors',
                    values.status === s ? 'bg-brand-600 text-white' : 'text-ink-500 hover:bg-ink-100 dark:hover:bg-ink-800'
                  )}
                >
                  {STATUS_CONFIG[s].label}
                </button>
              ))}
            </div>
          </div>
          <Textarea
            label="Description"
            wrapperClassName="sm:col-span-2"
            rows={3}
            placeholder="What must be delivered for this milestone to be complete?"
            value={values.description}
            onChange={(e) => setField('description', e.target.value)}
          />
        </form>
      </Modal>
    </div>
  )
}
