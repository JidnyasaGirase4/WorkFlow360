import { useState } from 'react'
import { Check, Minus, ShieldCheck, Tag } from 'lucide-react'
import Reveal from '../../components/common/Reveal'
import PageHero from '../../components/public/PageHero'
import CtaBand from '../../components/public/CtaBand'
import Accordion from '../../components/public/Accordion'
import SectionHeading from '../../components/public/SectionHeading'
import { BillingToggle, PlanGrid } from '../../components/public/PlanCards'
import { COMPARISON_GROUPS, PLANS, PRICING_FAQS } from '../../components/public/siteData'
import { cn } from '../../utils/cn'
import '../../components/public/public.css'

function Cell({ value, highlight }) {
  if (value === true) {
    return (
      <>
        <span className="mx-auto flex h-6 w-6 items-center justify-center rounded-full bg-success-100 text-success-600 dark:bg-success-500/15" aria-hidden="true"><Check size={14} strokeWidth={3} /></span>
        <span className="sr-only">Included</span>
      </>
    )
  }
  if (value === false) {
    return (
      <>
        <Minus size={17} className="mx-auto text-ink-300 dark:text-ink-600" aria-hidden="true" />
        <span className="sr-only">Not included</span>
      </>
    )
  }
  return <span className={cn('text-xs font-medium sm:text-sm', highlight ? 'text-brand-700 dark:text-brand-300' : 'text-ink-600 dark:text-ink-300')}>{value}</span>
}

export default function Pricing() {
  const [yearly, setYearly] = useState(true)

  return (
    <>
      <PageHero
        eyebrow="Pricing"
        icon={Tag}
        title={<>Simple, <span className="wf-text-gradient">transparent</span> pricing</>}
        description="Start free for 14 days. Upgrade as your team and client base grows. No payment details needed to begin."
      >
        <div className="mt-5 flex flex-col items-center gap-3">
          <BillingToggle yearly={yearly} onChange={setYearly} />
          <p className="text-xs text-ink-500" aria-live="polite">
            {yearly ? 'Yearly billing: you save 20% on every plan.' : 'Monthly billing: switch to yearly and save 20%.'}
          </p>
        </div>
      </PageHero>

      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <PlanGrid yearly={yearly} />
        <p className="mt-6 text-center text-xs text-ink-400">All prices are in Indian Rupees and exclusive of 18% GST. Enterprise pricing is tailored to your team size.</p>
      </section>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <SectionHeading title="Compare plans" description="Every feature, side by side." />
        <Reveal delay={80} className="mt-5 overflow-x-auto rounded-2xl border border-ink-200 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900">
          <table className="w-full min-w-[620px] text-left text-sm">
            <caption className="sr-only">Feature comparison between the Starter, Business and Enterprise plans</caption>
            <thead>
              <tr className="border-b border-ink-200 bg-gradient-to-r from-brand-50/70 via-ink-50 to-accent-50/60 dark:border-ink-800 dark:bg-ink-800/60 dark:from-transparent dark:via-transparent dark:to-transparent">
                <th scope="col" className="px-5 py-4 font-semibold text-ink-700 dark:text-ink-200">Feature</th>
                {PLANS.map((plan) => (
                  <th key={plan.id} scope="col" className={cn('px-5 py-4 text-center font-semibold', plan.highlight ? 'text-brand-700 dark:text-brand-300' : 'text-ink-700 dark:text-ink-200')}>
                    {plan.name}
                    {plan.highlight && <span className="ml-1.5 rounded-full bg-brand-100 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">Popular</span>}
                  </th>
                ))}
              </tr>
            </thead>
            {COMPARISON_GROUPS.map((group) => (
              <tbody key={group.group}>
                <tr className="bg-ink-50/60 dark:bg-ink-950/40">
                  <th scope="colgroup" colSpan={4} className="px-5 py-2 text-xs font-bold uppercase tracking-wider text-ink-400">
                    {group.group}
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.label} className="border-t border-ink-100 transition-colors hover:bg-brand-50/50 dark:border-ink-800 dark:hover:bg-ink-800/30">
                    <th scope="row" className="px-5 py-3.5 font-normal text-ink-600 dark:text-ink-300">{row.label}</th>
                    <td className="px-5 py-3.5 text-center"><Cell value={row.starter} /></td>
                    <td className="bg-brand-50/40 px-5 py-3.5 text-center dark:bg-brand-500/5"><Cell value={row.business} highlight /></td>
                    <td className="px-5 py-3.5 text-center"><Cell value={row.enterprise} /></td>
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </Reveal>
        <p className="mt-3 text-center text-xs text-ink-400 sm:hidden">Swipe the table sideways to see every plan.</p>
      </section>

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <SectionHeading eyebrow="FAQ" title="Pricing questions" />
        <Reveal delay={80} className="mt-5">
          <Accordion items={PRICING_FAQS} />
        </Reveal>
      </section>

      <CtaBand
        icon={ShieldCheck}
        title="Start your 14-day free trial today"
        description="Full access to every feature on your plan. No credit card, no setup call and you can cancel any time."
        primary={{ to: '/register', label: 'Start Free Trial' }}
        secondary={{ to: '/contact', label: 'Talk to Sales' }}
      />
    </>
  )
}
