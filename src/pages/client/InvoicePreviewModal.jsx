import { CreditCard, Download, FileText } from 'lucide-react'
import Modal from '../../components/common/Modal'
import Button from '../../components/common/Button'
import StatusBadge from '../../components/common/StatusBadge'
import { invoiceTotals, displayStatus } from '../../utils/invoiceDocument'
import { formatCurrency, formatDate } from '../../utils/format'

// On-screen invoice (bill-to, line items, GST, totals) styled like a sheet of
// paper, with Download / Pay Now.
export default function InvoicePreviewModal({ invoice, billTo, isOpen, onClose, onDownload, onPay }) {
  if (!invoice) return null
  const t = invoiceTotals(invoice)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      title={`Invoice ${invoice.number}`}
      description={`Issued ${formatDate(invoice.issueDate)} · Due ${formatDate(invoice.dueDate)}`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button variant="secondary" leftIcon={<Download size={15} />} onClick={() => onDownload(invoice)}>
            Download
          </Button>
          {invoice.balance > 0 && (
            <Button variant="accent" leftIcon={<CreditCard size={15} />} onClick={() => onPay(invoice)}>
              Pay Now
            </Button>
          )}
        </>
      }
    >
      <div className="-mx-1 rounded-2xl bg-ink-100/70 p-2.5 dark:bg-ink-950/50 sm:p-5">
        <article className="relative overflow-hidden rounded-xl border border-ink-200 bg-white shadow-panel dark:border-ink-700 dark:bg-ink-900">
          <div className="h-1.5 bg-gradient-to-r from-brand-500 via-brand-400 to-accent-500" aria-hidden="true" />
          <div className="space-y-5 p-4 sm:p-7">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <span className="gradient-brand flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-glow" aria-hidden="true">
                  <FileText size={20} />
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-semibold uppercase tracking-widest text-brand-600 dark:text-brand-300">From</p>
                  <p className="mt-0.5 text-sm font-semibold text-ink-800 dark:text-ink-100">TechNova Solutions</p>
                  <p className="text-xs text-ink-500">Baner Road, Pune, Maharashtra 411045</p>
                </div>
              </div>
              <div className="sm:text-right">
                <p className="text-xs font-semibold uppercase tracking-widest text-accent-600 dark:text-accent-300">Billed to</p>
                <p className="mt-0.5 text-sm font-semibold text-ink-800 dark:text-ink-100">{billTo}</p>
                <div className="mt-1.5 sm:flex sm:justify-end">
                  <StatusBadge status={displayStatus(invoice)} />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border border-ink-200 dark:border-ink-700">
              <table className="w-full min-w-[420px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-200 bg-brand-50/70 text-xs font-semibold uppercase tracking-wide text-brand-700 dark:border-ink-700 dark:bg-brand-500/10 dark:text-brand-300">
                    <th scope="col" className="px-3 py-2.5">Description</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Qty</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Rate</th>
                    <th scope="col" className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {invoice.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-dashed border-ink-200 last:border-0 dark:border-ink-700">
                      <td className="px-3 py-2.5 text-ink-700 dark:text-ink-200">{item.description}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-500">{item.qty}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-500">{formatCurrency(item.price)}</td>
                      <td className="px-3 py-2.5 text-right font-medium tabular-nums text-ink-700 dark:text-ink-200">{formatCurrency(item.qty * item.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <dl className="ml-auto w-full max-w-xs space-y-1.5 text-sm">
              <div className="flex justify-between text-ink-500">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatCurrency(t.subtotal)}</dd>
              </div>
              {invoice.taxPercent > 0 && (
                <div className="flex justify-between text-ink-500">
                  <dt>GST ({invoice.taxPercent}%)</dt>
                  <dd className="tabular-nums">{formatCurrency(t.taxAmount)}</dd>
                </div>
              )}
              {t.discount > 0 && (
                <div className="flex justify-between text-ink-500">
                  <dt>Discount</dt>
                  <dd className="tabular-nums">-{formatCurrency(t.discount)}</dd>
                </div>
              )}
              <div className="flex justify-between border-t border-ink-200 pt-2 text-base font-bold text-ink-800 dark:border-ink-700 dark:text-ink-100">
                <dt>Total</dt>
                <dd className="tabular-nums">{formatCurrency(t.total)}</dd>
              </div>
              <div className="flex justify-between text-success-600 dark:text-success-400">
                <dt>Paid</dt>
                <dd className="tabular-nums">{formatCurrency(invoice.paid)}</dd>
              </div>
              <div className="flex justify-between rounded-lg bg-danger-50 px-3 py-2 font-semibold text-danger-600 dark:bg-danger-500/10 dark:text-danger-400">
                <dt>Balance due</dt>
                <dd className="tabular-nums">{formatCurrency(invoice.balance)}</dd>
              </div>
            </dl>

            {invoice.notes && <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-xs text-ink-600 dark:bg-ink-800/40 dark:text-ink-300">{invoice.notes}</p>}
            <p className="border-t border-dashed border-ink-200 pt-3 text-xs text-ink-500 dark:border-ink-700">Payment terms: {invoice.paymentTerms || 'Net 15'}</p>
          </div>
        </article>
      </div>
    </Modal>
  )
}
