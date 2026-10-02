import { useMemo, useState } from 'react'
import { Clock, CheckCircle2, XCircle, Plus, Check, X, Eye, CalendarDays, AlertTriangle } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import RowActions from '../../../components/business/RowActions'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import { StatusChips, ActiveFilters } from '../../../components/business/ChipFilters'
import EmployeeKpiCard from '../../../components/business/EmployeeKpiCard'
import EmployeeAvatar from '../../../components/business/EmployeeAvatar'
import { ProgressRing } from '../../../components/business/EmployeeMeters'
import DataTable from '../../../components/common/DataTable'
import StatusBadge from '../../../components/common/StatusBadge'
import Button from '../../../components/common/Button'
import Modal from '../../../components/common/Modal'
import Drawer from '../../../components/common/Drawer'
import Select from '../../../components/common/Select'
import Input from '../../../components/common/Input'
import Textarea from '../../../components/common/Textarea'
import SearchBar from '../../../components/common/SearchBar'
import ActivityTimeline from '../../../components/common/ActivityTimeline'
import { leaveService } from '../../../services/attendanceService'
import { employeeService } from '../../../services/employeeService'
import { TODAY } from '../../../mockData/reference'
import { formatDate } from '../../../utils/format'
import { computeLeaveBalance, leaveDays, LEAVE_TYPES } from '../../../utils/leaveMath'
import { cn } from '../../../utils/cn'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { useResetOnChange } from '../../../hooks/useResetOnChange'

const BREADCRUMB = [{ label: 'People' }, { label: 'Leave' }]
const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]
const TYPE_OPTIONS = [{ value: '', label: 'All leave types' }, ...LEAVE_TYPES.map((t) => ({ value: t, label: t }))]
const APPROVER = 'Jay Girase'

function loadLeave() {
  return Promise.all([leaveService.list(), employeeService.list()]).then(([requests, employees]) => ({ requests, employees }))
}

function rangeLabel(l) {
  return l.from === l.to ? formatDate(l.from) : `${formatDate(l.from)} – ${formatDate(l.to)}`
}

export default function Leave() {
  const { status, data, retry } = useMockLoad(loadLeave)
  if (status === 'loading') {
    return <PageSkeleton title="Leave Management" description="Review, approve and track employee leave requests." breadcrumbItems={BREADCRUMB} stats={3} cols={7} />
  }
  if (status === 'error') return <PageError title="Leave Management" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <LeaveView initial={data.requests} employees={data.employees} />
}

