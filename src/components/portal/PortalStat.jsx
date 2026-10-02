import { useCountUp } from '../../hooks/useCountUp'
import KpiTile from '../common/KpiTile'

const defaultFormat = (v) => Math.round(v).toLocaleString('en-IN')

// KPI tile for the Employee and Client dashboards: count-up number in the shared compact KpiTile.
export default function PortalStat({ icon, label, value, prefix = '', suffix = '', format = defaultFormat, tone = 'brand', hint, index = 0, className }) {
  const animated = useCountUp(value)
  return <KpiTile icon={icon} label={label} value={`${prefix}${format(animated)}${suffix}`} hint={hint} tone={tone} index={index} className={className} />
}
