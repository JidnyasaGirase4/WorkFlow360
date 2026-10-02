import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, Wallet, Clock, AlertTriangle } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import RecordPaymentModal from '../../../components/business/RecordPaymentModal'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import { StatusChips, ActiveFilters } from '../../../components/business/ChipFilters'
import Button from '../../../components/common/Button'
import Select from '../../../components/common/Select'
import SearchBar from '../../../components/common/SearchBar'
import DataTable from '../../../components/common/DataTable'
import Badge from '../../../components/common/Badge'
import EmployeeKpiCard from '../../../components/business/EmployeeKpiCard'
import { paymentService } from '../../../services/paymentService'
import { invoiceService } from '../../../services/invoiceService'
import { formatCurrency, formatDate } from '../../../utils/format'
import { PAYMENT_METHODS } from '../../../utils/invoiceMath'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'

const BREADCRUMB = [{ label: 'Billing' }, { label: 'Payments' }]
const STATUS_CHIPS = [
  { value: '', label: 'All' },
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]
const STATUS_TONE = { completed: 'success', pending: 'warning', failed: 'danger' }
const METHOD_OPTIONS = [{ value: '', label: 'All methods' }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))]

function loadPayments() {
  return Promise.all([paymentService.list(), invoiceService.list()]).then(([payments, invoices]) => ({ payments, invoices }))
}

export default function Payments() {
  const { status, data, retry } = useMockLoad(loadPayments)
  if (status === 'loading') {
    return <PageSkeleton title="Payments" description="Track payments received against your invoices." breadcrumbItems={BREADCRUMB} stats={3} cols={7} />
  }
  if (status === 'error') return <PageError title="Payments" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <PaymentsView initialPayments={data.payments} initialInvoices={data.invoices} />
}

function PaymentsView({ initialPayments, initialInvoices }) {
  const { toast } = useToast()
  const [payments, setPayments] = useState(() => [...initialPayments].sort((a, b) => b.date.localeCompare(a.date)))
  const [invoices, setInvoices] = useState(initialInvoices)
  const [modalOpen, setModalOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [methodFilter, setMethodFilter] = useState('')

  const invoiceIdByNumber = useMemo(() => Object.fromEntries(invoices.map((i) => [i.number, i.id])), [invoices])
  const payable = useMemo(() => invoices.filter((i) => ['sent', 'partially_paid', 'overdue'].includes(i.status) && i.balance > 0), [invoices])

  const stats = useMemo(() => {
    const overdueInvoices = invoices.filter((i) => i.status === 'overdue')
    return {
      collected: payments.filter((p) => p.status === 'completed').reduce((s, p) => s + p.amount, 0),
      pending: payments.filter((p) => p.status === 'pending').reduce((s, p) => s + p.amount, 0),
      pendingCount: payments.filter((p) => p.status === 'pending').length,
      overdue: overdueInvoices.reduce((s, i) => s + i.balance, 0),
      overdueCount: overdueInvoices.length,
    }
  }, [payments, invoices])

  const counts = useMemo(() => {
    const acc = { '': payments.length, completed: 0, pending: 0, failed: 0 }
    payments.forEach((p) => {
      acc[p.status] += 1
    })
    return acc
  }, [payments])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter(
      (p) =>
        (!q || p.number.toLowerCase().includes(q) || p.invoice.toLowerCase().includes(q) || p.client.toLowerCase().includes(q)) &&
        (!statusFilter || p.status === statusFilter) &&
        (!methodFilter || p.method === methodFilter)
    )
  }, [payments, search, statusFilter, methodFilter])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_CHIPS.find((c) => c.value === statusFilter).label}`, onRemove: () => setStatusFilter('') },
    methodFilter && { key: 'method', label: `Method: ${methodFilter}`, onRemove: () => setMethodFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
    setMethodFilter('')
  }

  async function handleRecord(values) {
    try {
      const { invoice, payment } = await invoiceService.recordPayment(values.invoiceId, values)
      setPayments((prev) => [payment, ...prev])
      setInvoices((prev) => prev.map((i) => (i.id === invoice.id ? invoice : i)))
      toast.success(`${payment.number} recorded: ${formatCurrency(payment.amount)} from ${payment.client}`)
      setModalOpen(false)
    } catch {
      toast.error('Could not record the payment. Please try again.')
    }
  }

  const columns = [
    { key: 'number', header: 'Payment number', sortable: true, render: (row) => <span className="whitespace-nowrap font-bold text-ink-800 dark:text-ink-100">{row.number}</span> },
    {
      key: 'invoice',
      header: 'Invoice',
      sortable: true,
      render: (row) =>
        invoiceIdByNumber[row.invoice] ? (
          <Link to={`/admin/billing/invoices/${invoiceIdByNumber[row.invoice]}`} className="whitespace-nowrap font-medium text-brand-600 hover:underline dark:text-brand-400">
            {row.invoice}
          </Link>
        ) : (
          row.invoice
        ),
    },
    { key: 'client', header: 'Client', sortable: true, render: (row) => <span className="block max-w-[9rem]">{row.client}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (row) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(row.amount)}</span> },
    { key: 'date', header: 'Date', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.date)}</span> },
    { key: 'method', header: 'Payment method', render: (row) => <span className="block max-w-[7rem]">{row.method}</span> },
    { key: 'status', header: 'Status', sortable: true, render: (row) => <Badge tone={STATUS_TONE[row.status] || 'neutral'} dot>{row.status[0].toUpperCase() + row.status.slice(1)}</Badge> },
  ]

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Track payments received against your invoices."
        breadcrumbItems={BREADCRUMB}
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setModalOpen(true)} className="w-full sm:w-auto">
            Record Payment
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3 sm:gap-5">
        <EmployeeKpiCard index={0} icon={Wallet} label="Total Collected" value={stats.collected} format={(v) => formatCurrency(v)} tone="success" />
        <EmployeeKpiCard index={1} icon={Clock} label={`Pending (${stats.pendingCount} payment${stats.pendingCount === 1 ? '' : 's'})`} value={stats.pending} format={(v) => formatCurrency(v)} tone="warning" />
        <EmployeeKpiCard index={2} icon={AlertTriangle} label={`Overdue (${stats.overdueCount} invoice${stats.overdueCount === 1 ? '' : 's'})`} value={stats.overdue} format={(v) => formatCurrency(v)} tone="danger" />
      </div>

      <div className="mb-4 space-y-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-4">
        <div className="flex flex-col gap-2 sm:flex-row">
          <SearchBar value={search} onChange={setSearch} placeholder="Search payment, invoice or client..." className="sm:w-80" />
          <Select aria-label="Filter by payment method" options={METHOD_OPTIONS} value={methodFilter} onChange={(e) => setMethodFilter(e.target.value)} wrapperClassName="sm:w-48" />
        </div>
        <StatusChips options={STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} counts={counts} />
      </div>
      <ActiveFilters filters={activeFilters} onClearAll={clearFilters} className="mb-4" />

      <DataTable
        columns={columns}
        data={filtered}
        emptyTitle="No payments found"
        emptyDescription={activeFilters.length ? 'No payments match the current filters.' : 'Record your first payment to see it here.'}
        emptyActionLabel={activeFilters.length ? 'Clear filters' : 'Record Payment'}
        onEmptyAction={activeFilters.length ? clearFilters : () => setModalOpen(true)}
      />

      <RecordPaymentModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSubmit={handleRecord} invoices={payable} />
    </div>
  )
}
