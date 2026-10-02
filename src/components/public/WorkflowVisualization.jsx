import { useEffect, useState } from 'react'
import {
  Check, UserPlus, Building2, FolderKanban, Users, ListChecks, FileText, CalendarClock, Receipt, Wallet, LifeBuoy, FileBarChart2,
} from 'lucide-react'
import Reveal from '../common/Reveal'
import { cn } from '../../utils/cn'
import { tint } from './tints'

const STEPS = [
  { label: 'Lead', icon: UserPlus, text: 'Enquiries from your website, referrals and campaigns are captured and scored in the lead pipeline.' },
  { label: 'Client', icon: Building2, text: 'Convert a won lead into a client in one click. Contacts, history and notes carry over automatically.' },
  { label: 'Project', icon: FolderKanban, text: 'Spin up a project with scope, budget, milestones and a deadline linked to the client.' },
  { label: 'Team', icon: Users, text: 'Assign the right people based on department, skills and current workload.' },
  { label: 'Tasks', icon: ListChecks, text: 'Break work into tasks on a Kanban board with owners, priorities and due dates.' },
  { label: 'Documents', icon: FileText, text: 'Share contracts, designs and deliverables securely with the team and the client.' },
  { label: 'Meetings', icon: CalendarClock, text: 'Schedule reviews and stand-ups, and keep agendas and follow-ups next to the project.' },
  { label: 'Invoice', icon: Receipt, text: 'Generate quotations and GST-ready invoices straight from project milestones.' },
  { label: 'Payment', icon: Wallet, text: 'Record payments, track outstanding amounts and send reminders before due dates.' },
  { label: 'Support', icon: LifeBuoy, text: 'After delivery, clients raise tickets in their portal and your team resolves them with full history.' },
  { label: 'Reports', icon: FileBarChart2, text: 'Revenue, utilisation and delivery reports roll up automatically for leadership.' },
]

const INTERVAL_MS = 2800

// Interactive lifecycle diagram. Auto-advances gently until the visitor picks a step
// (or when reduced motion is preferred).
export default function WorkflowVisualization() {
  const [active, setActive] = useState(0)
  const [auto, setAuto] = useState(() => !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)

  useEffect(() => {
    if (!auto) return
    const id = setInterval(() => setActive((a) => (a + 1) % STEPS.length), INTERVAL_MS)
    return () => clearInterval(id)
  }, [auto])

  const current = STEPS[active]
  const progress = (active / (STEPS.length - 1)) * 100

  return (
    <div>
      <Reveal delay={80}>
        <ol className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6" aria-label="WorkFlow360 lifecycle">
          {STEPS.map((step, idx) => {
            const isActive = idx === active
            const isDone = idx < active
            const t = tint(idx)
            return (
              <li key={step.label} className="min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setAuto(false)
                    setActive(idx)
                  }}
                  aria-current={isActive ? 'step' : undefined}
                  className={cn(
                    'focus-ring group relative flex h-full w-full flex-col items-start gap-3 overflow-hidden rounded-2xl border p-3.5 text-left transition-all duration-300 sm:p-4',
                    isActive
                      ? 'wf-gradient-border -translate-y-1 shadow-panel'
                      : 'border-ink-200 bg-white/80 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card dark:border-ink-800 dark:bg-ink-900/50'
                  )}
                >
                  <span className="flex w-full items-center justify-between">
                    <span
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-105',
                        isActive ? cn('bg-gradient-to-br text-white shadow-glow', t.gradient) : t.chip
                      )}
                    >
                      {isDone ? <Check size={18} strokeWidth={2.5} /> : <step.icon size={18} />}
                    </span>
                    <span className={cn('text-xs font-bold tabular-nums', isActive ? 'text-accent-500' : 'text-ink-300 dark:text-ink-600')}>{String(idx + 1).padStart(2, '0')}</span>
                  </span>
                  <span className={cn('text-sm font-semibold', isActive ? 'text-brand-700 dark:text-brand-300' : 'text-ink-700 dark:text-ink-200')}>{step.label}</span>
                </button>
              </li>
            )
          })}
        </ol>
      </Reveal>

      <Reveal delay={140} className="mx-auto mt-6 max-w-2xl">
        {/* Connected timeline: coloured nodes joined by an animated line */}
        <div className="relative px-1.5" aria-hidden="true">
          <div className="absolute inset-x-1.5 top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink-100 dark:bg-ink-800" />
          <div className="absolute left-1.5 top-1/2 h-1 -translate-y-1/2 overflow-hidden rounded-full transition-all duration-500" style={{ width: `calc((100% - 0.75rem) * ${progress / 100})` }}>
            <div className="wf-flow-line h-full w-full" />
          </div>
          <div className="relative flex items-center justify-between">
            {STEPS.map((step, idx) => (
              <span
                key={step.label}
                className={cn(
                  'rounded-full border-2 border-white transition-all duration-300 dark:border-ink-950',
                  idx < active && cn('h-3 w-3', tint(idx).dot),
                  idx === active && 'wf-pulse-ring h-4 w-4 bg-accent-500',
                  idx > active && 'h-3 w-3 bg-ink-200 dark:bg-ink-700'
                )}
              />
            ))}
          </div>
        </div>
        <div className="mt-4 rounded-2xl border border-ink-100 bg-white/80 p-4 text-center shadow-card dark:border-ink-800 dark:bg-ink-900/60" aria-live="polite">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-600 dark:text-brand-400">
            Step {active + 1} of {STEPS.length} · {current.label}
          </p>
          <p className="mt-2 min-h-[4.5rem] text-base leading-relaxed text-ink-600 dark:text-ink-300 sm:min-h-[3.5rem]">{current.text}</p>
        </div>
      </Reveal>
    </div>
  )
}