function LeaveView({ initial, employees }) {
  const { toast } = useToast()
  const [requests, setRequests] = useState(initial)
  const [statusFilter, setStatusFilter] = useState('')
  const [typeFilter, setTypeFilter] = useState('')
  const [search, setSearch] = useState('')
  const [applyOpen, setApplyOpen] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [rejectTarget, setRejectTarget] = useState(null)
  const [busyId, setBusyId] = useState(null)

  const detail = requests.find((r) => r.id === detailId) || null

  const counts = useMemo(
    () =>
      requests.reduce(
        (acc, l) => {
          acc[l.status] = (acc[l.status] || 0) + 1
          acc[''] += 1
          return acc
        },
        { '': 0, pending: 0, approved: 0, rejected: 0 }
      ),
    [requests]
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return requests
      .filter((l) => (!statusFilter || l.status === statusFilter) && (!typeFilter || l.type === typeFilter))
      .filter((l) => !q || l.employee.toLowerCase().includes(q) || l.reason.toLowerCase().includes(q))
      .sort((a, b) => (a.status === 'pending') === (b.status === 'pending') ? b.from.localeCompare(a.from) : a.status === 'pending' ? -1 : 1)
  }, [requests, statusFilter, typeFilter, search])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    statusFilter && { key: 'status', label: `Status: ${statusFilter[0].toUpperCase() + statusFilter.slice(1)}`, onRemove: () => setStatusFilter('') },
    typeFilter && { key: 'type', label: `Type: ${typeFilter}`, onRemove: () => setTypeFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setTypeFilter('')
  }

  async function decide(row, patch, successMessage, tone = 'success') {
    setBusyId(row.id)
    try {
      const updated = await leaveService.update(row.id, { ...patch, decidedBy: APPROVER, decidedOn: TODAY })
      setRequests((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
      toast[tone](successMessage)
      return true
    } catch {
      toast.error('Could not update the request. Please try again.')
      return false
    } finally {
      setBusyId(null)
    }
  }

  function handleApprove(row) {
    const days = leaveDays(row)
    decide(row, { status: 'approved' }, `Leave approved for ${row.employee} (${days} day${days > 1 ? 's' : ''})`)
  }

  async function handleReject(reason) {
    const ok = await decide(rejectTarget, { status: 'rejected', rejectionReason: reason }, `Leave request for ${rejectTarget.employee} rejected`, 'info')
    if (ok) setRejectTarget(null)
  }

  async function handleCreate(payload) {
    const created = await leaveService.create({ ...payload, id: `lv-${Date.now()}`, status: 'pending', appliedOn: TODAY })
    setRequests((prev) => [created, ...prev])
    toast.success(`Leave request submitted for ${payload.employee}`)
    setApplyOpen(false)
  }

  const columns = [
    {
      key: 'employee',
      header: 'Employee',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <EmployeeAvatar name={row.employee} size="sm" />
          <p className="whitespace-nowrap font-semibold text-ink-800 dark:text-ink-100">{row.employee}</p>
        </div>
      ),
    },
    { key: 'type', header: 'Leave Type', sortable: true, render: (row) => <span className="whitespace-nowrap">{row.type}</span> },
    { key: 'from', header: 'From', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.from)}</span> },
    { key: 'to', header: 'To', render: (row) => <span className="whitespace-nowrap">{formatDate(row.to)}</span> },
    { key: 'days', header: 'Days', align: 'center', render: (row) => <span className="inline-flex min-w-7 justify-center rounded-lg bg-brand-50 px-2 py-0.5 text-xs font-bold tabular-nums text-brand-700 dark:bg-brand-500/15 dark:text-brand-300">{leaveDays(row)}</span> },
    { key: 'reason', header: 'Reason', render: (row) => <span className="line-clamp-1 max-w-[8rem]" title={row.reason}>{row.reason}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (row) => (
        <RowActions
          actions={[
            { label: `View details of ${row.employee}'s request`, icon: <Eye size={15} />, onClick: () => setDetailId(row.id) },
            { label: `Approve ${row.employee}'s request`, icon: <Check size={16} />, tone: 'success', hidden: row.status !== 'pending', disabled: busyId === row.id, onClick: () => handleApprove(row) },
            { label: `Reject ${row.employee}'s request`, icon: <X size={16} />, tone: 'danger', hidden: row.status !== 'pending', disabled: busyId === row.id, onClick: () => setRejectTarget(row) },
          ]}
        />
      ),
    },
  ]

  const detailBalance = detail ? computeLeaveBalance(requests, detail.employee).find((b) => b.type === detail.type) : null

  return (
    <div>
      <PageHeader
        title="Leave Management"
        description="Review, approve and track employee leave requests."
        breadcrumbItems={BREADCRUMB}
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setApplyOpen(true)} className="w-full sm:w-auto">
            New Leave Request
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
        <EmployeeKpiCard index={0} icon={Clock} label="Pending" value={counts.pending} tone="warning" hint="Awaiting your decision" />
        <EmployeeKpiCard index={1} icon={CheckCircle2} label="Approved" value={counts.approved} tone="success" hint="Cleared requests" />
        <EmployeeKpiCard index={2} icon={XCircle} label="Rejected" value={counts.rejected} tone="danger" hint="Declined requests" />
      </div>

      <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-4 lg:flex-row lg:items-center lg:justify-between">
        <StatusChips options={STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} counts={counts} />
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchBar value={search} onChange={setSearch} placeholder="Search employee or reason..." className="sm:w-64" />
          <Select aria-label="Filter by leave type" options={TYPE_OPTIONS} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} wrapperClassName="sm:w-44" />
        </div>
      </div>
      <ActiveFilters filters={activeFilters} onClearAll={clearFilters} className="mb-4" />

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="No leave requests"
        emptyDescription={activeFilters.length ? 'No requests match the current filters.' : 'Leave requests submitted by employees will appear here.'}
        emptyActionLabel={activeFilters.length ? 'Clear filters' : 'New Leave Request'}
        onEmptyAction={activeFilters.length ? clearFilters : () => setApplyOpen(true)}
      />

      <Drawer isOpen={Boolean(detail)} onClose={() => setDetailId(null)} title="Leave request details" width="max-w-md">
        {detail && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-3">
              <EmployeeAvatar name={detail.employee} size="lg" />
              <div className="min-w-0">
                <p className="text-base font-semibold text-ink-800 dark:text-ink-100">{detail.employee}</p>
                <p className="text-sm text-ink-500">{employees.find((e) => e.name === detail.employee)?.designation}</p>
              </div>
              <div className="ml-auto"><StatusBadge status={detail.status} /></div>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-4 rounded-2xl border border-ink-100 bg-gradient-to-br from-brand-50/50 to-accent-50/30 p-4 text-sm dark:border-ink-800 dark:from-brand-500/5 dark:to-accent-500/5">
              <DetailItem label="Leave type" value={detail.type} />
              <DetailItem label="Duration" value={`${leaveDays(detail)} day${leaveDays(detail) > 1 ? 's' : ''}`} />
              <DetailItem label="From" value={formatDate(detail.from)} />
              <DetailItem label="To" value={formatDate(detail.to)} />
              <DetailItem label="Applied on" value={formatDate(detail.appliedOn)} />
              <DetailItem label="Decided by" value={detail.decidedBy ? `${detail.decidedBy} · ${formatDate(detail.decidedOn)}` : 'Awaiting decision'} />
              <div className="col-span-2">
                <dt className="text-xs text-ink-400">Reason</dt>
                <dd className="mt-0.5 break-words text-ink-700 dark:text-ink-200">{detail.reason}</dd>
              </div>
              {detail.rejectionReason && (
                <div className="col-span-2 rounded-lg bg-danger-50 p-3 dark:bg-danger-500/10">
                  <dt className="text-xs font-medium text-danger-600 dark:text-danger-300">Reason for rejection</dt>
                  <dd className="mt-0.5 text-danger-700 dark:text-danger-100">{detail.rejectionReason}</dd>
                </div>
              )}
            </dl>

            {detailBalance && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-ink-500">{detail.type} balance</h3>
                <BalanceBar balance={detailBalance} />
              </div>
            )}

            <div>
              <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-500">Timeline</h3>
              <ActivityTimeline
                items={[
                  { id: 'applied', actor: detail.employee, text: 'submitted the request', time: <>{formatDate(detail.appliedOn)}</>, tone: 'info' },
                  ...(detail.status !== 'pending'
                    ? [{ id: 'decided', actor: detail.decidedBy || APPROVER, text: `${detail.status} the request`, time: <>{formatDate(detail.decidedOn)}</>, tone: detail.status === 'approved' ? 'success' : 'danger' }]
                    : [{ id: 'waiting', text: 'Waiting for manager approval', time: <>Pending</>, tone: 'warning' }]),
                ]}
              />
            </div>

            {detail.status === 'pending' && (
              <div className="flex flex-col gap-2 border-t border-ink-100 pt-4 dark:border-ink-800 sm:flex-row">
                <Button variant="success" className="flex-1" leftIcon={<Check size={15} />} isLoading={busyId === detail.id} onClick={() => handleApprove(detail)}>
                  Approve
                </Button>
                <Button variant="danger" className="flex-1" leftIcon={<X size={15} />} disabled={busyId === detail.id} onClick={() => { setRejectTarget(detail); setDetailId(null) }}>
                  Reject
                </Button>
              </div>
            )}
          </div>
        )}
      </Drawer>

      <RejectModal target={rejectTarget} onClose={() => setRejectTarget(null)} onConfirm={handleReject} />
      <LeaveRequestModal isOpen={applyOpen} onClose={() => setApplyOpen(false)} onSubmit={handleCreate} employees={employees} requests={requests} />
    </div>
  )
}

