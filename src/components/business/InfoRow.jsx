import { cn } from '../../utils/cn'
import { TONES } from './ProjectTones'

// Icon + label + value row. `tone` (optional) tints the icon chip.
export default function InfoRow({ icon: Icon, label, value, children, tone = 'brand' }) {
  return (
    <div className="group flex items-start gap-3">
      <span
        className={cn(
          'flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition-transform duration-200 group-hover:scale-110',
          TONES[tone]?.chip || TONES.brand.chip
        )}
      >
        <Icon size={16} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-xs font-medium text-ink-400">{label}</p>
        {children || <p className="mt-0.5 break-words text-sm font-semibold text-ink-800 dark:text-ink-100">{value || '—'}</p>}
      </div>
    </div>
  )
}
