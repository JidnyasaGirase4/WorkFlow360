import { Code2, Building2, Palette, Briefcase, Rocket, Check, Puzzle, MessageCircle } from 'lucide-react'
import Reveal from '../../components/common/Reveal'
import PageHero from '../../components/public/PageHero'
import CtaBand from '../../components/public/CtaBand'
import { tint } from '../../components/public/tints'
import { cn } from '../../utils/cn'
import '../../components/public/public.css'

const SOLUTIONS = [
  { icon: Code2, title: 'Software & IT Companies', desc: 'Run client projects, sprints and billing without leaving one platform.', stats: '500+ IT teams', points: ['Sprint-friendly Kanban boards', 'Milestone-based invoicing', 'Client portal for demos & sign-offs'] },
  { icon: Palette, title: 'Digital Agencies', desc: 'Manage multiple clients, creative reviews and retainer billing with ease.', stats: '300+ agencies', points: ['Multi-client dashboards', 'Retainer and recurring billing', 'Creative review & approvals'] },
  { icon: Briefcase, title: 'Consulting Firms', desc: 'Track engagements, timesheets and deliverables across every client.', stats: '150+ firms', points: ['Engagement and deliverable tracking', 'Team utilisation reports', 'Confidential client document vaults'] },
  { icon: Rocket, title: 'Startups', desc: 'Get enterprise-grade operations tooling without the enterprise overhead.', stats: '400+ startups', points: ['Live in under a day', 'Affordable Starter plan', 'Grows into Business as you scale'] },
  { icon: Building2, title: 'SMBs & Service Companies', desc: 'Replace spreadsheets with a real system for clients, staff and billing.', stats: '600+ businesses', points: ['Replace spreadsheets and chat threads', 'GST-ready quotations & invoices', 'Attendance and leave in one place'] },
]

export default function Solutions() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        tone="accent"
        icon={Puzzle}
        title={<>Built for every kind of <span className="wf-text-gradient">service business</span></>}
        description="Whatever you build or deliver, WorkFlow360 adapts to how your team actually works."
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:gap-6">
          {SOLUTIONS.map((s, idx) => {
            const t = tint(idx + 1)
            return (
              <Reveal key={s.title} delay={idx * 60} className="min-w-0">
                <div className="wf-no-motion-hover group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900 sm:p-7">
                  <span className={cn('absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100', t.hairline)} aria-hidden="true" />
                  <div className="flex items-center justify-between gap-3">
                    <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110', t.chip)}>
                      <s.icon size={24} />
                    </span>
                    <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', t.chip)}>{s.stats}</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-ink-900 dark:text-white">{s.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-500">{s.desc}</p>
                    <ul className="mt-4 space-y-2.5">
                      {s.points.map((p) => (
                        <li key={p} className="flex items-center gap-2.5 text-sm text-ink-600 dark:text-ink-300">
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-success-100 text-success-600 dark:bg-success-500/15">
                            <Check size={12} strokeWidth={3} />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      <CtaBand
        icon={MessageCircle}
        title="Not sure which plan fits your team?"
        description="Talk to us and we'll help you map your workflow to WorkFlow360."
        primary={{ to: '/contact', label: 'Talk to Sales' }}
      />
    </>
  )
}
