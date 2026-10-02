export const TASK_STATUSES = ['todo', 'in_progress', 'review', 'done']

// Checklist helper: marks items done according to the task's stage.
function checklist(status, items) {
  return items.map((text, i) => {
    let done = false
    if (status === 'done') done = true
    else if (status === 'review') done = i < items.length - 1
    else if (status === 'in_progress') done = i < Math.floor(items.length / 2)
    return { id: `chk-${i + 1}`, text, done }
  })
}

export const tasks = [
  { id: 'tsk-1', title: 'Design homepage hero section', project: 'Corporate Website Redesign', projectId: 'prj-1', assignee: 'Sneha Joshi', priority: 'high', status: 'done', dueDate: '2026-09-10', comments: 4, attachments: 2, description: 'Design the hero section for the new marketing homepage including headline, supporting copy, primary CTA and the product visual. Deliver desktop, tablet and mobile variants in the shared Figma library.', checklist: checklist('done', ['Draft three layout options', 'Review options with BrightPixel marketing team', 'Finalise hero for desktop, tablet and mobile', 'Hand off specs to development']) },
  { id: 'tsk-2', title: 'Build responsive navbar component', project: 'Corporate Website Redesign', projectId: 'prj-1', assignee: 'Rohit Girase', priority: 'medium', status: 'done', dueDate: '2026-09-12', comments: 2, attachments: 0, description: 'Implement the sticky navbar with mega-menu for Solutions, a collapsible mobile drawer and keyboard-accessible dropdowns. Must pass Lighthouse accessibility checks.', checklist: checklist('done', ['Desktop mega-menu', 'Mobile drawer with focus trap', 'Keyboard and screen reader pass']) },
  { id: 'tsk-3', title: 'Integrate CMS content API', project: 'Corporate Website Redesign', projectId: 'prj-1', assignee: 'Rohit Girase', priority: 'high', status: 'in_progress', dueDate: '2026-09-26', comments: 6, attachments: 1, description: 'Connect all marketing pages to the headless CMS content API. Includes typed content models, incremental static regeneration and a preview mode for the BrightPixel editorial team.', checklist: checklist('in_progress', ['Map CMS content models to page templates', 'Implement content fetching with caching', 'Add preview mode for editors', 'Handle empty and error states']) },
  { id: 'tsk-4', title: 'QA pass on blog templates', project: 'Corporate Website Redesign', projectId: 'prj-1', assignee: 'Tanvi Deshpande', priority: 'medium', status: 'review', dueDate: '2026-09-24', comments: 3, attachments: 0, description: 'Cross-browser and device QA on the blog listing, article and category templates. Log defects with screenshots and verify fixes before sign-off.', checklist: checklist('review', ['Test on Chrome, Safari and Firefox', 'Test on iOS and Android devices', 'Verify SEO meta tags and OG images']) },
  { id: 'tsk-5', title: 'Design lead pipeline Kanban UI', project: 'CRM Implementation', projectId: 'prj-2', assignee: 'Sneha Joshi', priority: 'high', status: 'done', dueDate: '2026-08-30', comments: 5, attachments: 3, description: 'Design the lead pipeline board with stage columns, drag-and-drop states, lead cards showing value in INR, owner and next follow-up. Include empty and loading states.', checklist: checklist('done', ['Wireframe pipeline stages', 'Design lead card variants', 'Document drag and drop interaction states']) },
  { id: 'tsk-6', title: 'Build leads REST endpoints', project: 'CRM Implementation', projectId: 'prj-2', assignee: 'Amit Kulkarni', priority: 'high', status: 'in_progress', dueDate: '2026-09-28', comments: 7, attachments: 1, description: 'Build CRUD, bulk update and export endpoints for leads with pagination, filtering by status, source and owner, and role based access. Publish the OpenAPI spec for the frontend team.', checklist: checklist('in_progress', ['CRUD endpoints with validation', 'Filtering, sorting and pagination', 'Bulk status change and owner assignment', 'CSV export endpoint', 'OpenAPI documentation']) },
  { id: 'tsk-7', title: 'Set up CI pipeline for staging', project: 'CRM Implementation', projectId: 'prj-2', assignee: 'Karthik Reddy', priority: 'medium', status: 'todo', dueDate: '2026-10-02', comments: 1, attachments: 0, description: 'Create a CI/CD pipeline that lints, tests and deploys every merge to main to the staging environment on AWS, with Slack notifications on failure.', checklist: checklist('todo', ['Configure build and test stages', 'Provision staging environment', 'Add deployment notifications']) },
  { id: 'tsk-8', title: 'Client portal invoice view', project: 'CRM Implementation', projectId: 'prj-2', assignee: 'Rohit Girase', priority: 'medium', status: 'todo', dueDate: '2026-10-05', comments: 0, attachments: 0, description: 'Build the invoice list and detail view for the client portal with GST breakup, payment status and PDF download.', checklist: checklist('todo', ['Invoice list with filters', 'Invoice detail with GST summary', 'PDF download action']) },
  { id: 'tsk-9', title: 'Wireframe checkout flow', project: 'E-commerce Platform', projectId: 'prj-3', assignee: 'Sneha Joshi', priority: 'high', status: 'in_progress', dueDate: '2026-09-25', comments: 2, attachments: 4, description: 'Wireframe the guest and logged-in checkout flow covering address, delivery slot, UPI, card and net banking payment options, and order confirmation.', checklist: checklist('in_progress', ['Map checkout steps and edge cases', 'Wireframe address and delivery step', 'Wireframe payment step with UPI and cards', 'Wireframe order confirmation']) },
  { id: 'tsk-10', title: 'Set up product catalog schema', project: 'E-commerce Platform', projectId: 'prj-3', assignee: 'Amit Kulkarni', priority: 'medium', status: 'todo', dueDate: '2026-09-30', comments: 0, attachments: 0, description: 'Define the database schema for products, variants, categories, pricing tiers and inventory, ready for the Meridian Retail SKU import.', checklist: checklist('todo', ['Model products and variants', 'Model categories and attributes', 'Write migration and seed scripts']) },
  { id: 'tsk-11', title: 'Loyalty tier calculation logic', project: 'Booking & Membership Portal', projectId: 'prj-5', assignee: 'Amit Kulkarni', priority: 'high', status: 'review', dueDate: '2026-09-23', comments: 4, attachments: 1, description: 'Implement points accrual, tier upgrade and downgrade rules and redemption limits for the Coastal Hospitality loyalty programme, with unit tests for each tier boundary.', checklist: checklist('review', ['Points accrual rules', 'Tier upgrade and downgrade rules', 'Redemption limits', 'Unit tests for tier boundaries']) },
  { id: 'tsk-12', title: 'Booking calendar UI polish', project: 'Booking & Membership Portal', projectId: 'prj-5', assignee: 'Sneha Joshi', priority: 'low', status: 'done', dueDate: '2026-09-14', comments: 1, attachments: 0, description: 'Polish the availability calendar: hover states, selected range styling, disabled dates and mobile touch targets.', checklist: checklist('done', ['Range selection styling', 'Disabled and sold-out dates', 'Mobile touch targets']) },
  { id: 'tsk-13', title: 'Mobile nav accessibility fixes', project: 'Mobile Application — InnoSoft', projectId: 'prj-4', assignee: 'Tanvi Deshpande', priority: 'low', status: 'todo', dueDate: '2026-10-10', comments: 0, attachments: 0, description: 'Fix screen reader labels, focus order and touch target sizes in the bottom tab navigation reported in the accessibility audit.', checklist: checklist('todo', ['Add accessible labels to tab icons', 'Fix focus order', 'Increase touch targets to 44px']) },
  { id: 'tsk-14', title: 'Payment gateway sandbox testing', project: 'E-commerce Platform', projectId: 'prj-3', assignee: 'Tanvi Deshpande', priority: 'urgent', status: 'todo', dueDate: '2026-09-23', comments: 2, attachments: 0, description: 'Run the Razorpay sandbox test matrix for UPI, cards, net banking and wallets including failed, pending and refunded payment scenarios.', checklist: checklist('todo', ['UPI success and failure cases', 'Card 3-D Secure flows', 'Refund and partial refund scenarios', 'Webhook retry handling']) },
]

