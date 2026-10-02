import { useMemo, useState } from 'react'
import { Download, Receipt, Send } from 'lucide-react'
import WideDialog from './WideDialog'
import LineItemsEditor from './LineItemsEditor'
import InvoicePreview from './InvoicePreview'
import Input from '../common/Input'
import Select from '../common/Select'
import Textarea from '../common/Textarea'
import Button from '../common/Button'
import { clients } from '../../mockData/clients'
import { TODAY, addDays } from '../../mockData/reference'
import { invoiceService } from '../../services/invoiceService'
import { usePrintInvoice } from '../../hooks/usePrintInvoice'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { useToast } from '../../context/ToastContext'
import { formatCurrency } from '../../utils/format'
import { computeTotals, isValidItem, newLineItem, PAYMENT_TERMS, termsToDays } from '../../utils/invoiceMath'
import { cn } from '../../utils/cn'

const DEFAULT_NOTES = 'Please quote the invoice number in your payment remarks. Thank you for your business.'

function emptyValues() {
  return {
    clientId: '',
    number: invoiceService.nextNumber(),
    issueDate: TODAY,
    dueDate: addDays(TODAY, 15),
    paymentTerms: 'Net 15',
    notes: DEFAULT_NOTES,
    taxPercent: 18,
    discount: 0,
  }
}

