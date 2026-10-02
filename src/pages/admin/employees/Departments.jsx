import { useMemo, useState } from 'react'
import { Plus, Building2, Users, FolderKanban, Gauge, Crown, Code2, Palette, Rocket, ShieldCheck, Megaphone, HeartHandshake, Landmark, ChevronRight } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import Button from '../../../components/common/Button'
import Input from '../../../components/common/Input'
import Select from '../../../components/common/Select'
import Textarea from '../../../components/common/Textarea'
import Modal from '../../../components/common/Modal'
import Drawer from '../../../components/common/Drawer'
import SearchBar from '../../../components/common/SearchBar'
import Card from '../../../components/common/Card'
import StatCard from '../../../components/common/StatCard'
import StatusBadge from '../../../components/common/StatusBadge'
import EmployeeAvatar from '../../../components/business/EmployeeAvatar'
import { GrowBar } from '../../../components/business/EmployeeMeters'
import { tintAt } from '../../../components/business/employeeTints'
import EmptyState from '../../../components/common/EmptyState'
import { SkeletonCard, Skeleton } from '../../../components/common/Skeleton'
import { employeeService } from '../../../services/employeeService'
import { projectService } from '../../../services/projectService'
import { departments as baseDepartments } from '../../../mockData/employees'
import { formatDate } from '../../../utils/format'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { PageError } from '../../../components/business/PageStates'

const HEAD_PATTERN = /manager|head|lead|ceo|founder|director/i

const DEPARTMENT_BLURBS = {
  Engineering: 'Builds and ships client platforms, APIs and infrastructure.',
  Design: 'Owns UX research, interface design and design systems.',
  Delivery: 'Plans sprints, manages client communication and delivery health.',
  QA: 'Guards release quality through manual and automated testing.',
  Marketing: 'Drives brand, content and inbound lead generation.',
  HR: 'Handles hiring, onboarding, payroll and people operations.',
  Leadership: 'Sets company strategy, sales direction and product vision.',
}

// The mock data carries no utilization field, so it is derived from each
// employee's project load. On-leave staff are excluded from the average.
function utilizationOf(employee) {
  return Math.min(96, 35 + employee.projects * 13)
}

const DEPARTMENT_ICONS = {
  Engineering: Code2,
  Design: Palette,
  Delivery: Rocket,
  QA: ShieldCheck,
  Marketing: Megaphone,
  HR: HeartHandshake,
  Leadership: Landmark,
}

function utilizationTone(value) {
  if (value >= 90) return { bar: 'from-danger-400 to-danger-500', text: 'text-danger-600 dark:text-danger-400' }
  if (value >= 75) return { bar: 'from-warning-300 to-warning-500', text: 'text-warning-600 dark:text-warning-400' }
  return { bar: 'from-success-400 to-success-500', text: 'text-success-600 dark:text-success-400' }
}

function pickHead(members) {
  if (members.length === 0) return null
  const titled = members.find((m) => HEAD_PATTERN.test(m.designation))
  if (titled) return titled
  return [...members].sort((a, b) => a.joiningDate.localeCompare(b.joiningDate))[0]
}

function buildDepartment(name, employees, projects, extra = {}) {
  const members = employees.filter((e) => e.department === name)
  const names = new Set(members.map((m) => m.name))
  const activeProjects = projects.filter(
    (p) => p.status === 'active' && (names.has(p.manager) || p.team.some((t) => names.has(t)))
  )
  const working = members.filter((m) => m.status === 'active')
  const avgUtilization = working.length
    ? Math.round(working.reduce((sum, m) => sum + utilizationOf(m), 0) / working.length)
    : 0
  const head = extra.headName ? employees.find((e) => e.name === extra.headName) ?? null : pickHead(members)
  return {
    name,
    description: extra.description || DEPARTMENT_BLURBS[name] || '',
    members,
    head,
    activeProjects,
    avgUtilization,
    isNew: Boolean(extra.isNew),
  }
}

function UtilizationBar({ value }) {
  const tone = utilizationTone(value)
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs">
        <span className="text-ink-500">Avg utilization</span>
        <span className={cn('font-bold tabular-nums', tone.text)}>{value}%</span>
      </div>
      <GrowBar value={value} gradient={tone.bar} label="Average utilization" height="h-2" />
    </div>
  )
}

function DepartmentsSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading departments">
      <div className="mb-6 space-y-2">
        <Skeleton className="h-8 w-44" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    </div>
  )
}

function loadDepartments() {
  return Promise.all([employeeService.list(), projectService.list()]).then(([employees, projects]) => ({ employees, projects }))
}

