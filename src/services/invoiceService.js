import { invoices } from '../mockData/invoices'
import { TODAY } from '../mockData/reference'
import { createMockService } from './createMockService'
import { paymentService, nextPaymentNumber } from './paymentService'
import { formatCurrency } from '../utils/format'

const base = createMockService(invoices, 'id')

function wait(ms = 350) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function entry(text, tone, actor = 'Jidnyasa Girase') {
  return { id: `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, actor, text, time: new Date().toISOString(), tone }
}

function findInvoice(id) {
  const invoice = base.getSnapshot().find((i) => i.id === id)
  if (!invoice) {
    const error = new Error('Not found')
    error.code = 'NOT_FOUND'
    throw error
  }
  return invoice
}

// Invoice service: CRUD from the mock factory plus the billing workflow
// (send, record payment, mark paid, cancel) so pages never duplicate the rules.
export const invoiceService = {
  ...base,

  nextNumber() {
    const year = TODAY.slice(0, 4)
    const max = base.getSnapshot().reduce((m, i) => Math.max(m, Number(/INV-\d{4}-(\d+)/.exec(i.number)?.[1]) || 0), 0)
    return `INV-${year}-${String(max + 1).padStart(5, '0')}`
  },

  async create(payload) {
    const invoice = {
      paid: 0,
      balance: payload.amount,
      activity: [entry('created the invoice as a draft', 'neutral')],
      ...payload,
    }
    return base.create(invoice)
  },

  async send(id) {
    const invoice = findInvoice(id)
    return base.update(id, {
      status: 'sent',
      activity: [...(invoice.activity || []), entry(`sent the invoice to ${invoice.client}`, 'info')],
    })
  },

  async cancel(id, reason) {
    const invoice = findInvoice(id)
    const text = reason ? `cancelled the invoice: ${reason}` : 'cancelled the invoice'
    return base.update(id, {
      status: 'cancelled',
      balance: 0,
      activity: [...(invoice.activity || []), entry(text, 'danger')],
    })
  },

  async recordPayment(id, { amount, date, method, reference }) {
    await wait(200)
    const invoice = findInvoice(id)
    const value = Number(amount)
    const paid = invoice.paid + value
    const balance = Math.max(0, invoice.amount - paid)
    const status = balance === 0 ? 'paid' : 'partially_paid'
    const number = nextPaymentNumber()
    const payment = await paymentService.create({
      id: `pay-${Date.now()}`,
      number,
      invoice: invoice.number,
      client: invoice.client,
      amount: value,
      date,
      method,
      status: 'completed',
      reference: reference || '',
    })
    const activity = [
      ...(invoice.activity || []),
      entry(`recorded payment ${number} of ${formatCurrency(value)} via ${method}`, 'success'),
    ]
    if (status === 'paid') activity.push(entry('marked the invoice as paid', 'success', 'System'))
    const updated = await base.update(id, { paid, balance, status, activity })
    return { invoice: updated, payment }
  },

  async markPaid(id) {
    const invoice = findInvoice(id)
    return invoiceService.recordPayment(id, {
      amount: invoice.balance || invoice.amount - invoice.paid,
      date: TODAY,
      method: 'Bank Transfer',
      reference: 'Marked as paid by admin',
    })
  },
}
