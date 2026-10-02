import { Mail, Phone, MapPin } from 'lucide-react'
import { COMPANY } from '../../mockData/company'
import { formatCurrency, formatDate } from '../../utils/format'
import { amountInWords, computeTotals, isValidItem, lineTotal } from '../../utils/invoiceMath'
import { cn } from '../../utils/cn'

const STATUS_PILL = {
  draft: 'Draft',
  sent: 'Sent',
  partially_paid: 'Partially Paid',
  paid: 'Paid',
  overdue: 'Overdue',
  cancelled: 'Cancelled',
}

const WATERMARK = {
  paid: { text: 'PAID', color: 'text-success-500/15' },
  cancelled: { text: 'CANCELLED', color: 'text-danger-500/15' },
}

// Paper-style invoice. Always renders on a white sheet (even in dark mode) so
// what you see is what prints / saves as PDF.
export default function InvoicePreview({ invoice, client, className, flat = false }) {
  const items = (invoice.items || []).filter((i) => isValidItem(i))
  const totals = computeTotals(items, invoice.taxPercent, invoice.discount)
  const paid = Number(invoice.paid) || 0
  const balance = invoice.status === 'cancelled' ? 0 : Math.max(0, totals.total - paid)
  const watermark = WATERMARK[invoice.status]

  return (
    <article
      aria-label={`Invoice preview ${invoice.number || ''}`}
      className={cn(
        'relative mx-auto w-full max-w-[860px] overflow-hidden bg-white text-[13px] leading-relaxed text-ink-800 [-webkit-print-color-adjust:exact] [print-color-adjust:exact]',
        !flat && 'rounded-2xl shadow-panel ring-1 ring-ink-200',
        className
      )}
    >
      {watermark && (
        <span
          aria-hidden="true"
          className={cn('pointer-events-none absolute left-1/2 top-1/2 z-0 -translate-x-1/2 -translate-y-1/2 -rotate-[24deg] select-none text-[5rem] font-black tracking-widest sm:text-[7rem]', watermark.color)}
        >
          {watermark.text}
        </span>
      )}

      <div aria-hidden="true" className="relative z-10 h-2 bg-gradient-to-r from-brand-400 via-brand-600 to-accent-400" />
      <header className="relative z-10 flex flex-wrap items-start justify-between gap-4 bg-gradient-to-br from-brand-50 via-white to-white px-5 py-5 sm:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-700 text-lg font-extrabold text-white">T</span>
          <div className="min-w-0">
            <p className="text-base font-bold leading-tight text-ink-900">{COMPANY.name}</p>
            <p className="text-[11px] text-ink-500">GSTIN {COMPANY.gstin}</p>
          </div>
        </div>
        <div className="text-left sm:text-right">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-600">Tax Invoice</p>
          <p className="text-xl font-bold leading-tight text-ink-900">{invoice.number || 'INV-—'}</p>
          {invoice.status && (
            <span className="mt-1 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-[11px] font-semibold text-brand-700">{STATUS_PILL[invoice.status] || invoice.status}</span>
          )}
        </div>
      </header>

      <div className="relative z-10 space-y-6 px-5 py-6 sm:px-8">
        <dl className="grid grid-cols-2 gap-3 rounded-xl border border-ink-100 bg-ink-50 p-4 sm:grid-cols-4">
          <Meta label="Issue date" value={formatDate(invoice.issueDate)} />
          <Meta label="Due date" value={formatDate(invoice.dueDate)} />
          <Meta label="Payment terms" value={invoice.paymentTerms || '—'} />
          <Meta label="Balance due" value={formatCurrency(balance)} strong />
        </dl>

        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Billed by</p>
            <p className="font-semibold text-ink-900">{COMPANY.name}</p>
            <div className="mt-1 space-y-0.5 text-ink-500">
              {COMPANY.address.map((line) => (
                <p key={line}>{line}</p>
              ))}
              <p>PAN {COMPANY.pan}</p>
              <p className="flex items-center gap-1.5"><Mail size={12} /> {COMPANY.email}</p>
              <p className="flex items-center gap-1.5"><Phone size={12} /> {COMPANY.phone}</p>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Bill to</p>
            {invoice.client ? (
              <>
                <p className="font-semibold text-ink-900">{invoice.client}</p>
                {client ? (
                  <div className="mt-1 space-y-0.5 text-ink-500">
                    <p>Attn: {client.contactPerson}</p>
                    <p className="flex items-center gap-1.5 break-all"><Mail size={12} className="shrink-0" /> {client.email}</p>
                    <p className="flex items-center gap-1.5"><Phone size={12} className="shrink-0" /> {client.phone}</p>
                    <p className="flex items-center gap-1.5"><MapPin size={12} className="shrink-0" /> {client.city}, India</p>
                  </div>
                ) : (
                  <p className="mt-1 text-ink-400">Client contact details not on file</p>
                )}
              </>
            ) : (
              <p className="text-ink-400">Select a client to see billing details</p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto rounded-xl border border-ink-200">
          <table className="w-full min-w-[420px] border-collapse text-left">
            <thead>
              <tr className="bg-brand-50 text-[11px] font-semibold uppercase tracking-wider text-brand-700">
                <th className="w-8 px-3 py-2.5">#</th>
                <th className="px-3 py-2.5">Description</th>
                <th className="w-14 px-3 py-2.5 text-right">Qty</th>
                <th className="w-24 px-3 py-2.5 text-right">Rate</th>
                <th className="w-28 px-3 py-2.5 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-ink-400">Line items you add will appear here.</td>
                </tr>
              ) : (
                items.map((item, idx) => (
                  <tr key={item.uid || idx} className="border-t border-ink-100">
                    <td className="px-3 py-2.5 text-ink-400">{idx + 1}</td>
                    <td className="px-3 py-2.5 font-medium text-ink-800">{item.description}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{item.qty}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums">{formatCurrency(item.price)}</td>
                    <td className="px-3 py-2.5 text-right font-semibold tabular-nums">{formatCurrency(lineTotal(item))}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-[1fr_16rem]">
          <div className="space-y-4">
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Amount in words</p>
              <p className="font-medium text-ink-700">{amountInWords(totals.total)}</p>
            </div>
            {invoice.notes && (
              <div>
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Notes</p>
                <p className="whitespace-pre-line text-ink-600">{invoice.notes}</p>
              </div>
            )}
          </div>
          <dl className="space-y-1.5 self-start rounded-xl border border-brand-100 bg-brand-50/50 p-4 tabular-nums">
            <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
            <Row label={`GST (${Number(invoice.taxPercent) || 0}%)`} value={formatCurrency(totals.taxAmount)} />
            {totals.discount > 0 && <Row label="Discount" value={`- ${formatCurrency(totals.discount)}`} />}
            <div className="flex items-center justify-between gap-2 rounded-lg bg-brand-600 px-3 py-2 text-base text-white">
              <dt className="font-bold">Total</dt>
              <dd className="font-extrabold">{formatCurrency(totals.total)}</dd>
            </div>
            {paid > 0 && <Row label="Amount paid" value={`- ${formatCurrency(paid)}`} tone="text-success-600" />}
            {paid > 0 && <Row label="Balance due" value={formatCurrency(balance)} tone="font-semibold text-danger-600" />}
          </dl>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t border-ink-100 pt-5 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Bank details</p>
            <p className="text-ink-600">{COMPANY.bank.name}</p>
            <p className="text-ink-600">A/c {COMPANY.bank.account} · IFSC {COMPANY.bank.ifsc}</p>
            <p className="text-ink-600">UPI {COMPANY.bank.upi}</p>
          </div>
          <div className="sm:text-right">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">Terms</p>
            <p className="text-ink-600">Payment due within the stated terms. Late payments may attract interest at 1.5% per month.</p>
          </div>
        </div>

        <p className="border-t border-ink-100 pt-4 text-center text-[11px] text-ink-400">
          Thank you for your business. This is a computer generated invoice and does not require a signature.
        </p>
      </div>
    </article>
  )
}

function Meta({ label, value, strong }) {
  return (
    <div>
      <dt className="text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</dt>
      <dd className={cn('mt-0.5 font-semibold text-ink-800', strong && 'text-accent-600')}>{value}</dd>
    </div>
  )
}

function Row({ label, value, tone }) {
  return (
    <div className="flex items-center justify-between text-ink-500">
      <dt>{label}</dt>
      <dd className={cn('font-medium text-ink-700', tone)}>{value}</dd>
    </div>
  )
}
