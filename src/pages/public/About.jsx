import { Target, Heart, Users, TrendingUp, Info, Sparkles } from 'lucide-react'
import Reveal from '../../components/common/Reveal'
import CountUp from '../../components/public/CountUp'
import PageHero from '../../components/public/PageHero'
import CtaBand from '../../components/public/CtaBand'
import SectionHeading from '../../components/public/SectionHeading'
import { tint } from '../../components/public/tints'
import { cn } from '../../utils/cn'
import '../../components/public/public.css'

const VALUES = [
  { icon: Target, title: 'Built for real workflows', desc: 'Every module maps to how service businesses actually operate — not a generic template.' },
  { icon: Heart, title: 'Customer obsessed', desc: 'We ship based on what delivery teams and account managers tell us they need.' },
  { icon: Users, title: 'One team, one platform', desc: "We believe your admins, employees and clients shouldn't need five different tools." },
  { icon: TrendingUp, title: 'Built to scale', desc: 'From a 5-person agency to a 500-person company, WorkFlow360 grows with you.' },
]

const TEAM = [
  { name: 'Jidnyasa Girase', role: 'Founder & CEO' },
  { name: 'Jay Girase', role: 'Head of Delivery' },
  { name: 'Rohit Girase', role: 'Lead Frontend Engineer' },
  { name: 'Sneha Joshi', role: 'Head of Design' },
]

const STATS = [
  { label: 'Businesses onboarded', target: 1200, suffix: '+' },
  { label: 'Cities across India', target: 85, suffix: '+' },
  { label: 'Team members', target: 42 },
  { label: 'Customer satisfaction', target: 4.8, decimals: 1, suffix: '/5' },
]

const MILESTONES = [
  { year: '2023', title: 'The idea', text: 'Jidnyasa, running a 20-person IT services firm in Pune, gets frustrated juggling five tools and builds the first internal prototype.' },
  { year: '2024', title: 'First customers', text: 'TechNova Solutions and a handful of Pune agencies adopt the CRM, project and billing modules.' },
  { year: '2025', title: 'Client portal', text: 'We launch the client portal and support desk, and cross 500 onboarded businesses.' },
  { year: '2026', title: 'Growing across India', text: 'Teams in 85+ cities now run their delivery on WorkFlow360, with mobile-first dashboards and role-based workspaces.' },
]

export default function About() {
  return (
    <>
      <PageHero
        eyebrow="About Us"
        icon={Info}
        title={<>We build the operating system for <span className="wf-text-gradient">service businesses</span></>}
        description="WorkFlow360 started with a simple observation — growing companies were running their business across spreadsheets, chat threads and five disconnected tools. We built the alternative."
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 gap-4 min-[520px]:grid-cols-2 sm:gap-5 lg:grid-cols-4 lg:gap-6">
          {VALUES.map((v, idx) => {
            const t = tint(idx)
            return (
              <Reveal key={v.title} delay={idx * 60} className="min-w-0">
                <div className="wf-no-motion-hover group relative h-full overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900 sm:p-6">
                  <span className={cn('absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100', t.hairline)} aria-hidden="true" />
                  <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110', t.chip)}>
                    <v.icon size={22} />
                  </span>
                  <h3 className="mt-4 text-base font-semibold text-ink-800 dark:text-ink-100">{v.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{v.desc}</p>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section className="bg-ink-50/60 py-6 dark:bg-ink-900/30 sm:py-8 lg:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Meet the team" description="A small team obsessed with making operations software feel simple." />
          <div className="mt-6 grid grid-cols-2 gap-4 sm:mt-8 sm:gap-6 md:grid-cols-4">
            {TEAM.map((member, idx) => (
              <Reveal key={member.name} delay={idx * 60} className="min-w-0">
                <div className="wf-no-motion-hover group h-full rounded-2xl border border-ink-100 bg-white p-4 text-center shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900 sm:p-6">
                  <div className={cn('mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br text-lg font-bold text-white shadow-glow transition-transform duration-300 group-hover:scale-105 sm:h-20 sm:w-20 sm:text-xl', tint(idx).gradient)}>
                    {member.name.split(' ').map((n) => n[0]).join('')}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-ink-800 dark:text-ink-100">{member.name}</p>
                  <p className="text-xs text-ink-400">{member.role}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10" aria-label="Company in numbers">
        <div className="relative overflow-hidden rounded-3xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-accent-50 p-6 shadow-card dark:border-ink-800 dark:from-brand-500/10 dark:via-transparent dark:to-accent-500/10 sm:p-8 lg:p-10">
          <div className="wf-dots pointer-events-none absolute inset-0 opacity-60" aria-hidden="true" />
          <div className="relative grid grid-cols-2 gap-x-4 gap-y-8 lg:grid-cols-4">
            {STATS.map((stat, idx) => (
              <Reveal key={stat.label} delay={idx * 70} className="min-w-0 text-center">
                <p className="wf-text-gradient text-3xl font-extrabold tracking-tight tabular-nums sm:text-4xl lg:text-5xl">
                  <CountUp target={stat.target} suffix={stat.suffix} decimals={stat.decimals} />
                </p>
                <p className="mt-1.5 text-xs text-ink-500 sm:text-sm">{stat.label}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-ink-50/60 py-6 dark:bg-ink-900/30 sm:py-8 lg:py-10">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Our story" description="From a Pune spreadsheet to a workspace used across India." />
          <ol className="relative mt-6 space-y-5 border-l-2 border-dashed border-brand-200 pl-8 dark:border-ink-700 sm:pl-10">
            {MILESTONES.map((m, idx) => (
              <Reveal as="li" key={m.year} delay={idx * 70} className="relative">
                <span className={cn('absolute -left-[2.85rem] top-0 flex h-8 w-8 items-center justify-center rounded-full border-4 border-ink-50 text-white shadow-card dark:border-ink-950 sm:-left-[3.35rem]', tint(idx).solid)} aria-hidden="true">
                  <Sparkles size={12} />
                </span>
                <div className="rounded-2xl border border-ink-100 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900 sm:p-5">
                  <p className={cn('text-xs font-bold uppercase tracking-wider', tint(idx).text)}>{m.year}</p>
                  <h3 className="mt-1 text-lg font-semibold text-ink-900 dark:text-white">{m.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-500">{m.text}</p>
                </div>
              </Reveal>
            ))}
          </ol>
        </div>
      </section>

      <CtaBand
        title="Come build the future of work with us"
        description="Try WorkFlow360 with your own team, or talk to us about how we can fit your workflow."
        primary={{ to: '/register', label: 'Start Free' }}
        secondary={{ to: '/contact', label: 'Contact Us' }}
        className="pt-6 sm:pt-8 lg:pt-10"
      />
    </>
  )
}