export default function InvoiceFormModal({ isOpen, onClose, onSubmit, isSaving }) {
  const { toast } = useToast()
  const [values, setValues] = useState(emptyValues)
  const [items, setItems] = useState(() => [newLineItem()])
  const [errors, setErrors] = useState({})
  const [pane, setPane] = useState('form')
  const { print, portal } = usePrintInvoice()

  useResetOnChange([isOpen], () => {
    if (isOpen) {
      setValues(emptyValues())
      setItems([newLineItem()])
      setErrors({})
      setPane('form')
    }
  })

  const client = useMemo(() => clients.find((c) => c.id === values.clientId) || null, [values.clientId])
  const totals = useMemo(() => computeTotals(items, values.taxPercent, values.discount), [items, values.taxPercent, values.discount])

  const previewInvoice = {
    number: values.number,
    client: client?.company || '',
    issueDate: values.issueDate,
    dueDate: values.dueDate,
    paymentTerms: values.paymentTerms,
    notes: values.notes,
    taxPercent: values.taxPercent,
    discount: values.discount,
    items,
    status: 'draft',
    paid: 0,
  }

  function set(field) {
    return (e) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function setIssueDate(e) {
    const issueDate = e.target.value
    setValues((v) => ({ ...v, issueDate, dueDate: issueDate ? addDays(issueDate, termsToDays(v.paymentTerms)) : v.dueDate }))
    setErrors((prev) => ({ ...prev, issueDate: undefined, dueDate: undefined }))
  }

  function setTerms(e) {
    const paymentTerms = e.target.value
    setValues((v) => ({ ...v, paymentTerms, dueDate: v.issueDate ? addDays(v.issueDate, termsToDays(paymentTerms)) : v.dueDate }))
    setErrors((prev) => ({ ...prev, dueDate: undefined }))
  }

  function validate() {
    const next = {}
    if (!values.clientId) next.clientId = 'Select a client to bill'
    if (!values.issueDate) next.issueDate = 'Issue date is required'
    if (!values.dueDate) next.dueDate = 'Due date is required'
    else if (values.issueDate && values.dueDate < values.issueDate) next.dueDate = 'Due date cannot be before the issue date'
    if (!items.some(isValidItem)) next.items = 'Add at least one line item with a description, quantity and price greater than zero'
    else if (items.some((i) => (i.description.trim() || Number(i.price) > 0) && !isValidItem(i))) next.items = 'Complete or remove the partially filled line items'
    const tax = Number(values.taxPercent)
    if (Number.isNaN(tax) || tax < 0 || tax > 100) next.taxPercent = 'Tax must be between 0 and 100'
    const discount = Number(values.discount)
    if (Number.isNaN(discount) || discount < 0) next.discount = 'Discount cannot be negative'
    else if (discount > totals.subtotal + totals.taxAmount) next.discount = 'Discount cannot exceed the invoice amount'
    return next
  }

  function submit(send) {
    if (isSaving) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) {
      setPane('form')
      toast.error('Please fix the highlighted fields')
      return
    }
    const validItems = items.filter(isValidItem).map((i) => ({ description: i.description.trim(), qty: Number(i.qty), price: Number(i.price) }))
    onSubmit(
      {
        id: `inv-${Date.now()}`,
        number: values.number,
        client: client.company,
        clientId: client.id,
        issueDate: values.issueDate,
        dueDate: values.dueDate,
        paymentTerms: values.paymentTerms,
        notes: values.notes.trim(),
        taxPercent: Number(values.taxPercent) || 0,
        discount: Number(values.discount) || 0,
        amount: totals.total,
        paid: 0,
        balance: totals.total,
        status: send ? 'sent' : 'draft',
        items: validItems,
      },
      { send }
    )
  }

  function downloadPdf() {
    print({ invoice: previewInvoice, client })
    toast.info('Choose "Save as PDF" in the print dialog to download the invoice')
  }

  return (
    <WideDialog
      isOpen={isOpen}
      onClose={isSaving ? undefined : onClose}
      title="Create Invoice"
      description="Fill in the details on the left — the invoice updates live on the right."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>Cancel</Button>
          <Button variant="secondary" onClick={() => submit(false)} disabled={isSaving}>Save as Draft</Button>
          <Button leftIcon={<Send size={15} />} onClick={() => submit(true)} isLoading={isSaving}>Create &amp; Send</Button>
        </>
      }
    >
      <div role="tablist" aria-label="Invoice editor sections" className="flex border-b border-ink-100 dark:border-ink-800 lg:hidden">
        {[
          ['form', 'Details'],
          ['preview', 'Live preview'],
        ].map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={pane === value}
            onClick={() => setPane(value)}
            className={cn(
              'focus-ring flex-1 py-3 text-sm font-semibold transition-colors',
              pane === value ? 'border-b-2 border-brand-600 bg-brand-50/60 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300' : 'text-ink-500'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 grid-rows-[minmax(0,1fr)] lg:grid-cols-2">
        <form
          onSubmit={(e) => { e.preventDefault(); submit(false) }}
          noValidate
          className={cn('min-h-0 space-y-5 overflow-y-auto px-4 py-5 sm:px-6', pane === 'form' ? 'block' : 'hidden', 'lg:block')}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select
              label="Client"
              required
              placeholder="Select client"
              options={clients.map((c) => ({ value: c.id, label: c.company }))}
              value={values.clientId}
              error={errors.clientId}
              onChange={set('clientId')}
            />
            <Input label="Invoice number" readOnly value={values.number} hint="Auto-generated" />
            <Input label="Issue date" type="date" required value={values.issueDate} error={errors.issueDate} onChange={setIssueDate} />
            <Select label="Payment terms" options={PAYMENT_TERMS.map((t) => ({ value: t, label: t }))} value={values.paymentTerms} onChange={setTerms} />
            <Input label="Due date" type="date" required min={values.issueDate || undefined} value={values.dueDate} error={errors.dueDate} onChange={set('dueDate')} />
          </div>

          <LineItemsEditor items={items} onChange={(next) => { setItems(next); setErrors((p) => ({ ...p, items: undefined })) }} error={errors.items} />

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Input label="Tax / GST (%)" type="number" min="0" max="100" step="any" value={values.taxPercent} error={errors.taxPercent} hint="GST is typically 18% for IT services" onChange={set('taxPercent')} />
            <Input label="Discount (₹)" type="number" min="0" step="any" value={values.discount} error={errors.discount} onChange={set('discount')} />
          </div>

          <Textarea label="Notes" rows={3} placeholder="Payment instructions, thank-you note, etc." value={values.notes} onChange={set('notes')} />

          <div className="rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-accent-50/40 p-4 dark:border-ink-800 dark:from-brand-500/10 dark:to-accent-500/5" aria-live="polite">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-ink-800 dark:text-ink-100"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"><Receipt size={15} /></span>Summary</p>
            <dl className="space-y-1.5 text-sm">
              <SummaryRow label="Subtotal" value={formatCurrency(totals.subtotal)} />
              <SummaryRow label={`Tax (${Number(values.taxPercent) || 0}%)`} value={formatCurrency(totals.taxAmount)} />
              <SummaryRow label="Discount" value={`- ${formatCurrency(totals.discount)}`} />
              <div className="flex items-center justify-between border-t border-ink-200 pt-2 text-base dark:border-ink-700">
                <dt className="font-semibold text-ink-800 dark:text-ink-100">Total</dt>
                <dd className="text-lg font-bold tabular-nums text-brand-700 dark:text-brand-300">{formatCurrency(totals.total)}</dd>
              </div>
            </dl>
          </div>
        </form>

        <section
          aria-label="Live invoice preview"
          className={cn('min-h-0 flex-col overflow-y-auto bg-gradient-to-br from-ink-100/80 to-brand-50/60 px-3 py-5 dark:from-ink-950/60 dark:to-ink-950/60 sm:px-6', pane === 'preview' ? 'flex' : 'hidden', 'lg:flex')}
        >
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-500">Preview</p>
            <Button type="button" size="sm" variant="secondary" leftIcon={<Download size={14} />} onClick={downloadPdf}>
              Download PDF
            </Button>
          </div>
          <InvoicePreview invoice={previewInvoice} client={client} />
        </section>
      </div>
      {portal}
    </WideDialog>
  )
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex items-center justify-between text-ink-500">
      <dt>{label}</dt>
      <dd className="font-medium tabular-nums text-ink-700 dark:text-ink-200">{value}</dd>
    </div>
  )
}
