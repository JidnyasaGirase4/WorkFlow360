import { useCountUp } from '../../hooks/useCountUp'
import KpiTile from '../common/KpiTile'

// Coloured KPI tile used by the People, Billing and Documents pages (shared compact KpiTile).
export default function EmployeeKpiCard({
  icon,
  label,
  value,
  format = (v) => Math.round(v).toLocaleString('en-IN'),
  hint,
  tone = 'brand',
  index = 0,
  className,
}) {
  const animated = useCountUp(value)
  return <KpiTile icon={icon} label={label} value={format(animated)} hint={hint} tone={tone} index={index} className={className} />
}
