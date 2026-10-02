import { formatCurrency } from './format'

export function formatValue(kind, value, { compact = false } = {}) {
  const n = Number(value) || 0
  switch (kind) {
    case 'currency':
      return formatCurrency(n, { compact })
    case 'percent':
      return `${Math.round(n * 10) / 10}%`
    case 'hours':
      return `${Math.round(n * 10) / 10}h`
    default:
      return n.toLocaleString('en-IN')
  }
}
