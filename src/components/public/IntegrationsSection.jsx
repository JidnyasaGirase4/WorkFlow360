import { Plug } from 'lucide-react'
import Reveal from '../common/Reveal'
import SectionHeading from './SectionHeading'

const INTEGRATIONS = [
  { name: 'Razorpay', note: 'Collect online payments', color: 'bg-info-100 text-info-600' },
  { name: 'Tally', note: 'Sync accounting entries', color: 'bg-warning-100 text-warning-700' },
  { name: 'Google Calendar', note: 'Two-way meeting sync', color: 'bg-success-100 text-success-700' },
  { name: 'Slack', note: 'Team alerts & digests', color: 'bg-accent-100 text-accent-700' },
  { name: 'WhatsApp Business', note: 'Client notifications', color: 'bg-success-100 text-success-700' },
  { name: 'Gmail & Outlook', note: 'Email logging', color: 'bg-danger-100 text-danger-700' },
  { name: 'Zoom & Meet', note: 'Meeting links', color: 'bg-brand-100 text-brand-700' },
  { name: 'Google Drive', note: 'Document storage', color: 'bg-warning-100 text-warning-700' },
]

export default function IntegrationsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
      <SectionHeading
        eyebrow="Integrations"
        tone="accent"
        title="Fits into the tools you already use"
        description="WorkFlow360 is built API-first. These are the integrations on our roadmap, with early access available on Business and Enterprise plans."
      />
      <div className="relative mt-6">
        <Reveal className="flex flex-col items-center">
          <div className="relative mx-auto flex max-w-full items-center gap-3 rounded-2xl border border-brand-200 bg-white px-4 py-3 shadow-panel dark:border-brand-700/50 dark:bg-ink-900 sm:px-5">
            <span className="wf-pulse-ring flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-accent-500 text-white">
              <Plug size={18} />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-ink-900 dark:text-white">WorkFlow360</p>
              <p className="text-xs text-ink-400">Open REST API &amp; webhooks</p>
            </div>
          </div>
          <span className="h-8 w-px bg-gradient-to-b from-brand-400 to-transparent" aria-hidden="true" />
        </Reveal>
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4 lg:gap-6">
          {INTEGRATIONS.map((item, idx) => (
            <Reveal key={item.name} delay={idx * 50}>
              <div className="wf-no-motion-hover group flex h-full flex-col items-center rounded-2xl border border-ink-200 bg-white p-4 text-center shadow-card sm:p-5 transition-all duration-300 hover:-translate-y-1 hover:border-brand-200 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-base font-extrabold transition-transform duration-300 group-hover:scale-110 ${item.color} dark:bg-ink-800 dark:text-ink-100`}>
                  {item.name[0]}
                </span>
                <p className="mt-3 text-sm font-semibold text-ink-800 dark:text-ink-100">{item.name}</p>
                <p className="mt-0.5 text-xs text-ink-400">{item.note}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <p className="mt-4 text-center text-xs text-ink-400">Integrations shown are a product concept. Names are trademarks of their respective owners.</p>
      </div>
    </section>
  )
}
