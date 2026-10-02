import {
  AreaChart, Area, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'
import { BarChart3 } from 'lucide-react'
import Card, { CardHeader, CardTitle, CardBody } from '../common/Card'
import ChartCard from '../common/ChartCard'
import EmptyState from '../common/EmptyState'
import ChartTooltip from './ChartTooltip'
import { useChartColors } from '../../hooks/useChartColors'
import { formatValue } from '../../utils/reportFormat'
import { cn } from '../../utils/cn'

const FUNNEL_COLORS = ['#1aa996', '#3fc4b1', '#8654ec', '#ec4a7d', '#22a559']

// Renders one report chart from a declarative definition produced by reportService.
export default function ReportChart({ chart }) {
  const { type, title, subtitle, data, emptyText } = chart
  const hasData = data && data.length > 0 && (type === 'donut' ? data.some((d) => d.value > 0) : true)

  if (type === 'progress') {
    return (
      <Card className="animate-fade-in rounded-2xl">
        <CardHeader>
          <div>
            <CardTitle>{title}</CardTitle>
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
        </CardHeader>
        <CardBody>
          {hasData ? <ProgressList items={data} /> : <EmptyState icon={BarChart3} title="Nothing to show" description={emptyText || 'No data for this selection.'} className="py-8" />}
        </CardBody>
      </Card>
    )
  }

  const height = type === 'donut' ? 300 : 280
  return (
    <ChartCard title={title} subtitle={subtitle} height={height} className="animate-fade-in rounded-2xl">
      {hasData ? (
        <ChartBody chart={chart} />
      ) : (
        <EmptyState icon={BarChart3} title="Nothing to show" description={emptyText || 'No data for this selection.'} className="h-full py-4" />
      )}
    </ChartCard>
  )
}

function summarize(chart) {
  const fmt = chart.format
  const rows = chart.data.slice(0, 8).map((d) => {
    if (chart.type === 'donut') return `${d.name} ${formatValue(fmt, d.value)}`
    const s = chart.series?.[0]
    return `${d.name} ${formatValue(fmt, d[s?.key])}`
  })
  return `${chart.title}. ${rows.join(', ')}`
}

function ChartBody({ chart }) {
  const colors = useChartColors()
  const { type, data, series = [], format, domain } = chart
  const axis = { fontSize: 12, fill: colors.tick }
  const tooltip = <ChartTooltip formatter={(v) => formatValue(format, v)} />
  const yTick = (v) => formatValue(format, v, { compact: true })
  const margin = { top: 4, right: 8, left: 0, bottom: 0 }

  if (type === 'donut') {
    const total = data.reduce((s, d) => s + d.value, 0)
    return (
      <div className="flex h-full flex-col">
        <div className="relative min-h-0 flex-1" role="img" aria-label={summarize(chart)}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="value" nameKey="name" innerRadius="62%" outerRadius="90%" paddingAngle={4} cornerRadius={6} stroke="none" animationDuration={800}>
                {data.map((d, i) => (
                  <Cell key={d.name} fill={d.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                ))}
              </Pie>
              <RTooltip content={<ChartTooltip formatter={(v) => formatValue(format, v)} />} />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold tabular-nums text-ink-800 dark:text-ink-50">{chart.centerValue !== undefined ? formatValue(format, chart.centerValue, { compact: true }) : total.toLocaleString('en-IN')}</span>
            <span className="text-xs font-medium text-ink-400">{chart.centerLabel}</span>
          </div>
        </div>
        <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
          {data.map((d, i) => (
            <li key={d.name} className="flex items-center gap-1.5 text-ink-500">
              <span className="h-2 w-2 rounded-full" style={{ background: d.color || FUNNEL_COLORS[i % FUNNEL_COLORS.length] }} />
              {d.name}
              <span className="font-semibold text-ink-700 dark:text-ink-200">{formatValue(format, d.value, { compact: true })}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const legend = series.length > 1 && (
    <ul className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 text-xs">
      {series.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5 text-ink-500">
          <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
          {s.name}
        </li>
      ))}
    </ul>
  )

  let chartEl = null
  if (type === 'area') {
    chartEl = (
      <AreaChart data={data} margin={margin}>
        <defs>
          {series.map((s) => (
            <linearGradient key={s.key} id={`rep-${chart.id}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={s.color} stopOpacity={0.4} />
              <stop offset="100%" stopColor={s.color} stopOpacity={0.02} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} strokeOpacity={0.6} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} />
        <YAxis tickLine={false} axisLine={false} tick={axis} width={54} tickFormatter={yTick} domain={domain} />
        <RTooltip content={tooltip} />
        {series.map((s) => (
          <Area key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={3} fill={`url(#rep-${chart.id}-${s.key})`} activeDot={{ r: 5, fill: s.color, stroke: '#fff', strokeWidth: 2 }} animationDuration={800} />
        ))}
      </AreaChart>
    )
  } else if (type === 'line') {
    chartEl = (
      <LineChart data={data} margin={margin}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} strokeOpacity={0.6} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} />
        <YAxis tickLine={false} axisLine={false} tick={axis} width={40} tickFormatter={yTick} allowDecimals={false} />
        <RTooltip content={tooltip} />
        {series.map((s) => (
          <Line key={s.key} type="monotone" dataKey={s.key} name={s.name} stroke={s.color} strokeWidth={2.5} dot={{ r: 4, fill: '#fff', stroke: s.color, strokeWidth: 2 }} activeDot={{ r: 6, fill: s.color, stroke: '#fff', strokeWidth: 2 }} animationDuration={800} />
        ))}
      </LineChart>
    )
  } else if (type === 'hbar') {
    const longest = Math.max(...data.map((d) => String(d.name).length))
    const s = series[0]
    chartEl = (
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={colors.grid} strokeOpacity={0.6} />
        <XAxis type="number" tickLine={false} axisLine={false} tick={axis} tickFormatter={yTick} allowDecimals={false} />
        <YAxis dataKey="name" type="category" width={Math.min(150, Math.max(64, longest * 6.4))} tickLine={false} axisLine={false} tick={{ ...axis, fontSize: 11 }} />
        <RTooltip cursor={{ fill: colors.cursor }} content={tooltip} />
        <Bar dataKey={s.key} name={s.name} fill={s.color} radius={[0, 8, 8, 0]} maxBarSize={24} animationDuration={800}>
          {chart.colorByIndex && data.map((d, i) => <Cell key={d.name} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />)}
        </Bar>
      </BarChart>
    )
  } else {
    const stacked = type === 'stackedBar'
    chartEl = (
      <BarChart data={data} margin={margin} barGap={3}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={colors.grid} strokeOpacity={0.6} />
        <XAxis dataKey="name" tickLine={false} axisLine={false} tick={axis} />
        <YAxis tickLine={false} axisLine={false} tick={axis} width={54} tickFormatter={yTick} allowDecimals={false} />
        <RTooltip cursor={{ fill: colors.cursor }} content={tooltip} />
        {series.map((s, i) => (
          <Bar
            key={s.key}
            dataKey={s.key}
            name={s.name}
            fill={s.color}
            stackId={stacked ? 'stack' : undefined}
            maxBarSize={36}
            radius={stacked ? (i === series.length - 1 ? [8, 8, 0, 0] : 0) : [8, 8, 0, 0]}
            animationDuration={800}
          />
        ))}
      </BarChart>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1" role="img" aria-label={summarize(chart)}>
        <ResponsiveContainer width="100%" height="100%">
          {chartEl}
        </ResponsiveContainer>
      </div>
      {legend}
    </div>
  )
}

function ProgressList({ items }) {
  return (
    <ul className="space-y-4">
      {items.map((item) => {
        const value = Math.max(0, Math.min(100, item.value))
        const tone = value >= 75 ? 'bg-gradient-to-r from-success-300 to-success-500' : value >= 40 ? 'bg-gradient-to-r from-brand-300 to-brand-500' : 'bg-gradient-to-r from-warning-300 to-warning-500'
        return (
          <li key={item.name}>
            <div className="mb-1.5 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink-700 dark:text-ink-200">{item.name}</span>
              <span className="shrink-0 text-xs text-ink-400">
                {item.hint && <span className="mr-2">{item.hint}</span>}
                <span className="font-semibold text-ink-700 dark:text-ink-200">{value}%</span>
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} aria-label={`${item.name} ${value}%`}>
              <div className={cn('h-full rounded-full transition-all duration-700', tone)} style={{ width: `${value}%` }} />
            </div>
          </li>
        )
      })}
    </ul>
  )
}
