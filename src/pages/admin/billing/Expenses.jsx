import { useMemo, useState } from 'react'
import { Plus, Wallet, CalendarDays, FolderKanban, Tags, Paperclip, Pencil, Trash2, Eye, X, Receipt, FileText } from 'lucide-react'
import { PieChart, Pie, Cell, Tooltip as RTooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts'
import PageHeader from '../../../components/business/PageHeader'
import RowActions from '../../../components/business/RowActions'
import FileDropzone from '../../../components/business/FileDropzone'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import { ActiveFilters } from '../../../components/business/ChipFilters'
import Button from '../../../components/common/Button'
import Select from '../../../components/common/Select'
import Input from '../../../components/common/Input'
import Textarea from '../../../components/common/Textarea'
import SearchBar from '../../../components/common/SearchBar'
import DataTable from '../../../components/common/DataTable'
import EmployeeKpiCard from '../../../components/business/EmployeeKpiCard'
import ChartTooltip from '../../../components/business/ChartTooltip'
import ChartCard from '../../../components/common/ChartCard'
import Modal from '../../../components/common/Modal'
import Drawer from '../../../components/common/Drawer'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import EmptyState from '../../../components/common/EmptyState'
import { expenseService } from '../../../services/paymentService'
import { employeeService } from '../../../services/employeeService'
import { projectService } from '../../../services/projectService'
import { TODAY } from '../../../mockData/reference'
import { formatCurrency, formatDate } from '../../../utils/format'
import { formatBytes, validateFile } from '../../../utils/validators'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { useIsMobile } from '../../../hooks/useMediaQuery'
import { useTheme } from '../../../context/ThemeContext'
import { cn } from '../../../utils/cn'
import { useResetOnChange } from '../../../hooks/useResetOnChange'

const BREADCRUMB = [{ label: 'Billing' }, { label: 'Expenses' }]
const CATEGORIES = ['Infrastructure', 'Software', 'Marketing', 'Travel', 'Client Entertainment', 'Team Building', 'Office Supplies', 'Other']
const PIE_COLORS = ['#1aa996', '#ec4a7d', '#f59e0b', '#8654ec', '#0f7066', '#f96c98', '#22a559', '#a0a9a2']
const colorOf = (name) => PIE_COLORS[Math.max(0, CATEGORIES.indexOf(name)) % PIE_COLORS.length]
const RECEIPT_TYPES = ['pdf', 'png', 'jpg', 'jpeg']
const RECEIPT_MAX = 5 * 1024 * 1024
const AXIS_TICK = { fontSize: 12, fill: 'var(--color-ink-500)' }
const ALL = '__all__'

function shorten(text, max) {
  return text.length > max ? `${text.slice(0, max - 1)}…` : text
}

const inr = (v) => formatCurrency(v)
const inrShort = (v) => `₹${v >= 100000 ? `${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L` : `${Math.round(v / 1000)}k`}`

function monthKey(date) {
  return date.slice(0, 7)
}

function monthLabel(key, opts = { month: 'short' }) {
  return new Intl.DateTimeFormat('en-IN', { ...opts, timeZone: 'UTC' }).format(new Date(`${key}-01T00:00:00Z`))
}

function loadExpenses() {
  return Promise.all([expenseService.list(), employeeService.list(), projectService.list()]).then(([expenses, employees, projects]) => ({ expenses, employees, projects }))
}

export default function Expenses() {
  const { status, data, retry } = useMockLoad(loadExpenses)
  if (status === 'loading') {
    return <PageSkeleton title="Expenses" description="Track and categorize business expenses." breadcrumbItems={BREADCRUMB} stats={4} cols={7} />
  }
  if (status === 'error') return <PageError title="Expenses" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <ExpensesView initial={data.expenses} employees={data.employees} projects={data.projects} />
}

function ExpensesView({ initial, employees, projects }) {
  const { toast } = useToast()
  const isMobile = useIsMobile()
  const { theme } = useTheme()
  const gridStroke = theme === 'dark' ? 'var(--color-ink-800)' : 'var(--color-ink-100)'
  const [expenses, setExpenses] = useState(() => [...initial].sort((a, b) => b.date.localeCompare(a.date)))
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('')
  const [employee, setEmployee] = useState('')
  const [project, setProject] = useState('')
  const [month, setMonth] = useState('')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [isDeleting, setIsDeleting] = useState(false)

  const detail = expenses.find((e) => e.id === detailId) || null
  const thisMonth = monthKey(TODAY)

  const dashboard = useMemo(() => {
    const total = expenses.reduce((s, e) => s + e.amount, 0)
    const monthTotal = expenses.filter((e) => monthKey(e.date) === thisMonth).reduce((s, e) => s + e.amount, 0)
    const projectTotal = expenses.filter((e) => e.project).reduce((s, e) => s + e.amount, 0)

    const byCategory = {}
    const byProject = {}
    expenses.forEach((e) => {
      byCategory[e.category] = (byCategory[e.category] || 0) + e.amount
      if (e.project) byProject[e.project] = (byProject[e.project] || 0) + e.amount
    })
    const categories = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
    const projectBars = Object.entries(byProject)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)

    const months = []
    const cursor = new Date(`${thisMonth}-01T00:00:00Z`)
    cursor.setUTCMonth(cursor.getUTCMonth() - 5)
    for (let i = 0; i < 6; i += 1) {
      const key = cursor.toISOString().slice(0, 7)
      months.push({ key, month: monthLabel(key), value: expenses.filter((e) => monthKey(e.date) === key).reduce((s, e) => s + e.amount, 0) })
      cursor.setUTCMonth(cursor.getUTCMonth() + 1)
    }
    return { total, monthTotal, projectTotal, categories, projectBars, months, topCategory: categories[0] }
  }, [expenses, thisMonth])

  const monthOptions = useMemo(() => {
    const keys = [...new Set(expenses.map((e) => monthKey(e.date)))].sort().reverse()
    return [{ value: '', label: 'All months' }, ...keys.map((k) => ({ value: k, label: monthLabel(k, { month: 'long', year: 'numeric' }) }))]
  }, [expenses])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return expenses.filter(
      (e) =>
        (!q || e.title.toLowerCase().includes(q) || e.employee.toLowerCase().includes(q) || (e.description || '').toLowerCase().includes(q)) &&
        (!category || e.category === category) &&
        (!employee || e.employee === employee) &&
        (!project || (project === ALL ? !e.project : e.project === project)) &&
        (!month || monthKey(e.date) === month)
    )
  }, [expenses, search, category, employee, project, month])

  const filteredTotal = filtered.reduce((s, e) => s + e.amount, 0)

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    category && { key: 'category', label: `Category: ${category}`, onRemove: () => setCategory('') },
    employee && { key: 'employee', label: `Employee: ${employee}`, onRemove: () => setEmployee('') },
    project && { key: 'project', label: project === ALL ? 'No project' : `Project: ${project}`, onRemove: () => setProject('') },
    month && { key: 'month', label: `Month: ${monthLabel(month, { month: 'short', year: 'numeric' })}`, onRemove: () => setMonth('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setCategory('')
    setEmployee('')
    setProject('')
    setMonth('')
  }

  function openCreate() {
    setEditing(null)
    setFormOpen(true)
  }

  function openEdit(expense) {
    setEditing(expense)
    setDetailId(null)
    setFormOpen(true)
  }

  async function handleSave(values) {
    setIsSaving(true)
    try {
      if (editing) {
        const updated = await expenseService.update(editing.id, values)
        setExpenses((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        toast.success('Expense updated')
      } else {
        const created = await expenseService.create({ ...values, id: `exp-${Date.now()}` })
        setExpenses((prev) => [created, ...prev].sort((a, b) => b.date.localeCompare(a.date)))
        toast.success(`Expense of ${inr(values.amount)} added`)
      }
      setFormOpen(false)
      setEditing(null)
    } catch {
      toast.error('Could not save the expense. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await expenseService.remove(deleteTarget.id)
      setExpenses((prev) => prev.filter((e) => e.id !== deleteTarget.id))
      toast.success('Expense deleted')
      setDeleteTarget(null)
      setDetailId(null)
    } catch {
      toast.error('Could not delete the expense. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = [
    {
      key: 'title',
      header: 'Title',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <span className="whitespace-nowrap font-semibold text-ink-800 dark:text-ink-100">{row.title}</span>
          {row.attachment && <Paperclip size={13} className="shrink-0 text-ink-400" aria-label="Has attachment" />}
        </div>
      ),
    },
    { key: 'category', header: 'Category', sortable: true, render: (row) => <CategoryChip name={row.category} /> },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (row) => <span className="whitespace-nowrap font-semibold tabular-nums">{inr(row.amount)}</span> },
    { key: 'date', header: 'Date', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span> },
    { key: 'employee', header: 'Employee', sortable: true, render: (row) => <span className="whitespace-nowrap">{row.employee}</span> },
    { key: 'project', header: 'Project', render: (row) => row.project ? <span className="whitespace-nowrap">{row.project}</span> : <span className="text-ink-400">—</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <RowActions
          actions={[
            { label: `View ${row.title}`, icon: <Eye size={15} />, onClick: () => setDetailId(row.id) },
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
        title="Expenses"
        description="Track and categorize business expenses."
        breadcrumbItems={BREADCRUMB}
        action={
          <Button leftIcon={<Plus size={16} />} onClick={openCreate} className="w-full sm:w-auto">
            Add Expense
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        <EmployeeKpiCard index={0} icon={Wallet} label="Total Expenses" value={dashboard.total} format={(v) => inr(v)} tone="danger" />
        <EmployeeKpiCard index={1} icon={CalendarDays} label={`Monthly Expenses (${monthLabel(thisMonth, { month: 'short', year: 'numeric' })})`} value={dashboard.monthTotal} format={(v) => inr(v)} tone="warning" />
        <EmployeeKpiCard index={2} icon={FolderKanban} label="Project Expenses" value={dashboard.projectTotal} format={(v) => inr(v)} tone="info" />
        <EmployeeKpiCard index={3} icon={Tags} label={`Top Category: ${dashboard.topCategory?.name || '—'}`} value={dashboard.topCategory?.value || 0} format={(v) => inr(v)} tone="accent" />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <ChartCard title="Monthly expenses" subtitle="Last 6 months" height={260} className="rounded-2xl border-ink-100 lg:col-span-2">
          <div role="img" aria-label={`Monthly expenses: ${dashboard.months.map((m) => `${m.month} ${inr(m.value)}`).join(', ')}`} className="h-full w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.months}>
                <defs>
                  <linearGradient id="exp-month-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#3fc4b1" />
                    <stop offset="100%" stopColor="#0f7066" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridStroke} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={AXIS_TICK} />
                <YAxis tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={inrShort} width={48} />
                <RTooltip content={<ChartTooltip formatter={(v) => inr(v)} />} cursor={{ fill: 'var(--color-brand-500)', opacity: 0.08 }} />
                <Bar dataKey="value" name="Expenses" fill="url(#exp-month-grad)" radius={[10, 10, 0, 0]} maxBarSize={44} animationDuration={900} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartCard>

        <ChartCard title="Category breakdown" subtitle="Share of total spend" height={260} className="rounded-2xl border-ink-100">
          {dashboard.categories.length === 0 ? (
            <EmptyState title="No expenses yet" className="py-8" />
          ) : (
            <div className="flex h-full flex-col">
              <div role="img" aria-label={`Category breakdown: ${dashboard.categories.map((c) => `${c.name} ${inr(c.value)}`).join(', ')}`} className="min-h-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={dashboard.categories} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={3} stroke="none" animationDuration={900}>
                      {dashboard.categories.map((entry) => (
                        <Cell key={entry.name} fill={colorOf(entry.name)} />
                      ))}
                    </Pie>
                    <RTooltip content={<ChartTooltip formatter={(v) => inr(v)} />} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <ChartCard title="Spend by category" subtitle="Legend with totals" height="auto" className="rounded-2xl border-ink-100 lg:col-span-1">
          <ul className="space-y-2.5">
            {dashboard.categories.map((c) => (
              <li key={c.name} className="flex items-center justify-between gap-3 text-sm">
                <span className="flex min-w-0 items-center gap-2 text-ink-600 dark:text-ink-300">
                  <span className="h-3 w-3 shrink-0 rounded-md" style={{ background: colorOf(c.name) }} />
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-ink-800 dark:text-ink-100">{inr(c.value)}</span>
              </li>
            ))}
          </ul>
        </ChartCard>
        <ChartCard title="Project expenses" subtitle="Spend charged to projects" height={Math.max(200, dashboard.projectBars.length * 44 + 30)} className="rounded-2xl border-ink-100 lg:col-span-2">
          {dashboard.projectBars.length === 0 ? (
            <EmptyState icon={FolderKanban} title="No project expenses" description="Link an expense to a project to see it here." className="py-6" />
          ) : (
            <div role="img" aria-label={`Project expenses: ${dashboard.projectBars.map((p) => `${p.name} ${inr(p.value)}`).join(', ')}`} className="h-full w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dashboard.projectBars} layout="vertical" margin={{ left: 4, right: 12 }}>
                  <defs>
                    <linearGradient id="exp-project-grad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#f96c98" />
                      <stop offset="100%" stopColor="#ec4a7d" />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={gridStroke} />
                  <XAxis type="number" tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={inrShort} />
                  <YAxis dataKey="name" type="category" width={isMobile ? 96 : 150} tickLine={false} axisLine={false} tick={AXIS_TICK} tickFormatter={(n) => shorten(n, isMobile ? 12 : 22)} />
                  <RTooltip content={<ChartTooltip formatter={(v) => inr(v)} />} cursor={{ fill: 'var(--color-accent-500)', opacity: 0.08 }} />
                  <Bar dataKey="value" name="Spend" fill="url(#exp-project-grad)" radius={[0, 10, 10, 0]} maxBarSize={22} animationDuration={900} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-2 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:grid-cols-2 sm:gap-3 sm:p-4 lg:grid-cols-5">
        <SearchBar value={search} onChange={setSearch} placeholder="Search expenses..." className="lg:col-span-1" />
        <Select aria-label="Filter by category" options={[{ value: '', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} value={category} onChange={(e) => setCategory(e.target.value)} />
        <Select aria-label="Filter by employee" options={[{ value: '', label: 'All employees' }, ...employees.map((e) => ({ value: e.name, label: e.name }))]} value={employee} onChange={(e) => setEmployee(e.target.value)} />
        <Select aria-label="Filter by project" options={[{ value: '', label: 'All projects' }, { value: ALL, label: 'No project' }, ...projects.map((p) => ({ value: p.name, label: p.name }))]} value={project} onChange={(e) => setProject(e.target.value)} />
        <Select aria-label="Filter by month" options={monthOptions} value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <ActiveFilters filters={activeFilters} onClearAll={clearFilters} className="mb-3" />
      <p className="mb-3 text-xs text-ink-500" aria-live="polite">
        {filtered.length} expense{filtered.length === 1 ? '' : 's'} · <span className="font-semibold tabular-nums text-ink-700 dark:text-ink-200">{inr(filteredTotal)}</span>
      </p>

      <DataTable
        columns={columns}
        data={filtered}
        pageSize={8}
        onRowClick={(row) => setDetailId(row.id)}
        emptyTitle="No expenses found"
        emptyDescription={activeFilters.length ? 'No expenses match the current filters.' : 'Add your first expense to see it here.'}
        emptyActionLabel={activeFilters.length ? 'Clear filters' : 'Add Expense'}
        onEmptyAction={activeFilters.length ? clearFilters : openCreate}
      />

      <Drawer isOpen={Boolean(detail)} onClose={() => setDetailId(null)} title="Expense details" width="max-w-md">
        {detail && (
          <div className="space-y-5">
            <div>
              <p className="text-lg font-semibold text-ink-800 dark:text-ink-100">{detail.title}</p>
              <p className="mt-1 text-3xl font-bold tabular-nums text-brand-600 dark:text-brand-300">{inr(detail.amount)}</p>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-ink-100 bg-gradient-to-br from-brand-50/50 to-accent-50/30 p-4 text-sm dark:border-ink-800 dark:from-brand-500/5 dark:to-accent-500/5">
              <Detail label="Category" value={<CategoryChip name={detail.category} />} />
              <Detail label="Date" value={formatDate(detail.date)} />
              <Detail label="Employee" value={detail.employee} />
              <Detail label="Project" value={detail.project || 'Not linked to a project'} />
            </dl>
            <div>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Description</h3>
              <p className="text-sm text-ink-600 dark:text-ink-300">{detail.description || 'No description provided.'}</p>
            </div>
            <div>
              <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-ink-500">Attachment</h3>
              {detail.attachment ? (
                <div className="flex items-center gap-3 rounded-xl border border-ink-100 p-3 dark:border-ink-800">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300"><Receipt size={18} /></span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink-700 dark:text-ink-200">{detail.attachment}</p>
                  <Button size="sm" variant="secondary" onClick={() => toast.success(`Downloading ${detail.attachment}...`)}>Download</Button>
                </div>
              ) : (
                <p className="text-sm text-ink-500">No receipt attached.</p>
              )}
            </div>
            <div className="flex flex-col gap-2 border-t border-ink-100 pt-4 dark:border-ink-800 sm:flex-row">
              <Button variant="secondary" className="flex-1" leftIcon={<Pencil size={15} />} onClick={() => openEdit(detail)}>Edit</Button>
              <Button variant="danger" className="flex-1" leftIcon={<Trash2 size={15} />} onClick={() => setDeleteTarget(detail)}>Delete</Button>
            </div>
          </div>
        )}
      </Drawer>

      <ExpenseFormModal
        isOpen={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null) }}
        onSubmit={handleSave}
        isSaving={isSaving}
        initial={editing}
        employees={employees}
        projects={projects}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title="Delete this expense?"
        description={deleteTarget ? `"${deleteTarget.title}" (${inr(deleteTarget.amount)}) will be permanently removed.` : ''}
        confirmLabel="Delete Expense"
      />
    </div>
  )
}

function Detail({ label, value }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-ink-800 dark:text-ink-100">{value}</dd>
    </div>
  )
}

// Category pill tinted with the chart colour of that category.
function CategoryChip({ name }) {
  const color = colorOf(name)
  return (
    <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full bg-ink-50 px-2.5 py-0.5 text-xs font-semibold text-ink-700 ring-1 ring-inset ring-ink-200/80 dark:bg-ink-800 dark:text-ink-200 dark:ring-ink-700')}>
      <span className="h-2 w-2 rounded-full" style={{ background: color }} />
      {name}
    </span>
  )
}

const EMPTY = { title: '', category: 'Infrastructure', amount: '', date: TODAY, employee: '', project: '', description: '' }

function ExpenseFormModal({ isOpen, onClose, onSubmit, isSaving, initial, employees, projects }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [file, setFile] = useState(null)
  const [existingAttachment, setExistingAttachment] = useState(null)
  const isEdit = Boolean(initial)

  useResetOnChange([isOpen, initial], () => {
    if (isOpen) {
      setValues(initial ? { ...EMPTY, ...initial, amount: String(initial.amount), project: initial.project || '' } : EMPTY)
      setExistingAttachment(initial?.attachment || null)
      setFile(null)
      setErrors({})
    }
  })

  function set(field) {
    return (e) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function handleFiles([picked]) {
    const problem = validateFile(picked, RECEIPT_TYPES, RECEIPT_MAX)
    if (problem) {
      setFile(null)
      setErrors((prev) => ({ ...prev, attachment: problem }))
      return
    }
    setFile(picked)
    setExistingAttachment(null)
    setErrors((prev) => ({ ...prev, attachment: undefined }))
  }

  function validate() {
    const next = {}
    if (!values.title.trim()) next.title = 'Title is required'
    const amount = Number(values.amount)
    if (!values.amount || Number.isNaN(amount) || amount <= 0) next.amount = 'Enter an amount greater than zero'
    else if (amount > 10000000) next.amount = 'Amount looks too large. Please check it.'
    if (!values.date) next.date = 'Date is required'
    else if (values.date > TODAY) next.date = 'Expense date cannot be in the future'
    if (!values.employee) next.employee = 'Select who incurred this expense'
    return next
  }

  function submit(e) {
    e?.preventDefault()
    if (isSaving) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    onSubmit({
      title: values.title.trim(),
      category: values.category,
      amount: Number(values.amount),
      date: values.date,
      employee: values.employee,
      project: values.project || null,
      description: values.description.trim(),
      attachment: file ? file.name : existingAttachment,
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title={isEdit ? 'Edit Expense' : 'Add Expense'}
      description={isEdit ? 'Update the expense details' : 'Record a new business expense'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button onClick={submit} isLoading={isSaving}>{isEdit ? 'Save Changes' : 'Add Expense'}</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <div className="sm:col-span-2">
          <Input label="Title" required placeholder="e.g. AWS hosting — October" value={values.title} error={errors.title} onChange={set('title')} />
        </div>
        <Select label="Category" required options={CATEGORIES.map((c) => ({ value: c, label: c }))} value={values.category} onChange={set('category')} />
        <Input label="Amount (₹)" type="number" min="1" step="any" required placeholder="e.g. 12500" value={values.amount} error={errors.amount} onChange={set('amount')} />
        <Input label="Date" type="date" required max={TODAY} value={values.date} error={errors.date} onChange={set('date')} />
        <Select
          label="Employee"
          required
          placeholder="Select employee"
          options={employees.filter((emp) => emp.status !== 'inactive').map((emp) => ({ value: emp.name, label: emp.name }))}
          value={values.employee}
          error={errors.employee}
          onChange={set('employee')}
        />
        <div className="sm:col-span-2">
          <Select
            label="Project"
            options={[{ value: '', label: 'No project (overhead)' }, ...projects.map((p) => ({ value: p.name, label: p.name }))]}
            value={values.project}
            onChange={set('project')}
          />
        </div>
        <div className="sm:col-span-2">
          <Textarea label="Description" rows={3} placeholder="What was this expense for?" value={values.description} onChange={set('description')} />
        </div>

        <div className="sm:col-span-2">
          <p className="mb-1.5 text-sm font-medium text-ink-700 dark:text-ink-200">Receipt attachment</p>
          {file || existingAttachment ? (
            <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-3 dark:border-ink-700">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300"><FileText size={18} /></span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink-700 dark:text-ink-200">{file ? file.name : existingAttachment}</p>
                {file && <p className="text-xs text-ink-400">{formatBytes(file.size)}</p>}
              </div>
              <button type="button" onClick={() => { setFile(null); setExistingAttachment(null) }} className="focus-ring flex h-10 w-10 items-center justify-center rounded-xl text-ink-400 hover:bg-danger-50 hover:text-danger-600 dark:hover:bg-ink-800" aria-label="Remove attachment">
                <X size={16} />
              </button>
            </div>
          ) : (
            <FileDropzone compact onFiles={handleFiles} accept=".pdf,.png,.jpg,.jpeg" hint="PDF, PNG or JPG up to 5 MB" />
          )}
          {errors.attachment && <p role="alert" className="mt-1.5 text-xs font-medium text-danger-600 dark:text-danger-400">{errors.attachment}</p>}
        </div>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
