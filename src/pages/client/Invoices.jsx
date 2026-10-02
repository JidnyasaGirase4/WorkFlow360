import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, Download, CreditCard, Receipt, IndianRupee, Wallet, AlertTriangle, FileDown } from 'lucide-react'
import PageHeader from '../../components/business/PageHeader'
import PortalStat from '../../components/portal/PortalStat'
import DataTable from '../../components/common/DataTable'
import Select from '../../components/common/Select'
import SearchBar from '../../components/common/SearchBar'
import FilterBar from '../../components/common/FilterBar'
import StatusBadge from '../../components/common/StatusBadge'
import Button from '../../components/common/Button'
import EmptyState from '../../components/common/EmptyState'
import AsyncState from '../../components/common/AsyncState'
import { Skeleton, SkeletonCard, SkeletonTable } from '../../components/common/Skeleton'
import InvoicePreviewModal from './InvoicePreviewModal'
import PaymentModal from './PaymentModal'
import { useToast } from '../../context/ToastContext'
import { useClientData } from '../../hooks/useClientData'
import { usePortalLoad } from '../../hooks/usePortalLoad'
import { settleInvoice } from '../../utils/portalStores'
import { buildInvoiceHtml, displayStatus, paymentStatus } from '../../utils/invoiceDocument'
import { downloadTextFile } from '../../utils/download'
import { formatCurrency, formatDate } from '../../utils/format'
import { cn } from '../../utils/cn'

const STATUS_OPTIONS = [
  { value: 'sent', label: 'Sent' },
  { value: 'partially_paid', label: 'Partially Paid' },
  { value: 'paid', label: 'Paid' },
  { value: 'overdue', label: 'Overdue' },
]
const rupees = (v) => Math.round(v).toLocaleString('en-IN')

