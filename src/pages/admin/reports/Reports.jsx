import { useState } from 'react'
import {
  IndianRupee, Briefcase, Users, Target, Receipt, LifeBuoy, Filter, RotateCcw,
} from 'lucide-react'
import PageHeader from '../../../components/business/PageHeader'
import ReportChart from '../../../components/business/ReportChart'
import ExportMenu from '../../../components/business/ExportMenu'
import DateRangeFilter from '../../../components/business/DateRangeFilter'
import StatCard from '../../../components/common/StatCard'
import Card, { CardHeader, CardTitle } from '../../../components/common/Card'
import Tabs from '../../../components/common/Tabs'
import Select from '../../../components/common/Select'
import Badge from '../../../components/common/Badge'
import Button from '../../../components/common/Button'
import DataTable from '../../../components/common/DataTable'
import StatusBadge from '../../../components/common/StatusBadge'
import EmptyState from '../../../components/common/EmptyState'
import ErrorState from '../../../components/common/ErrorState'
import { Skeleton, SkeletonCard, SkeletonTable } from '../../../components/common/Skeleton'
import { reportService } from '../../../services/reportService'
import { useAsyncData } from '../../../hooks/useAsyncData'
import { useToast } from '../../../context/ToastContext'
import { formatDate } from '../../../utils/format'
import { downloadCsv } from '../../../utils/exportCsv'
import { formatValue } from '../../../utils/reportFormat'
import { RANGE_OPTIONS, validateCustomRange } from '../../../utils/reportRange'
import { cn } from '../../../utils/cn'

const TABS = [
  { value: 'revenue', label: 'Revenue', icon: <IndianRupee size={15} /> },
  { value: 'projects', label: 'Projects', icon: <Briefcase size={15} /> },
  { value: 'employees', label: 'Employees', icon: <Users size={15} /> },
  { value: 'crm', label: 'CRM', icon: <Target size={15} /> },
  { value: 'billing', label: 'Billing', icon: <Receipt size={15} /> },
  { value: 'support', label: 'Support', icon: <LifeBuoy size={15} /> },
]

const KPI_ICONS = { revenue: IndianRupee, projects: Briefcase, employees: Users, crm: Target, billing: Receipt, support: LifeBuoy }
const SPAN = { 2: 'lg:col-span-2', 3: 'lg:col-span-3' }