export function getTaskById(id) {
  return tasks.find((t) => t.id === id)
}

// ---- Additive detail data (comments, attachments, activity history) ---------
const TEAM_BY_PROJECT = {
  'prj-1': ['Rohit Girase', 'Sneha Joshi', 'Tanvi Deshpande', 'Jay Girase'],
  'prj-2': ['Amit Kulkarni', 'Rohit Girase', 'Karthik Reddy', 'Jay Girase'],
  'prj-3': ['Sneha Joshi', 'Amit Kulkarni', 'Tanvi Deshpande', 'Jidnyasa Girase'],
  'prj-4': ['Rohit Girase', 'Tanvi Deshpande', 'Jay Girase'],
  'prj-5': ['Sneha Joshi', 'Amit Kulkarni', 'Tanvi Deshpande', 'Jidnyasa Girase'],
}

const GENERIC_COMMENTS = [
  'Picked this up, will share an update by end of day.',
  'Pushed the latest changes to the feature branch. Ready for a quick look.',
  'Blocked on client feedback for the copy, following up with the project manager.',
  'Updated the estimate after reviewing the scope again.',
  'Looks good to me. Approved from my side.',
  "Can we align on this in tomorrow's stand-up?",
  'Added the edge cases to the checklist.',
  'Reproduced this on staging, notes attached in the ticket.',
  'Client confirmed the approach on the call yesterday.',
  'Small tweak needed on spacing at the mobile breakpoint.',
]

