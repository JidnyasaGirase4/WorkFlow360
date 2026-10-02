import { CalendarRange } from 'lucide-react'
import Select from '../common/Select'
import Input from '../common/Input'
import { RANGE_OPTIONS } from '../../utils/reportRange'

// Preset ranges plus a custom range with two date inputs. Validation is done by the parent
// (via validateCustomRange) and passed back as `error`.
export default function DateRangeFilter({ range, custom, onRangeChange, onCustomChange, error }) {
  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
        <Select label="Date range" options={RANGE_OPTIONS} value={range} onChange={(e) => onRangeChange(e.target.value)} wrapperClassName="sm:w-48" />
        {range === 'custom' ? (
          <>
            <Input label="From" type="date" value={custom.from} max={custom.to || undefined} onChange={(e) => onCustomChange({ ...custom, from: e.target.value })} aria-invalid={Boolean(error)} wrapperClassName="sm:w-40" />
            <Input label="To" type="date" value={custom.to} min={custom.from || undefined} onChange={(e) => onCustomChange({ ...custom, to: e.target.value })} aria-invalid={Boolean(error)} wrapperClassName="sm:w-40" />
          </>
        ) : (
          <span className="hidden items-center gap-1.5 self-end pb-2.5 text-xs text-ink-500 sm:inline-flex">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-accent-50 text-accent-600 dark:bg-accent-500/15 dark:text-accent-300"><CalendarRange size={13} /></span> Fiscal year runs April to March
          </span>
        )}
      </div>
      {range === 'custom' && error && (
        <p role="alert" className="mt-2 text-xs font-medium text-danger-600 dark:text-danger-400">
          {error}
        </p>
      )}
    </div>
  )
}
