import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, FileText, Eye, Send, Check, X, ArrowRightLeft, FileCheck2, Hourglass, IndianRupee, Percent } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import RowActions from '../../../components/business/RowActions'
import LineItemsEditor from '../../../components/business/LineItemsEditor'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import { StatusChips, ActiveFilters } from '../../../components/business/ChipFilters'
import Button from '../../../components/common/Button'
import Input from '../../../components/common/Input'
import Textarea from '../../../components/common/Textarea'
import SearchBar from '../../../components/common/SearchBar'
import DataTable from '../../../components/common/DataTable'
import Badge from '../../../components/common/Badge'
import EmployeeKpiCard from '../../../components/business/EmployeeKpiCard'
import Modal from '../../../components/common/Modal'
import Drawer from '../../../components/common/Drawer'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import { quotationService } from '../../../services/quotationService'
import { clients } from '../../../mockData/clients'
import { TODAY, addDays } from '../../../mockData/reference'
import { formatCurrency, formatDate } from '../../../utils/format'
import { computeTotals, isValidItem, newLineItem } from '../../../utils/invoiceMath'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { useResetOnChange } from '../../../hooks/useResetOnChange'

const BREADCRUMB = [{ label: 'Billing' }, { label: 'Quotations' }]

const STATUS_META = {
  draft: { label: 'Draft', tone: 'neutral' },
  sent: { label: 'Sent', tone: 'info' },
  accepted: { label: 'Accepted', tone: 'success' },
  rejected: { label: 'Rejected', tone: 'danger' },
  expired: { label: 'Expired', tone: 'warning' },
  converted: { label: 'Converted', tone: 'accent' },
}
const STATUS_CHIPS = [{ value: '', label: 'All' }, ...Object.entries(STATUS_META).map(([value, m]) => ({ value, label: m.label }))]

function QuotationStatus({ status }) {
  const meta = STATUS_META[status] || { label: status, tone: 'neutral' }
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>
}

function loadQuotations() {
  return quotationService.list()
}

export default function Quotations() {
  const { status, data, retry } = useMockLoad(loadQuotations)
  if (status === 'loading') {
    return <PageSkeleton title="Quotations" description="Create and track quotations sent to prospective clients." breadcrumbItems={BREADCRUMB} stats={4} cols={7} />
  }
  if (status === 'error') return <PageError title="Quotations" breadcrumbItems={BREADCRUMB} onRetry={retry} />
  return <QuotationsView initial={data} />
}