const SPECIFIC_COMMENTS = {
  'tsk-3': ['CMS staging credentials are in the shared vault, sharing the model docs shortly.', 'Preview mode works for pages. Blog posts still need the draft token.'],
  'tsk-6': ['Bulk status endpoint will accept up to 200 lead IDs per request.', 'Frontend needs the owner filter as a query param, adding it now.'],
  'tsk-14': ['Sandbox keys received from Razorpay. Starting with the UPI collect flow.'],
  'tsk-11': ['Tier boundaries match the sheet Farhan shared. Ready for review.'],
}

function buildComments(task) {
  const authors = TEAM_BY_PROJECT[task.projectId] || [task.assignee]
  const specific = SPECIFIC_COMMENTS[task.id] || []
  const number = Number(task.id.split('-')[1])
  return Array.from({ length: task.comments }).map((_, i) => {
    const text = specific[i] || GENERIC_COMMENTS[(number + i * 3) % GENERIC_COMMENTS.length]
    const author = i === 0 ? task.assignee : authors[(number + i) % authors.length]
    const day = String(12 + i).padStart(2, '0')
    const hour = String(9 + ((number + i * 2) % 9)).padStart(2, '0')
    return { id: `${task.id}-cm-${i + 1}`, author, text, time: `2026-09-${day}T${hour}:${i % 2 ? '40' : '15'}:00` }
  })
}

const ATTACHMENTS = {
  'tsk-1': [['Hero_Section_v2.fig', 3480000], ['Hero_Copy_Deck.pdf', 634000]],
  'tsk-3': [['CMS_API_Contract.pdf', 412000]],
  'tsk-5': [['Pipeline_Kanban_Wireframes.fig', 4200000], ['Pipeline_States.png', 890000], ['Kanban_Spec.pdf', 305000]],
  'tsk-6': [['Leads_API_Spec.pdf', 268000]],
  'tsk-9': [['Checkout_Wireframes_v1.fig', 5100000], ['Checkout_Flow.png', 1250000], ['Payment_Options.pdf', 342000], ['Competitor_Benchmark.xlsx', 96000]],
  'tsk-11': [['Loyalty_Tier_Rules.xlsx', 74000]],
}

function buildAttachments(task) {
  const list = ATTACHMENTS[task.id] || []
  const team = TEAM_BY_PROJECT[task.projectId] || [task.assignee]
  return list.map(([name, size], i) => ({
    id: `${task.id}-att-${i + 1}`,
    name,
    size,
    uploadedBy: i === 0 ? task.assignee : team[1] || task.assignee,
    time: `2026-09-${String(8 + i).padStart(2, '0')}T11:20:00`,
  }))
}

const STAGE_LABEL = { todo: 'Todo', in_progress: 'In Progress', review: 'Review', done: 'Completed' }

function buildHistory(task) {
  const team = TEAM_BY_PROJECT[task.projectId] || [task.assignee]
  const manager = team[team.length - 1]
  const events = [
    { id: `${task.id}-h-1`, actor: manager, text: 'created this task', time: '2026-09-01T09:30:00', tone: 'neutral' },
    { id: `${task.id}-h-2`, actor: manager, text: `assigned this task to ${task.assignee}`, time: '2026-09-01T09:32:00', tone: 'info' },
  ]
  const path = ['in_progress', 'review', 'done']
  const reached = path.slice(0, path.indexOf(task.status) + 1)
  reached.forEach((stage, i) => {
    events.push({
      id: `${task.id}-h-${i + 3}`,
      actor: task.assignee,
      text: `moved this task to ${STAGE_LABEL[stage]}`,
      time: `2026-09-${String(5 + i * 3).padStart(2, '0')}T15:10:00`,
      tone: stage === 'done' ? 'success' : 'brand',
    })
  })
  return events.reverse()
}

export const taskDetailsSeed = Object.fromEntries(
  tasks.map((t) => [
    t.id,
    { commentList: buildComments(t), attachmentList: buildAttachments(t), history: buildHistory(t) },
  ])
)
