import Reveal from '../common/Reveal'
import Badge from '../common/Badge'
import { cn } from '../../utils/cn'

// Light gradient hero used at the top of the inner marketing pages.
// `title` may contain a <span className="wf-text-gradient"> for emphasis.
export default function PageHero({ eyebrow, tone = 'brand', icon: Icon, title, description, align = 'center', children, className }) {
  const centered = align === 'center'
  return (
    <section className={cn('gradient-soft relative overflow-hidden', className)}>
      <div className="wf-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="wf-drift pointer-events-none absolute -left-24 -top-10 h-64 w-64 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/15" aria-hidden="true" />
      <div className="wf-drift-slow pointer-events-none absolute -right-20 top-10 h-64 w-64 rounded-full bg-accent-300/30 blur-3xl dark:bg-accent-500/15" aria-hidden="true" />
      <Reveal className={cn('relative mx-auto max-w-7xl px-4 pb-6 pt-8 sm:px-6 sm:pb-8 sm:pt-10 lg:px-8 lg:pb-10 lg:pt-12', centered && 'text-center')}>
        {eyebrow && (
          <Badge tone={tone} className={cn('mb-5', centered && 'mx-auto')}>
            {Icon && <Icon size={12} />} {eyebrow}
          </Badge>
        )}
        <h1 className={cn('text-balance text-3xl font-extrabold leading-[1.12] tracking-tight text-ink-900 dark:text-white min-[400px]:text-4xl sm:text-5xl', centered ? 'mx-auto max-w-3xl' : 'max-w-3xl')}>
          {title}
        </h1>
        {description && (
          <p className={cn('mt-4 text-base leading-relaxed text-ink-500 dark:text-ink-400 sm:text-lg', centered ? 'mx-auto max-w-2xl' : 'max-w-3xl')}>{description}</p>
        )}
        {children}
      </Reveal>
    </section>
  )
}
