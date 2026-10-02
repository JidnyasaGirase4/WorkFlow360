import { cn } from '../../utils/cn'

// Friendly gradient greeting banner (light, never dark). `children` renders under the copy.
export default function WelcomeBanner({ icon: Icon, eyebrow, title, description, action, children, className }) {
  return (
    <section className={cn('gradient-soft relative overflow-hidden rounded-3xl border border-brand-100/80 p-5 shadow-card dark:border-ink-800 sm:p-7 lg:p-8', className)}>
      <span className="pointer-events-none absolute -right-12 -top-20 h-60 w-60 rounded-full bg-brand-200/50 blur-3xl dark:bg-brand-500/10" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-24 right-40 h-52 w-52 rounded-full bg-accent-200/50 blur-3xl dark:bg-accent-500/10" aria-hidden="true" />
      <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          {Icon && (
            <span className="animate-float hidden h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-glow dark:bg-ink-800 dark:text-brand-300 sm:flex" aria-hidden="true">
              <Icon size={26} />
            </span>
          )}
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-1.5 inline-flex items-center gap-1.5 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-brand-700 ring-1 ring-brand-100 dark:bg-ink-800/80 dark:text-brand-300 dark:ring-ink-700">
                {eyebrow}
              </p>
            )}
            <h1 className="text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">{title}</h1>
            {description && <p className="mt-1.5 max-w-xl text-sm text-ink-500 dark:text-ink-300 sm:text-base">{description}</p>}
            {children && <div className="mt-4 flex flex-wrap items-center gap-2">{children}</div>}
          </div>
        </div>
        {action && <div className="shrink-0 [&>*]:w-full sm:[&>*]:w-auto">{action}</div>}
      </div>
    </section>
  )
}
