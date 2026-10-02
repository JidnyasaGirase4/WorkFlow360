import { useState } from 'react'
import { CheckCircle2, ShieldAlert, Lock, ShieldCheck } from 'lucide-react'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import Input from '../../components/common/Input'
import Select from '../../components/common/Select'
import { RadioGroup } from '../../components/common/Radio'
import { useResetOnChange } from '../../hooks/useResetOnChange'
import { TODAY } from '../../mockData/reference'
import { PAYMENT_METHODS, NETBANKING_BANKS } from '../../mockData/clientPortal'
import { formatCurrency } from '../../utils/format'

const EMPTY = { method: 'upi', upiId: '', cardNumber: '', cardName: '', expiry: '', cvv: '', bank: '' }
const CURRENT_YEAR_MONTH = Number(TODAY.slice(0, 4)) * 100 + Number(TODAY.slice(5, 7))
const METHOD_LABEL = { upi: 'UPI', card: 'Card', netbanking: 'Net Banking' }

function validate(form) {
  const errors = {}
  if (form.method === 'upi') {
    if (!form.upiId.trim()) errors.upiId = 'Enter your UPI ID.'
    else if (!/^[\w.-]{2,}@[a-zA-Z]{2,}$/.test(form.upiId.trim())) errors.upiId = 'Enter a valid UPI ID, e.g. name@okhdfcbank.'
  }
  if (form.method === 'card') {
    const digits = form.cardNumber.replace(/\s/g, '')
    if (!digits) errors.cardNumber = 'Enter the card number.'
    else if (!/^\d{13,19}$/.test(digits)) errors.cardNumber = 'Card number must be 13 to 19 digits.'
    if (!form.cardName.trim()) errors.cardName = 'Enter the name on the card.'
    const match = /^(0[1-9]|1[0-2])\/(\d{2})$/.exec(form.expiry.trim())
    if (!form.expiry.trim()) errors.expiry = 'Enter the expiry date.'
    else if (!match) errors.expiry = 'Use MM/YY format.'
    else if (Number(`20${match[2]}`) * 100 + Number(match[1]) < CURRENT_YEAR_MONTH) errors.expiry = 'This card has expired.'
    if (!form.cvv) errors.cvv = 'Enter the CVV.'
    else if (!/^\d{3,4}$/.test(form.cvv)) errors.cvv = 'CVV must be 3 or 4 digits.'
  }
  if (form.method === 'netbanking' && !form.bank) errors.bank = 'Select your bank.'
  return errors
}

