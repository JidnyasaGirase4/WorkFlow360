import { payments, expenses } from '../mockData/payments'
import { createMockService } from './createMockService'

export const paymentService = createMockService(payments, 'id')
export const expenseService = createMockService(expenses, 'id')

export function nextPaymentNumber() {
  const max = paymentService
    .getSnapshot()
    .reduce((m, p) => Math.max(m, Number(/PAY-(\d+)/.exec(p.number)?.[1]) || 0), 1000)
  return `PAY-${max + 1}`
}
