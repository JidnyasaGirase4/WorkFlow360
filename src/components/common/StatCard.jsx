import { useId } from 'react'
import { ArrowDownRight, ArrowUpRight } from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer } from 'recharts'
import { useCountUp } from '../../hooks/useCountUp'
import { cn } from '../../utils/cn'
import KpiTile from './KpiTile'

export default function StatCard({
  icon,
  label,
  value,
  format = (v) => Math.round(v).toLocaleString('en-IN'),
  prefix = '',
  suffix = '',
  change,
  changeLabel = 'vs last month',
  trendData,
  tone = 'brand',
  className,
}) {
  const animated = useCountUp(value)
  const gradientId = useId()
  const isPositive = change >= 0

  const badge =
    change !== undefined ? (
      <span
        className={cn(
          'flex shrink-0 items-center gap-0.5 rounded-full px-2 py-0.5 text-xs font-semibold',
          isPositive
            ? 'bg-success-50 text-success-600 dark:bg-success-500/10 dark:text-success-400'
            : 'bg-danger-50 text-danger-600 dark:bg-danger-500/10 dark:text-danger-400'
        )}
      >
        {isPositive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
        {Math.abs(change)}%
      </span>
    ) : null

  const footer = trendData ? (
    <div className="-mx-1 h-9">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={trendData}>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="currentColor"
            strokeWidth={1.75}
            fill={`url(#${gradientId})`}
            className={TONE_TEXT[tone] || TONE_TEXT.brand}
            isAnimationActive
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  ) : null

  return (
    <KpiTile
      icon={icon}
      label={label}
      value={`${prefix}${format(animated)}${suffix}`}
      badge={badge}
      hint={change !== undefined && !trendData ? changeLabel : undefined}
      footer={footer}
      tone={tone}
      className={className}
    />
  )
}

const TONE_TEXT = {
  brand: 'text-brand-600 dark:text-brand-400',
  accent: 'text-accent-600 dark:text-accent-400',
  success: 'text-success-600 dark:text-success-400',
  warning: 'text-warning-600 dark:text-warning-400',
  danger: 'text-danger-600 dark:text-danger-400',
  info: 'text-info-600 dark:text-info-400',
}
