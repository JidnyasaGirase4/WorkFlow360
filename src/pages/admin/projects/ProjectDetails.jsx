import { useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from 'recharts'
import {
  CalendarClock, IndianRupee, Users, Pencil, Plus, Paperclip, MessageSquare, UserPlus, Upload, Gauge, Wallet, PiggyBank,
  CheckCircle2, Clock3, FileText, Trash2, Flag, Circle, Folder, UserRound, Building2,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ProjectFormModal from '../../../components/business/ProjectFormModal'
import TaskFormModal from '../../../components/business/TaskFormModal'
import TaskDetailsDrawer from '../../../components/business/TaskDetailsDrawer'
import AddMemberModal from '../../../components/business/AddMemberModal'
import FileUploadModal from '../../../components/business/FileUploadModal'
import DetailSkeleton from '../../../components/business/DetailSkeleton'
import ProjectKpi from '../../../components/business/ProjectKpi'
import ClientAvatar from '../../../components/business/ClientAvatar'
import LeadTimeline from '../../../components/business/LeadTimeline'
import { TONES, CHART_COLORS, PRIORITY_ACCENT, stagger } from '../../../components/business/ProjectTones'
import ChartTooltip from '../../../components/business/ChartTooltip'
import Card, { CardHeader, CardTitle, CardBody } from '../../../components/common/Card'
import Button from '../../../components/common/Button'
import Tabs from '../../../components/common/Tabs'
import StatusBadge from '../../../components/common/StatusBadge'
import Badge from '../../../components/common/Badge'
import Avatar from '../../../components/common/Avatar'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { projectService } from '../../../services/projectService'
import { taskService } from '../../../services/taskService'
import { milestoneService } from '../../../services/milestoneService'
import { documentService } from '../../../services/documentService'
import { employeeService } from '../../../services/employeeService'
import { clientService } from '../../../services/clientService'
import { useMockQuery } from '../../../hooks/useMockQuery'
import { useAuth } from '../../../context/AuthContext'
import { useToast } from '../../../context/ToastContext'
import { useTheme } from '../../../context/ThemeContext'
import { formatCurrency, formatDate, formatDateTime } from '../../../utils/format'
import { TASK_COLUMNS, TASK_STATUS_LABEL, cap, fileKind, formatFileSize, isPastDate, newId, priorityTone, todayKey } from '../../../utils/workspace'
import { cn } from '../../../utils/cn'

const MILESTONE_LABEL = { upcoming: 'Upcoming', in_progress: 'In progress', done: 'Done', delayed: 'Delayed' }
const MILESTONE_TONE = { upcoming: 'info', in_progress: 'brand', done: 'success', delayed: 'danger' }
const STATUS_COLORS = { todo: '#a0a9a2', in_progress: '#1aa996', review: '#8654ec', done: '#22a559' }
const [TEAL, , AMBER, VIOLET, , , GREEN] = CHART_COLORS

const FILE_TONE = { pdf: 'accent', sheet: 'success', doc: 'brand', image: 'info', design: 'warning', file: 'neutral' }

function pad(n) {
  return String(n).padStart(2, '0')
}

function weekKey(dateKey) {
  const [y, m, d] = dateKey.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - ((dt.getDay() + 6) % 7))
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

function daysBetween(fromKey, toKey) {
  const [fy, fm, fd] = fromKey.split('-').map(Number)
  const [ty, tm, td] = toKey.split('-').map(Number)
  return Math.round((new Date(ty, tm - 1, td) - new Date(fy, fm - 1, fd)) / 86400000)
}

export default function ProjectDetails() {
  const { id } = useParams()
  return <ProjectDetailsInner key={id} id={id} />
}

function ProjectDetailsInner({ id }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = useAuth()
  const { theme } = useTheme()
  const dark = theme === 'dark'
  const actor = user?.name || 'You'
  const axisColor = dark ? '#a0a9a2' : '#737e76'
  const gridColor = dark ? '#2b332d' : '#e2e6e1'
  const cursorColor = dark ? 'rgba(255,255,255,0.05)' : 'rgba(26,169,150,0.08)'

  const load = useCallback(
    () =>
      Promise.all([
        projectService.get(id),
        taskService.list(),
        milestoneService.list(),
        documentService.list(),
        employeeService.list(),
        clientService.list(),
      ]).then(([project, tasks, milestones, documents, employees, clients]) => ({
        project,
        tasks: tasks.filter((t) => t.projectId === id),
        milestones: milestones.filter((m) => m.projectId === id),
        documents: documents.filter((d) => d.project === project.name),
        employees,
        clients,
      })),
    [id]
  )
  const { data, isLoading, isError, error, retry, setData } = useMockQuery(load)

  const [tab, setTab] = useState('overview')
  const [editOpen, setEditOpen] = useState(false)
  const [taskOpen, setTaskOpen] = useState(false)
  const [memberOpen, setMemberOpen] = useState(false)
  const [fileOpen, setFileOpen] = useState(false)
  const [removeMember, setRemoveMember] = useState(null)
  const [openTaskId, setOpenTaskId] = useState(null)
  const [busy, setBusy] = useState(false)

  const project = data?.project
  const tasks = useMemo(() => data?.tasks ?? [], [data])
  const milestones = useMemo(() => data?.milestones ?? [], [data])
  const documents = useMemo(() => data?.documents ?? [], [data])
  const employees = useMemo(() => data?.employees ?? [], [data])
  const team = useMemo(() => project?.team ?? [], [project])
  const openTask = tasks.find((t) => t.id === openTaskId) || null

  const doneTasks = tasks.filter((t) => t.status === 'done').length
  const pendingTasks = tasks.length - doneTasks

  const statusChart = useMemo(
    () =>
      TASK_COLUMNS.map((c) => ({ name: c.label, value: tasks.filter((t) => t.status === c.value).length, color: STATUS_COLORS[c.value] })).filter((s) => s.value > 0),
    [tasks]
  )

  const workloadChart = useMemo(() => {
    const names = [...new Set([...team, ...tasks.map((t) => t.assignee)])]
    return names.map((name) => ({
      name: name.split(' ')[0],
      fullName: name,
      Open: tasks.filter((t) => t.assignee === name && t.status !== 'done').length,
      Done: tasks.filter((t) => t.assignee === name && t.status === 'done').length,
    }))
  }, [team, tasks])

  const timelineChart = useMemo(() => {
    const buckets = {}
    tasks.forEach((t) => {
      const key = weekKey(t.dueDate)
      buckets[key] = buckets[key] || { Done: 0, Pending: 0 }
      buckets[key][t.status === 'done' ? 'Done' : 'Pending'] += 1
    })
    return Object.keys(buckets)
      .sort()
      .map((key) => ({ name: formatDate(key, { year: undefined }), ...buckets[key] }))
  }, [tasks])

  const activityItems = useMemo(() => {
    if (!project) return []
    const own = (project.activityLog || []).map((a) => ({ id: a.id, actor: a.actor, text: a.text, at: a.time, tone: a.tone }))
    const fromTasks = tasks.flatMap((t) =>
      (t.history || [])
        .filter((h) => !h.text.startsWith('created'))
        .map((h) => ({ id: `${t.id}-${h.id}`, actor: h.actor, text: `${h.text.replace('this task', `"${t.title}"`)}`, at: h.time, tone: h.tone }))
    )
    const created = { id: 'created', actor: project.manager, text: 'created this project', at: `${project.startDate}T09:00:00`, tone: 'neutral' }
    return [...own, ...fromTasks, created]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((it) => ({ id: it.id, actor: it.actor, text: it.text, tone: it.tone, time: <>{formatDateTime(it.at)}</> }))
  }, [project, tasks])

  async function logActivity(text, tone = 'brand') {
    const entry = { id: newId('pa'), actor, text, time: new Date().toISOString(), tone }
    const log = [entry, ...(project.activityLog || [])]
    setData((prev) => ({ ...prev, project: { ...prev.project, activityLog: log } }))
    await projectService.update(id, { activityLog: log })
  }

  async function updateTask(taskId, patch) {
    const before = tasks.find((t) => t.id === taskId)
    setData((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) }))
    try {
      await taskService.update(taskId, patch)
    } catch (err) {
      setData((prev) => ({ ...prev, tasks: prev.tasks.map((t) => (t.id === taskId ? before : t)) }))
      throw err
    }
  }

  async function handleEdit(values) {
    setBusy(true)
    try {
      const updated = await projectService.update(id, values)
      setData((prev) => ({ ...prev, project: updated }))
      toast.success(`${values.name} updated successfully`)
      setEditOpen(false)
    } catch {
      toast.error('Could not update the project. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddTask(values) {
    setBusy(true)
    try {
      const created = await taskService.create({
        ...values,
        id: newId('tsk'),
        projectId: id,
        project: project.name,
        comments: 0,
        attachments: 0,
        commentList: [],
        attachmentList: [],
        checklist: [],
        history: [{ id: newId('h'), actor, text: `created this task and assigned it to ${values.assignee}`, time: new Date().toISOString(), tone: 'success' }],
      })
      setData((prev) => ({ ...prev, tasks: [created, ...prev.tasks] }))
      await logActivity(`added the task "${values.title}"`, 'success')
      toast.success(`Task "${values.title}" added to ${project.name}`)
      setTaskOpen(false)
      setTab('tasks')
    } catch {
      toast.error('Could not add the task. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleAddMember(name) {
    setBusy(true)
    try {
      const nextTeam = [...team, name]
      const updated = await projectService.update(id, { team: nextTeam })
      setData((prev) => ({ ...prev, project: { ...prev.project, ...updated } }))
      await logActivity(`added ${name} to the project team`, 'info')
      toast.success(`${name} added to the team`)
      setMemberOpen(false)
    } catch {
      toast.error('Could not add the member. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleRemoveMember() {
    setBusy(true)
    try {
      const nextTeam = team.filter((m) => m !== removeMember)
      const updated = await projectService.update(id, { team: nextTeam })
      setData((prev) => ({ ...prev, project: { ...prev.project, ...updated } }))
      await logActivity(`removed ${removeMember} from the project team`, 'warning')
      toast.success(`${removeMember} removed from the team`)
      setRemoveMember(null)
    } catch {
      toast.error('Could not remove the member. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function handleUpload({ file, category }) {
    setBusy(true)
    try {
      const doc = await documentService.create({
        id: newId('doc'),
        name: file.name,
        category,
        project: project.name,
        client: project.client,
        uploadedBy: actor,
        uploadedDate: todayKey(),
        size: formatFileSize(file.size),
        type: fileKind(file.name),
      })
      setData((prev) => ({ ...prev, documents: [doc, ...prev.documents] }))
      await logActivity(`uploaded ${file.name}`, 'brand')
      toast.success(`${file.name} uploaded`)
      setFileOpen(false)
      setTab('files')
    } catch {
      toast.error('Could not upload the file. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function toggleMilestone(m) {
    const status = m.status === 'done' ? 'in_progress' : 'done'
    setData((prev) => ({ ...prev, milestones: prev.milestones.map((x) => (x.id === m.id ? { ...x, status } : x)) }))
    try {
      await milestoneService.update(m.id, { status })
      toast.success(status === 'done' ? `"${m.title}" marked as done` : `"${m.title}" reopened`)
    } catch {
      setData((prev) => ({ ...prev, milestones: prev.milestones.map((x) => (x.id === m.id ? m : x)) }))
      toast.error('Could not update the milestone.')
    }
  }

  if (isLoading) return <DetailSkeleton label="Loading project" />
  if (isError) {
    if (error?.code === 'NOT_FOUND') {
      return <EmptyState title="Project not found" description="This project may have been deleted." actionLabel="Back to Projects" onAction={() => navigate('/admin/projects')} />
    }
    return <ErrorState title="Couldn't load this project" onRetry={retry} />
  }

  const today = todayKey()
  const closed = project.status === 'completed' || project.status === 'cancelled'
  const daysLeft = daysBetween(today, project.deadline)
  const overdue = !closed && daysLeft < 0
  const remaining = project.budget - project.spent
  const spentPct = project.budget ? Math.min(Math.round((project.spent / project.budget) * 100), 100) : 0
  const candidates = employees.filter((e) => !team.includes(e.name))
  const client = data.clients.find((c) => c.id === project.clientId)

  const tabs = [
    { value: 'overview', label: 'Overview' },
    { value: 'tasks', label: 'Tasks', count: tasks.length },
    { value: 'milestones', label: 'Milestones', count: milestones.length },
    { value: 'team', label: 'Team', count: team.length },
    { value: 'files', label: 'Files', count: documents.length },
    { value: 'activity', label: 'Activity' },
  ]

  return (
    <div>
      <PageHeader
        title={project.name}
        breadcrumbItems={[{ label: 'Projects', href: '/admin/projects' }, { label: project.name }]}
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" leftIcon={<Pencil size={15} />} onClick={() => setEditOpen(true)}>Edit</Button>
            <Button variant="secondary" leftIcon={<UserPlus size={15} />} onClick={() => setMemberOpen(true)}>Add Member</Button>
            <Button variant="secondary" leftIcon={<Upload size={15} />} onClick={() => setFileOpen(true)}>Upload File</Button>
            <Button leftIcon={<Plus size={15} />} onClick={() => setTaskOpen(true)}>Add Task</Button>
          </div>
        }
      />

      <div className="gradient-hero relative mb-6 overflow-hidden rounded-2xl p-4 text-white shadow-card sm:p-6 lg:mb-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-white/10" />
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-white/10" />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/95 px-1 py-0.5 dark:bg-ink-900/90">
                <StatusBadge status={project.status} />
              </span>
              {overdue && <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-danger-600">Overdue by {Math.abs(daysLeft)} day{Math.abs(daysLeft) === 1 ? '' : 's'}</span>}
            </div>
            <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-white/90">
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <Building2 size={15} aria-hidden="true" className="shrink-0" />
                Client:{' '}
                {client ? (
                  <Link to={`/admin/crm/clients/${client.id}`} className="focus-ring truncate rounded font-semibold text-white underline decoration-white/50 underline-offset-2 hover:decoration-white">{project.client}</Link>
                ) : (
                  <span className="truncate font-semibold text-white">{project.client}</span>
                )}
              </span>
              <span className="inline-flex min-w-0 items-center gap-1.5">
                <UserRound size={15} aria-hidden="true" className="shrink-0" />
                Manager: <span className="truncate font-semibold text-white">{project.manager}</span>
              </span>
            </p>
          </div>
          <div className="flex flex-1 flex-col gap-4 sm:flex-row sm:items-center lg:max-w-xl lg:justify-end">
            <div className="flex-1">
              <div className="mb-2 flex items-center justify-between text-xs text-white/85">
                <span>Overall progress</span>
                <span className="text-sm font-bold text-white">{project.progress}%</span>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-white/25" role="progressbar" aria-valuenow={project.progress} aria-valuemin={0} aria-valuemax={100} aria-label="Overall project progress">
                <div className="h-full rounded-full bg-white transition-[width] duration-1000 ease-out starting:w-0" style={{ width: `${project.progress}%` }} />
              </div>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl bg-white/15 px-3 py-2 text-sm backdrop-blur-sm">
              <CalendarClock size={18} aria-hidden="true" />
              <div>
                <p className="text-xs text-white/80">Deadline</p>
                <p className="font-bold">{formatDate(project.deadline)}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} className="mb-5" />

      {tab === 'overview' && (
        <div className="space-y-4 sm:space-y-5 lg:space-y-6">
          <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
            <ProjectKpi index={0} icon={Gauge} label="Overall progress" value={`${project.progress}%`} tone="brand" />
            <ProjectKpi index={1} icon={Wallet} label="Budget" value={formatCurrency(project.budget)} tone="info" />
            <ProjectKpi index={2} icon={IndianRupee} label="Spent" value={formatCurrency(project.spent)} sub={`${spentPct}% of budget`} tone="warning" />
            <ProjectKpi index={3} icon={PiggyBank} label="Remaining" value={formatCurrency(remaining)} tone={remaining < 0 ? 'danger' : 'success'} sub={remaining < 0 ? 'Over budget' : undefined} />
            <ProjectKpi index={4} icon={CheckCircle2} label="Tasks completed" value={`${doneTasks} of ${tasks.length}`} tone="success" />
            <ProjectKpi index={5} icon={Clock3} label="Tasks pending" value={pendingTasks} tone="warning" />
            <ProjectKpi index={6} icon={Users} label="Team members" value={team.length} tone="accent" />
            <ProjectKpi index={7} icon={CalendarClock} label="Deadline" value={formatDate(project.deadline)} sub={closed ? 'Project closed' : overdue ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days left`} tone={overdue ? 'danger' : 'info'} />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            <Card>
              <CardHeader><CardTitle>Task completion</CardTitle></CardHeader>
              <CardBody style={{ height: 260 }}>
                {tasks.length === 0 ? (
                  <EmptyState title="No tasks yet" description="Add a task to see completion." className="py-6" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusChart} dataKey="value" nameKey="name" innerRadius={52} outerRadius={80} paddingAngle={3} stroke="none">
                        {statusChart.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                      </Pie>
                      <RTooltip content={<ChartTooltip />} />
                      <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: axisColor }} />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Team workload</CardTitle></CardHeader>
              <CardBody style={{ height: 260 }}>
                {workloadChart.length === 0 ? (
                  <EmptyState title="No team yet" description="Add members to see workload." className="py-6" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={workloadChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pd-open" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={TEAL} stopOpacity={1} />
                          <stop offset="100%" stopColor={TEAL} stopOpacity={0.65} />
                        </linearGradient>
                        <linearGradient id="pd-done" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={VIOLET} stopOpacity={1} />
                          <stop offset="100%" stopColor={VIOLET} stopOpacity={0.65} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: axisColor }} tickLine={false} axisLine={false} />
                      <RTooltip cursor={{ fill: cursorColor }} content={<ChartTooltip labelFormatter={(_, p) => p[0]?.payload?.fullName} />} />
                      <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: axisColor }} />
                      <Bar dataKey="Open" stackId="a" fill="url(#pd-open)" maxBarSize={36} radius={[0, 0, 0, 0]} />
                      <Bar dataKey="Done" stackId="a" fill="url(#pd-done)" maxBarSize={36} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
            <Card>
              <CardHeader><CardTitle>Task timeline</CardTitle></CardHeader>
              <CardBody style={{ height: 260 }}>
                {timelineChart.length === 0 ? (
                  <EmptyState title="No dated tasks" description="Tasks with due dates appear here by week." className="py-6" />
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={timelineChart} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="pd-tl-done" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={GREEN} stopOpacity={1} />
                          <stop offset="100%" stopColor={GREEN} stopOpacity={0.65} />
                        </linearGradient>
                        <linearGradient id="pd-tl-pending" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={AMBER} stopOpacity={1} />
                          <stop offset="100%" stopColor={AMBER} stopOpacity={0.65} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridColor} />
                      <XAxis dataKey="name" tick={{ fontSize: 12, fill: axisColor }} tickLine={false} axisLine={false} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: axisColor }} tickLine={false} axisLine={false} />
                      <RTooltip cursor={{ fill: cursorColor }} content={<ChartTooltip labelFormatter={(l) => `Week of ${l}`} />} />
                      <Legend verticalAlign="bottom" iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, color: axisColor }} />
                      <Bar dataKey="Done" stackId="a" fill="url(#pd-tl-done)" maxBarSize={36} />
                      <Bar dataKey="Pending" stackId="a" fill="url(#pd-tl-pending)" maxBarSize={36} radius={[8, 8, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            <div className="space-y-4 sm:space-y-5 lg:col-span-2 lg:space-y-6">
              <Card>
                <CardHeader><CardTitle>Description</CardTitle></CardHeader>
                <CardBody>
                  <p className="text-sm leading-relaxed text-ink-600 dark:text-ink-300">{project.description || 'No description added yet.'}</p>
                </CardBody>
              </Card>
              <Card>
                <CardHeader><CardTitle>Budget overview</CardTitle></CardHeader>
                <CardBody>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-ink-500">Spent</span>
                    <span className="font-bold text-ink-800 dark:text-ink-100">{formatCurrency(project.spent)}</span>
                  </div>
                  <div className="mt-1.5 h-3 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={spentPct} aria-valuemin={0} aria-valuemax={100} aria-label="Budget spent">
                    <div className={cn('h-full rounded-full transition-[width] duration-1000 ease-out starting:w-0', remaining < 0 ? 'bg-danger-500' : 'bg-gradient-to-r from-brand-400 to-accent-500')} style={{ width: `${spentPct}%` }} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-ink-400">
                    <span>Remaining: {formatCurrency(remaining)}</span>
                    <span>Total budget: {formatCurrency(project.budget)}</span>
                  </div>
                </CardBody>
              </Card>
            </div>
            <Card>
              <CardHeader>
                <CardTitle>Recent activity</CardTitle>
                <button type="button" onClick={() => setTab('activity')} className="focus-ring rounded text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">View all</button>
              </CardHeader>
              <CardBody>
                {activityItems.length === 0 ? <EmptyState title="No activity yet" className="py-6" /> : <LeadTimeline items={activityItems.slice(0, 5)} />}
              </CardBody>
            </Card>
          </div>
        </div>
      )}

      {tab === 'tasks' && (
        <Card>
          <CardHeader>
            <CardTitle>Tasks</CardTitle>
            <Button size="sm" leftIcon={<Plus size={14} />} onClick={() => setTaskOpen(true)}>Add Task</Button>
          </CardHeader>
          <CardBody className="space-y-2.5">
            {tasks.length === 0 && <EmptyState title="No tasks yet" description="Tasks assigned to this project will appear here." actionLabel="Add Task" onAction={() => setTaskOpen(true)} />}
            {tasks.map((t) => {
              const late = t.status !== 'done' && isPastDate(t.dueDate)
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setOpenTaskId(t.id)}
                  style={stagger(tasks.indexOf(t), 40, 10)}
                  className={cn('animate-slide-up focus-ring flex w-full flex-wrap items-center justify-between gap-3 rounded-xl border border-l-4 border-ink-100 p-3.5 text-left transition-all duration-200 hover:-translate-y-px hover:bg-brand-50/40 hover:shadow-card dark:border-ink-800 dark:hover:bg-ink-800/40', PRIORITY_ACCENT[t.priority])}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{t.title}</p>
                    <div className="mt-1 flex items-center gap-3 text-xs text-ink-400">
                      <span className="flex items-center gap-1"><Paperclip size={11} aria-hidden="true" /> {t.attachments}</span>
                      <span className="flex items-center gap-1"><MessageSquare size={11} aria-hidden="true" /> {t.comments}</span>
                      <span className={cn(late && 'font-semibold text-danger-600 dark:text-danger-400')}>Due {formatDate(t.dueDate)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={priorityTone(t.priority)}>{cap(t.priority)}</Badge>
                    <StatusBadge status={t.status} label={TASK_STATUS_LABEL[t.status]} />
                    <Avatar name={t.assignee} size="xs" />
                  </div>
                </button>
              )
            })}
          </CardBody>
        </Card>
      )}

      {tab === 'milestones' && (
        <Card>
          <CardHeader>
            <CardTitle>Milestones</CardTitle>
            <Button as={Link} to="/admin/milestones" size="sm" variant="secondary">Manage milestones</Button>
          </CardHeader>
          <CardBody>
            {milestones.length === 0 ? (
              <EmptyState icon={Flag} title="No milestones yet" description="Add delivery milestones from the Milestones page." actionLabel="Go to Milestones" onAction={() => navigate('/admin/milestones')} />
            ) : (
              <ol>
                {[...milestones].sort((a, b) => a.dueDate.localeCompare(b.dueDate)).map((m) => {
                  const late = m.status !== 'done' && m.dueDate < today
                  return (
                    <li key={m.id} className={cn('relative flex items-start gap-3 rounded-xl p-3.5 before:absolute before:bottom-0 before:left-[1.65rem] before:top-0 before:w-px before:bg-ink-200 only:before:hidden first:before:top-6 last:before:bottom-auto last:before:h-6 dark:before:bg-ink-700', late && 'bg-danger-50/50 dark:bg-danger-500/5')}>
                      <button
                        type="button"
                        onClick={() => toggleMilestone(m)}
                        aria-pressed={m.status === 'done'}
                        aria-label={m.status === 'done' ? `Reopen ${m.title}` : `Mark ${m.title} as done`}
                        className={cn('focus-ring relative z-10 mt-0.5 shrink-0 rounded-full bg-white transition-transform duration-200 hover:scale-110 dark:bg-ink-900', m.status === 'done' ? 'text-success-500' : m.status === 'delayed' ? 'text-danger-500 hover:text-success-500' : m.status === 'in_progress' ? 'text-brand-500 hover:text-success-500' : 'text-info-300 hover:text-success-500 dark:text-info-400')}
                      >
                        {m.status === 'done' ? <CheckCircle2 size={20} /> : <Circle size={20} />}
                      </button>
                      <div className="min-w-0 flex-1">
                        <p className={cn('text-sm font-medium', m.status === 'done' ? 'text-ink-400 line-through' : 'text-ink-800 dark:text-ink-100')}>{m.title}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{m.description}</p>
                        <p className={cn('mt-1.5 text-xs', late ? 'font-semibold text-danger-600 dark:text-danger-400' : 'text-ink-400')}>
                          {m.owner} · Due {formatDate(m.dueDate)}{late && ' · overdue'}
                        </p>
                      </div>
                      <Badge tone={MILESTONE_TONE[m.status]} dot>{MILESTONE_LABEL[m.status]}</Badge>
                    </li>
                  )
                })}
              </ol>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'team' && (
        <Card>
          <CardHeader>
            <CardTitle>Team</CardTitle>
            <Button size="sm" leftIcon={<UserPlus size={14} />} onClick={() => setMemberOpen(true)}>Add Member</Button>
          </CardHeader>
          <CardBody className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <MemberCard name={project.manager} role="Project Manager" employees={employees} openTasks={tasks.filter((t) => t.assignee === project.manager && t.status !== 'done').length} />
            {team.filter((m) => m !== project.manager).map((member) => (
              <MemberCard key={member} name={member} role="Contributor" employees={employees} openTasks={tasks.filter((t) => t.assignee === member && t.status !== 'done').length} onRemove={() => setRemoveMember(member)} />
            ))}
            {team.length === 0 && (
              <div className="sm:col-span-2">
                <EmptyState icon={Users} title="No team members yet" description="Add people to start assigning work on this project." actionLabel="Add Member" onAction={() => setMemberOpen(true)} />
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {tab === 'files' && (
        <Card>
          <CardHeader>
            <CardTitle>Files</CardTitle>
            <Button size="sm" leftIcon={<Upload size={14} />} onClick={() => setFileOpen(true)}>Upload File</Button>
          </CardHeader>
          <CardBody className="space-y-2.5">
            {documents.length === 0 && <EmptyState icon={Folder} title="No files yet" description="Files uploaded to this project will appear here." actionLabel="Upload File" onAction={() => setFileOpen(true)} />}
            {documents.map((f) => (
              <div key={f.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3 transition-all duration-200 hover:-translate-y-px hover:bg-brand-50/40 hover:shadow-card dark:border-ink-800 dark:hover:bg-ink-800/40">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-xl', TONES[FILE_TONE[f.type] || 'neutral'].chip)}><FileText size={17} aria-hidden="true" /></span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-800 dark:text-ink-100">{f.name}</p>
                    <p className="text-xs text-ink-400">{f.category} · {f.uploadedBy} · {formatDate(f.uploadedDate)}</p>
                  </div>
                </div>
                <span className="shrink-0 rounded-full bg-ink-100 px-2.5 py-1 text-xs font-medium text-ink-500 dark:bg-ink-800">{f.size}</span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      {tab === 'activity' && (
        <Card>
          <CardHeader><CardTitle>Activity</CardTitle></CardHeader>
          <CardBody>
            {activityItems.length === 0 ? <EmptyState title="No activity yet" /> : <LeadTimeline items={activityItems} />}
          </CardBody>
        </Card>
      )}

      <ProjectFormModal isOpen={editOpen} onClose={() => setEditOpen(false)} onSubmit={handleEdit} initialValues={project} isSaving={busy} clients={data.clients} employees={employees.length ? employees : undefined} />
      <TaskFormModal isOpen={taskOpen} onClose={() => setTaskOpen(false)} onSubmit={handleAddTask} isSaving={busy} projects={[project]} employees={employees.length ? employees : undefined} lockedProjectId={id} />
      <AddMemberModal isOpen={memberOpen} onClose={() => setMemberOpen(false)} onSubmit={handleAddMember} isSaving={busy} candidates={candidates} projectName={project.name} />
      <FileUploadModal isOpen={fileOpen} onClose={() => setFileOpen(false)} onSubmit={handleUpload} isSaving={busy} targetName={project.name} />
      <TaskDetailsDrawer task={openTask} onClose={() => setOpenTaskId(null)} onChange={updateTask} employees={employees} projects={[project]} />
      <ConfirmDialog
        isOpen={Boolean(removeMember)}
        onClose={() => setRemoveMember(null)}
        onConfirm={handleRemoveMember}
        isLoading={busy}
        title="Remove team member?"
        description={`${removeMember} will no longer be part of ${project.name}. Their existing tasks stay assigned until reassigned.`}
        confirmLabel="Remove Member"
      />
    </div>
  )
}

function MemberCard({ name, role, employees, openTasks, onRemove }) {
  const person = employees.find((e) => e.name === name)
  const isManager = role === 'Project Manager'
  return (
    <div className="group flex items-center gap-3 rounded-2xl border border-ink-100 p-3.5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-hover dark:border-ink-800">
      <ClientAvatar name={name} size="lg" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{name}</p>
        <p className="truncate text-xs text-ink-400">{role}{person ? ` · ${person.designation}` : ''}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', isManager ? TONES.accent.chip : TONES.brand.chip)}>{isManager ? 'Manager' : 'Contributor'}</span>
          <span className="text-xs text-ink-400">{openTasks} open task{openTasks === 1 ? '' : 's'}</span>
        </div>
      </div>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name} from the team`}
          className="focus-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-ink-400 transition-colors hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-danger-500/10"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}