function QuotationsView({ initial }) {
  const { toast } = useToast()
  const [quotations, setQuotations] = useState(() => [...initial].sort((a, b) => b.issueDate.localeCompare(a.issueDate)))
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [detailId, setDetailId] = useState(null)
  const [convertTarget, setConvertTarget] = useState(null)
  const [isConverting, setIsConverting] = useState(false)

  const detail = quotations.find((q) => q.id === detailId) || null

  const stats = useMemo(() => {
    const open = quotations.filter((q) => q.status === 'sent')
    const won = quotations.filter((q) => q.status === 'accepted' || q.status === 'converted')
    const decided = quotations.filter((q) => ['accepted', 'converted', 'rejected', 'expired'].includes(q.status))
    return {
      total: quotations.reduce((s, q) => s + q.amount, 0),
      openValue: open.reduce((s, q) => s + q.amount, 0),
      openCount: open.length,
      wonValue: won.reduce((s, q) => s + q.amount, 0),
      winRate: decided.length ? Math.round((won.length / decided.length) * 100) : 0,
    }
  }, [quotations])

  const counts = useMemo(() => {
    const acc = { '': quotations.length }
    Object.keys(STATUS_META).forEach((s) => {
      acc[s] = quotations.filter((q) => q.status === s).length
    })
    return acc
  }, [quotations])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return quotations.filter(
      (item) => (!q || item.number.toLowerCase().includes(q) || item.client.toLowerCase().includes(q)) && (!statusFilter || item.status === statusFilter)
    )
  }, [quotations, search, statusFilter])

  const activeFilters = [
    search.trim() && { key: 'search', label: `Search: "${search.trim()}"`, onRemove: () => setSearch('') },
    statusFilter && { key: 'status', label: `Status: ${STATUS_META[statusFilter].label}`, onRemove: () => setStatusFilter('') },
  ].filter(Boolean)

  function clearFilters() {
    setSearch('')
    setStatusFilter('')
  }

  function replace(updated) {
    setQuotations((prev) => prev.map((q) => (q.id === updated.id ? updated : q)))
  }

  async function setStatus(q, status, message) {
    try {
      replace(await quotationService.update(q.id, { status }))
      toast.success(message)
    } catch {
      toast.error('Could not update the quotation. Please try again.')
    }
  }

  async function handleCreate(payload) {
    setIsSaving(true)
    try {
      const created = await quotationService.create(payload)
      setQuotations((prev) => [created, ...prev])
      toast.success(payload.status === 'sent' ? `${created.number} sent to ${created.client}` : `${created.number} saved as draft`)
      setCreateOpen(false)
    } catch {
      toast.error('Could not create the quotation. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  async function handleConvert() {
    setIsConverting(true)
    try {
      const { quotation, invoice } = await quotationService.convertToInvoice(convertTarget.id)
      replace(quotation)
      toast.success(`${quotation.number} converted to draft invoice ${invoice.number}`)
      setConvertTarget(null)
    } catch {
      toast.error('Could not convert the quotation. Please try again.')
    } finally {
      setIsConverting(false)
    }
  }

  const canConvert = (q) => q.status === 'accepted' || q.status === 'sent'

  const columns = [
    { key: 'number', header: 'Quotation', sortable: true, render: (row) => <span className="whitespace-nowrap font-bold text-brand-600 dark:text-brand-300">{row.number}</span> },
    { key: 'client', header: 'Client', sortable: true, render: (row) => <span className="whitespace-nowrap">{row.client}</span> },
    { key: 'amount', header: 'Amount', align: 'right', sortable: true, render: (row) => <span className="whitespace-nowrap font-semibold tabular-nums">{formatCurrency(row.amount)}</span> },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      render: (row) => (
        <div>
          <QuotationStatus status={row.status} />
          {row.invoiceId && (
            <Link to={`/admin/billing/invoices/${row.invoiceId}`} onClick={(e) => e.stopPropagation()} className="mt-1 block text-xs font-medium text-brand-600 hover:underline dark:text-brand-400">
              {row.invoiceNumber}
            </Link>
          )}
        </div>
      ),
    },
    { key: 'issueDate', header: 'Issue date', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.issueDate)}</span> },
    { key: 'validUntil', header: 'Valid until', sortable: true, render: (row) => <span className="whitespace-nowrap">{formatDate(row.validUntil)}</span> },
    {
      key: 'actions',
      header: '',
      align: 'right',
      render: (row) => (
        <RowActions
          actions={[
            { label: `View ${row.number}`, icon: <Eye size={15} />, onClick: () => setDetailId(row.id) },
            { label: `Send ${row.number}`, icon: <Send size={15} />, hidden: row.status !== 'draft', onClick: () => setStatus(row, 'sent', `${row.number} sent to ${row.client}`) },
            { label: `Mark ${row.number} accepted`, icon: <Check size={16} />, tone: 'success', hidden: row.status !== 'sent', onClick: () => setStatus(row, 'accepted', `${row.number} accepted by ${row.client}`) },
            { label: `Mark ${row.number} rejected`, icon: <X size={16} />, tone: 'danger', hidden: row.status !== 'sent', onClick: () => setStatus(row, 'rejected', `${row.number} marked as rejected`) },
            { label: `Convert ${row.number} to invoice`, icon: <ArrowRightLeft size={15} />, hidden: !canConvert(row), onClick: () => setConvertTarget(row) },
          ]}
        />
      ),
    },
  ]

  const detailTotals = detail ? computeTotals(detail.items, detail.taxPercent, 0) : null

  return (
    <div>
      <PageHeader
        title="Quotations"
        description="Create and track quotations sent to prospective clients."
        breadcrumbItems={BREADCRUMB}
        action={
          <Button leftIcon={<Plus size={16} />} onClick={() => setCreateOpen(true)} className="w-full sm:w-auto">
            New Quotation
          </Button>
        }
      />

      <div className="mb-6 grid grid-cols-1 gap-3 min-[480px]:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        <EmployeeKpiCard index={0} icon={IndianRupee} label="Total Quoted" value={stats.total} format={(v) => formatCurrency(v)} tone="brand" />
        <EmployeeKpiCard index={1} icon={Hourglass} label={`Awaiting Response (${stats.openCount})`} value={stats.openValue} format={(v) => formatCurrency(v)} tone="info" />
        <EmployeeKpiCard index={2} icon={FileCheck2} label="Accepted / Converted" value={stats.wonValue} format={(v) => formatCurrency(v)} tone="success" />
        <EmployeeKpiCard index={3} icon={Percent} label="Win Rate" value={stats.winRate} format={(v) => `${Math.round(v)}%`} tone="accent" />
      </div>

      <div className="mb-4 space-y-3 rounded-2xl border border-ink-100 bg-white p-3 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-4">
        <SearchBar value={search} onChange={setSearch} placeholder="Search quotation number or client..." className="sm:w-80" />
        <StatusChips options={STATUS_CHIPS} value={statusFilter} onChange={setStatusFilter} counts={counts} />
      </div>
      <ActiveFilters filters={activeFilters} onClearAll={clearFilters} className="mb-4" />

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => setDetailId(row.id)}
        emptyTitle="No quotations found"
        emptyDescription={activeFilters.length ? 'No quotations match the current filters.' : 'Create your first quotation to send a proposal.'}
        emptyActionLabel={activeFilters.length ? 'Clear filters' : 'New Quotation'}
        onEmptyAction={activeFilters.length ? clearFilters : () => setCreateOpen(true)}
      />

      <Drawer isOpen={Boolean(detail)} onClose={() => setDetailId(null)} title={detail?.number || ''} width="max-w-lg">
        {detail && (
          <div className="space-y-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-semibold text-ink-800 dark:text-ink-100">{detail.client}</p>
                <p className="text-xs text-ink-500">Issued {formatDate(detail.issueDate)} · Valid until {formatDate(detail.validUntil)}</p>
              </div>
              <QuotationStatus status={detail.status} />
            </div>

            <div className="overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brand-100 bg-brand-50 text-xs uppercase tracking-wide text-brand-700 dark:border-ink-800 dark:bg-ink-800/60 dark:text-brand-300">
                    <th className="px-3 py-2.5 font-semibold">Item</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Qty</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-ink-100 last:border-0 dark:border-ink-800">
                      <td className="px-3 py-2.5 text-ink-700 dark:text-ink-200">{item.description}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-500">{item.qty}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink-800 dark:text-ink-100">{formatCurrency(item.qty * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="space-y-1.5 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-accent-50/40 p-4 text-sm tabular-nums dark:border-ink-800 dark:from-brand-500/10 dark:to-accent-500/5">
              <div className="flex justify-between text-ink-500"><dt>Subtotal</dt><dd className="font-medium text-ink-700 dark:text-ink-200">{formatCurrency(detailTotals.subtotal)}</dd></div>
              <div className="flex justify-between text-ink-500"><dt>GST ({detail.taxPercent || 0}%)</dt><dd className="font-medium text-ink-700 dark:text-ink-200">{formatCurrency(detailTotals.taxAmount)}</dd></div>
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base dark:border-ink-700"><dt className="font-semibold text-ink-800 dark:text-ink-100">Total</dt><dd className="text-lg font-bold text-brand-700 dark:text-brand-300">{formatCurrency(detailTotals.total)}</dd></div>
            </dl>

            {detail.notes && (
              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-500">Notes</h3>
                <p className="text-sm text-ink-600 dark:text-ink-300">{detail.notes}</p>
              </div>
            )}

            {detail.invoiceId && (
              <p className="rounded-xl bg-accent-50 p-3 text-sm text-accent-700 dark:bg-accent-500/10 dark:text-accent-300">
                Converted to invoice{' '}
                <Link to={`/admin/billing/invoices/${detail.invoiceId}`} className="font-semibold underline">{detail.invoiceNumber}</Link>.
              </p>
            )}

            <div className="flex flex-col gap-2 border-t border-ink-100 pt-4 dark:border-ink-800 sm:flex-row sm:flex-wrap">
              {detail.status === 'draft' && <Button leftIcon={<Send size={15} />} onClick={() => setStatus(detail, 'sent', `${detail.number} sent to ${detail.client}`)}>Send to client</Button>}
              {detail.status === 'sent' && <Button variant="success" leftIcon={<Check size={15} />} onClick={() => setStatus(detail, 'accepted', `${detail.number} accepted by ${detail.client}`)}>Mark accepted</Button>}
              {detail.status === 'sent' && <Button variant="secondary" leftIcon={<X size={15} />} onClick={() => setStatus(detail, 'rejected', `${detail.number} marked as rejected`)}>Mark rejected</Button>}
              {canConvert(detail) && <Button variant="secondary" leftIcon={<ArrowRightLeft size={15} />} onClick={() => { setConvertTarget(detail); setDetailId(null) }}>Convert to invoice</Button>}
            </div>
          </div>
        )}
      </Drawer>

      <QuotationFormModal isOpen={createOpen} onClose={() => setCreateOpen(false)} onSubmit={handleCreate} isSaving={isSaving} />
      <ConfirmDialog
        isOpen={Boolean(convertTarget)}
        onClose={() => setConvertTarget(null)}
        onConfirm={handleConvert}
        isLoading={isConverting}
        danger={false}
        title={`Convert ${convertTarget?.number} to an invoice?`}
        description={`A draft invoice for ${convertTarget ? formatCurrency(convertTarget.amount) : ''} will be created for ${convertTarget?.client} with the same line items.`}
        confirmLabel="Create Invoice"
      />
    </div>
  )
}

