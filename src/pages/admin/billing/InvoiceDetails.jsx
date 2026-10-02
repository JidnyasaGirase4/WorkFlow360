import { useCallback, useMemo, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Download, Send, CheckCircle2, ArrowLeft, HandCoins, Ban, Bell, FileX, CalendarClock, Receipt, History } from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import InvoicePreview from '../../../components/business/InvoicePreview'
import RecordPaymentModal from '../../../components/business/RecordPaymentModal'
import { PageSkeleton, PageError } from '../../../components/business/PageStates'
import Button from '../../../components/common/Button'
import Card, { CardBody, CardHeader, CardTitle } from '../../../components/common/Card'
import InvoiceStatusPill from '../../../components/business/InvoiceStatusPill'
import Badge from '../../../components/common/Badge'
import EmptyState from '../../../components/common/EmptyState'
import ConfirmDialog from '../../../components/common/ConfirmDialog'
import Modal from '../../../components/common/Modal'
import Textarea from '../../../components/common/Textarea'
import ActivityTimeline from '../../../components/common/ActivityTimeline'
import { invoiceService } from '../../../services/invoiceService'
import { paymentService } from '../../../services/paymentService'
import { getClientById } from '../../../mockData/clients'
import { TODAY, daysBetween } from '../../../mockData/reference'
import { formatCurrency, formatDate } from '../../../utils/format'
import { usePrintInvoice } from '../../../hooks/usePrintInvoice'
import { useToast } from '../../../context/ToastContext'
import { useMockLoad } from '../../../hooks/useMockLoad'
import { useResetOnChange } from '../../../hooks/useResetOnChange'

const PAYMENT_TONE = { completed: 'success', pending: 'warning', failed: 'danger' }

export default function InvoiceDetails() {
  const { id } = useParams()
  const navigate = useNavigate()
  const crumbs = [{ label: 'Billing' }, { label: 'Invoices', href: '/admin/billing/invoices' }, { label: 'Invoice' }]

  const load = useCallback(async () => {
    const [invoice, payments] = await Promise.all([
      invoiceService.get(id).catch((e) => (e.code === 'NOT_FOUND' ? null : Promise.reject(e))),
      paymentService.list(),
    ])
    return { invoice, payments }
  }, [id])

  const { status, data, retry } = useMockLoad(load)

  if (status === 'loading') return <PageSkeleton title="Invoice" breadcrumbItems={crumbs} stats={0} filters={false} cols={4} />
  if (status === 'error') return <PageError title="Invoice" breadcrumbItems={crumbs} onRetry={retry} />
  if (!data.invoice) {
    return (
      <div>
        <PageHeader title="Invoice" breadcrumbItems={crumbs} />
        <Card>
          <EmptyState
            icon={FileX}
            title="Invoice not found"
            description="This invoice may have been removed or the link is invalid."
            actionLabel="Back to Invoices"
            onAction={() => navigate('/admin/billing/invoices')}
          />
        </Card>
      </div>
    )
  }
  return <InvoiceView key={data.invoice.id} initial={data.invoice} allPayments={data.payments} />
}

