export const TIMEZONES = [
  { value: 'Asia/Kolkata', label: '(UTC+05:30) India Standard Time - Kolkata' },
  { value: 'Asia/Dubai', label: '(UTC+04:00) Gulf Standard Time - Dubai' },
  { value: 'Asia/Singapore', label: '(UTC+08:00) Singapore Standard Time' },
  { value: 'Europe/London', label: '(UTC+01:00) British Summer Time - London' },
  { value: 'America/New_York', label: '(UTC-04:00) Eastern Time - New York' },
  { value: 'America/Los_Angeles', label: '(UTC-07:00) Pacific Time - Los Angeles' },
  { value: 'Australia/Sydney', label: '(UTC+10:00) Australian Eastern Time - Sydney' },
]

export const CURRENCIES = [
  { value: 'INR', label: 'INR - Indian Rupee (₹)' },
  { value: 'USD', label: 'USD - US Dollar ($)' },
  { value: 'EUR', label: 'EUR - Euro (€)' },
  { value: 'GBP', label: 'GBP - British Pound (£)' },
  { value: 'AED', label: 'AED - UAE Dirham (د.إ)' },
  { value: 'SGD', label: 'SGD - Singapore Dollar (S$)' },
]

export const INDUSTRIES = [
  'Software & IT Services',
  'E-commerce & Retail',
  'Finance & Banking',
  'Healthcare',
  'Hospitality',
  'Manufacturing',
  'Education',
  'Other',
]

export const defaultCompany = {
  companyName: 'TechNova Solutions Pvt Ltd',
  industry: 'Software & IT Services',
  address: '4th Floor, Cyber Towers, HITEC City, Hyderabad, Telangana 500081',
  phone: '+91 98765 43210',
  email: 'jidnyasa.girase@technova.in',
  website: 'https://www.technova.in',
  gstin: '36AABCT1234F1Z5',
  timezone: 'Asia/Kolkata',
  currency: 'INR',
  fiscalYearStart: 'april',
  logoUrl: null,
  logoName: '',
}

export const defaultProfileExtras = {
  location: 'Hyderabad, Telangana',
  bio: 'Founder and CEO of TechNova Solutions. Building reliable software for growing Indian businesses.',
}

export const initialSessions = [
  { id: 'ses-1', device: 'MacBook Pro', browser: 'Chrome 126', location: 'Hyderabad, Telangana', ip: '49.37.152.18', lastActive: '2026-09-26T09:40:00', current: true, type: 'desktop' },
  { id: 'ses-2', device: 'iPhone 15', browser: 'Safari (iOS 18)', location: 'Hyderabad, Telangana', ip: '106.51.66.204', lastActive: '2026-09-26T07:15:00', current: false, type: 'mobile' },
  { id: 'ses-3', device: 'Windows 11 PC', browser: 'Edge 126', location: 'Pune, Maharashtra', ip: '103.77.42.9', lastActive: '2026-09-25T17:05:00', current: false, type: 'desktop' },
  { id: 'ses-4', device: 'Samsung Galaxy S23', browser: 'Chrome Mobile', location: 'Mumbai, Maharashtra', ip: '117.199.20.131', lastActive: '2026-09-22T20:30:00', current: false, type: 'mobile' },
]
