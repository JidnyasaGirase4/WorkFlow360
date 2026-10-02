import { cn } from '../../utils/cn'
import { toneOf } from './tones'

const SIZES = {
  xs: { box: 'h-7 w-7 rounded-lg', icon: 14 },
  sm: { box: 'h-8 w-8 rounded-lg', icon: 15 },
  md: { box: 'h-10 w-10 rounded-xl', icon: 18 },
  lg: { box: 'h-12 w-12 rounded-2xl', icon: 22 },
}

// Tinted rounded chip holding a lucide icon.
export default function IconChip({ icon: Icon, tone = 'brand', size = 'md', className }) {
  const s = SIZES[size] || SIZES.md
  return (
    <span className={cn('flex shrink-0 items-center justify-center transition-transform duration-200', s.box, toneOf(tone).chip, className)} aria-hidden="true">
      {Icon && <Icon size={s.icon} />}
    </span>
  )
}
