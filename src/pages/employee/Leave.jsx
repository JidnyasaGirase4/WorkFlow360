import { useMemo, useState } from 'react'
import { Plus, CalendarDays, Briefcase, HeartPulse, Info, X } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import { Panel } from '../../components/portal/Panel'
import IconChip from '../../components/portal/IconChip'
import ProgressRing from '../../components/portal/ProgressRing'
import { toneOf, stagger } from '../../components/portal/tones'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import Modal from '../../components/common/Modal'
import ConfirmDialog from '../../components/common/ConfirmDialog'
import Input from '../../components/common/Input'
import Textarea from '../../components/common/Textarea'
import Select from '../../components/common/Select'
import { RadioGroup } from '../../components/common/Radio'
import FilterBar from '../../components/common/FilterBar'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard, SkeletonTable } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useEmployeeData } from '../../hooks/useEmployeeData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { addLeaveRequest, cancelLeaveRequest } from '../../utils/portalStores'
import { holidays } from '../../mockData/attendance'
import { TODAY } from '../../mockData/reference'
import { formatDate } from '../../utils/format'

const ICONS = { 'Earned Leave': CalendarDays, 'Casual Leave': Briefcase, 'Sick Leave': HeartPulse }
const TONES = { 'Earned Leave': 'brand', 'Casual Leave': 'accent', 'Sick Leave': 'warning' }
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
]
const EMPTY_FORM = { type: '', from: '', to: '', reason: '' }

// Working days between two dates (weekends and company holidays excluded).
function workingDays(from, to) {
  if (!from || !to || to < from) return 0
  let count = 0
  const cursor = new Date(`${from}T00:00:00Z`)
  const end = new Date(`${to}T00:00:00Z`)
  while (cursor <= end) {
    const key = cursor.toISOString().slice(0, 10)
    const day = cursor.getUTCDay()
    if (day !== 0 && day !== 6 && !holidays[key]) count += 1
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  }
  return count
}

function LeaveSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading leave" className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} lines={1} />
        ))}
      </div>
      <Skeleton className="h-10 w-48" />
      <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={4} cols={5} />
      </div>
    </div>
  )
}

