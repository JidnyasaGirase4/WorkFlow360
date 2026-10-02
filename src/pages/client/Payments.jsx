import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Wallet, Clock3, CheckCircle2, Download, FileDown, Receipt } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import PortalStat from '../../components/portal/PortalStat'
import DataTable from '../../components/common/DataTable'
import StatusBadge from '../../components/common/StatusBadge'
import Select from '../../components/common/Select'
import SearchBar from '../../components/common/SearchBar'
import FilterBar from '../../components/common/FilterBar'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard, SkeletonTable } from '../../components/common/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { downloadTextFile } from '../../utils/download'
import { formatCurrency, formatDate } from '../../utils/format'

const STATUS_OPTIONS = [
  { value: 'completed', label: 'Completed' },
  { value: 'pending', label: 'Pending' },
  { value: 'failed', label: 'Failed' },
]
const rupees = (v) => Math.round(v).toLocaleString('en-IN')

function PaymentsSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading payments" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5">
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <Skeleton className="h-10 w-72" />
      <div className="rounded-2xl border border-ink-100 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
        <SkeletonTable rows={4} cols={6} />
      </div>
    </div>
  )
}

export default function ClientPayments() {
  const { toast } = useToast()
  const navigate = useNavigate()
  const { isLoading, isError, retry } = usePortalLoad()
  const { company, payments, invoices } = useClientData()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return payments.filter((p) => (!q || p.number.toLowerCase().includes(q) || p.invoice.toLowerCase().includes(q) || (p.reference || '').toLowerCase().includes(q)) && (!status || p.status === status))
  }, [payments, search, status])

  const totalPaid = payments.filter((p) => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0)
  const inVerification = payments.filter((p) => p.status === 'pending').reduce((sum, p) => sum + p.amount, 0)
  const outstanding = invoices.reduce((sum, i) => sum + i.balance, 0)

  function downloadReceipt(payment) {
    const body = [
      'WORKFLOW360 - PAYMENT RECEIPT (demo)',
      '',
      `Receipt: ${payment.number}`,
      `Paid by: ${company}`,
      `Invoice: ${payment.invoice}`,
      `Amount: ${formatCurrency(payment.amount)}`,
      `Method: ${payment.method}`,
      `Date: ${formatDate(payment.date)}`,
      `Reference: ${payment.reference || '-'}`,
      `Status: ${payment.status}`,
    ].join('\n')
    downloadTextFile(`${payment.number}-receipt.txt`, body)
    toast.success(`Receipt ${payment.number} downloaded`)
  }

  function exportHistory() {
    const lines = [['Payment', 'Invoice', 'Amount (INR)', 'Date', 'Method', 'Reference', 'Status']]
    filtered.forEach((p) => lines.push([p.number, p.invoice, p.amount, p.date, p.method, p.reference || '', p.status]))
    downloadTextFile('payment-history.csv', lines.map((r) => r.join(',')).join('\n'), 'text/csv')
    toast.success('Payment history exported')
  }

  const columns = [
    { key: 'number', header: 'Payment', sortable: true, render: (row) => <span className="font-semibold text-ink-800 dark:text-ink-100">{row.number}</span> },
    { key: 'invoice', header: 'Invoice', render: (row) => <Link to="/client/invoices" className="focus-ring rounded text-brand-600 hover:underline dark:text-brand-400" onClick={(e) => e.stopPropagation()}>{row.invoice}</Link> },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (row) => formatCurrency(row.amount) },
    { key: 'date', header: 'Date', sortable: true, render: (row) => formatDate(row.date) },
    { key: 'method', header: 'Method' },
    { key: 'reference', header: 'Reference', mobileHidden: true, render: (row) => <span className="font-mono text-xs text-ink-500">{row.reference || '—'}</span> },
    { key: 'status', header: 'Status', render: (row) => <StatusBadge status={row.status} /> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) =>
        row.status === 'completed' ? (
          <Button size="sm" variant="secondary" leftIcon={<Download size={13} />} onClick={() => downloadReceipt(row)} aria-label={`Download receipt ${row.number}`}>
            Receipt
          </Button>
        ) : null,
    },
  ]

  return (
    <div>
      <PageHeader
        title="Payments"
        description="A record of payments made against your invoices."
        breadcrumbItems={[{ label: 'Billing' }, { label: 'Payments' }]}
        homeHref="/client/dashboard"
        action={
          <Button variant="secondary" leftIcon={<FileDown size={15} />} onClick={exportHistory} disabled={filtered.length === 0}>
            Export history
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<PaymentsSkeleton />}>
        {payments.length === 0 ? (
          <EmptyState icon={Receipt} title="No payments yet" description="Payments you make will be recorded here." actionLabel="View invoices" onAction={() => navigate('/client/invoices')} />
        ) : (
          <>
            <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-5 lg:mb-8">
              <PortalStat index={0} icon={CheckCircle2} label="Total Paid" value={totalPaid} tone="success" prefix="₹" format={rupees} />
              <PortalStat index={1} icon={Clock3} label="Awaiting Verification" value={inVerification} tone="warning" prefix="₹" format={rupees} />
              <PortalStat index={2} icon={Wallet} label="Outstanding Balance" value={outstanding} tone="info" prefix="₹" format={rupees} className="col-span-2 sm:col-span-1" />
            </div>

            <FilterBar
              className="mb-4"
              search={<SearchBar value={search} onChange={setSearch} placeholder="Search payment, invoice or reference..." />}
              chips={status ? [{ key: 'status', label: `Status: ${STATUS_OPTIONS.find((s) => s.value === status)?.label}`, onRemove: () => setStatus('') }] : []}
              onClearAll={() => setStatus('')}
            >
              <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={status} onChange={(e) => setStatus(e.target.value)} className="sm:w-44" />
            </FilterBar>
            <DataTable columns={columns} data={filtered} ariaLabel="Payment history" emptyTitle="No payments match" emptyDescription="Try a different search or clear the filter." />
          </>
        )}
      </AsyncState>
    </div>
  )
}
