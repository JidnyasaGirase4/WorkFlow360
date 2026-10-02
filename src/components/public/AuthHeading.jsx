import { cn } from '../../utils/cn'

// Icon chip + title + subtitle used at the top of every auth form.
export default function AuthHeading({ icon: Icon, title, description, align = 'left', tone = 'gradient', className }) {
  const chip = tone === 'success' ? 'bg-gradient-to-br from-success-400 to-success-600 text-white shadow-glow' : 'gradient-brand text-white shadow-glow'
  return (
    <div className={cn(align === 'center' && 'text-center', className)}>
      {Icon && (
        <span className={cn('flex h-10 w-10 items-center justify-center rounded-xl', chip, align === 'center' && 'mx-auto')}>
          <Icon size={19} aria-hidden="true" />
        </span>
      )}
      <h1 className={cn('text-xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-2xl', Icon && 'mt-3')}>{title}</h1>
      {description && <p className="mt-1 text-sm text-ink-500">{description}</p>}
    </div>
  )
}