export default function EmployeeLeave() {
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { name, leave, leaveBalance } = useEmployeeData()

  const [statusFilter, setStatusFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [errors, setErrors] = useState({})
  const [cancelTarget, setCancelTarget] = useState(null)

  const rows = useMemo(() => leave.filter((l) => !statusFilter || l.status === statusFilter), [leave, statusFilter])
  const requestedDays = workingDays(form.from, form.to)
  const balanceFor = (type) => leaveBalance.find((b) => b.type === type)

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function closeModal() {
    setModalOpen(false)
    setForm(EMPTY_FORM)
    setErrors({})
  }

  function validate() {
    const next = {}
    if (!form.type) next.type = 'Select a leave type.'
    if (!form.from) next.from = 'Choose a start date.'
    else if (form.from < TODAY && form.type !== 'Sick Leave') next.from = 'Start date cannot be in the past (sick leave can be backdated).'
    if (!form.to) next.to = 'Choose an end date.'
    else if (form.from && form.to < form.from) next.to = 'End date must be on or after the start date.'
    if (!form.reason.trim()) next.reason = 'Please share a reason.'
    else if (form.reason.trim().length < 10) next.reason = 'Reason must be at least 10 characters.'

    if (!next.from && !next.to && form.from && form.to) {
      if (requestedDays === 0) next.to = 'The selected dates fall on weekends or holidays.'
      const bal = balanceFor(form.type)
      if (!next.to && bal && requestedDays > bal.remaining) {
        next.to = `Only ${bal.remaining} ${form.type.toLowerCase()} day${bal.remaining === 1 ? '' : 's'} left, but ${requestedDays} requested.`
      }
      const overlap = leave.find((l) => l.status !== 'rejected' && form.from <= l.to && form.to >= l.from)
      if (!next.to && overlap) next.from = `Overlaps your ${overlap.status} ${overlap.type.toLowerCase()} (${formatDate(overlap.from)} - ${formatDate(overlap.to)}).`
    }
    setErrors(next)
    return Object.keys(next).length === 0
  }

  function handleSubmit() {
    if (!validate()) return
    addLeaveRequest({ employee: name, type: form.type, from: form.from, to: form.to, reason: form.reason.trim() })
    toast.success('Leave request submitted to your manager')
    closeModal()
  }

  function confirmCancel() {
    cancelLeaveRequest(cancelTarget.id)
    toast.info('Leave request withdrawn')
    setCancelTarget(null)
  }

  const columns = [
    { key: 'type', header: 'Type', sortable: true, render: (row) => <span className="font-medium text-ink-800 dark:text-ink-100">{row.type}</span> },
    { key: 'from', header: 'From', sortable: true, render: (row) => formatDate(row.from) },
    { key: 'to', header: 'To', render: (row) => formatDate(row.to) },
    { key: 'days', header: 'Days', align: 'right', render: (row) => workingDays(row.from, row.to) },
    { key: 'reason', header: 'Reason', mobileHidden: false, render: (row) => (
      <div className="max-w-xs">
        <p className="truncate">{row.reason}</p>
        {row.rejectionReason && <p className="mt-0.5 text-xs text-danger-600 dark:text-danger-400">Manager note: {row.rejectionReason}</p>}
      </div>
    ) },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.status === 'pending' ? (
          <Button size="sm" variant="ghost" leftIcon={<X size={13} />} onClick={() => setCancelTarget(row)}>
            Withdraw
          </Button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Leave"
        description="Track your leave balance and requests."
        breadcrumbItems={[{ label: 'HR' }, { label: 'Leave' }]}
        homeHref="/employee/dashboard"
        action={
          <Button leftIcon={<Plus size={15} />} onClick={() => setModalOpen(true)}>
            Apply for Leave
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<LeaveSkeleton />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5 lg:gap-6">
          {leaveBalance.map((b, i) => {
            const Icon = ICONS[b.type]
            const tone = TONES[b.type] || 'brand'
            const pct = b.total ? (b.remaining / b.total) * 100 : 0
            return (
              <Panel key={b.type} hover style={stagger(i)} className="animate-slide-up relative overflow-hidden p-4 sm:p-5">
                <span className={`pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full blur-2xl ${toneOf(tone).glow}`} aria-hidden="true" />
                <div className="relative flex items-center justify-between gap-2">
                  <IconChip icon={Icon} tone={tone} />
                  <span className="text-xs text-ink-500">{b.total} days / year</span>
                </div>
                <div className="relative mt-4 flex items-center gap-4">
                  <ProgressRing value={pct} size={68} stroke={8} tone={tone} label={`${b.type} remaining`}>
                    <span className="text-lg font-bold tabular-nums text-ink-800 dark:text-ink-100">{b.remaining}</span>
                  </ProgressRing>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-ink-800 dark:text-ink-100">{b.type}</p>
                    <p className="text-sm text-ink-500">
                      <span className="font-semibold text-ink-700 dark:text-ink-200">{b.remaining}</span> days left
                    </p>
                    <p className="mt-0.5 text-xs text-ink-500">
                      {b.used} used · {b.pending} pending approval
                    </p>
                  </div>
                </div>
              </Panel>
            )
          })}
        </div>

        <div className="mt-6 lg:mt-8">
          <h2 className="mb-3 text-base font-semibold text-ink-800 dark:text-ink-100 sm:text-lg">Leave history</h2>
          <FilterBar
            className="mb-3"
            chips={statusFilter ? [{ key: 'status', label: `Status: ${STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}`, onRemove: () => setStatusFilter('') }] : []}
            onClearAll={() => setStatusFilter('')}
          >
            <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-44" />
          </FilterBar>
          <DataTable
            columns={columns}
            data={rows}
            ariaLabel="Leave requests"
            emptyTitle={leave.length === 0 ? 'No leave requests yet' : 'No requests match this filter'}
            emptyDescription={leave.length === 0 ? 'Apply for leave and it will appear here with its approval status.' : 'Clear the status filter to see all requests.'}
            emptyActionLabel={leave.length === 0 ? 'Apply for Leave' : undefined}
            onEmptyAction={leave.length === 0 ? () => setModalOpen(true) : undefined}
          />
        </div>
      </AsyncState>

      <Modal
        isOpen={modalOpen}
        onClose={closeModal}
        title="Apply for Leave"
        description="Your request goes to your reporting manager for approval."
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Submit Request</Button>
          </>
        }
      >
        <form
          className="space-y-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault()
            handleSubmit()
          }}
        >
          <RadioGroup
            label="Leave type"
            value={form.type}
            onChange={(v) => update('type', v)}
            error={errors.type}
            options={leaveBalance.map((b) => ({ value: b.type, label: b.type, description: `${b.remaining} of ${b.total} days available` }))}
          />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="From" type="date" required value={form.from} onChange={(e) => update('from', e.target.value)} error={errors.from} />
            <Input label="To" type="date" required min={form.from || undefined} value={form.to} onChange={(e) => update('to', e.target.value)} error={errors.to} />
          </div>
          {requestedDays > 0 && (
            <p className="flex items-center gap-2 rounded-xl bg-brand-50 px-3 py-2.5 text-sm font-medium text-brand-700 dark:bg-brand-500/10 dark:text-brand-300">
              <Info size={15} /> {requestedDays} working day{requestedDays === 1 ? '' : 's'} will be deducted (weekends and holidays excluded).
            </p>
          )}
          <Textarea label="Reason" required rows={3} placeholder="Briefly describe the reason for your leave" value={form.reason} onChange={(e) => update('reason', e.target.value)} error={errors.reason} />
        </form>
      </Modal>

      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={confirmCancel}
        title="Withdraw this request?"
        description={cancelTarget ? `Your ${cancelTarget.type.toLowerCase()} request for ${formatDate(cancelTarget.from)} will be withdrawn.` : ''}
        confirmLabel="Withdraw"
      />
    </div>
  )
}
