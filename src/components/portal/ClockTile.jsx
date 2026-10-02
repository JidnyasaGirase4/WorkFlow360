import { LogIn, LogOut, Timer, CheckCheck } from 'lucide-react'
import { cn } from '../../utils/cn'

// Presentational live-clock tile for check-in / check-out. All values are
// supplied by the page (behaviour stays in the page).
//   state: 'in' (ready to check in) | 'out' (checked in, can check out) | 'done'
export default function ClockTile({
  title = 'Attendance',
  headerRight,
  timeText,
  dateText,
  checkInText,
  checkOutText,
  workedText,
  state,
  buttonLabel,
  onAction,
  footer,
  className,
}) {
  return (
    <section className={cn('gradient-hero relative overflow-hidden rounded-2xl p-4 text-white shadow-glow sm:p-5', className)} aria-label={title}>
      <span className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-white/15 blur-2xl" aria-hidden="true" />
      <span className="pointer-events-none absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-accent-400/40 blur-2xl" aria-hidden="true" />

      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/20" aria-hidden="true">
              <Timer size={15} />
            </span>
            {title}
          </h2>
          {headerRight && <div className="shrink-0 text-xs font-semibold">{headerRight}</div>}
        </div>

        <div className="mt-5 text-center">
          <p className="font-sans text-3xl font-bold tabular-nums tracking-tight sm:text-4xl" aria-live="off">
            {timeText}
          </p>
          <p className="mt-1 text-xs font-medium text-white/90 sm:text-sm">{dateText}</p>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-3 text-center">
          <div className="rounded-xl bg-white/15 px-3 py-2.5 ring-1 ring-white/20 backdrop-blur-sm">
            <dt className="text-xs font-medium text-white/90">Check in</dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums">{checkInText}</dd>
          </div>
          <div className="rounded-xl bg-white/15 px-3 py-2.5 ring-1 ring-white/20 backdrop-blur-sm">
            <dt className="text-xs font-medium text-white/90">Check out</dt>
            <dd className="mt-0.5 text-sm font-bold tabular-nums">{checkOutText}</dd>
          </div>
        </dl>

        {workedText && (
          <p className="mt-4 flex items-center justify-center gap-1.5 text-sm font-medium text-white">
            <Timer size={14} aria-hidden="true" /> {workedText}
          </p>
        )}

        <button
          type="button"
          onClick={onAction}
          disabled={state === 'done'}
          className={cn(
            'focus-ring mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-all duration-200 active:scale-[0.98]',
            state === 'done'
              ? 'cursor-not-allowed bg-white/20 text-white/80'
              : state === 'out'
                ? 'bg-white text-accent-600 shadow-lg hover:-translate-y-0.5 hover:shadow-xl'
                : 'bg-white text-brand-700 shadow-lg hover:-translate-y-0.5 hover:shadow-xl'
          )}
        >
          {state === 'done' ? <CheckCheck size={16} /> : state === 'out' ? <LogOut size={16} /> : <LogIn size={16} />}
          {buttonLabel}
        </button>

        {footer && <div className="mt-3 text-center text-xs text-white/90">{footer}</div>}
      </div>
    </section>
  )
}
