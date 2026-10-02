export default function ChartTooltip({ active, payload, label, formatter, labelFormatter }) {
  if (!active || !payload || payload.length === 0) return null
  const title = labelFormatter ? labelFormatter(label, payload) : label ?? payload[0]?.payload?.name
  return (
    <div className="min-w-[8rem] max-w-[14rem] rounded-xl border border-ink-100 bg-white/95 px-3 py-2.5 text-xs shadow-panel backdrop-blur dark:border-ink-700 dark:bg-ink-900/95">
      {title !== undefined && title !== '' && (
        <p className="mb-1.5 truncate font-semibold text-ink-800 dark:text-ink-100">{title}</p>
      )}
      <div className="space-y-1">
        {payload.map((item) => (
          <p key={item.dataKey ?? item.name} className="flex items-center gap-2 text-ink-600 dark:text-ink-300">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white dark:ring-ink-900"
              style={{ background: item.color || item.payload?.color || item.payload?.fill }}
            />
            <span className="truncate">{item.name}</span>
            <span className="ml-auto pl-3 font-bold tabular-nums text-ink-800 dark:text-ink-50">
              {formatter ? formatter(item.value, item.name, item) : item.value}
            </span>
          </p>
        ))}
      </div>
    </div>
  )
}
