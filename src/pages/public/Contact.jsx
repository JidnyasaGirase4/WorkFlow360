import { useState } from 'react'
import { Mail, Phone, MapPin, Clock, CheckCircle2, Send, User, Building2, MessageSquare } from 'lucide-react'
import Reveal from '../../components/common/Reveal'
import PageHero from '../../components/public/PageHero'
import { tint } from '../../components/public/tints'
import { cn } from '../../utils/cn'
import Input from '../../components/common/Input'
import Textarea from '../../components/common/Textarea'
import Button from '../../components/common/Button'
import { useForm } from '../../components/public/useForm'
import { emailError, phoneError } from '../../components/public/validators'
import '../../components/public/public.css'

const INITIAL = { name: '', email: '', phone: '', company: '', subject: '', message: '' }
const MESSAGE_MAX = 1000

function validate(values) {
  const errors = {}
  if (!values.name.trim()) errors.name = 'Full name is required'
  else if (values.name.trim().length < 2) errors.name = 'Name should be at least 2 characters'
  const email = emailError(values.email)
  if (email) errors.email = email
  const phone = phoneError(values.phone)
  if (phone) errors.phone = phone
  if (!values.subject.trim()) errors.subject = 'Subject is required'
  if (!values.message.trim()) errors.message = 'Message is required'
  else if (values.message.trim().length < 10) errors.message = 'Please write at least 10 characters so we can help properly'
  else if (values.message.length > MESSAGE_MAX) errors.message = `Message must be under ${MESSAGE_MAX} characters`
  return errors
}

const CONTACT_INFO = [
  { icon: Mail, label: 'Email', value: 'hello@workflow360.app', href: 'mailto:hello@workflow360.app' },
  { icon: Phone, label: 'Phone', value: '+91 98765 43210', href: 'tel:+919876543210' },
  { icon: MapPin, label: 'Office', value: 'Baner Road, Pune, Maharashtra 411045' },
  { icon: Clock, label: 'Hours', value: 'Mon to Sat, 10:00 AM to 7:00 PM IST' },
]

export default function Contact() {
  const form = useForm(INITIAL, validate)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [sentTo, setSentTo] = useState(null)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.submit()) return
    setIsSubmitting(true)
    await new Promise((r) => setTimeout(r, 900))
    setIsSubmitting(false)
    setSentTo(form.values.email)
    form.reset()
  }

  return (
    <>
      <PageHero
        eyebrow="Contact Us"
        icon={Mail}
        title={<>Let&apos;s talk about your <span className="wf-text-gradient">workflow</span></>}
        description="Questions about plans, onboarding or a custom setup? We usually reply within one business day."
      />

      <section className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-5 lg:gap-10">
          <Reveal className="min-w-0 lg:col-span-2">
            <ul className="space-y-3 sm:space-y-4">
              {CONTACT_INFO.map((item, idx) => (
                <li key={item.label} className="group flex items-start gap-3.5 rounded-2xl border border-ink-100 bg-white p-4 shadow-card transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900">
                  <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-transform duration-300 group-hover:scale-110', tint(idx).chip)}>
                    <item.icon size={18} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-ink-400">{item.label}</p>
                    {item.href ? (
                      <a href={item.href} className="focus-ring break-words rounded text-sm font-semibold text-ink-800 hover:text-brand-600 dark:text-ink-100">
                        {item.value}
                      </a>
                    ) : (
                      <p className="text-sm font-semibold text-ink-800 dark:text-ink-100">{item.value}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </Reveal>

          <Reveal delay={100} className="min-w-0 lg:col-span-3">
            {sentTo ? (
              <div className="rounded-3xl border border-success-200 bg-gradient-to-b from-success-50/60 to-white p-6 text-center shadow-panel dark:border-success-500/30 dark:from-success-500/5 dark:to-ink-900 sm:p-12" role="status">
                <span className="wf-pop mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-success-400 to-success-600 text-white shadow-glow">
                  <CheckCircle2 size={32} />
                </span>
                <h2 className="mt-5 text-2xl font-bold text-ink-900 dark:text-white">Message sent. Thank you!</h2>
                <p className="mx-auto mt-2 max-w-sm text-sm text-ink-500">
                  We have received your message and sent a confirmation to <span className="font-medium text-ink-700 dark:text-ink-200">{sentTo}</span>.
                  A member of our team will get back to you within one business day.
                </p>
                <Button variant="secondary" className="mt-6" onClick={() => setSentTo(null)}>
                  Send another message
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="relative overflow-hidden rounded-3xl border border-ink-100 bg-white p-5 shadow-panel dark:border-ink-800 dark:bg-ink-900 min-[400px]:p-6 sm:p-8" noValidate aria-label="Contact form">
                <span className="gradient-hero absolute inset-x-0 top-0 h-1.5" aria-hidden="true" />
                <p className="mb-5 text-xs text-ink-400"><span className="text-danger-500">*</span> Required fields</p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Input label="Full Name" required autoComplete="name" placeholder="e.g. Ananya Iyer" leftIcon={<User size={16} />} {...form.bind('name')} />
                  <Input label="Email" type="email" required autoComplete="email" placeholder="you@company.in" leftIcon={<Mail size={16} />} {...form.bind('email')} />
                  <Input label="Phone" type="tel" required autoComplete="tel" inputMode="tel" placeholder="+91 98765 43210" leftIcon={<Phone size={16} />} {...form.bind('phone')} />
                  <Input label="Company" autoComplete="organization" placeholder="e.g. InnoSoft Systems" leftIcon={<Building2 size={16} />} {...form.bind('company')} />
                </div>
                <Input label="Subject" required wrapperClassName="mt-4" placeholder="What can we help with?" leftIcon={<MessageSquare size={16} />} {...form.bind('subject')} />
                <div className="mt-4">
                  <Textarea
                    label="Message"
                    required
                    rows={5}
                    placeholder="Tell us a bit about your team size, current tools and what you would like to achieve..."
                    {...form.bind('message')}
                  />
                  <p className={`mt-1 text-right text-xs ${form.values.message.length > MESSAGE_MAX ? 'text-danger-500' : 'text-ink-400'}`}>
                    {form.values.message.length}/{MESSAGE_MAX}
                  </p>
                </div>
                <Button type="submit" size="lg" className="gradient-brand mt-3 w-full justify-center hover:shadow-glow sm:w-auto" isLoading={isSubmitting} leftIcon={<Send size={16} />}>
                  {isSubmitting ? 'Sending...' : 'Send Message'}
                </Button>
                <p className="mt-3 text-xs text-ink-400">By submitting, you agree to be contacted about WorkFlow360. We never share your details.</p>
              </form>
            )}
          </Reveal>
        </div>
      </section>
    </>
  )
}