function toLabel(value) {
  return String(value || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export default function Reports() {
  const { toast } = useToast()
  const [tab, setTab] = useState('revenue')
  const [range, setRange] = useState('this_month')
  const [custom, setCustom] = useState({ from: '2026-07-01', to: '2026-09-26' })
  const [filters, setFilters] = useState({})

  const filter = filters[tab] || ''
  const customError = range === 'custom' ? validateCustomRange(custom.from, custom.to) : ''
  const filterDef = reportService.getFilterOptions(tab)

  const key = `${tab}|${range}|${custom.from}|${custom.to}|${filter}|${customError ? 'invalid' : 'ok'}`
  const { data: report, loading, error, reload } = useAsyncData(
    () => (customError ? Promise.resolve({ invalid: true }) : reportService.getReport(tab, { range, custom, filter })),
    key
  )

  const table = report?.table
  const rows = table?.rows || []

  function exportCsv() {
    if (!table || rows.length === 0) {
      toast.warning('There is no table data to export for this selection.')
      return
    }
    const columns = table.columns.map((c) => ({
      header: c.header,
      accessor: (row) => (c.kind === 'status' || c.kind === 'health' ? toLabel(row[c.key]) : row[c.key]),
    }))
    downloadCsv(`${table.filename}-${tab === 'projects' || tab === 'employees' ? 'snapshot' : range}`, columns, rows)
    toast.success(`Downloaded ${rows.length} row${rows.length === 1 ? '' : 's'} as CSV`)
  }

  function exportPdf() {
    toast.info('PDF export queued. Your report will be ready to download shortly.')
  }

  function resetFilters() {
    setRange('this_month')
    setFilters((f) => ({ ...f, [tab]: '' }))
  }

  const tableColumns = (table?.columns || []).map((c) => ({
    key: c.key,
    header: c.header,
    sortable: true,
    align: c.align,
    render: (row) => renderCell(c, row),
  }))

  return (
    <div>
      <PageHeader
        title="Reports"
        description="Track performance across revenue, projects, team, CRM, billing and support."
        breadcrumbItems={[{ label: 'Reports' }]}
        action={<ExportMenu onCsv={exportCsv} onPdf={exportPdf} disabled={loading || Boolean(error) || !report || report.empty || report.invalid} />}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-5" />

      <Card className="gradient-soft mb-6 rounded-2xl p-4 sm:p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <DateRangeFilter range={range} custom={custom} onRangeChange={setRange} onCustomChange={setCustom} error={customError} />
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Select
              label={filterDef.label}
              options={filterDef.options}
              value={filter}
              onChange={(e) => setFilters((f) => ({ ...f, [tab]: e.target.value }))}
              wrapperClassName="sm:w-52"
            />
            <Button variant="ghost" className="w-full sm:w-auto" size="md" leftIcon={<RotateCcw size={14} />} onClick={resetFilters} disabled={range === 'this_month' && !filter}>
              Reset
            </Button>
          </div>
        </div>
        {report && !report.invalid && (
          <p className="mt-3 flex flex-wrap items-center gap-2 border-t border-ink-100 pt-3 text-xs text-ink-500 dark:border-ink-800">
            <Filter size={12} /> Showing
            <Badge tone="brand">{RANGE_OPTIONS.find((r) => r.value === range)?.label}</Badge>
            <span>{report.rangeLabel}</span>
            {filter && <Badge tone="accent">{filterDef.options.find((o) => o.value === filter)?.label}</Badge>}
          </p>
        )}
      </Card>

      {loading && <ReportSkeleton />}

      {error && (
        <Card>
          <ErrorState title="Couldn't generate this report" description="Something went wrong while building the report. Please try again." onRetry={reload} />
        </Card>
      )}

      {report?.invalid && (
        <Card>
          <EmptyState icon={Filter} title="Choose a valid date range" description="Pick a start date that is on or before the end date to generate the report." />
        </Card>
      )}

      {report?.empty && (
        <Card>
          <EmptyState
            icon={Filter}
            title="No data for this period"
            description="We have no records between the selected dates. Data is available from October 2025 to September 2026."
            actionLabel="Reset to this month"
            onAction={resetFilters}
          />
        </Card>
      )}

      {report && !report.empty && !report.invalid && (
        <div className="space-y-6 lg:space-y-8">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
            {report.kpis.map((k) => (
              <StatCard
                key={`${tab}-${k.label}`}
                icon={KPI_ICONS[tab]}
                label={k.label}
                value={k.value}
                tone={k.tone}
                format={(v) => `${k.signed && v > 0 ? '+' : ''}${formatValue(k.kind, k.kind === 'percent' || k.kind === 'hours' ? Math.round(v * 10) / 10 : v)}`}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
            {report.charts.map((chart) => (
              <div key={`${tab}-${chart.id}`} className={cn('min-w-0', SPAN[chart.span])}>
                <ReportChart chart={chart} />
              </div>
            ))}
          </div>

          <Card className="overflow-hidden rounded-2xl">
            <CardHeader>
              <div className="min-w-0">
                <CardTitle>{table.title}</CardTitle>
                <p className="mt-0.5 text-xs text-ink-500">
                  {rows.length} record{rows.length === 1 ? '' : 's'} - the CSV export contains exactly these rows.
                </p>
              </div>
            </CardHeader>
            <div className="p-4">
              <DataTable
                key={`${tab}-${key}`}
                columns={tableColumns}
                data={rows}
                pageSize={6}
                emptyTitle="No records in this selection"
                emptyDescription="Try widening the date range or clearing the filter."
              />
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}

function renderCell(col, row) {
  const value = row[col.key]
  switch (col.kind) {
    case 'strong':
      return <span className="whitespace-nowrap font-semibold text-ink-800 dark:text-ink-100">{value}</span>
    case 'currency':
      return <span className="whitespace-nowrap">{formatValue('currency', value)}</span>
    case 'percent':
      return <span className="whitespace-nowrap">{formatValue('percent', value)}</span>
    case 'date':
      return <span className="whitespace-nowrap">{formatDate(value)}</span>
    case 'status':
      return <StatusBadge status={value} />
    case 'health':
      return (
        <Badge tone={value === 'delayed' ? 'danger' : value === 'completed' ? 'success' : 'info'} dot>
          {value === 'on_track' ? 'On track' : toLabel(value)}
        </Badge>
      )
    case 'progress':
      return (
        <div className="flex min-w-[8rem] items-center gap-2">
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800">
            <div className="h-full rounded-full bg-gradient-to-r from-brand-300 to-brand-500 transition-all duration-700" style={{ width: `${value}%` }} />
          </div>
          <span className="w-9 text-right text-xs font-medium text-ink-600 dark:text-ink-300">{value}%</span>
        </div>
      )
    default:
      return value
  }
}

function ReportSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Generating report">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:gap-5 lg:grid-cols-3 lg:gap-6">
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-2xl" />
      </div>
      <Card className="rounded-2xl p-4">
        <SkeletonTable rows={5} cols={6} />
      </Card>
    </div>
  )
}
