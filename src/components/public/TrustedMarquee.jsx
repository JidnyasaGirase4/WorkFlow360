import { TRUSTED } from './siteData'
import { tint } from './tints'
import { cn } from '../../utils/cn'

export default function TrustedMarquee() {
  return (
    <div className="relative border-t border-ink-100 bg-white/70 py-4 backdrop-blur-sm dark:border-ink-800 dark:bg-ink-950/40 sm:py-5">
      <p className="px-4 text-center text-xs font-semibold uppercase tracking-wider text-ink-400">
        Trusted by growing teams across India
      </p>
      <div className="wf-marquee mt-6">
        <div className="wf-marquee-track">
          {[0, 1].map((copy) => (
            <ul
              key={copy}
              className="flex shrink-0 items-center gap-8 pr-8 sm:gap-12 sm:pr-12"
              aria-hidden={copy === 1 ? 'true' : undefined}
              {...(copy === 1 ? { 'data-marquee-clone': true } : {})}
            >
              {TRUSTED.map((name, i) => (
                <li
                  key={name}
                  className="group flex items-center gap-2.5 whitespace-nowrap rounded-full border border-ink-100 bg-white px-3.5 py-1.5 text-sm font-bold text-ink-500 shadow-card transition-all duration-200 hover:-translate-y-0.5 hover:text-ink-800 dark:border-ink-800 dark:bg-ink-900 dark:text-ink-300 dark:hover:text-white sm:text-base"
                >
                  <span className={cn('flex h-7 w-7 items-center justify-center rounded-lg text-xs font-extrabold transition-transform duration-200 group-hover:scale-110', tint(i).chip)}>
                    {name[0]}
                  </span>
                  {name}
                </li>
              ))}
            </ul>
          ))}
        </div>
      </div>
    </div>
  )
}