function InvoicesSkeleton() {
  return (
    <div role="status" aria-busy="true" aria-label="Loading invoices" className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
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

export default function ClientInvoices() {
  const { toast } = useToast()
  const { isLoading, isError, retry } = usePortalLoad()
  const { company, invoices } = useClientData()

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [previewId, setPreviewId] = useState(null)
  const [payId, setPayId] = useState(null)

  const rows = useMemo(() => invoices.map((i) => ({ ...i, shownStatus: displayStatus(i), payStatus: paymentStatus(i) })), [invoices])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((i) => (!q || i.number.toLowerCase().includes(q)) && (!statusFilter || i.shownStatus === statusFilter))
  }, [rows, search, statusFilter])

  const totals = useMemo(
    () => ({
      billed: rows.reduce((s, i) => s + i.amount, 0),
      paid: rows.reduce((s, i) => s + i.paid, 0),
      outstanding: rows.reduce((s, i) => s + i.balance, 0),
      overdue: rows.filter((i) => i.shownStatus === 'overdue').reduce((s, i) => s + i.balance, 0),
    }),
    [rows]
  )

  const previewInvoice = rows.find((i) => i.id === previewId) || null
  const payInvoice = rows.find((i) => i.id === payId) || null

  function downloadInvoice(invoice) {
    downloadTextFile(`${invoice.number}.html`, buildInvoiceHtml(invoice, company), 'text/html')
    toast.success(`${invoice.number} downloaded. Open the file and use Print to save as PDF.`)
  }

  function downloadStatement() {
    const lines = [['Invoice', 'Issue date', 'Due date', 'Amount (INR)', 'Paid (INR)', 'Balance (INR)', 'Status']]
    rows.forEach((i) => lines.push([i.number, i.issueDate, i.dueDate, i.amount, i.paid, i.balance, i.shownStatus]))
    downloadTextFile('account-statement.csv', lines.map((r) => r.join(',')).join('\n'), 'text/csv')
    toast.success('Account statement downloaded')
  }

  function handlePaid(invoice, method, reference) {
    settleInvoice(invoice.id, method, reference)
    toast.success(`Payment of ${formatCurrency(invoice.balance)} recorded for ${invoice.number} (demo)`)
  }

  function openPay(invoice) {
    setPreviewId(null)
    setPayId(invoice.id)
  }

  const columns = [
    { key: 'number', header: 'Invoice', sortable: true, render: (row) => <span className="inline-flex items-center gap-2 whitespace-nowrap font-semibold text-ink-800 dark:text-ink-100"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300" aria-hidden="true"><Receipt size={14} /></span>{row.number}</span> },
    { key: 'issueDate', header: 'Issued', sortable: true, mobileHidden: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.issueDate)}</span> },
    { key: 'dueDate', header: 'Due date', sortable: true, render: (row) => <span className={cn('whitespace-nowrap', row.shownStatus === 'overdue' && 'font-semibold text-danger-600 dark:text-danger-400')}>{formatDate(row.dueDate)}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (row) => formatCurrency(row.amount) },
    { key: 'balance', header: 'Balance', align: 'right', sortable: true, render: (row) => formatCurrency(row.balance) },
    { key: 'shownStatus', header: 'Status', render: (row) => <StatusBadge status={row.shownStatus} /> },
    {
      key: 'payStatus',
      header: 'Payment',
      render: (row) => <StatusBadge status={row.payStatus} label={row.payStatus === 'pending' ? 'Unpaid' : undefined} />,
    },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <div className="flex flex-wrap justify-end gap-1.5 sm:flex-nowrap">
          <Button size="sm" variant="secondary" leftIcon={<Eye size={13} />} onClick={() => setPreviewId(row.id)} aria-label={`View ${row.number}`}>
            <span className="sm:hidden xl:inline">View</span>
          </Button>
          <Button size="sm" variant="secondary" leftIcon={<Download size={13} />} onClick={() => downloadInvoice(row)} aria-label={`Download ${row.number}`}>
            <span className="sm:hidden xl:inline">Download</span>
          </Button>
          {row.balance > 0 && (
            <Button size="sm" variant="accent" leftIcon={<CreditCard size={13} />} onClick={() => openPay(row)} aria-label={`Pay ${row.number} now`}>
              Pay Now
            </Button>
          )}
        </div>
      ),
    },
  ]

  const statCards = [
    { icon: Receipt, label: 'Total Billed', value: totals.billed, tone: 'brand', prefix: '₹', format: rupees },
    { icon: Wallet, label: 'Paid', value: totals.paid, tone: 'success', prefix: '₹', format: rupees },
    { icon: IndianRupee, label: 'Outstanding', value: totals.outstanding, tone: 'warning', prefix: '₹', format: rupees },
    { icon: AlertTriangle, label: 'Overdue', value: totals.overdue, tone: 'danger', prefix: '₹', format: rupees },
  ]

  return (
    <div>
      <PageHeader
        title="Invoices"
        description="Track, download and pay invoices raised against your account."
        breadcrumbItems={[{ label: 'Billing' }, { label: 'Invoices' }]}
        homeHref="/client/dashboard"
        action={
          <Button variant="secondary" leftIcon={<FileDown size={15} />} onClick={downloadStatement} disabled={rows.length === 0}>
            Download statement
          </Button>
        }
      />

      <AsyncState isLoading={isLoading} isError={isError} onRetry={retry} skeleton={<InvoicesSkeleton />}>
        {rows.length === 0 ? (
          <EmptyState icon={Receipt} title="No invoices yet" description="Invoices raised against your account will appear here." />
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 sm:gap-5 xl:grid-cols-4">
              {statCards.map((card, i) => (
                <PortalStat key={card.label} index={i} {...card} />
              ))}
            </div>

            <div className="mt-6 lg:mt-8">
              <FilterBar
                className="mb-4"
                search={<SearchBar value={search} onChange={setSearch} placeholder="Search invoice number..." />}
                chips={statusFilter ? [{ key: 'status', label: `Status: ${STATUS_OPTIONS.find((s) => s.value === statusFilter)?.label}`, onRemove: () => setStatusFilter('') }] : []}
                onClearAll={() => setStatusFilter('')}
                actions={
                  <Link to="/client/payments" className="focus-ring rounded text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
                    Payment history
                  </Link>
                }
              >
                <Select aria-label="Filter by status" placeholder="All statuses" options={STATUS_OPTIONS} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:w-48" />
              </FilterBar>

              <DataTable
                columns={columns}
                data={filtered}
                ariaLabel="Invoices"
                emptyTitle="No invoices match"
                emptyDescription="Try a different search or clear the status filter."
              />
            </div>
          </>
        )}
      </AsyncState>

      <InvoicePreviewModal invoice={previewInvoice} billTo={company} isOpen={Boolean(previewInvoice)} onClose={() => setPreviewId(null)} onDownload={downloadInvoice} onPay={openPay} />
      <PaymentModal invoice={payInvoice} isOpen={Boolean(payInvoice)} onClose={() => setPayId(null)} onPaid={handlePaid} />
    </div>
  )
}
