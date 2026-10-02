import Card, { CardHeader, CardTitle } from './Card'
import { cn } from '../../utils/cn'

export default function ChartCard({ title, subtitle, action, height = 280, className, children }) {
  return (
    <Card className={className}>
      <CardHeader>
        <div className="min-w-0">
          <CardTitle>{title}</CardTitle>
          {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
        </div>
        {action}
      </CardHeader>
      <div className={cn('p-3 sm:p-5')} style={{ height }}>
        {children}
      </div>
    </Card>
  )
}