function DetailItem({ label, value }) {
  return (
    <div>
      <dt className="text-xs text-ink-500">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold text-ink-800 dark:text-ink-100">{value}</dd>
    </div>
  )
}

const RING_STROKES = { 'Casual Leave': 'stroke-brand-500', 'Sick Leave': 'stroke-accent-500', 'Earned Leave': 'stroke-warning-500' }

function BalanceBar({ balance, highlight = false }) {
  const usedPct = balance.total ? Math.min(100, ((balance.used + balance.pending) / balance.total) * 100) : 0
  return (
    <div
      className={cn('flex min-w-0 items-center gap-3 rounded-2xl border p-3 transition-colors', highlight ? 'border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10' : 'border-ink-100 bg-white dark:border-ink-800 dark:bg-ink-900')}
      role="group"
      aria-label={`${balance.type}: ${balance.used + balance.pending} of ${balance.total} days used or pending`}
    >
      <ProgressRing value={usedPct} size={52} strokeWidth={6} stroke={RING_STROKES[balance.type] || 'stroke-brand-500'}>
        <span className="text-xs font-bold tabular-nums text-ink-700 dark:text-ink-200">{balance.remaining}</span>
      </ProgressRing>
      <div className="min-w-0 text-xs">
        <p className="truncate font-semibold text-ink-700 dark:text-ink-200">{balance.type}</p>
        <p className="text-ink-500"><strong className="text-ink-800 dark:text-ink-100">{balance.remaining}</strong> of {balance.total} days left</p>
        <p className="text-ink-500">{balance.used} used · {balance.pending} pending</p>
      </div>
    </div>
  )
}

