import { Link } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'
import Reveal from '../common/Reveal'
import Button from '../common/Button'
import { cn } from '../../utils/cn'

// Bright gradient call-to-action band that closes a page.
export default function CtaBand({ icon: Icon, title, description, primary, secondary, className }) {
  return (
    <section className={cn('mx-auto max-w-7xl px-4 pb-6 sm:px-6 sm:pb-8 lg:px-8 lg:pb-10', className)}>
      <Reveal className="relative overflow-hidden bg-gradient-to-br from-brand-500 via-brand-600 to-brand-700 rounded-3xl px-5 py-8 text-center shadow-panel sm:px-10 sm:py-10">
        <div className="wf-dots-light pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="wf-drift pointer-events-none absolute -bottom-28 -right-12 h-80 w-80 rounded-full bg-accent-400/80 blur-3xl sm:h-96 sm:w-96" aria-hidden="true" />
        <div className="wf-drift-slow pointer-events-none absolute -left-16 -top-24 h-64 w-64 rounded-full bg-brand-300/50 blur-3xl" aria-hidden="true" />
        {Icon && (
          <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white/20 text-white ring-1 ring-white/30 backdrop-blur-sm">
            <Icon size={24} aria-hidden="true" />
          </span>
        )}
        <h2 className="relative mx-auto mt-3 max-w-2xl text-balance text-2xl font-bold tracking-tight text-white min-[400px]:text-2xl sm:text-3xl">{title}</h2>
        {description && <p className="relative mx-auto mt-3 max-w-xl text-base text-white/85">{description}</p>}
        <div className="relative mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
          {primary && (
            <Button
              as={Link}
              to={primary.to}
              size="lg"
              rightIcon={<ArrowRight size={16} />}
              className="w-full justify-center bg-white text-brand-700 shadow-panel hover:-translate-y-0.5 hover:bg-white hover:shadow-glow sm:w-auto"
            >
              {primary.label}
            </Button>
          )}
          {secondary && (
            <Button
              as={Link}
              to={secondary.to}
              size="lg"
              variant="ghost"
              className="w-full justify-center border border-white/40 text-white hover:bg-white/15 hover:text-white sm:w-auto"
            >
              {secondary.label}
            </Button>
          )}
        </div>
      </Reveal>
    </section>
  )
}
