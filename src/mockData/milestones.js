export const MILESTONE_STATUSES = ['upcoming', 'in_progress', 'done', 'delayed']

export const milestones = [
  { id: 'ms-1', projectId: 'prj-1', title: 'Design system and wireframes signed off', description: 'Approved component library, page templates and mobile wireframes.', dueDate: '2026-07-10', status: 'done', owner: 'Sneha Joshi' },
  { id: 'ms-2', projectId: 'prj-1', title: 'CMS integration complete', description: 'Content API wired to all marketing pages with preview mode.', dueDate: '2026-09-30', status: 'in_progress', owner: 'Rohit Girase' },
  { id: 'ms-3', projectId: 'prj-1', title: 'Content migration and QA sweep', description: 'Migrate 140 legacy pages and complete cross-browser testing.', dueDate: '2026-10-15', status: 'upcoming', owner: 'Tanvi Deshpande' },
  { id: 'ms-4', projectId: 'prj-1', title: 'Go-live and DNS cutover', description: 'Production launch with redirects and analytics verified.', dueDate: '2026-11-05', status: 'upcoming', owner: 'Jay Girase' },
  { id: 'ms-5', projectId: 'prj-2', title: 'Requirements and data model freeze', description: 'Signed-off BRD, entity model and role matrix.', dueDate: '2026-08-05', status: 'done', owner: 'Jay Girase' },
  { id: 'ms-6', projectId: 'prj-2', title: 'Lead pipeline module (beta)', description: 'Kanban pipeline, lead scoring and follow-up reminders.', dueDate: '2026-09-20', status: 'delayed', owner: 'Amit Kulkarni' },
  { id: 'ms-7', projectId: 'prj-2', title: 'Client portal and invoicing', description: 'Portal login, invoice view and GST-compliant PDF export.', dueDate: '2026-11-10', status: 'upcoming', owner: 'Rohit Girase' },
  { id: 'ms-8', projectId: 'prj-3', title: 'Discovery and scope sign-off', description: 'Confirm catalog structure, gateway choice and phase 1 scope.', dueDate: '2026-09-23', status: 'in_progress', owner: 'Jidnyasa Girase' },
  { id: 'ms-9', projectId: 'prj-3', title: 'UX prototypes approved', description: 'Clickable prototypes for storefront and checkout.', dueDate: '2026-10-20', status: 'upcoming', owner: 'Sneha Joshi' },
  { id: 'ms-10', projectId: 'prj-3', title: 'Payment gateway integration', description: 'Razorpay integration with UPI, cards and net banking.', dueDate: '2026-12-05', status: 'upcoming', owner: 'Amit Kulkarni' },
  { id: 'ms-11', projectId: 'prj-4', title: 'Client budget approval', description: 'InnoSoft board approval needed to resume development.', dueDate: '2026-09-15', status: 'delayed', owner: 'Jay Girase' },
  { id: 'ms-12', projectId: 'prj-4', title: 'Beta build on TestFlight and Play Console', description: 'Internal beta with crash reporting enabled.', dueDate: '2026-11-25', status: 'upcoming', owner: 'Rohit Girase' },
  { id: 'ms-13', projectId: 'prj-5', title: 'Booking flow MVP', description: 'Room search, availability calendar and booking confirmation.', dueDate: '2026-08-28', status: 'done', owner: 'Amit Kulkarni' },
  { id: 'ms-14', projectId: 'prj-5', title: 'Loyalty tier engine', description: 'Points accrual, tier upgrades and redemption rules.', dueDate: '2026-10-08', status: 'in_progress', owner: 'Amit Kulkarni' },
  { id: 'ms-15', projectId: 'prj-5', title: 'Membership payments and launch', description: 'Recurring membership billing and soft launch at two properties.', dueDate: '2026-10-30', status: 'upcoming', owner: 'Jidnyasa Girase' },
  { id: 'ms-16', projectId: 'prj-6', title: 'Dashboard handover and sign-off', description: 'Training session, documentation and formal acceptance.', dueDate: '2026-07-01', status: 'done', owner: 'Amit Kulkarni' },
]