function RejectModal({ target, onClose, onConfirm }) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useResetOnChange([target], () => {
    setReason('')
    setError('')
    setSaving(false)
  })

  async function submit(e) {
    e.preventDefault()
    if (reason.trim().length < 5) {
      setError('Please give a reason (at least 5 characters) so the employee understands the decision')
      return
    }
    setSaving(true)
    await onConfirm(reason.trim())
    setSaving(false)
  }

  return (
    <Modal
      isOpen={Boolean(target)}
      onClose={saving ? undefined : onClose}
      title="Reject leave request"
      description={target ? `${target.employee} · ${target.type} · ${rangeLabel(target)}` : ''}
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button variant="danger" onClick={submit} isLoading={saving}>Reject Request</Button>
        </>
      }
    >
      <form onSubmit={submit} noValidate>
        <Textarea
          label="Reason for rejection"
          required
          rows={4}
          placeholder="e.g. Sprint release scheduled on these dates. Please reapply for next week."
          value={reason}
          error={error}
          onChange={(e) => { setReason(e.target.value); if (error) setError('') }}
        />
      </form>
    </Modal>
  )
}

const EMPTY = { employee: '', type: LEAVE_TYPES[0], from: '', to: '', reason: '' }

function LeaveRequestModal({ isOpen, onClose, onSubmit, employees, requests }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setValues(EMPTY)
      setErrors({})
      setSaving(false)
    }
  })

  const days = values.from && values.to && values.to >= values.from ? leaveDays(values) : 0
  const balances = values.employee ? computeLeaveBalance(requests, values.employee) : []
  const selectedBalance = balances.find((b) => b.type === values.type)

  function set(field) {
    return (e) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined, ...(field === 'from' || field === 'to' ? { to: undefined } : {}) }))
    }
  }

  function validate() {
    const next = {}
    if (!values.employee) next.employee = 'Select an employee'
    if (!values.from) next.from = 'From date is required'
    if (!values.to) next.to = 'To date is required'
    if (values.from && values.to && values.to < values.from) next.to = 'To date cannot be earlier than the from date'
    if (values.reason.trim().length < 5) next.reason = 'Please add a short reason (at least 5 characters)'
    if (!next.from && !next.to && values.employee) {
      const overlap = requests.find(
        (r) => r.employee === values.employee && r.status !== 'rejected' && r.from <= values.to && r.to >= values.from
      )
      if (overlap) next.from = `Overlaps with an existing ${overlap.status} request (${rangeLabel(overlap)})`
      else if (selectedBalance && days > selectedBalance.remaining) {
        next.to = `Requested ${days} days but only ${selectedBalance.remaining} ${values.type.toLowerCase()} days are left`
      }
    }
    return next
  }

  async function submit(e) {
    e.preventDefault()
    if (saving) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    try {
      await onSubmit({ ...values, reason: values.reason.trim() })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title="New Leave Request"
      description="Submit a leave request on behalf of an employee"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving}>Submit Request</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        <Select
          label="Employee"
          required
          placeholder="Select employee"
          options={employees.filter((e) => e.status !== 'inactive').map((e) => ({ value: e.name, label: e.name }))}
          value={values.employee}
          error={errors.employee}
          onChange={set('employee')}
        />
        <Select label="Leave Type" required options={LEAVE_TYPES.map((t) => ({ value: t, label: t }))} value={values.type} onChange={set('type')} />
        <Input label="From" type="date" required value={values.from} error={errors.from} onChange={set('from')} />
        <Input label="To" type="date" required min={values.from || undefined} value={values.to} error={errors.to} onChange={set('to')} />
        <div className="sm:col-span-2">
          <Textarea label="Reason" required rows={3} placeholder="Briefly explain the purpose of the leave" value={values.reason} error={errors.reason} onChange={set('reason')} />
        </div>

        <div className="sm:col-span-2">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="flex items-center gap-1.5 text-sm font-semibold text-ink-700 dark:text-ink-200"><CalendarDays size={14} className="text-brand-500" /> Leave balance</h3>
            {days > 0 && <span className="text-xs font-medium text-brand-600 dark:text-brand-400">{days} day{days > 1 ? 's' : ''} requested</span>}
          </div>
          {values.employee ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
              {balances.map((b) => (
                <BalanceBar key={b.type} balance={b} highlight={b.type === values.type} />
              ))}
            </div>
          ) : (
            <p className="rounded-2xl border border-dashed border-ink-200 p-3 text-xs text-ink-500 dark:border-ink-700">Select an employee to see their remaining leave balance.</p>
          )}
          {selectedBalance && days > selectedBalance.remaining && (
            <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-warning-600 dark:text-warning-400">
              <AlertTriangle size={13} /> This request exceeds the remaining {values.type.toLowerCase()} balance.
            </p>
          )}
        </div>
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}
