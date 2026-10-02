import { quotations } from '../mockData/payments'
import { TODAY, addDays } from '../mockData/reference'
import { createMockService } from './createMockService'
import { invoiceService } from './invoiceService'
import { computeTotals } from '../utils/invoiceMath'

const base = createMockService(quotations, 'id')

export const quotationService = {
  ...base,

  nextNumber() {
    const year = TODAY.slice(0, 4)
    const max = base.getSnapshot().reduce((m, q) => Math.max(m, Number(/QUO-\d{4}-(\d+)/.exec(q.number)?.[1]) || 0), 0)
    return `QUO-${year}-${String(max + 1).padStart(3, '0')}`
  },

  // Turns an accepted/sent quotation into a draft invoice and links the two.
  async convertToInvoice(id) {
    const quotation = base.getSnapshot().find((q) => q.id === id)
    if (!quotation) throw new Error('Quotation not found')
    const totals = computeTotals(quotation.items, quotation.taxPercent, 0)
    const invoice = await invoiceService.create({
      id: `inv-${Date.now()}`,
      number: invoiceService.nextNumber(),
      client: quotation.client,
      clientId: quotation.clientId || null,
      issueDate: TODAY,
      dueDate: addDays(TODAY, 15),
      amount: totals.total,
      balance: totals.total,
      paid: 0,
      status: 'draft',
      taxPercent: quotation.taxPercent || 0,
      discount: 0,
      paymentTerms: 'Net 15',
      notes: quotation.notes || '',
      items: quotation.items,
      sourceQuotation: quotation.number,
    })
    const updated = await base.update(id, { status: 'converted', invoiceId: invoice.id, invoiceNumber: invoice.number })
    return { quotation: updated, invoice }
  },
}
