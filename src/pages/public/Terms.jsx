import LegalPage from '../../components/business/LegalPage'

const SECTIONS = [
  {
    id: 'acceptance',
    title: 'Acceptance of Terms',
    paragraphs: [
      'These Terms & Conditions ("Terms") form a binding agreement between you and WorkFlow360 Technologies Pvt Ltd ("WorkFlow360", "we", "us") governing your access to and use of the WorkFlow360 website and cloud workspace (the "Service").',
      'By creating an account, clicking "Create Account" or otherwise using the Service, you confirm that you have read and agree to these Terms and our Privacy Policy. If you are using the Service on behalf of a company, you confirm that you have the authority to bind that company.',
    ],
  },
  {
    id: 'the-service',
    title: 'The Service',
    paragraphs: [
      'WorkFlow360 provides software for managing leads, clients, projects, tasks, employees, documents, meetings, invoices, payments and support tickets. We may add, change or retire features from time to time. Where a change materially reduces the functionality of a paid plan, we will give you at least 30 days\' notice.',
    ],
  },
  {
    id: 'accounts',
    title: 'Accounts and Roles',
    list: [
      'You must provide accurate, current information when you register and keep it up to date.',
      'You must be at least 18 years old and legally able to enter into a contract under the Indian Contract Act, 1872.',
      'Each Company designates one or more administrators who control the workspace, invite employees and clients, and assign roles and permissions.',
      'You are responsible for keeping your password confidential and for all activity under your account. Notify us immediately at security@workflow360.app if you suspect unauthorised use.',
      'Accounts are for individual use. Sharing one login between several people is not permitted.',
    ],
  },
  {
    id: 'plans-and-billing',
    title: 'Plans, Fees and Billing',
    paragraphs: ['WorkFlow360 is offered under the Starter, Business and Enterprise plans described on our Pricing page.'],
    subsections: [
      {
        title: 'Free trial',
        paragraphs: ['New workspaces start with a 14-day free trial. No payment details are needed to begin. At the end of the trial you can choose a paid plan or your workspace will move to read-only mode for 30 days before it is scheduled for deletion.'],
      },
      {
        title: 'Fees and taxes',
        list: [
          'Paid plans are billed in advance, monthly or yearly, in Indian Rupees.',
          'Listed prices are exclusive of GST, which is charged at the prevailing rate and shown on your tax invoice.',
          'Yearly plans are billed once for twelve months and offer a discount compared with monthly billing.',
          'We may change our prices with at least 30 days\' written notice. Changes apply from your next renewal.',
        ],
      },
      {
        title: 'Cancellation and refunds',
        paragraphs: ['You may cancel at any time from your account settings; your plan then remains active until the end of the current billing period. Fees already paid are non-refundable except where required by law or where we have failed to provide the Service for a sustained period.'],
      },
    ],
  },
  {
    id: 'acceptable-use',
    title: 'Acceptable Use',
    paragraphs: ['You agree not to, and not to allow anyone else to:'],
    list: [
      'Use the Service for any unlawful purpose or in violation of any Indian or applicable law.',
      'Attempt to gain unauthorised access to the Service, other workspaces, or our systems and networks.',
      'Upload malware, or content that is defamatory, obscene, infringing or that you do not have the right to share.',
      'Probe, scan or test the vulnerability of the Service without our written permission.',
      'Reverse engineer, copy or resell the Service, or use it to build a competing product.',
      'Send unsolicited bulk messages or use the Service in a way that degrades performance for others.',
    ],
  },
  {
    id: 'your-data',
    title: 'Your Data',
    paragraphs: [
      'You retain all rights in the content and data you upload to or create in WorkFlow360 ("Customer Data"). You grant us a limited licence to host, process and display Customer Data solely to provide, secure and support the Service.',
      'You are responsible for the accuracy and legality of Customer Data, including having the right to add the personal data of your employees, clients and leads. Our handling of personal data is described in the Privacy Policy. You may export your data at any time, and after cancellation we will make it available for export for 30 days before deletion.',
    ],
  },
  {
    id: 'intellectual-property',
    title: 'Intellectual Property',
    paragraphs: [
      'The Service, including its software, design, logos and documentation, is owned by WorkFlow360 and protected by Indian and international intellectual property laws. Subject to these Terms, we grant you a limited, non-exclusive, non-transferable right to use the Service for your internal business purposes.',
      'If you send us feedback or suggestions, you allow us to use them without restriction or obligation to you.',
    ],
  },
  {
    id: 'availability',
    title: 'Service Availability and Support',
    paragraphs: [
      'We aim for 99.9% monthly uptime but do not guarantee uninterrupted or error-free operation. Planned maintenance is announced in advance where possible and is typically scheduled outside Indian business hours.',
      'Support is provided by email on all plans, with priority and SLA-backed support on the Business and Enterprise plans respectively.',
    ],
  },
  {
    id: 'confidentiality',
    title: 'Confidentiality',
    paragraphs: ['Each party agrees to protect the other\'s non-public business information with at least the same care it uses for its own, and to use it only to perform under these Terms. This does not apply to information that is public, independently developed, or that must be disclosed by law.'],
  },
  {
    id: 'warranties',
    title: 'Disclaimer of Warranties',
    paragraphs: ['To the fullest extent permitted by law, the Service is provided "as is" and "as available". We disclaim all implied warranties, including merchantability, fitness for a particular purpose and non-infringement. We do not warrant that the Service will meet every requirement of your business.'],
  },
  {
    id: 'liability',
    title: 'Limitation of Liability',
    paragraphs: [
      'To the maximum extent permitted by law, WorkFlow360 will not be liable for any indirect, incidental, special or consequential damages, or for loss of profits, revenue, goodwill or data arising from your use of the Service.',
      'Our total aggregate liability for any claim under these Terms is limited to the fees you paid to us in the twelve months preceding the event giving rise to the claim. Nothing in these Terms limits liability that cannot be limited under applicable law.',
    ],
  },
  {
    id: 'indemnity',
    title: 'Indemnification',
    paragraphs: ['You agree to indemnify and hold WorkFlow360 harmless from claims, losses and expenses (including reasonable legal fees) arising from Customer Data you upload, your breach of these Terms, or your violation of any law or third-party right.'],
  },
  {
    id: 'termination',
    title: 'Suspension and Termination',
    paragraphs: ['You may stop using the Service and close your account at any time. We may suspend or terminate access if you materially breach these Terms, fail to pay undisputed fees after notice, or use the Service in a way that threatens its security or other customers. Where practical we will give you notice and an opportunity to fix the issue first.'],
    list: ['Sections on data ownership, intellectual property, confidentiality, liability, indemnity and governing law survive termination.'],
  },
  {
    id: 'governing-law',
    title: 'Governing Law and Disputes',
    paragraphs: [
      'These Terms are governed by the laws of India. The parties will first try to resolve any dispute through good-faith discussion for 30 days. Failing that, the dispute will be referred to arbitration in Pune under the Arbitration and Conciliation Act, 1996, before a sole arbitrator appointed by mutual agreement, conducted in English.',
      'Subject to the above, the courts at Pune, Maharashtra have exclusive jurisdiction.',
    ],
  },
  {
    id: 'changes',
    title: 'Changes to These Terms',
    paragraphs: ['We may revise these Terms from time to time. For material changes we will notify Company administrators by email or in-app notice at least 15 days in advance. Continued use of the Service after the effective date means you accept the updated Terms.'],
  },
  {
    id: 'contact',
    title: 'Contact',
    paragraphs: ['For questions about these Terms, write to legal@workflow360.app or WorkFlow360 Technologies Pvt Ltd, Baner Road, Pune, Maharashtra 411045, India.'],
  },
]

export default function Terms() {
  return (
    <LegalPage
      title="Terms & Conditions"
      updatedAt="1 September 2026"
      effectiveAt="15 September 2026"
      intro="Please read these terms carefully. They set out the rules for using WorkFlow360, what you can expect from us and what we expect from you."
      sections={SECTIONS}
      related={{ label: 'Privacy Policy', to: '/privacy' }}
    />
  )
}
