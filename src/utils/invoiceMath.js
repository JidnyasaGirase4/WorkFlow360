let counter = 0
export function newLineItem(overrides = {}) {
  counter += 1
  return { uid: `li-${Date.now()}-${counter}`, description: '', qty: 1, price: '', ...overrides }
}

export function lineTotal(item) {
  return (Number(item?.qty) || 0) * (Number(item?.price) || 0)
}

// Whole-rupee arithmetic keeps the preview, table and totals in agreement.
export function computeTotals(items = [], taxPercent = 0, discount = 0) {
  const subtotal = items.reduce((sum, item) => sum + lineTotal(item), 0)
  const taxAmount = Math.round(subtotal * ((Number(taxPercent) || 0) / 100))
  const discountAmount = Math.max(0, Number(discount) || 0)
  const total = Math.max(0, subtotal + taxAmount - discountAmount)
  return { subtotal, taxAmount, discount: discountAmount, total }
}

export function isValidItem(item) {
  return Boolean(item?.description?.trim()) && Number(item?.qty) > 0 && Number(item?.price) > 0
}

export const PAYMENT_METHODS = ['Bank Transfer', 'UPI', 'Credit Card', 'Debit Card', 'Cheque', 'Cash']

export const PAYMENT_TERMS = ['Due on receipt', 'Net 7', 'Net 15', 'Net 30', 'Net 45']

export function termsToDays(terms) {
  if (terms === 'Due on receipt') return 0
  const match = /Net (\d+)/.exec(terms || '')
  return match ? Number(match[1]) : 15
}

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen']
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']

function belowThousand(n) {
  const parts = []
  if (n >= 100) {
    parts.push(`${ONES[Math.floor(n / 100)]} Hundred`)
    n %= 100
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)] + (n % 10 ? `-${ONES[n % 10]}` : ''))
  } else if (n > 0) {
    parts.push(ONES[n])
  }
  return parts.join(' ')
}

// Indian numbering (crore / lakh / thousand), e.g. 125000 -> "Rupees One Lakh Twenty-Five Thousand Only".
export function amountInWords(value) {
  let n = Math.round(Number(value) || 0)
  if (n === 0) return 'Rupees Zero Only'
  const units = [
    [10000000, 'Crore'],
    [100000, 'Lakh'],
    [1000, 'Thousand'],
  ]
  const parts = []
  units.forEach(([size, label]) => {
    if (n >= size) {
      parts.push(`${belowThousand(Math.floor(n / size))} ${label}`)
      n %= size
    }
  })
  if (n > 0) parts.push(belowThousand(n))
  return `Rupees ${parts.join(' ')} Only`
}