function emptyValues() {
  return { client: '', validUntil: addDays(TODAY, 15), taxPercent: 18, notes: '' }
}

function QuotationFormModal({ isOpen, onClose, onSubmit, isSaving }) {
  const [values, setValues] = useState(emptyValues)
  const [items, setItems] = useState(() => [newLineItem()])
  const [errors, setErrors] = useState({})

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setValues(emptyValues())
      setItems([newLineItem()])
      setErrors({})
    }
  })

  const totals = useMemo(() => computeTotals(items, values.taxPercent, 0), [items, values.taxPercent])

  function set(field) {
    return (e) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function submit(send) {
    if (isSaving) return
    const next = {}
    if (!values.client.trim()) next.client = 'Enter the client or company name'
    if (!values.validUntil) next.validUntil = 'Valid-until date is required'
    else if (values.validUntil < TODAY) next.validUntil = 'Valid-until date cannot be in the past'
    if (!items.some(isValidItem)) next.items = 'Add at least one line item with a description, quantity and price greater than zero'
    else if (items.some((i) => (i.description.trim() || Number(i.price) > 0) && !isValidItem(i))) next.items = 'Complete or remove the partially filled line items'
    const tax = Number(values.taxPercent)
    if (Number.isNaN(tax) || tax < 0 || tax > 100) next.taxPercent = 'Tax must be between 0 and 100'
    setErrors(next)
    if (Object.keys(next).length > 0) return

    const known = clients.find((c) => c.company.toLowerCase() === values.client.trim().toLowerCase())
    onSubmit({
      id: `quo-${Date.now()}`,
      number: quotationService.nextNumber(),
      client: known?.company || values.client.trim(),
      clientId: known?.id || null,
      amount: totals.total,
      status: send ? 'sent' : 'draft',
      issueDate: TODAY,
      validUntil: values.validUntil,
      taxPercent: Number(values.taxPercent) || 0,
      notes: values.notes.trim(),
      items: items.filter(isValidItem).map((i) => ({ description: i.description.trim(), qty: Number(i.qty), price: Number(i.price) })),
    })
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title="New Quotation"
      description="Prepare a price quotation for a client or prospect"
      size="xl"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={isSaving}>Save as Draft</Button>
          <Button leftIcon={<FileText size={15} />} onClick={() => submit(true)} isLoading={isSaving}>Create &amp; Send</Button>
        </>
      }
    >
      <form onSubmit={(e) => { e.preventDefault(); submit(false) }} noValidate className="space-y-5">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <Input label="Client / company" required list="quotation-clients" placeholder="Choose an existing client or type a new name" value={values.client} error={errors.client} onChange={set('client')} />
            <datalist id="quotation-clients">
              {clients.map((c) => (
                <option key={c.id} value={c.company} />
              ))}
            </datalist>
          </div>
          <Input label="Valid until" type="date" required min={TODAY} value={values.validUntil} error={errors.validUntil} onChange={set('validUntil')} />
        </div>

        <LineItemsEditor items={items} onChange={(next) => { setItems(next); setErrors((p) => ({ ...p, items: undefined })) }} error={errors.items} />

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="space-y-4">
            <Input label="Tax / GST (%)" type="number" min="0" max="100" step="any" value={values.taxPercent} error={errors.taxPercent} onChange={set('taxPercent')} />
            <Textarea label="Notes" rows={3} placeholder="Scope, timelines, payment milestones..." value={values.notes} onChange={set('notes')} />
          </div>
          <dl className="space-y-2 self-start rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-accent-50/40 p-4 text-sm tabular-nums dark:border-ink-800 dark:from-brand-500/10 dark:to-accent-500/5" aria-live="polite">
            <div className="flex justify-between text-ink-500"><dt>Subtotal</dt><dd className="font-medium text-ink-700 dark:text-ink-200">{formatCurrency(totals.subtotal)}</dd></div>
            <div className="flex justify-between text-ink-500"><dt>GST ({Number(values.taxPercent) || 0}%)</dt><dd className="font-medium text-ink-700 dark:text-ink-200">{formatCurrency(totals.taxAmount)}</dd></div>
            <div className="flex justify-between border-t border-ink-200 pt-2 text-base dark:border-ink-700"><dt className="font-semibold text-ink-800 dark:text-ink-100">Total</dt><dd className="text-lg font-bold text-brand-700 dark:text-brand-300">{formatCurrency(totals.total)}</dd></div>
          </dl>
        </div>
      </form>
    </Modal>
  )
}
