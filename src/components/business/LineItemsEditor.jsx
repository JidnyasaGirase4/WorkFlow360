import { ListPlus, Plus, Trash2 } from 'lucide-react'
import Button from '../common/Button'
import Input from '../common/Input'
import { formatCurrency } from '../../utils/format'
import { lineTotal, newLineItem } from '../../utils/invoiceMath'

// Editable list of invoice / quotation line items (description, qty, price).
// Stacks on small screens and becomes a grid from `sm` upwards.
export default function LineItemsEditor({ items, onChange, error }) {
  function update(uid, field, value) {
    onChange(items.map((item) => (item.uid === uid ? { ...item, [field]: value } : item)))
  }

  function remove(uid) {
    if (items.length > 1) onChange(items.filter((item) => item.uid !== uid))
  }

  return (
    <fieldset>
      <div className="mb-2 flex items-center justify-between">
        <legend className="flex items-center gap-2 text-sm font-semibold text-ink-700 dark:text-ink-200">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/15 dark:text-brand-300"><ListPlus size={15} /></span>
          Line items<span className="ml-0.5 text-danger-500">*</span>
        </legend>
        <Button type="button" size="sm" variant="secondary" leftIcon={<Plus size={14} />} onClick={() => onChange([...items, newLineItem()])}>
          Add item
        </Button>
      </div>
      {error && <p role="alert" className="mb-2 text-xs font-medium text-danger-600 dark:text-danger-400">{error}</p>}
      <div className="overflow-hidden rounded-2xl border border-ink-200 dark:border-ink-800">
        <div className="hidden grid-cols-[minmax(0,1fr)_4.5rem_7rem_6.5rem_2rem] gap-2 border-b border-ink-200 bg-ink-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-ink-500 dark:border-ink-800 dark:bg-ink-800/60 sm:grid">
          <span>Description</span>
          <span>Qty</span>
          <span>Price (₹)</span>
          <span className="text-right">Amount</span>
          <span />
        </div>
        <ul className="divide-y divide-ink-100 dark:divide-ink-800">
          {items.map((item, index) => (
            <li key={item.uid} className="animate-fade-in grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-2 p-3 sm:grid-cols-[minmax(0,1fr)_4.5rem_7rem_6.5rem_2rem] sm:items-center">
              <div className="col-span-2 sm:col-span-1">
                <Input
                  aria-label={`Item ${index + 1} description`}
                  placeholder="Description, e.g. Website design — Milestone 1"
                  value={item.description}
                  onChange={(e) => update(item.uid, 'description', e.target.value)}
                />
              </div>
              <Input
                aria-label={`Item ${index + 1} quantity`}
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                placeholder="Qty"
                value={item.qty}
                onChange={(e) => update(item.uid, 'qty', e.target.value)}
              />
              <Input
                aria-label={`Item ${index + 1} price`}
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="Price (₹)"
                value={item.price}
                onChange={(e) => update(item.uid, 'price', e.target.value)}
              />
              <p className="col-span-1 self-center text-sm font-semibold tabular-nums text-ink-700 dark:text-ink-200 sm:text-right">
                <span className="mr-1 text-xs font-normal text-ink-400 sm:hidden">Amount</span>
                {formatCurrency(lineTotal(item))}
              </p>
              <button
                type="button"
                onClick={() => remove(item.uid)}
                disabled={items.length === 1}
                className="focus-ring flex h-10 w-10 items-center justify-center justify-self-end sm:h-8 sm:w-8 rounded-lg text-ink-400 hover:bg-danger-50 hover:text-danger-600 disabled:cursor-not-allowed disabled:opacity-40 dark:hover:bg-danger-500/10"
                aria-label={`Remove item ${index + 1}`}
              >
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </fieldset>
  )
}
