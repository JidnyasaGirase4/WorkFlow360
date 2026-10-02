import LegalPage from '../../components/business/LegalPage'

const SECTIONS = [
  {
    id: 'introduction',
    title: 'Introduction',
    paragraphs: [
      'WorkFlow360 Technologies Pvt Ltd ("WorkFlow360", "we", "us") provides a cloud workspace that helps service companies manage clients, projects, employees, billing and support. This Privacy Policy explains what personal data we collect, why we collect it, how we protect it and the choices you have.',
      'This policy applies to visitors of our website, to customers who create a workspace (each a "Company"), and to the employees and clients whom a Company invites to use WorkFlow360. It is written to comply with the Information Technology Act, 2000, the Information Technology (Reasonable Security Practices and Procedures and Sensitive Personal Data or Information) Rules, 2011 and the Digital Personal Data Protection Act, 2023.',
    ],
  },
  {
    id: 'information-we-collect',
    title: 'Information We Collect',
    paragraphs: ['We collect only the information we need to run and improve the service.'],
    subsections: [
      {
        title: 'Information you provide',
        list: [
          'Account details: your name, work email address, mobile number, company name and password (stored as a salted hash).',
          'Workspace content: leads, clients, projects, tasks, documents, invoices, tickets and other records you or your team add to WorkFlow360.',
          'Billing details: GSTIN, billing address and payment references for paid plans. We do not store full card or UPI credentials.',
          'Communications: messages you send us through the contact form, email or support tickets.',
        ],
      },
      {
        title: 'Information collected automatically',
        list: [
          'Device and log data such as IP address, browser type, operating system, pages viewed and timestamps.',
          'Usage data such as features used and actions taken inside your workspace, used to improve the product and to build your audit trail.',
          'Cookies and local storage used to keep you signed in and to remember preferences such as light or dark theme.',
        ],
      },
    ],
  },
  {
    id: 'how-we-use-information',
    title: 'How We Use Your Information',
    paragraphs: ['We process personal data on the basis of your consent, to perform our contract with you, and for our legitimate business purposes. Specifically, we use it to:'],
    list: [
      'Create and secure your account and provide the WorkFlow360 features you have signed up for.',
      'Process subscription payments and issue GST-compliant tax invoices.',
      'Send service messages such as verification emails, password resets, invoice reminders and security alerts.',
      'Provide customer support and respond to your enquiries.',
      'Monitor performance, prevent fraud and abuse, and keep the platform secure.',
      'Improve and develop new features using aggregated, de-identified usage data.',
    ],
  },
  {
    id: 'roles-of-company-and-workflow360',
    title: 'Company Data and Our Role',
    paragraphs: [
      'When a Company adds information about its own employees, clients and leads to WorkFlow360, the Company decides why and how that data is used and we act as a data processor on its behalf. We process this data only on the Company\'s documented instructions and as described in our Terms & Conditions.',
      'If you are an employee or client of a Company and have questions about how your data is used inside its workspace, please contact that Company first. We will assist them in responding to your request.',
    ],
  },
  {
    id: 'sharing',
    title: 'How We Share Information',
    paragraphs: ['We do not sell your personal data. We share it only in the following limited circumstances:'],
    list: [
      'Service providers who help us run WorkFlow360, such as cloud hosting, email delivery, payment gateways and customer-support tools. They are bound by written confidentiality and data protection obligations.',
      'Within your Company, according to the roles and permissions your administrators configure.',
      'Legal and safety reasons, where disclosure is required by law, court order or government authority, or is necessary to protect the rights, property or safety of WorkFlow360, our users or the public.',
      'Business transfers, if WorkFlow360 is involved in a merger, acquisition or sale of assets. We will notify you before your data becomes subject to a different privacy policy.',
    ],
  },
  {
    id: 'security',
    title: 'Data Security',
    paragraphs: ['We follow reasonable security practices appropriate to the sensitivity of the data we handle, including:'],
    list: [
      'Role-based access control so people see only what their role allows, and client-level data isolation.',
      'Encryption of data in transit using TLS, and of stored passwords using industry-standard hashing.',
      'Token-based sessions with automatic expiry and the ability to sign out of all devices.',
      'An activity audit trail of key actions inside each workspace.',
      'Access to production systems restricted to authorised staff on a need-to-know basis.',
    ],
    subsections: [
      {
        title: 'Breach notification',
        paragraphs: ['If we become aware of a personal data breach that affects you, we will notify affected Companies and, where required, the Data Protection Board of India and CERT-In, without undue delay.'],
      },
    ],
  },
  {
    id: 'retention',
    title: 'Data Retention',
    paragraphs: [
      'We keep personal data for as long as your account is active or as needed to provide the service. If you close your workspace, we permanently delete or anonymise your content within 90 days, except where we must retain certain records, such as tax invoices, for the period required by Indian law (generally up to eight years).',
      'Backups are overwritten on a rolling schedule and are not restored except in the case of a disaster.',
    ],
  },
  {
    id: 'your-rights',
    title: 'Your Rights and Choices',
    paragraphs: ['Subject to applicable law, you have the right to:'],
    list: [
      'Access a summary of the personal data we hold about you.',
      'Correct inaccurate or incomplete data, most of which you can do yourself in your profile settings.',
      'Request erasure of your personal data when it is no longer necessary for the purpose it was collected.',
      'Withdraw consent for optional processing, such as marketing emails, at any time using the unsubscribe link or your settings.',
      'Nominate another person to exercise your rights in the event of your death or incapacity.',
      'Lodge a grievance with us and, if unresolved, with the Data Protection Board of India.',
    ],
    subsections: [
      {
        title: 'How to exercise your rights',
        paragraphs: ['Email privacy@workflow360.app from your registered email address. We will verify your identity and respond within 30 days.'],
      },
    ],
  },
  {
    id: 'cookies',
    title: 'Cookies and Similar Technologies',
    paragraphs: [
      'We use a small number of first-party cookies and browser storage items that are strictly necessary, for example to keep you signed in, protect against cross-site request forgery and remember your theme preference. We do not use third-party advertising cookies.',
      'You can block cookies in your browser settings, but parts of WorkFlow360 may not work correctly if you do.',
    ],
  },
  {
    id: 'children',
    title: 'Children\'s Privacy',
    paragraphs: ['WorkFlow360 is a business product intended for people aged 18 and over. We do not knowingly collect personal data from children. If you believe a child has provided us with personal data, please contact us and we will delete it.'],
  },
  {
    id: 'transfers',
    title: 'Data Location and Transfers',
    paragraphs: ['Workspace data is hosted in data centres located in India. If we ever need to transfer personal data outside India, we will do so only to countries permitted under Indian law and with appropriate safeguards in place.'],
  },
  {
    id: 'changes',
    title: 'Changes to This Policy',
    paragraphs: ['We may update this policy from time to time to reflect changes in our practices or in the law. If we make material changes, we will notify Company administrators by email and through an in-app notice at least 15 days before they take effect. The "Last updated" date at the top of this page always shows the current version.'],
  },
  {
    id: 'grievance',
    title: 'Grievance Officer',
    paragraphs: ['In accordance with the Information Technology Act, 2000 and the rules made under it, the name and contact details of our Grievance Officer are:'],
    list: [
      'Name: Sneha Kulkarni, Data Protection & Compliance Lead',
      'Email: grievance@workflow360.app',
      'Address: WorkFlow360 Technologies Pvt Ltd, Baner Road, Pune, Maharashtra 411045, India',
      'Response time: we acknowledge complaints within 48 hours and aim to resolve them within 30 days.',
    ],
  },
]

export default function Privacy() {
  return (
    <LegalPage
      title="Privacy Policy"
      updatedAt="1 September 2026"
      effectiveAt="15 September 2026"
      intro="Your trust matters to us. This policy explains in plain language what information WorkFlow360 collects, how we use and protect it, and the control you have over it."
      sections={SECTIONS}
      related={{ label: 'Terms & Conditions', to: '/terms' }}
    />
  )
}
