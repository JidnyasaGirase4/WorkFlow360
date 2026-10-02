import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { Plus, Receipt, Wallet, AlertTriangle, IndianRupee, Eye, Send, HandCoins, Ban, FileText } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import InvoiceFormModal from '../../../components/business/InvoiceFormModal'
import InvoiceCard from '../../../components/business/InvoiceCard'
import RecordPaymentModal from '../../../components/business/RecordPaymentModal'
import PagedCards from '../../../components/business/PagedCards'
import RowActions from '../../../components/business/RowActions'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import { StatusChips, ActiveFilters } from '../../../components/business/ChipFilters'
import Button from '../../../components/common/Button'
import SearchBar from '../../../components/common/SearchBar'
import Select from '../../../components/common/Select'
import DataTable from '../../../components/common/DataTable'
import InvoiceStatusPill from '../../../components/business/InvoiceStatusPill'
import EmployeeKpiCard from '../../../components/business/EmployeeKpiCard'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { invoiceService } from '../../../services/invoiceService'
import { clients } from '../../../mockData/clients'
import { TODAY, daysBetween } from '../../../mockData/reference'
import { formatCurrency, formatDate } from '../../../utils/format'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { useResetOnChange } from '../../../hooks/useResetOnChange'

const BREADCRUMB = [{ label: 'Billing' }, { label: 'Invoices' }]

const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'cancelled', label: 'Cancelled' },
]
const STATUS_LABEL = Object.fromEntries(STATUS_CHIPS.map((c) => [c.value, c.label]))
const CLIENT_OPTIONS = [{ value: '', label: 'All clients' }, ...clients.map((c) => ({ value: c.id, label: c.company }))]
const PAYABLE = ['sent', 'partially_paid', 'overdue']

function loadInvoices() {
  return invoiceService.list()
}

export default function Invoices() {
  const { status, data, retry } = useMockLoad(loadInvoices)
  if (status === 'loading') {
    return <PageSkeleton title="Invoices" description="Create, send and track invoices for your clients." breadcrumbItems={BREADCRUMB} stats={4} cols={8} />
  }
  if (status === 'error') return <PageError title="Invoices" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <InvoicesView initial={data} />
}

