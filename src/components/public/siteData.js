// Shared marketing content (mock data) used by Home, Pricing and FAQ.

export const FAQS = [
  {
    q: 'What is WorkFlow360?',
    a: 'WorkFlow360 is an all-in-one business workspace that brings CRM, project management, employee management, invoicing, a client portal and a support desk into one product, so service companies stop juggling spreadsheets, chat threads and five different tools.',
  },
  {
    q: 'Who can use WorkFlow360?',
    a: 'Any team that manages clients and delivers work: IT and software companies, digital agencies, consulting firms, startups and growing service businesses. Company admins, managers, employees and even your clients each get their own tailored workspace.',
  },
  {
    q: 'Can clients access their projects?',
    a: 'Yes. Every client gets a secure portal where they can follow project progress and milestones, download shared documents, raise support tickets and view or download their invoices, without seeing anything from other clients.',
  },
  {
    q: 'Can employees have different permissions?',
    a: 'Yes. Roles such as Company Admin, Manager, Employee and Client each see a different navigation and a different level of access. On the Enterprise plan you can define fully custom roles and module-level permissions.',
  },
  {
    q: 'Does it support invoices?',
    a: 'Yes. Create quotations, convert them to GST-ready invoices with automatic tax and discount calculations, record payments and track outstanding balances. Payment status and reminders are visible to both your team and the client.',
  },
  {
    q: 'Can I manage multiple projects?',
    a: 'Absolutely. Run as many projects as your plan allows, each with its own Kanban board, milestones, budget-vs-spend tracking, team members and files, with a single dashboard that rolls everything up.',
  },
  {
    q: 'Is there a mobile version?',
    a: 'WorkFlow360 is fully responsive, so dashboards, tables, boards and forms adapt to phones and tablets in any modern mobile browser. You can add it to your home screen for quick access. Native apps are on our roadmap.',
  },
  {
    q: 'Is my data secure?',
    a: 'Every workspace is isolated. Access is role-based, sessions are token-based with expiry, and important actions are captured in an activity audit trail. Enterprise customers can also request dedicated onboarding and security reviews.',
  },
]

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    audience: 'Small teams',
    tagline: 'For small teams getting organised and shipping their first client projects.',
    monthly: 1999,
    yearly: 1599,
    highlight: false,
    cta: 'Start Free Trial',
    features: [
      'Up to 5 team members',
      'Up to 10 active clients',
      'CRM & lead pipeline',
      'Project & task management',
      'Quotations & basic invoicing',
      'Email support',
    ],
  },
  {
    id: 'business',
    name: 'Business',
    audience: 'Growing companies',
    tagline: 'For growing companies that need the client portal, billing and support desk.',
    monthly: 4999,
    yearly: 3999,
    highlight: true,
    cta: 'Start Free Trial',
    features: [
      'Up to 25 team members',
      'Unlimited clients',
      'Client portal access',
      'Attendance, leave & departments',
      'Advanced billing & expenses',
      'Support ticketing with SLAs',
      'Priority support',
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    audience: 'Larger organisations',
    tagline: 'For larger organisations with custom roles, integrations and compliance needs.',
    monthly: null,
    yearly: null,
    highlight: false,
    cta: 'Contact Sales',
    features: [
      'Unlimited team members',
      'Unlimited clients & projects',
      'Custom roles & permissions',
      'Dedicated onboarding manager',
      'Custom integrations & API access',
      'SLA-backed priority support',
    ],
  },
]

export const COMPARISON_GROUPS = [
  {
    group: 'Workspace',
    rows: [
      { label: 'Team members', starter: 'Up to 5', business: 'Up to 25', enterprise: 'Unlimited' },
      { label: 'Active clients', starter: 'Up to 10', business: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Active projects', starter: 'Up to 15', business: 'Unlimited', enterprise: 'Unlimited' },
      { label: 'Document storage', starter: '10 GB', business: '100 GB', enterprise: '1 TB+' },
    ],
  },
  {
    group: 'Core modules',
    rows: [
      { label: 'Leads & CRM pipeline', starter: true, business: true, enterprise: true },
      { label: 'Project & task management', starter: true, business: true, enterprise: true },
      { label: 'Quotations & invoicing', starter: true, business: true, enterprise: true },
      { label: 'Employee attendance & leave', starter: false, business: true, enterprise: true },
      { label: 'Client portal', starter: false, business: true, enterprise: true },
      { label: 'Support ticketing', starter: false, business: true, enterprise: true },
      { label: 'Reports & analytics', starter: 'Basic', business: 'Advanced', enterprise: 'Advanced + export' },
    ],
  },
  {
    group: 'Security & support',
    rows: [
      { label: 'Role-based access', starter: 'Standard roles', business: 'Standard roles', enterprise: 'Custom roles' },
      { label: 'Activity audit trail', starter: false, business: true, enterprise: true },
      { label: 'Dedicated onboarding', starter: false, business: false, enterprise: true },
      { label: 'Custom integrations & API', starter: false, business: false, enterprise: true },
      { label: 'Support', starter: 'Email', business: 'Priority', enterprise: 'SLA-backed' },
    ],
  },
]

export const PRICING_FAQS = [
  { q: 'Can I change plans later?', a: 'Yes. You can upgrade or downgrade at any time. Changes take effect immediately and the difference is prorated on your next bill.' },
  { q: 'Is there a free trial?', a: 'Every plan starts with a 14-day free trial with full feature access. No credit card is required to begin.' },
  { q: 'Do prices include GST?', a: 'Listed prices are exclusive of GST. 18% GST is added at checkout and a GST-compliant tax invoice is issued for every payment.' },
  { q: 'What happens if I exceed my team-member limit?', a: 'We notify you before you hit a limit so you can upgrade without any disruption. Nothing is switched off suddenly.' },
  { q: 'How does the yearly discount work?', a: 'Choosing yearly billing saves you 20% compared with paying month to month. You are billed once a year.' },
]

export const TRUSTED = [
  'TechNova Solutions',
  'BrightPixel Labs',
  'CloudMatrix Technologies',
  'InnoSoft Systems',
  'Meridian Retail',
  'Zenith Financial',
  'Nimbus Freight',
  'Orbit Analytics',
]

export const TESTIMONIALS = [
  {
    name: 'Karan Mehta',
    role: 'COO, CloudMatrix Technologies',
    quote: 'WorkFlow360 replaced four different tools we were juggling. Our delivery team finally has one place to see leads, projects and invoices.',
  },
  {
    name: 'Aditi Rao',
    role: 'Marketing Head, BrightPixel Labs',
    quote: 'The client portal alone has cut our status-update calls in half. Our clients love that they can see progress and invoices themselves.',
  },
  {
    name: 'Suresh Pillai',
    role: 'Director, Meridian Retail Pvt Ltd',
    quote: 'Billing used to be a mess of spreadsheets. Now quotations, GST invoices, payments and reminders just happen in one flow.',
  },
]
