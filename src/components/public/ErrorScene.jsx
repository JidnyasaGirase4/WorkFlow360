import Reveal from '../common/Reveal'
import { cn } from '../../utils/cn'

const TONES = {
  danger: { chip: 'from-danger-400 to-accent-500', ring: 'border-danger-200/70 dark:border-danger-500/20', glow: 'bg-danger-300/30 dark:bg-danger-500/15' },
  warning: { chip: 'from-warning-400 to-accent-400', ring: 'border-warning-200/70 dark:border-warning-500/20', glow: 'bg-warning-300/30 dark:bg-warning-500/15' },
  brand: { chip: 'from-brand-400 to-brand-600', ring: 'border-brand-200/70 dark:border-brand-500/20', glow: 'bg-brand-300/30 dark:bg-brand-500/15' },
  info: { chip: 'from-info-400 to-accent-500', ring: 'border-info-200/70 dark:border-info-500/20', glow: 'bg-info-300/30 dark:bg-info-500/15' },
}

// Playful full-height status scene: gradient blobs + a large tinted icon in concentric rings.
export default function ErrorScene({ icon: Icon, tone = 'brand', code, className, children }) {
  const t = TONES[tone] || TONES.brand
  return (
    <div className={cn('gradient-soft relative flex min-h-[calc(100vh-4rem)] flex-col items-center justify-center overflow-hidden px-4 py-16 text-center', className)}>
      <div className="wf-grid-bg pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <span className={cn('wf-drift absolute left-[8%] top-[14%] h-56 w-56 rounded-full blur-3xl', t.glow)} />
        <span className="wf-drift-slow absolute right-[8%] top-[26%] h-64 w-64 rounded-full bg-accent-300/30 blur-3xl dark:bg-accent-500/15" />
        <span className="wf-float absolute bottom-[10%] left-[30%] h-40 w-40 rounded-full bg-brand-300/30 blur-3xl dark:bg-brand-500/15" />
        <span className="wf-float-delay absolute right-[22%] top-[12%] hidden h-5 w-5 rotate-12 rounded-md bg-warning-300/70 sm:block" />
        <span className="wf-float absolute bottom-[22%] right-[12%] hidden h-4 w-4 rounded-full bg-accent-400/60 sm:block" />
        <span className="wf-float-delay absolute bottom-[28%] left-[14%] hidden h-4 w-4 rotate-45 rounded-sm bg-brand-400/60 sm:block" />
      </div>
      <Reveal className="relative flex w-full flex-col items-center">
        <div className="relative flex h-36 w-36 items-center justify-center sm:h-44 sm:w-44" aria-hidden="true">
          <span className={cn('absolute inset-0 rounded-full border-2 border-dashed', t.ring)} />
          <span className={cn('absolute inset-4 rounded-full border', t.ring)} />
          <span className={cn('wf-float relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br text-white shadow-glow sm:h-24 sm:w-24', t.chip)}>
            <Icon size={38} strokeWidth={1.75} />
          </span>
        </div>
        {code && <p className="wf-text-gradient mt-2 text-sm font-bold uppercase tracking-[0.25em]">{code}</p>}
        {children}
      </Reveal>
    </div>
  )
}
