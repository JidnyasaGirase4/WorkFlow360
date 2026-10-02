import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Pencil, Trash2, Eye, Users } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import EmployeeFormModal from '../../../components/business/EmployeeFormModal'
import EmployeeCard from '../../../components/business/EmployeeCard'
import RowActions from '../../../components/business/RowActions'
import PagedCards from '../../../components/business/PagedCards'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import { ActiveFilters } from '../../../components/business/ChipFilters'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import DataTable from '../../../components/common/DataTable'
import StatusBadge from '../../../components/common/StatusBadge'
import EmployeeAvatar from '../../../components/business/EmployeeAvatar'
import { tintFor } from '../../../components/business/employeeTints'
import { cn } from '../../../utils/cn'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { employeeService } from '../../../services/employeeService'
import { departments } from '../../../mockData/employees'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { useResetOnChange } from '../../../hooks/useResetOnChange'

const BREADCRUMB = [{ label: 'People' }, { label: 'Employees' }]

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'on_leave', label: 'On Leave' },
  { value: 'inactive', label: 'Inactive' },
]
const STATUS_LABELS = { active: 'Active', on_leave: 'On Leave', inactive: 'Inactive' }
const DEPARTMENT_OPTIONS = [{ value: '', label: 'All departments' }, ...departments.map((d) => ({ value: d, label: d }))]

function loadEmployees() {
  return employeeService.list()
}

export default function Employees() {
  const { status, data, retry } = useMockLoad(loadEmployees)
  if (status === 'loading') {
    return <PageSkeleton title="Employees" description="Manage your team members and their organizational details." breadcrumbItems={BREADCRUMB} stats={0} cols={7} />
  }
  if (status === 'error') return <PageError title="Employees" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <EmployeesView initial={data} />
}

