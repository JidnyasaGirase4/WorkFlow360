// Client-portal-only mock data. Everything here is safe to show to the client
// (no budgets, margins or internal notes). Records are keyed by company /
// project so the portal can scope strictly to the logged-in client.

export const clientSharedFiles = [
  {
    id: 'cdoc-1',
    name: 'Milestone_3_Status_Report.pdf',
    category: 'Project Documents',
    project: 'Corporate Website Redesign',
    client: 'BrightPixel Labs',
    uploadedBy: 'Jay Girase',
    uploadedDate: '2026-09-18',
    size: '640 KB',
    sizeBytes: 655360,
    type: 'pdf',
  },
  {
    id: 'cdoc-2',
    name: 'Sitemap_and_URL_Redirects.xlsx',
    category: 'Project Documents',
    project: 'Corporate Website Redesign',
    client: 'BrightPixel Labs',
    uploadedBy: 'Rohit Girase',
    uploadedDate: '2026-09-12',
    size: '128 KB',
    sizeBytes: 131072,
    type: 'sheet',
  },
  {
    id: 'cdoc-3',
    name: 'Brand_Assets_Logo_Pack.zip',
    category: 'Other',
    project: 'Corporate Website Redesign',
    client: 'BrightPixel Labs',
    uploadedBy: 'Aditi Rao',
    uploadedDate: '2026-06-04',
    size: '8.4 MB',
    sizeBytes: 8808038,
    type: 'archive',
  },
  {
    id: 'cdoc-4',
    name: 'INV-2026-00124.pdf',
    category: 'Invoices',
    project: null,
    client: 'BrightPixel Labs',
    uploadedBy: 'System',
    uploadedDate: '2026-09-05',
    size: '204 KB',
    sizeBytes: 208896,
    type: 'pdf',
  },
]

// Client-facing project activity (progress updates, deliveries, approvals).
export const clientProjectUpdates = {
  'prj-1': [
    { id: 'u1', actor: 'Jay Girase', text: 'shared the Milestone 3 status report', time: '2026-09-18T10:00:00', tone: 'brand' },
    { id: 'u2', actor: 'Rohit Girase', text: 'connected the CMS content API to the blog and case study pages', time: '2026-09-17T16:30:00', tone: 'success' },
    { id: 'u3', actor: 'Tanvi Deshpande', text: 'completed cross-browser QA on the blog templates', time: '2026-09-15T14:10:00', tone: 'success' },
    { id: 'u4', actor: 'Sneha Joshi', text: 'uploaded Homepage_Wireframes_v3.fig for your review', time: '2026-08-14T12:00:00', tone: 'info' },
    { id: 'u5', actor: 'Jay Girase', text: 'kicked off the project with your marketing team', time: '2026-06-01T09:30:00', tone: 'neutral' },
  ],
}

export const PAYMENT_METHODS = [
  { value: 'upi', label: 'UPI', description: 'Pay using GPay, PhonePe, Paytm or any UPI app' },
  { value: 'card', label: 'Credit / Debit Card', description: 'Visa, Mastercard, RuPay and American Express' },
  { value: 'netbanking', label: 'Net Banking', description: 'HDFC, ICICI, SBI, Axis and 40+ banks' },
]

export const NETBANKING_BANKS = ['HDFC Bank', 'ICICI Bank', 'State Bank of India', 'Axis Bank', 'Kotak Mahindra Bank', 'Bank of Baroda']

export const SUPPORT_CATEGORIES = ['Technical Issue', 'Billing & Invoicing', 'Feature Request', 'Access & Permissions', 'Integration', 'General Query']

// Extra upcoming meetings for the demo client so the portal has content in
// its "Upcoming" views (the shared meetings mock has none for BrightPixel).
export const portalMeetings = [
  {
    id: 'pm-1',
    title: 'Milestone 3 Review — Corporate Website Redesign',
    client: 'BrightPixel Labs',
    project: 'Corporate Website Redesign',
    date: '2026-09-29',
    time: '11:00',
    type: 'Video Call',
    link: 'https://meet.workflow360.app/brightpixel-milestone-3',
    participants: ['Jay Girase', 'Rohit Girase', 'Sneha Joshi', 'Aditi Rao'],
    status: 'upcoming',
    notes: 'Walk through the CMS-connected pages and agree the content migration plan.',
  },
  {
    id: 'pm-2',
    title: 'Go-live Readiness Workshop',
    client: 'BrightPixel Labs',
    project: 'Corporate Website Redesign',
    date: '2026-10-08',
    time: '15:00',
    type: 'In Person',
    link: null,
    participants: ['Jay Girase', 'Tanvi Deshpande', 'Rohit Girase', 'Aditi Rao'],
    status: 'upcoming',
    notes: 'Review QA results, the redirect map and the DNS cutover checklist.',
  },
]
