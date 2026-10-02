import { useState } from 'react'
import Modal from '../common/Modal'
import Input from '../common/Input'
import Select from '../common/Select'
import Button from '../common/Button'
import { TODAY } from '../../mockData/reference'
import { formatCurrency } from '../../utils/format'
import { PAYMENT_METHODS } from '../../utils/invoiceMath'
import { useResetOnChange } from '../../hooks/useResetOnChange'

const EMPTY = { invoiceId: '', amount: '', date: TODAY, method: 'Bank Transfer', reference: '' }

// Records a payment against an invoice. Pass `invoice` to lock the invoice
// (invoice details page) or `invoices` (payable ones) to let the user choose.
export default function RecordPaymentModal({ isOpen, onClose, onSubmit, invoice, invoices = [] }) {
  const [values, setValues] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [saving, setSaving] = useState(false)

  useResetOnChange([isOpen, invoice?.id], () => {
    if (isOpen) {
      setValues({ ...EMPTY, invoiceId: invoice?.id || '', amount: invoice ? String(invoice.balance) : '' })
      setErrors({})
      setSaving(false)
    }
  })

  const selected = invoice || invoices.find((i) => i.id === values.invoiceId) || null

  function set(field) {
    return (e) => {
      const value = e.target.value
      setValues((v) => ({ ...v, [field]: value }))
      setErrors((prev) => ({ ...prev, [field]: undefined }))
    }
  }

  function pickInvoice(e) {
    const id = e.target.value
    const next = invoices.find((i) => i.id === id)
    setValues((v) => ({ ...v, invoiceId: id, amount: next ? String(next.balance) : v.amount }))
    setErrors((prev) => ({ ...prev, invoiceId: undefined, amount: undefined }))
  }

  function validate() {
    const next = {}
    const amount = Number(values.amount)
    if (!selected) next.invoiceId = 'Select the invoice this payment is for'
    if (!values.amount || Number.isNaN(amount) || amount <= 0) next.amount = 'Enter an amount greater than zero'
    else if (selected && amount > selected.balance) next.amount = `Amount cannot exceed the balance due of ${formatCurrency(selected.balance)}`
    if (!values.date) next.date = 'Payment date is required'
    else if (values.date > TODAY) next.date = 'Payment date cannot be in the future'
    return next
  }

  async function submit(e) {
    e?.preventDefault()
    if (saving) return
    const found = validate()
    setErrors(found)
    if (Object.keys(found).length > 0) return
    setSaving(true)
    try {
      await onSubmit({ ...values, invoiceId: selected.id, amount: Number(values.amount) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={saving ? undefined : onClose}
      title="Record Payment"
      description={selected ? `${selected.number} · ${selected.client}` : 'Log a payment received against an invoice'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={submit} isLoading={saving}>Record Payment</Button>
        </>
      }
    >
      <form onSubmit={submit} className="grid grid-cols-1 gap-4 sm:grid-cols-2" noValidate>
        {!invoice && (
          <div className="sm:col-span-2">
            <Select
              label="Invoice"
              required
              placeholder="Select invoice"
              options={invoices.map((inv) => ({ value: inv.id, label: `${inv.number} — ${inv.client} (${formatCurrency(inv.balance)} due)` }))}
              value={values.invoiceId}
              error={errors.invoiceId}
              onChange={pickInvoice}
              hint={invoices.length === 0 ? 'No invoices with an outstanding balance' : undefined}
            />
          </div>
        )}
        {selected && (
          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 to-accent-50/40 p-3 text-center dark:border-ink-800 dark:from-brand-500/10 dark:to-accent-500/5 sm:col-span-2 sm:gap-3">
            <Fact label="Invoice total" value={formatCurrency(selected.amount)} />
            <Fact label="Paid so far" value={formatCurrency(selected.paid)} />
            <Fact label="Balance due" value={formatCurrency(selected.balance)} strong />
          </div>
        )}
        <div>
          <Input label="Amount (₹)" type="number" min="1" max={selected?.balance} step="any" required value={values.amount} error={errors.amount} onChange={set('amount')} />
          {selected && (
            <button type="button" onClick={() => setValues((v) => ({ ...v, amount: String(selected.balance) }))} className="focus-ring mt-1.5 inline-flex min-h-8 items-center rounded-full bg-brand-50 px-3 text-xs font-semibold text-brand-700 transition-colors hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300">
              Pay full balance
            </button>
          )}
        </div>
        <Input label="Payment date" type="date" required max={TODAY} value={values.date} error={errors.date} onChange={set('date')} />
        <Select label="Payment method" options={PAYMENT_METHODS.map((m) => ({ value: m, label: m }))} value={values.method} onChange={set('method')} />
        <Input label="Reference / transaction ID" placeholder="e.g. UTR 2609260457" value={values.reference} onChange={set('reference')} />
        <button type="submit" className="hidden" aria-hidden="true" tabIndex={-1} />
      </form>
    </Modal>
  )
}

function Fact({ label, value, strong }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-ink-500">{label}</p>
      <p className={strong ? 'truncate text-sm font-bold tabular-nums text-accent-600 dark:text-accent-300' : 'truncate text-sm font-semibold tabular-nums text-ink-800 dark:text-ink-100'}>{value}</p>
    </div>
  )
}