function InvoicesView({ initial }) {
  const { toast } = useToast()
  const location = useLocation()
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState(() => [...initial].sort((a, b) => b.issueDate.localeCompare(a.issueDate)))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [clientFilter, setClientFilter] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [payTarget, setPayTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)
  const [isCancelling, setIsCancelling] = useState(false)

  useResetOnChange(
    [location.key],
    () => {
      if (location.state?.openCreate) setModalOpen(true)
    },
    { immediate: true }
  )

  useEffect(() => {
    if (location.state?.openCreate) navigate(location.pathname, { replace: true, state: {} })
  }, [location, navigate])

  const stats = useMemo(
    () =>
      invoices
        .filter((i) => i.status !== 'cancelled')
        .reduce(
          (acc, inv) => {
            acc.totalInvoiced += inv.amount
            acc.totalPaid += inv.paid
            acc.outstanding += inv.balance
            if (inv.status === 'overdue') acc.overdueCount += 1
            return acc
          },
          { totalInvoiced: 0, totalPaid: 0, outstanding: 0, overdueCount: 0 }
        ),
    [invoices]
  )

  const counts = useMemo(() => {
    const acc = { '': invoices.length }
    invoices.forEach((i) => {
      acc[i.status] = (acc[i.status] || 0) + 1
    })
    STATUS_CHIPS.forEach((c) => {
      acc[c.value] ||= 0
    })
    return acc
  }, [invoices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return invoices.filter(
      (inv) =>
        (!q || inv.number.toLowerCase().includes(q) || inv.client.toLowerCase().includes(q)) &&
        (!statusFilter || inv.status === statusFilter) &&
        (!clientFilter || inv.clientId === clientFilter)
    )
  }, [invoices, search, statusFilter, clientFilter])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_LABEL[statusFilter]}`, onRemove: () => setStatusFilter('') },
    clientFilter && { key: 'client', label: `Client: ${clients.find((c) => c.id === clientFilter)?.company}`, onRemove: () => setClientFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setClientFilter('')
  }

  function replaceInvoice(updated) {
    setInvoices((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  async function handleCreate(payload, { send }) {
    setIsSaving(true)
    try {
      const created = await invoiceService.create(payload)
      setInvoices((prev) => [created, ...prev])
      toast.success(send ? `Invoice ${created.number} created and sent to ${created.client}` : `Invoice ${created.number} saved as draft`)
      setModalOpen(false)
    } catch {
      toast.error('Could not create the invoice. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleSend(inv) {
    try {
      replaceInvoice(await invoiceService.send(inv.id))
      toast.success(`Invoice ${inv.number} sent to ${inv.client}`)
    } catch {
      toast.error('Could not send the invoice. Please try again.')
    }
  }

  async function handleRecordPayment(values) {
    try {
      const { invoice } = await invoiceService.recordPayment(values.invoiceId, values)
      replaceInvoice(invoice)
      toast.success(`Payment of ${formatCurrency(values.amount)} recorded for ${invoice.number}`)
      setPayTarget(null)
    } catch {
      toast.error('Could not record the payment. Please try again.')
    }
  }

  async function handleCancel() {
    setIsCancelling(true)
    try {
      replaceInvoice(await invoiceService.cancel(cancelTarget.id))
      toast.success(`Invoice ${cancelTarget.number} cancelled`)
      setCancelTarget(null)
    } catch {
      toast.error('Could not cancel the invoice. Please try again.')
    } finally {
      setIsCancelling(false)
    }
  }

  const columns = [
    { key: 'number', header: 'Invoice number', sortable: true, render: (row) => <span className="whitespace-nowrap font-bold text-brand-600 dark:text-brand-300">{row.number}</span> },
    { key: 'client', header: 'Client', sortable: true, render: (row) => <span className="block max-w-[10rem]">{row.client}</span> },
    { key: 'issueDate', header: 'Date', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.issueDate)}</span> },
    {
      key: 'dueDate',
      header: 'Due date',
      sortable: true,
      render: (row) => {
        const late = row.status === 'overdue' ? daysBetween(row.dueDate, TODAY) : 0
        return (
          <div className="whitespace-nowrap">
            {formatDate(row.dueDate)}
            {late > 0 && <p className="text-xs font-medium text-danger-600 dark:text-danger-400">{late} days overdue</p>}
          </div>
        )
      },
    },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (row) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(row.amount)}</span> },
    { key: 'paid', header: 'Paid', align: 'right', sortable: true, render: (row) => <span className="whitespace-nowrap tabular-nums text-success-600 dark:text-success-400">{formatCurrency(row.paid)}</span> },
    { key: 'balance', header: 'Balance', align: 'right', sortable: true, render: (row) => <span className={`whitespace-nowrap tabular-nums ${row.balance > 0 ? 'font-semibold text-accent-600 dark:text-accent-300' : 'text-ink-400'}`}>{formatCurrency(row.balance)}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <InvoiceStatusPill status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <RowActions
          actions={[
            { label: `View ${row.number}`, icon: <Eye size={15} />, onClick: () => navigate(`/admin/billing/invoices/${row.id}`) },
            { label: `Send ${row.number}`, icon: <Send size={15} />, hidden: row.status !== 'draft', onClick: () => handleSend(row) },
            { label: `Record payment for ${row.number}`, icon: <HandCoins size={15} />, tone: 'success', hidden: !PAYABLE.includes(row.status), onClick: () => setPayTarget(row) },
            { label: `Cancel ${row.number}`, icon: <Ban size={15} />, tone: 'danger', hidden: !['draft', 'sent', 'overdue'].includes(row.status), onClick: () => setCancelTarget(row) },
          ]}
        />
      ),
    },
  ]

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Create, send and track invoices for your clients."
        breadcrumbItems={BREADCRUMB}
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            Create Invoice
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        <EmployeeKpiCard index={0} icon={IndianRupee} label="Total Invoiced" value={stats.totalInvoiced} format={(v) => formatCurrency(v)} tone="brand" />
        <EmployeeKpiCard index={1} icon={Wallet} label="Total Paid" value={stats.totalPaid} format={(v) => formatCurrency(v)} tone="success" />
        <EmployeeKpiCard index={2} icon={Receipt} label="Outstanding Balance" value={stats.outstanding} format={(v) => formatCurrency(v)} tone="warning" />
        <EmployeeKpiCard index={3} icon={AlertTriangle} label="Overdue Invoices" value={stats.overdueCount} tone="danger" />
      </div>

      <div className="mb-4 space-y-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchBar value={search} onChange={setSearch} placeholder="Search invoice number or client..." className="sm:w-80" />
          <Select aria-label="Filter by client" options={CLIENT_OPTIONS} value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} wrapperClassName="sm:w-56" />
        </div>
        <StatusChips options={STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} counts={counts} />
      </div>
      <ActiveFilters filters={activeFilters} onClearAll={clearFilters} className="mb-4" />

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
          <EmptyState
            icon={FileText}
            title="No invoices found"
            description={activeFilters.length ? 'No invoices match the current filters.' : 'Create your first invoice to start billing clients.'}
            actionLabel={activeFilters.length ? 'Clear filters' : 'Create Invoice'}
            onAction={activeFilters.length ? clearFilters : () => setModalOpen(true)}
          />
        </div>
      ) : (
        <>
          <div className="hidden animate-fade-in md:block">
            <DataTable columns={columns} data={filtered} pageSize={8} onRowClick={(row) => navigate(`/admin/billing/invoices/${row.id}`)} />
          </div>
          <div className="md:hidden">
            <PagedCards items={filtered} pageSize={5} renderItem={(inv) => <InvoiceCard invoice={inv} onOpen={() => navigate(`/admin/billing/invoices/${inv.id}`)} />} />
          </div>
        </>
      )}

      <InvoiceFormModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleCreate} isSaving={isSaving} />
      <RecordPaymentModal isOpen={Boolean(payTarget)} onClose={() => setPayTarget(null)} onSubmit={handleRecordPayment} invoice={payTarget} />
      <ConfirmDialog
        isOpen={Boolean(cancelTarget)}
        onClose={() => setCancelTarget(null)}
        onConfirm={handleCancel}
        isLoading={isCancelling}
        title={`Cancel ${cancelTarget?.number}?`}
        description="The invoice will be marked as cancelled and the outstanding balance removed. This cannot be undone."
        confirmLabel="Cancel Invoice"
        cancelLabel="Keep Invoice"
      />
    </div>
  )
}
