import { Link } from 'react-router-dom'
import { ArrowRight, Check } from 'lucide-react'
import Reveal from '../common/Reveal'
import Badge from '../common/Badge'
import ModuleVisual from './ModuleVisual'
import { tint } from './tints'
import { cn } from '../../utils/cn'

// Alternating text + product-visual section used for each core module on the home page.
// `toneIndex` picks the colour tint (see tints.js); `muted` gives the section a tinted background.
export default function ModuleSection({ id, icon: Icon, eyebrow, title, description, points, kind, to = '/features', reverse = false, muted = false, toneIndex = 0 }) {
  const t = tint(toneIndex)
  return (
    <section id={id} className={cn('relative scroll-mt-20 overflow-hidden py-4 sm:py-5 lg:py-6', muted && cn('bg-gradient-to-b', t.section))}>
      <div className="mx-auto grid max-w-7xl grid-cols-1 items-center gap-6 px-4 sm:px-6 lg:grid-cols-2 lg:gap-10 lg:px-8">
        <Reveal className={cn('min-w-0', reverse && 'lg:order-2')}>
          <Badge tone={t.badge} className="mb-3">
            <Icon size={12} /> {eyebrow}
          </Badge>
          <h2 className="text-balance text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-2xl lg:text-3xl">{title}</h2>
          <p className="mt-3 max-w-lg leading-relaxed text-ink-500 dark:text-ink-400">{description}</p>
          <ul className="mt-4 space-y-2">
            {points.map((p, i) => (
              <li key={p} className="flex items-start gap-3 text-sm text-ink-600 dark:text-ink-300">
                <span
                  className={cn('mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full', tint(toneIndex + i).chip)}
                >
                  <Check size={12} strokeWidth={3} />
                </span>
                {p}
              </li>
            ))}
          </ul>
          <Link
            to={to}
            className={cn('focus-ring group mt-4 inline-flex items-center gap-1.5 rounded-lg px-1 text-sm font-semibold transition-all hover:gap-2.5', t.text)}
          >
            Explore {eyebrow.toLowerCase()} <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
        <Reveal delay={120} className={cn('relative min-w-0', reverse && 'lg:order-1')}>
          <div className={cn('pointer-events-none absolute -inset-3 -z-0 rounded-[2rem] bg-gradient-to-br opacity-70 blur-2xl', t.glow)} aria-hidden="true" />
          <ModuleVisual kind={kind} toneIndex={toneIndex} className="relative" />
        </Reveal>
      </div>
    </section>
  )
}
