import { useId } from 'react'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import KpiTile from '../common/KpiTile'
import { useCountUp } from '../../hooks/useCountUp'
import { useChartColors } from '../../hooks/useChartColors'
import { cn } from '../../utils/cn'

const TONE_HEX = {
  brand: '#1aa996',
  accent: '#ec4a7d',
  success: '#22a559',
  warning: '#f59e0b',
  danger: '#f26f63',
  info: '#8654ec',
}

// KPI tile: icon, count-up value, % change with comparison period and sparkline.
export default function MetricCard({
  icon: Icon,
  label,
  value,
  format = (v) => Math.round(v).toLocaleString('en-IN'),
  change = 0,
  higherIsBetter = true,
  compareLabel = 'vs last month',
  trend,
  tone = 'brand',
  delay = 0,
}) {
  const animated = useCountUp(value)
  const gradientId = `spark-${useId().replace(/:/g, '')}`
  const { dark } = useChartColors()
  const flat = change === 0
  const good = flat ? null : (change > 0) === higherIsBetter
  const color = TONE_HEX[tone]

  const badge = (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
        flat && 'bg-ink-100 text-ink-500 dark:bg-ink-800',
        good === true && 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400',
        good === false && 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400'
      )}
    >
      {flat ? <Minus size={12} /> : change > 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
      {Math.abs(change)}%
    </span>
  )

  const footer = trend ? (
    <div className="-mx-1 h-9" aria-hidden="true">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trend} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={dark ? 0.4 : 0.3} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.75} fill={`url(#${gradientId})`} isAnimationActive animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) : null

  return (
    <KpiTile
      icon={Icon}
      label={label}
      value={format(animated)}
      badge={badge}
      hint={compareLabel}
      footer={footer}
      tone={tone}
      index={delay / 60}
      ariaLabel={`${label}: ${format(value)}, ${change > 0 ? 'up' : change < 0 ? 'down' : 'no change'} ${Math.abs(change)} percent ${compareLabel}`}
    />
  )
}
