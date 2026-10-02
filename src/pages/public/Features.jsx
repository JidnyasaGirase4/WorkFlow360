import {
  Users, Briefcase, UserSquare2, Receipt, ShieldCheck, LifeBuoy, Calendar, FileText,
  BarChart3, Search, Bell, Lock, Check, Layers, Rocket,
} from 'lucide-react'
import Reveal from '../../components/common/Reveal'
import ModuleVisual from '../../components/public/ModuleVisual'
import PageHero from '../../components/public/PageHero'
import CtaBand from '../../components/public/CtaBand'
import SectionHeading from '../../components/public/SectionHeading'
import { tint } from '../../components/public/tints'
import { cn } from '../../utils/cn'
import '../../components/public/public.css'

const MODULES = [
  {
    icon: Users,
    id: 'crm',
    kind: 'crm',
    title: 'CRM & Lead Management',
    desc: 'Capture, qualify and convert leads with a visual pipeline, activity tracking and automated follow-up reminders.',
    points: ['Kanban-style lead pipeline', 'Lead source & owner tracking', 'One-click convert to client'],
  },
  {
    icon: Briefcase,
    id: 'projects',
    kind: 'project',
    title: 'Project Management',
    desc: 'Plan milestones, assign tasks and keep every stakeholder aligned with real-time progress tracking.',
    points: ['Milestones & Kanban boards', 'Budget vs. spend tracking', 'File sharing & activity logs'],
  },
  {
    icon: UserSquare2,
    id: 'employees',
    kind: 'employee',
    title: 'Employee Management',
    desc: 'Manage departments, attendance, leave and workload distribution across your whole team.',
    points: ['Attendance & leave workflows', 'Skill & department tagging', 'Workload visibility'],
  },
  {
    icon: Receipt,
    id: 'billing',
    kind: 'billing',
    title: 'Billing & Invoicing',
    desc: 'Generate quotations, send professional invoices and track every payment automatically.',
    points: ['Auto tax & discount calculation', 'Payment status tracking', 'Expense management'],
  },
  {
    icon: ShieldCheck,
    id: 'portal',
    kind: 'portal',
    title: 'Client Portal',
    desc: 'Give every client a branded self-serve portal for projects, documents, invoices and support.',
    points: ['Project progress visibility', 'Secure document access', 'Invoice & payment history'],
  },
  {
    icon: LifeBuoy,
    id: 'support',
    kind: 'support',
    title: 'Support Desk',
    desc: 'Resolve issues faster with a structured ticketing system and full conversation history.',
    points: ['Priority & SLA tracking', 'Threaded conversations', 'Ticket activity timeline'],
  },
]

const EXTRAS = [
  { icon: Calendar, title: 'Meetings & Calendar', desc: 'Schedule and track meetings across teams and clients.' },
  { icon: FileText, title: 'Document Management', desc: 'Centralized, categorized document storage with previews.' },
  { icon: BarChart3, title: 'Reports & Analytics', desc: 'Revenue, project and team reports with exportable data.' },
  { icon: Search, title: 'Global Search', desc: 'Find any lead, client, project or invoice in seconds with ⌘K.' },
  { icon: Bell, title: 'Notification Center', desc: 'Stay on top of tasks, billing and support in one inbox.' },
  { icon: Lock, title: 'Role-Based Access', desc: 'Granular permissions for admins, managers, staff and clients.' },
]

export default function Features() {
  return (
    <>
      <PageHero
        eyebrow="Platform Features"
        icon={Layers}
        title={<>Every tool your <span className="wf-text-gradient">operations team</span> needs</>}
        description="From the first lead to the final payment, WorkFlow360 gives every team a purpose-built workspace."
      />

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="space-y-16 sm:space-y-20 lg:space-y-24">
          {MODULES.map((mod, idx) => {
            const t = tint(idx)
            return (
              <Reveal key={mod.title} id={mod.id} className="scroll-mt-24">
                <div className={cn('grid grid-cols-1 items-center gap-8 sm:gap-10 lg:grid-cols-2 lg:gap-16', idx % 2 === 1 && 'lg:[&>*:first-child]:order-2')}>
                  <div className="min-w-0">
                    <span className={cn('flex h-12 w-12 items-center justify-center rounded-2xl', t.chip)}>
                      <mod.icon size={24} />
                    </span>
                    <h2 className="mt-5 text-2xl font-bold tracking-tight text-ink-900 dark:text-white sm:text-3xl">{mod.title}</h2>
                    <p className="mt-3 text-ink-500 dark:text-ink-400">{mod.desc}</p>
                    <ul className="mt-5 space-y-3">
                      {mod.points.map((p, i) => (
                        <li key={p} className="flex items-center gap-3 text-sm text-ink-600 dark:text-ink-300">
                          <span className={cn('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', tint(idx + i).chip)}>
                            <Check size={12} strokeWidth={3} />
                          </span>
                          {p}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="relative min-w-0">
                    <div className={cn('pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-br opacity-70 blur-2xl', t.glow)} aria-hidden="true" />
                    <ModuleVisual kind={mod.kind} toneIndex={idx} className="relative" />
                  </div>
                </div>
              </Reveal>
            )
          })}
        </div>
      </section>

      <section id="security" className="scroll-mt-20 bg-ink-50/60 py-6 dark:bg-ink-900/30 sm:py-8 lg:py-10">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <SectionHeading title="Security and productivity, built in" />
          <div className="mt-6 grid grid-cols-1 gap-4 sm:gap-5 min-[520px]:grid-cols-2 lg:grid-cols-3 lg:gap-6">
            {EXTRAS.map((e, idx) => {
              const t = tint(idx)
              return (
                <Reveal key={e.title} delay={idx * 50} className="min-w-0">
                  <div className="wf-no-motion-hover group relative h-full overflow-hidden rounded-2xl border border-ink-100 bg-white p-5 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900 sm:p-6">
                    <span className={cn('absolute inset-x-0 top-0 h-1 origin-left scale-x-0 bg-gradient-to-r transition-transform duration-300 group-hover:scale-x-100', t.hairline)} aria-hidden="true" />
                    <span className={cn('flex h-11 w-11 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110', t.chip)}>
                      <e.icon size={20} />
                    </span>
                    <h3 className="mt-4 text-base font-semibold text-ink-800 dark:text-ink-100">{e.title}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-ink-500">{e.desc}</p>
                  </div>
                </Reveal>
              )
            })}
          </div>
        </div>
      </section>

      <CtaBand
        className="pt-6 sm:pt-8 lg:pt-10"
        icon={Rocket}
        title="See it all working together"
        description="Start a free trial — no credit card, no setup calls required."
        primary={{ to: '/register', label: 'Start Free' }}
        secondary={{ to: '/pricing', label: 'See Pricing' }}
      />
    </>
  )
}
