import Reveal from '../common/Reveal'
import Badge from '../common/Badge'
import { cn } from '../../utils/cn'

export default function SectionHeading({ eyebrow, title, description, tone = 'brand', align = 'center', as: Heading = 'h2', className, dark = false }) {
  return (
    <Reveal className={cn('max-w-2xl', align === 'center' && 'mx-auto text-center', className)}>
      {eyebrow && (
        <Badge tone={tone} className={cn('mb-3', align === 'center' && 'mx-auto', dark && 'bg-white/10 text-white')}>
          {eyebrow}
        </Badge>
      )}
      <Heading className={cn('text-balance text-2xl font-bold tracking-tight min-[400px]:text-2xl sm:text-3xl', dark ? 'text-white' : 'text-ink-900 dark:text-white')}>{title}</Heading>
      {description && <p className={cn('mt-2 text-base leading-relaxed', dark ? 'text-ink-300' : 'text-ink-500 dark:text-ink-400')}>{description}</p>}
    </Reveal>
  )
}