// Mock checkout: clearly labelled demo, validates the chosen method's fields,
// simulates processing, then calls onPaid(method, reference). No real payment.
export default function PaymentModal({ invoice, isOpen, onClose, onPaid }) {
  const [form, setForm] = useState(EMPTY)
  const [errors, setErrors] = useState({})
  const [step, setStep] = useState('form')
  const [receipt, setReceipt] = useState(null)

  useResetOnChange([isOpen], () => {
    if (!isOpen) {
      setForm(EMPTY)
      setErrors({})
      setStep('form')
      setReceipt(null)
    }
  })

  if (!invoice) return null

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }))
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }))
  }

  function handlePay() {
    const next = validate(form)
    setErrors(next)
    if (Object.keys(next).length > 0) return
    setStep('processing')
    setTimeout(() => {
      const reference = `DEMO-${form.method.toUpperCase()}-${Date.now().toString().slice(-8)}`
      const label = METHOD_LABEL[form.method]
      const amount = invoice.balance
      onPaid(invoice, label, reference)
      setReceipt({ reference, label, amount })
      setStep('success')
    }, 1400)
  }

  const processing = step === 'processing'

  return (
    <Modal
      isOpen={isOpen}
      onClose={processing ? undefined : onClose}
      title={step === 'success' ? 'Payment successful' : `Pay ${invoice.number}`}
      description={step === 'success' ? undefined : 'Choose a payment method'}
      footer={
        step === 'success' ? (
          <Button onClick={onClose}>Done</Button>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose} disabled={processing}>
              Cancel
            </Button>
            <Button onClick={handlePay} isLoading={processing} leftIcon={<Lock size={15} />}>
              Pay {formatCurrency(invoice.balance)} (Demo)
            </Button>
          </>
        )
      }
    >
      {step === 'success' && receipt ? (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="relative flex h-20 w-20 animate-scale-in items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-success-100 dark:bg-success-500/15" aria-hidden="true" />
            <span className="absolute inset-2.5 rounded-full bg-success-200/70 dark:bg-success-500/20" aria-hidden="true" />
            <span className="relative flex h-12 w-12 items-center justify-center rounded-full bg-success-500 text-white shadow-lg">
              <CheckCircle2 size={28} />
            </span>
          </span>
          <p className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white">{formatCurrency(receipt.amount)} received</p>
          <div className="w-full max-w-sm rounded-xl border border-dashed border-ink-200 bg-ink-50 px-4 py-3 text-left text-sm dark:border-ink-700 dark:bg-ink-800/40">
            <p className="text-ink-600 dark:text-ink-300">
              Demo payment for {invoice.number} via {receipt.label}. Reference <span className="font-mono font-semibold text-ink-800 dark:text-ink-100">{receipt.reference}</span>.
            </p>
          </div>
          <p className="text-xs text-ink-500">No real money was charged. This is a UI demonstration.</p>
        </div>
      ) : (
        <div className="space-y-5">
          <div role="note" className="flex items-start gap-2.5 rounded-xl border border-warning-200 bg-warning-50 px-3.5 py-3 text-sm text-warning-700 dark:border-warning-500/30 dark:bg-warning-500/10 dark:text-warning-200">
            <ShieldAlert size={17} className="mt-0.5 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-semibold">Demo checkout.</span> No real payment is processed and no card or bank details leave your browser. Do not enter real credentials.
            </p>
          </div>

          <div className="gradient-soft relative flex items-center justify-between gap-3 overflow-hidden rounded-2xl border border-brand-100 px-4 py-4 dark:border-ink-700">
            <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 rounded-full bg-brand-200/50 blur-2xl dark:bg-brand-500/10" aria-hidden="true" />
            <div className="relative min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-500">Amount due</p>
              <p className="truncate text-2xl font-bold tabular-nums tracking-tight text-ink-900 dark:text-white">{formatCurrency(invoice.balance)}</p>
            </div>
            <p className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-ink-800/80 dark:text-brand-300 dark:ring-ink-700">
              <ShieldCheck size={13} aria-hidden="true" /> {invoice.number}
            </p>
          </div>

          <RadioGroup label="Payment method" value={form.method} onChange={(v) => update('method', v)} options={PAYMENT_METHODS} />

          {form.method === 'upi' && (
            <Input label="UPI ID" required placeholder="name@okhdfcbank" value={form.upiId} onChange={(e) => update('upiId', e.target.value)} error={errors.upiId} autoComplete="off" />
          )}
          {form.method === 'card' && (
            <div className="space-y-4">
              <Input label="Card number" required inputMode="numeric" placeholder="4111 1111 1111 1111" value={form.cardNumber} onChange={(e) => update('cardNumber', e.target.value.replace(/[^\d\s]/g, ''))} error={errors.cardNumber} autoComplete="off" />
              <Input label="Name on card" required value={form.cardName} onChange={(e) => update('cardName', e.target.value)} error={errors.cardName} autoComplete="off" />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Expiry" required placeholder="MM/YY" value={form.expiry} onChange={(e) => update('expiry', e.target.value)} error={errors.expiry} autoComplete="off" />
                <Input label="CVV" required type="password" inputMode="numeric" maxLength={4} value={form.cvv} onChange={(e) => update('cvv', e.target.value.replace(/\D/g, ''))} error={errors.cvv} autoComplete="off" />
              </div>
            </div>
          )}
          {form.method === 'netbanking' && (
            <Select label="Select your bank" required placeholder="Choose a bank" options={NETBANKING_BANKS.map((b) => ({ value: b, label: b }))} value={form.bank} onChange={(e) => update('bank', e.target.value)} error={errors.bank} />
          )}
        </div>
      )}
    </Modal>
  )
}
