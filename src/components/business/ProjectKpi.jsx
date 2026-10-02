import KpiTile from '../common/KpiTile'

// KPI tile for project/client detail pages (shared compact KpiTile).
// `index` staggers the entrance animation inside a grid.
export default function ProjectKpi({ icon, label, value, sub, tone = 'brand', index = 0, className }) {
  return <KpiTile icon={icon} label={label} value={value} hint={sub} hintTone={tone === 'danger' ? 'danger' : undefined} tone={tone} index={index} className={className} />
}
