// `visibility`: 'everyone' | 'team' | 'admins'  (who can open the file)
// `status`: 'active' | 'in_review' | 'signed' | 'archived'
export const DOCUMENT_CATEGORIES = [
  'Client Documents',
  'Project Documents',
  'Employee Documents',
  'Contracts',
  'Invoices',
  'Other',
]

export const documents = [
  { id: 'doc-1', name: 'Website_Redesign_Contract.pdf', category: 'Contracts', project: 'Corporate Website Redesign', client: 'BrightPixel Labs', uploadedBy: 'Jay Girase', uploadedDate: '2026-06-02', size: '1.2 MB', sizeBytes: 1258291, type: 'pdf', visibility: 'admins', status: 'signed' },
  { id: 'doc-2', name: 'Homepage_Wireframes_v3.fig', category: 'Project Documents', project: 'Corporate Website Redesign', client: 'BrightPixel Labs', uploadedBy: 'Sneha Joshi', uploadedDate: '2026-08-14', size: '4.6 MB', sizeBytes: 4823449, type: 'design', visibility: 'team', status: 'active' },
  { id: 'doc-3', name: 'CRM_Requirements_Spec.docx', category: 'Project Documents', project: 'CRM Implementation', client: 'CloudMatrix Technologies', uploadedBy: 'Karan Mehta', uploadedDate: '2026-07-20', size: '860 KB', sizeBytes: 880640, type: 'doc', visibility: 'team', status: 'in_review' },
  { id: 'doc-4', name: 'INV-2026-00118.pdf', category: 'Invoices', project: null, client: 'BrightPixel Labs', uploadedBy: 'System', uploadedDate: '2026-08-01', size: '210 KB', sizeBytes: 215040, type: 'pdf', visibility: 'admins', status: 'active' },
  { id: 'doc-5', name: 'NDA_InnoSoft_Systems.pdf', category: 'Contracts', project: null, client: 'InnoSoft Systems', uploadedBy: 'Jidnyasa Girase', uploadedDate: '2026-01-20', size: '340 KB', sizeBytes: 348160, type: 'pdf', visibility: 'admins', status: 'signed' },
  { id: 'doc-6', name: 'Product_Catalog_Schema.xlsx', category: 'Project Documents', project: 'E-commerce Platform', client: 'Meridian Retail Pvt Ltd', uploadedBy: 'Amit Kulkarni', uploadedDate: '2026-09-11', size: '95 KB', sizeBytes: 97280, type: 'sheet', visibility: 'team', status: 'active' },
  { id: 'doc-7', name: 'Rohit_Girase_Offer_Letter.pdf', category: 'Employee Documents', project: null, client: null, uploadedBy: 'HR', uploadedDate: '2022-01-05', size: '150 KB', sizeBytes: 153600, type: 'pdf', visibility: 'admins', status: 'signed', employeeId: 'emp-3' },
  { id: 'doc-8', name: 'Booking_Portal_Brand_Guidelines.pdf', category: 'Other', project: 'Booking & Membership Portal', client: 'Coastal Hospitality Inc', uploadedBy: 'Farhan Sheikh', uploadedDate: '2026-06-15', size: '2.8 MB', sizeBytes: 2936012, type: 'pdf', visibility: 'everyone', status: 'active' },
  { id: 'doc-9', name: 'BrightPixel_KYC_and_GST_Certificate.pdf', category: 'Client Documents', project: null, client: 'BrightPixel Labs', uploadedBy: 'Jay Girase', uploadedDate: '2026-02-12', size: '780 KB', sizeBytes: 798720, type: 'pdf', visibility: 'admins', status: 'active' },
  { id: 'doc-10', name: 'CloudMatrix_Vendor_Registration.docx', category: 'Client Documents', project: null, client: 'CloudMatrix Technologies', uploadedBy: 'Jidnyasa Girase', uploadedDate: '2025-11-03', size: '410 KB', sizeBytes: 419840, type: 'doc', visibility: 'team', status: 'active' },
  { id: 'doc-11', name: 'Sneha_Joshi_Offer_Letter.pdf', category: 'Employee Documents', project: null, client: null, uploadedBy: 'HR', uploadedDate: '2022-03-10', size: '148 KB', sizeBytes: 151552, type: 'pdf', visibility: 'admins', status: 'signed', employeeId: 'emp-4' },
  { id: 'doc-12', name: 'Rohit_Girase_Aadhaar_PAN_KYC.pdf', category: 'Employee Documents', project: null, client: null, uploadedBy: 'Meera Iyer', uploadedDate: '2022-01-07', size: '1.4 MB', sizeBytes: 1468006, type: 'pdf', visibility: 'admins', status: 'active', employeeId: 'emp-3' },
  { id: 'doc-13', name: 'Amit_Kulkarni_Appraisal_2026.pdf', category: 'Employee Documents', project: null, client: null, uploadedBy: 'Meera Iyer', uploadedDate: '2026-04-15', size: '260 KB', sizeBytes: 266240, type: 'pdf', visibility: 'admins', status: 'active', employeeId: 'emp-5' },
  { id: 'doc-14', name: 'Meridian_Master_Services_Agreement.pdf', category: 'Contracts', project: 'E-commerce Platform', client: 'Meridian Retail Pvt Ltd', uploadedBy: 'Jidnyasa Girase', uploadedDate: '2026-08-25', size: '1.9 MB', sizeBytes: 1992294, type: 'pdf', visibility: 'admins', status: 'in_review' },
  { id: 'doc-15', name: 'INV-2026-00136.pdf', category: 'Invoices', project: 'E-commerce Platform', client: 'Meridian Retail Pvt Ltd', uploadedBy: 'System', uploadedDate: '2026-09-10', size: '198 KB', sizeBytes: 202752, type: 'pdf', visibility: 'admins', status: 'active' },
  { id: 'doc-16', name: 'Sprint_Retro_Notes_Sep.docx', category: 'Other', project: 'CRM Implementation', client: null, uploadedBy: 'Jay Girase', uploadedDate: '2026-09-19', size: '72 KB', sizeBytes: 73728, type: 'doc', visibility: 'team', status: 'active' },
]