function EmployeesView({ initial }) {
  const { toast } = useToast()
  const navigate = useNavigate()
  const location = useLocation()

  const [employees, setEmployees] = useState(initial)
  const [search, setSearch] = useState('')
  const [departmentFilter, setDepartmentFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editingEmployee, setEditingEmployee] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) {
        setEditingEmployee(null)
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

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return employees.filter((e) => {
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.email.toLowerCase().includes(q) ||
        e.designation.toLowerCase().includes(q) ||
        e.phone.replace(/\s/g, '').includes(q.replace(/\s/g, ''))
      const matchesDepartment = !departmentFilter || e.department === departmentFilter
      const matchesStatus = !statusFilter || e.status === statusFilter
      return matchesSearch && matchesDepartment && matchesStatus
    })
  }, [employees, search, departmentFilter, statusFilter])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    departmentFilter && { key: 'department', label: `Department: ${departmentFilter}`, onRemove: () => setDepartmentFilter('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_LABELS[statusFilter]}`, onRemove: () => setStatusFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setDepartmentFilter('')
    setStatusFilter('')
  }

  function openCreate() {
    setEditingEmployee(null)
    setModalOpen(true)
  }

  function openEdit(row) {
    setEditingEmployee(row)
    setModalOpen(true)
  }

  async function handleSave(values) {
    setIsSaving(true)
    try {
      if (editingEmployee) {
        const updated = await employeeService.update(editingEmployee.id, values)
        setEmployees((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
        toast.success(`${values.name} updated successfully`)
      } else {
        const code = `TN-${String(40 + employees.length + 1).padStart(4, '0')}`
        const created = await employeeService.create({ ...values, id: `emp-${Date.now()}`, projects: 0, avatar: null, employeeCode: code })
        setEmployees((prev) => [created, ...prev])
        toast.success(`${values.name} added to ${values.department}`)
      }
      setModalOpen(false)
      setEditingEmployee(null)
    } catch {
      toast.error('Could not save the employee. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const ids = deleteTarget ? [deleteTarget.id] : selected
      await Promise.all(ids.map((id) => employeeService.remove(id)))
      setEmployees((prev) => prev.filter((e) => !ids.includes(e.id)))
      setSelected((prev) => prev.filter((id) => !ids.includes(id)))
      toast.success(ids.length > 1 ? `${ids.length} employees removed` : 'Employee removed')
      setDeleteTarget(null)
      setBulkDeleteOpen(false)
    } catch {
      toast.error('Could not remove the employee. Please try again.')
    } finally {
      setIsDeleting(false)
    }
  }

  const columns = [
    {
      key: 'name',
      header: 'Employee',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <EmployeeAvatar name={row.name} src={row.avatar} size="md" />
          <div className="min-w-0">
            <p className="whitespace-nowrap font-semibold text-ink-800 dark:text-ink-100">{row.name}</p>
            {row.employeeCode && <p className="text-xs text-ink-400">{row.employeeCode}</p>}
          </div>
        </div>
      ),
    },
    { key: 'department', header: 'Department', sortable: true, render: (row) => <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset', tintFor(row.department).chip)}>{row.department}</span> },
    { key: 'designation', header: 'Designation', sortable: true, render: (row) => <span className="block max-w-[11rem]">{row.designation}</span> },
    { key: 'email', header: 'Email', render: (row) => <span className="block max-w-[13rem] break-all text-ink-500">{row.email}</span> },
    { key: 'phone', header: 'Phone', render: (row) => <span className="whitespace-nowrap text-ink-500">{row.phone}</span> },
    { key: 'projects', header: 'Projects', align: 'center', sortable: true, render: (row) => <span className="inline-flex min-w-7 justify-center rounded-lg bg-ink-100 px-2 py-0.5 text-xs font-bold tabular-nums text-ink-700 dark:bg-ink-800 dark:text-ink-200">{row.projects}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <RowActions
          actions={[
            { label: `View profile of ${row.name}`, icon: <Eye size={15} />, onClick: () => navigate(`/admin/employees/${row.id}`) },
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
        title="Employees"
        description={`${employees.length} team members across ${new Set(employees.map((e) => e.department)).size} departments.`}
        breadcrumbItems={BREADCRUMB}
        action={
          <Button leftIcon={<Plus size={16} />} onClick={openCreate} className="w-full sm:w-auto">
            Add Employee
          </Button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:flex-row sm:flex-wrap sm:items-center sm:p-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search name, email, phone, designation..." className="sm:w-80" />
        <Select aria-label="Filter by department" options={DEPARTMENT_OPTIONS} value={departmentFilter} onChange={(e) => setDepartmentFilter(e.target.value)} wrapperClassName="sm:w-48" />
        <Select aria-label="Filter by status" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} wrapperClassName="sm:w-44" />
      </div>
      <ActiveFilters filters={activeFilters} onClearAll={clearFilters} className="mb-4" />
      <p className="sr-only" aria-live="polite">{filtered.length} employees match</p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
          <EmptyState
            icon={Users}
            title="No employees found"
            description={activeFilters.length ? 'No one matches the current filters.' : 'Add your first employee to get started.'}
            actionLabel={activeFilters.length ? 'Clear filters' : 'Add Employee'}
            onAction={activeFilters.length ? clearFilters : openCreate}
          />
        </div>
      ) : (
        <>
          <div className="hidden animate-fade-in md:block">
            <DataTable
              columns={columns}
              data={filtered}
              pageSize={8}
              selectable
              selected={selected}
              onSelectedChange={setSelected}
              onRowClick={(row) => navigate(`/admin/employees/${row.id}`)}
              bulkActions={
                <Button size="sm" variant="danger" leftIcon={<Trash2 size={14} />} onClick={() => setBulkDeleteOpen(true)}>
                  Delete selected
                </Button>
              }
            />
          </div>
          <div className="md:hidden">
            <PagedCards
              items={filtered}
              pageSize={5}
              renderItem={(emp) => (
                <EmployeeCard
                  employee={emp}
                  onView={() => navigate(`/admin/employees/${emp.id}`)}
                  onEdit={() => openEdit(emp)}
                  onDelete={() => setDeleteTarget(emp)}
                />
              )}
            />
          </div>
        </>
      )}

      <EmployeeFormModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingEmployee(null) }}
        onSubmit={handleSave}
        initialValues={editingEmployee}
        isSaving={isSaving}
        existingEmails={employees.map((e) => e.email)}
      />
      <ConfirmDialog
        isOpen={Boolean(deleteTarget) || bulkDeleteOpen}
        onClose={() => { setDeleteTarget(null); setBulkDeleteOpen(false) }}
        onConfirm={handleDelete}
        isLoading={isDeleting}
        title={deleteTarget ? 'Remove this employee?' : `Remove ${selected.length} employees?`}
        description={
          deleteTarget
            ? `This will permanently remove ${deleteTarget.name} from your organization.`
            : 'The selected employees will be permanently removed from your organization.'
        }
        confirmLabel={deleteTarget ? 'Remove Employee' : 'Remove Employees'}
      />
    </div>
  )
}