function InvoiceView({ initial, allPayments }) {
  const navigate = useNavigate()
  const { toast } = useToast()
  const { print, portal } = usePrintInvoice()

  const [invoice, setInvoice] = useState(initial)
  const [payments, setPayments] = useState(allPayments)
  const [busy, setBusy] = useState('')
  const [payOpen, setPayOpen] = useState(false)
  const [paidConfirm, setPaidConfirm] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const client = useMemo(() => (invoice.clientId ? getClientById(invoice.clientId) : null), [invoice.clientId])
  const invoicePayments = useMemo(
    () => payments.filter((p) => p.invoice === invoice.number).sort((a, b) => b.date.localeCompare(a.date)),
    [payments, invoice.number]
  )

  const isClosed = invoice.status === 'paid' || invoice.status === 'cancelled'
  const canPay = ['sent', 'partially_paid', 'overdue'].includes(invoice.status) && invoice.balance > 0
  const daysToDue = daysBetween(TODAY, invoice.dueDate)

  async function refreshPayments() {
    setPayments(await paymentService.list())
  }

  async function run(key, task) {
    setBusy(key)
    try {
      await task()
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setBusy('')
    }
  }

  const handleSend = () =>
    run('send', async () => {
      setInvoice(await invoiceService.send(invoice.id))
      toast.success(`Invoice ${invoice.number} sent to ${client?.contactPerson || invoice.client}`)
    })

  const handleReminder = () =>
    run('remind', async () => {
      await new Promise((r) => setTimeout(r, 400))
      toast.success(`Payment reminder sent to ${client?.contactPerson || invoice.client}`)
    })

  const handleMarkPaid = () =>
    run('paid', async () => {
      const { invoice: updated } = await invoiceService.markPaid(invoice.id)
      setInvoice(updated)
      await refreshPayments()
      setPaidConfirm(false)
      toast.success(`Invoice ${updated.number} marked as paid`)
    })

  async function handleRecordPayment(values) {
    try {
      const { invoice: updated } = await invoiceService.recordPayment(invoice.id, values)
      setInvoice(updated)
      await refreshPayments()
      setPayOpen(false)
      toast.success(`Payment of ${formatCurrency(values.amount)} recorded`)
    } catch {
      toast.error('Could not record the payment. Please try again.')
    }
  }

  const handleCancel = (reason) =>
    run('cancel', async () => {
      setInvoice(await invoiceService.cancel(invoice.id, reason))
      setCancelOpen(false)
      toast.success(`Invoice ${invoice.number} cancelled`)
    })

  function downloadPdf() {
    print({ invoice, client })
    toast.info('Choose "Save as PDF" in the print dialog to download the invoice')
  }

  const activity = [...(invoice.activity || [])].sort((a, b) => String(b.time).localeCompare(String(a.time)))

  return (
    <div>
      <PageHeader
        title={invoice.number}
        description={`${invoice.client} · Issued ${formatDate(invoice.issueDate)}`}
        breadcrumbItems={[{ label: 'Billing' }, { label: 'Invoices', href: '/admin/billing/invoices' }, { label: invoice.number }]}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" leftIcon={<ArrowLeft size={16} />} onClick={() => navigate('/admin/billing/invoices')}>
              Back
            </Button>
            <Button variant="secondary" leftIcon={<Download size={16} />} onClick={downloadPdf}>
              Download PDF
            </Button>
          </div>
        }
      />

      <Card className="gradient-soft relative mb-6 overflow-hidden rounded-2xl border-ink-100 lg:mb-8">
        <span aria-hidden="true" className="pointer-events-none absolute -right-10 -top-10 h-36 w-36 rounded-full bg-gradient-to-br from-brand-200/50 to-transparent" />
        <CardBody className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-600 text-white shadow-lg shadow-brand-500/30"><Receipt size={22} aria-hidden="true" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-lg font-bold tracking-tight text-ink-900 dark:text-white">{invoice.number}</p>
                <InvoiceStatusPill status={invoice.status} />
              </div>
              <p className="mt-0.5 flex items-center gap-1.5 text-sm text-ink-500">
              <CalendarClock size={14} className="shrink-0 text-brand-500" aria-hidden="true" />
              {invoice.status === 'cancelled'
                ? 'This invoice was cancelled.'
                : invoice.status === 'paid'
                  ? 'Fully paid. No action needed.'
                  : invoice.status === 'draft'
                    ? 'Draft: not yet visible to the client.'
                    : daysToDue < 0
                      ? `${Math.abs(daysToDue)} days past due`
                      : daysToDue === 0
                        ? 'Due today'
                        : `Due in ${daysToDue} days`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 [&>button]:flex-1 sm:[&>button]:flex-none" role="group" aria-label="Invoice actions">
            {invoice.status === 'draft' && (
              <Button leftIcon={<Send size={16} />} onClick={handleSend} isLoading={busy === 'send'}>Send Invoice</Button>
            )}
            {canPay && (
              <Button variant="secondary" leftIcon={<Bell size={15} />} onClick={handleReminder} isLoading={busy === 'remind'}>Send Reminder</Button>
            )}
            {canPay && (
              <Button variant="secondary" leftIcon={<HandCoins size={15} />} onClick={() => setPayOpen(true)}>Record Payment</Button>
            )}
            {canPay && (
              <Button variant="success" leftIcon={<CheckCircle2 size={15} />} onClick={() => setPaidConfirm(true)}>Mark as Paid</Button>
            )}
            {!isClosed && invoice.paid === 0 && (
              <Button variant="danger" leftIcon={<Ban size={15} />} onClick={() => setCancelOpen(true)}>Cancel Invoice</Button>
            )}
          </div>
        </CardBody>
      </Card>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 space-y-6 xl:col-span-2">
          <div className="rounded-3xl bg-gradient-to-br from-ink-100/80 to-brand-50/60 p-2 dark:from-ink-950/60 dark:to-ink-950/60 sm:p-5">
            <InvoicePreview invoice={invoice} client={client} />
          </div>

          <Card className="rounded-2xl border-ink-100">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-300"><HandCoins size={16} aria-hidden="true" /></span>Payment history</CardTitle>
              <span className="text-xs text-ink-500">{invoicePayments.length} payment{invoicePayments.length === 1 ? '' : 's'}</span>
            </CardHeader>
            <CardBody>
              {invoicePayments.length === 0 ? (
                <EmptyState icon={HandCoins} title="No payments recorded" description="Payments received against this invoice will appear here." className="py-8" />
              ) : (
                <ul className="space-y-2.5">
                  {invoicePayments.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-xl border border-ink-100 p-3.5 transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/40">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{p.number}</p>
                        <p className="truncate text-xs text-ink-500">{p.method} · {formatDate(p.date)}{p.reference && ` · ${p.reference}`}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="mb-1 text-sm font-bold tabular-nums text-ink-800 dark:text-ink-100">{formatCurrency(p.amount)}</p>
                        <Badge tone={PAYMENT_TONE[p.status] || 'neutral'} dot>{p.status[0].toUpperCase() + p.status.slice(1)}</Badge>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card className="rounded-2xl border-ink-100">
            <CardHeader><CardTitle className="text-base sm:text-lg">Summary</CardTitle></CardHeader>
            <CardBody>
              <dl className="space-y-3 text-sm">
                <SummaryRow label="Client" value={client ? <Link to={`/admin/crm/clients/${client.id}`} className="font-medium text-brand-600 hover:underline dark:text-brand-400">{invoice.client}</Link> : invoice.client} />
                <SummaryRow label="Invoice total" value={formatCurrency(invoice.amount)} />
                <SummaryRow label="Amount paid" value={formatCurrency(invoice.paid)} tone="text-success-600 dark:text-success-400" />
                <div className="flex items-center justify-between gap-3 rounded-xl bg-gradient-to-r from-accent-50 to-brand-50 px-3 py-2.5 dark:from-accent-500/10 dark:to-brand-500/10">
                  <dt className="font-semibold text-ink-800 dark:text-ink-100">Balance due</dt>
                  <dd className="text-lg font-bold tabular-nums text-accent-600 dark:text-accent-300">{formatCurrency(invoice.balance)}</dd>
                </div>
                <SummaryRow label="Due date" value={formatDate(invoice.dueDate)} />
                {invoice.sourceQuotation && <SummaryRow label="From quotation" value={invoice.sourceQuotation} />}
              </dl>
            </CardBody>
          </Card>

          <Card className="rounded-2xl border-ink-100">
            <CardHeader><CardTitle className="flex items-center gap-2 text-base sm:text-lg"><span className="flex h-8 w-8 items-center justify-center rounded-lg bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300"><History size={16} aria-hidden="true" /></span>Activity</CardTitle></CardHeader>
            <CardBody>
              {activity.length === 0 ? (
                <EmptyState title="No activity yet" description="Actions on this invoice will be logged here." className="py-6" />
              ) : (
                <ActivityTimeline items={activity.map((a) => ({ ...a, time: <>{new Date(a.time).getTime() ? formatDateTimeShort(a.time) : ''}</> }))} />
              )}
            </CardBody>
          </Card>
        </div>
      </div>

      <RecordPaymentModal isOpen={payOpen} onClose={() => setPayOpen(false)} onSubmit={handleRecordPayment} invoice={invoice} />
      <ConfirmDialog
        isOpen={paidConfirm}
        onClose={() => setPaidConfirm(false)}
        onConfirm={handleMarkPaid}
        isLoading={busy === 'paid'}
        danger={false}
        title="Mark invoice as paid?"
        description={`A payment of ${formatCurrency(invoice.balance)} will be recorded against ${invoice.number} and the invoice will be closed.`}
        confirmLabel="Mark as Paid"
      />
      <CancelModal isOpen={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={handleCancel} loading={busy === 'cancel'} number={invoice.number} />
      {portal}
    </div>
  )
}

function formatDateTimeShort(value) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function SummaryRow({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-ink-500">{label}</dt>
      <dd className={`min-w-0 break-words text-right font-medium tabular-nums text-ink-800 dark:text-ink-100 ${tone || ''}`}>{value}</dd>
    </div>
  )
}

function CancelModal({ isOpen, onClose, onConfirm, loading, number }) {
  const [reason, setReason] = useState('')
  useResetOnChange([isOpen], () => setReason(''))
  return (
    <Modal
      isOpen={isOpen}
      onClose={loading ? undefined : onClose}
      title={`Cancel ${number}`}
      description="The balance will be written off and the client will no longer be asked to pay."
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={loading}>Keep Invoice</Button>
          <Button variant="danger" onClick={() => onConfirm(reason.trim())} isLoading={loading}>Cancel Invoice</Button>
        </>
      }
    >
      <Textarea label="Reason (optional)" rows={3} placeholder="e.g. Scope merged into the retainer invoice" value={reason} onChange={(e) => setReason(e.target.value)} />
    </Modal>
  )
}