export default function Departments() {
  const { toast } = useToast()
  const { status, data, retry } = useMockLoad(loadDepartments)
  const [added, setAdded] = useState([])
  const [search, setSearch] = useState('')
  const [activeName, setActiveName] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [values, setValues] = useState({ name: '', head: '', description: '' })
  const [errors, setErrors] = useState({})
  const [isSaving, setIsSaving] = useState(false)

  const employees = useMemo(() => data?.employees ?? [], [data])
  const projects = useMemo(() => data?.projects ?? [], [data])

  const departments = useMemo(() => {
    const names = [...new Set([...baseDepartments, ...employees.map((e) => e.department)])]
    const base = names
      .map((name) => buildDepartment(name, employees, projects))
      .filter((d) => d.members.length > 0)
    const extra = added.map((a) => buildDepartment(a.name, employees, projects, { headName: a.headName, description: a.description, isNew: true }))
    return [...base, ...extra]
  }, [employees, projects, added])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return departments
    return departments.filter(
      (d) => d.name.toLowerCase().includes(q) || d.head?.name.toLowerCase().includes(q) || d.description.toLowerCase().includes(q)
    )
  }, [departments, search])

  const stats = useMemo(() => {
    const working = employees.filter((e) => e.status === 'active')
    const avg = working.length ? Math.round(working.reduce((s, e) => s + utilizationOf(e), 0) / working.length) : 0
    return {
      departments: departments.length,
      headcount: employees.length,
      activeProjects: projects.filter((p) => p.status === 'active').length,
      utilization: avg,
    }
  }, [departments, employees, projects])

  const activeDepartment = departments.find((d) => d.name === activeName) ?? null

  function openModal() {
    setValues({ name: '', head: '', description: '' })
    setErrors({})
    setModalOpen(true)
  }

  function handleSubmit(e) {
    e.preventDefault()
    const name = values.name.trim()
    const next = {}
    if (!name) next.name = 'Department name is required'
    else if (name.length < 2) next.name = 'Name should be at least 2 characters'
    else if (departments.some((d) => d.name.toLowerCase() === name.toLowerCase())) next.name = 'A department with this name already exists'
    if (values.description.length > 200) next.description = 'Keep the description under 200 characters'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    setIsSaving(true)
    setTimeout(() => {
      setAdded((prev) => [...prev, { name, headName: values.head, description: values.description.trim() }])
      setIsSaving(false)
      setModalOpen(false)
      toast.success(`${name} department added`)
    }, 400)
  }

  if (status === 'loading') return <DepartmentsSkeleton />
  if (status === 'error') return <PageError title="Departments" breadcrumbItems={[{ label: 'People' }, { label: 'Departments' }]} onRetry={retry} />

  return (
    <div>
      <PageHeader
        title="Departments"
        description="Teams across TechNova with headcount, delivery load and utilization."
        breadcrumbItems={[{ label: 'People' }, { label: 'Departments' }]}
        action={
          <Button leftIcon={<Plus size={16} />} onClick={openModal} className="w-full sm:w-auto">
            Add department
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        <StatCard icon={Building2} label="Departments" value={stats.departments} tone="brand" />
        <StatCard icon={Users} label="Total headcount" value={stats.headcount} tone="accent" />
        <StatCard icon={FolderKanban} label="Active projects" value={stats.activeProjects} tone="info" />
        <StatCard icon={Gauge} label="Avg utilization" value={stats.utilization} suffix="%" tone="success" />
      </div>

      <div className="mb-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search departments or heads..." className="sm:max-w-xs" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Building2}
          title="No departments found"
          description={search ? 'No department matches your search. Try a different name.' : 'Create your first department to organise your team.'}
          actionLabel={search ? 'Clear search' : 'Add department'}
          onAction={search ? () => setSearch('') : openModal}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-3">
          {filtered.map((dept, i) => {
            const tint = tintAt(i)
            const DeptIcon = DEPARTMENT_ICONS[dept.name] || Building2
            return (
            <Card key={dept.name} hover className="group relative animate-slide-up overflow-hidden rounded-2xl border-ink-100" style={{ animationDelay: `${Math.min(i, 8) * 60}ms` }}>
              <span aria-hidden="true" className={cn('h-1.5 w-full bg-gradient-to-r', tint.bar, 'absolute inset-x-0 top-0')} />
              <span aria-hidden="true" className={cn('pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent', tint.corner)} />
              <button
                type="button"
                onClick={() => setActiveName(dept.name)}
                aria-label={`${dept.name} department, ${dept.members.length} members. Open member list`}
                className="focus-ring relative flex h-full w-full flex-col gap-4 rounded-2xl p-4 pt-5 text-left sm:p-5 sm:pt-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-base font-bold text-ink-800 dark:text-ink-100">{dept.name}</h3>
                    <p className="mt-1 line-clamp-2 text-xs text-ink-500">{dept.description || 'No description added yet.'}</p>
                  </div>
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110 group-hover:-rotate-3', tint.soft)}>
                    <DeptIcon size={20} aria-hidden="true" />
                  </span>
                </div>

                <div className="flex items-center gap-2.5">
                  {dept.head ? (
                    <>
                      <EmployeeAvatar name={dept.head.name} size="sm" />
                      <div className="min-w-0">
                        <p className="flex items-center gap-1 truncate text-sm font-semibold text-ink-800 dark:text-ink-100">
                          {dept.head.name}
                          <Crown size={12} className="shrink-0 text-warning-500" aria-hidden="true" />
                        </p>
                        <p className="truncate text-xs text-ink-400">{dept.head.designation}</p>
                      </div>
                    </>
                  ) : (
                    <p className="text-xs text-ink-400">No department head assigned</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-ink-50 px-3 py-2.5 dark:bg-ink-800/50">
                    <p className="flex items-center gap-1.5 text-xl font-bold tabular-nums text-ink-800 dark:text-ink-50"><Users size={14} className="text-ink-400" aria-hidden="true" />{dept.members.length}</p>
                    <p className="text-xs text-ink-500">Headcount</p>
                  </div>
                  <div className="rounded-xl bg-ink-50 px-3 py-2.5 dark:bg-ink-800/50">
                    <p className="flex items-center gap-1.5 text-xl font-bold tabular-nums text-ink-800 dark:text-ink-50"><FolderKanban size={14} className="text-ink-400" aria-hidden="true" />{dept.activeProjects.length}</p>
                    <p className="text-xs text-ink-500">Active projects</p>
                  </div>
                </div>

                <UtilizationBar value={dept.avgUtilization} />
                <span className="flex items-center justify-end gap-0.5 text-xs font-semibold text-brand-600 dark:text-brand-300">
                  View team <ChevronRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </button>
            </Card>
            )
          })}
        </div>
      )}

      <Drawer
        isOpen={Boolean(activeDepartment)}
        onClose={() => setActiveName(null)}
        title={activeDepartment ? `${activeDepartment.name} team` : ''}
        width="max-w-lg"
      >
        {activeDepartment && (
          <div className="space-y-5">
            <p className="text-sm text-ink-500">{activeDepartment.description || 'No description added yet.'}</p>

            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="rounded-xl bg-brand-50 px-2 py-3 dark:bg-brand-500/10">
                <p className="text-xl font-bold tabular-nums text-brand-700 dark:text-brand-300">{activeDepartment.members.length}</p>
                <p className="text-xs text-ink-500">Members</p>
              </div>
              <div className="rounded-xl bg-accent-50 px-2 py-3 dark:bg-accent-500/10">
                <p className="text-xl font-bold tabular-nums text-accent-700 dark:text-accent-300">{activeDepartment.activeProjects.length}</p>
                <p className="text-xs text-ink-500">Active projects</p>
              </div>
              <div className="rounded-xl bg-success-50 px-2 py-3 dark:bg-success-500/10">
                <p className="text-xl font-bold tabular-nums text-success-700 dark:text-success-300">{activeDepartment.avgUtilization}%</p>
                <p className="text-xs text-ink-500">Utilization</p>
              </div>
            </div>

            {activeDepartment.activeProjects.length > 0 && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Active projects</h3>
                <ul className="space-y-1.5">
                  {activeDepartment.activeProjects.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 px-3 py-2.5 text-sm transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40">
                      <span className="truncate font-medium text-ink-700 dark:text-ink-200">{p.name}</span>
                      <span className="shrink-0 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold tabular-nums text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{p.progress}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">Members</h3>
              {activeDepartment.members.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="No members yet"
                  description="Assign employees to this department from the Employees page to see them here."
                  className="py-8"
                />
              ) : (
                <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                  {activeDepartment.members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3 py-3">
                      <EmployeeAvatar name={m.name} src={m.avatar} size="md" />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1.5 truncate text-sm font-medium text-ink-800 dark:text-ink-100">
                          {m.name}
                          {activeDepartment.head?.id === m.id && <Crown size={12} className="text-warning-500" aria-label="Department head" />}
                        </p>
                        <p className="truncate text-xs text-ink-400">
                          {m.designation} · Joined {formatDate(m.joiningDate)}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <StatusBadge status={m.status} />
                        <span className="text-xs text-ink-400">{m.projects} {m.projects === 1 ? 'project' : 'projects'}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Add department"
        description="Create a new team. You can assign employees to it later."
        footer={
          <>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={isSaving}>
              Add department
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="Department name"
            required
            placeholder="e.g. Customer Success"
            value={values.name}
            error={errors.name}
            onChange={(e) => setValues((v) => ({ ...v, name: e.target.value }))}
          />
          <Select
            label="Department head"
            hint="Optional. Choose who will lead this team."
            placeholder="No head assigned"
            options={employees.map((emp) => ({ value: emp.name, label: `${emp.name} — ${emp.designation}` }))}
            value={values.head}
            onChange={(e) => setValues((v) => ({ ...v, head: e.target.value }))}
          />
          <Textarea
            label="Description"
            rows={3}
            placeholder="What does this team own?"
            value={values.description}
            error={errors.description}
            onChange={(e) => setValues((v) => ({ ...v, description: e.target.value }))}
          />
        </form>
      </Modal>
    </div>
  )
}
