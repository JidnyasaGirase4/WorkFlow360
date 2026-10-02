import { Link } from 'react-router-dom'
import { Check, Sparkles, Rocket, Zap, Building2 } from 'lucide-react'
import Button from '../common/Button'
import Reveal from '../common/Reveal'
import { cn } from '../../utils/cn'
import { formatNumber } from '../../utils/format'
import { PLANS } from './siteData'

export function BillingToggle({ yearly, onChange }) {
  return (
    <div className="inline-flex items-center rounded-full border border-ink-200 bg-white p-1 shadow-card dark:border-ink-800 dark:bg-ink-900" role="group" aria-label="Billing period">
      {[
        { value: false, label: 'Monthly' },
        { value: true, label: 'Yearly' },
      ].map((opt) => (
        <button
          key={opt.label}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={yearly === opt.value}
          className={cn(
            'focus-ring flex min-h-9 items-center gap-2 rounded-full px-4 py-1.5 text-sm font-semibold transition-all duration-200',
            yearly === opt.value ? 'gradient-brand text-white shadow-glow' : 'text-ink-500 hover:text-ink-800 dark:hover:text-ink-100'
          )}
        >
          {opt.label}
          {opt.value && (
            <span className={cn('rounded-full px-1.5 py-0.5 text-[10px] font-bold', yearly ? 'bg-white/25 text-white' : 'bg-success-100 text-success-700 dark:bg-success-500/15 dark:text-success-300')}>
              -20%
            </span>
          )}
        </button>
      ))}
    </div>
  )
}

const PLAN_ICONS = { starter: Rocket, business: Zap, enterprise: Building2 }
const PLAN_CHIPS = {
  starter: 'bg-warning-50 text-warning-600 dark:bg-warning-500/15 dark:text-warning-300',
  business: 'gradient-brand text-white shadow-glow',
  enterprise: 'bg-info-50 text-info-600 dark:bg-info-500/15 dark:text-info-300',
}

export function PlanCard({ plan, yearly }) {
  const price = plan.monthly ? (yearly ? plan.yearly : plan.monthly) : null
  const PlanIcon = PLAN_ICONS[plan.id] || Rocket
  return (
    <div
      className={cn(
        'wf-no-motion-hover relative flex h-full flex-col rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover sm:p-6 lg:p-7',
        plan.highlight
          ? 'wf-gradient-border shadow-panel lg:scale-[1.03]'
          : 'border border-ink-200 bg-white shadow-card hover:border-brand-200 dark:border-ink-800 dark:bg-ink-900'
      )}
    >
      {plan.highlight && (
        <span className="gradient-accent absolute -top-3.5 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-bold text-white shadow-glow">
          <Sparkles size={12} /> Most Popular
        </span>
      )}
      <div className="flex items-center gap-3">
        <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', PLAN_CHIPS[plan.id] || PLAN_CHIPS.starter)}>
          <PlanIcon size={20} />
        </span>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-ink-900 dark:text-white">{plan.name}</h3>
          <span className="block text-xs font-medium text-ink-400">{plan.audience}</span>
        </div>
      </div>
      <p className="mt-4 min-h-[3.25rem] text-sm leading-relaxed text-ink-500">{plan.tagline}</p>
      <div className="mt-5 min-h-[4.5rem]">
        {price ? (
          <>
            <p className="flex items-baseline gap-1">
              <span className={cn('text-4xl font-extrabold tracking-tight tabular-nums', plan.highlight ? 'wf-text-gradient' : 'text-ink-900 dark:text-white')}>₹{formatNumber(price)}</span>
              <span className="text-sm text-ink-400">/mo</span>
            </p>
            <p className="mt-1 text-xs text-ink-400">
              {yearly ? `Billed yearly (₹${formatNumber(price * 12)}/yr) · ` : 'Billed monthly · '}+ 18% GST
            </p>
          </>
        ) : (
          <>
            <p className="text-4xl font-extrabold tracking-tight text-ink-900 dark:text-white">Custom</p>
            <p className="mt-1 text-xs text-ink-400">Volume pricing, annual contract</p>
          </>
        )}
      </div>
      <Button
        as={Link}
        to={price ? '/register' : '/contact'}
        variant={plan.highlight ? 'primary' : 'secondary'}
        size="lg"
        className={cn('mt-5 w-full justify-center', plan.highlight ? 'gradient-brand hover:shadow-glow' : 'hover:border-brand-300 hover:text-brand-700')}
      >
        {plan.cta}
      </Button>
      <ul className="mt-6 space-y-3 border-t border-ink-100 pt-6 dark:border-ink-800">
        {plan.features.map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm text-ink-600 dark:text-ink-300">
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-600 dark:bg-success-500/15">
              <Check size={12} strokeWidth={3} />
            </span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  )
}

export function PlanGrid({ yearly }) {
  return (
    <div className="mx-auto grid max-w-md grid-cols-1 gap-8 lg:max-w-none lg:grid-cols-3 lg:gap-6">
      {PLANS.map((plan, idx) => (
        <Reveal key={plan.id} delay={idx * 70} className="pt-3">
          <PlanCard plan={plan} yearly={yearly} />
        </Reveal>
      ))}
    </div>
  )
}
