// Shared, realistic form validation for public + auth forms.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function isValidEmail(value) {
  return EMAIL_RE.test(String(value).trim())
}

// Indian mobile numbers: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9.
export function isValidIndianPhone(value) {
  const cleaned = String(value).replace(/[\s\-().]/g, '')
  return /^(?:\+91|91|0)?[6-9]\d{9}$/.test(cleaned)
}

export function emailError(value) {
  if (!String(value).trim()) return 'Email is required'
  if (!isValidEmail(value)) return 'Enter a valid email address, e.g. name@company.in'
  return ''
}

export function phoneError(value, { required = true } = {}) {
  if (!String(value).trim()) return required ? 'Phone number is required' : ''
  if (!isValidIndianPhone(value)) return 'Enter a valid 10-digit Indian mobile number, e.g. +91 98765 43210'
  return ''
}

export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'case', label: 'Upper and lower case letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'At least one symbol (!@#$...)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

// 0 (empty) to 4 (strong)
export function passwordStrength(password) {
  if (!password) return 0
  return PASSWORD_RULES.filter((rule) => rule.test(password)).length
}

export const STRENGTH_LABELS = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong']

export function newPasswordError(value) {
  if (!value) return 'Password is required'
  if (value.length < 8) return 'Password must be at least 8 characters'
  if (passwordStrength(value) < 3) return 'Add upper/lower case letters, a number or a symbol to strengthen it'
  return ''
}

// Where each role lands after login (manager shares the employee workspace by default).
export function homeForRole(role) {
  if (role === 'client') return '/client/dashboard'
  if (role === 'employee' || role === 'manager') return '/employee/dashboard'
  if (role === 'company_admin' || role === 'super_admin') return '/admin/dashboard'
  return '/login'
}

// Roles allowed in each protected area (mirrors the route guards in App.jsx).
const AREA_ROLES = {
  '/admin': ['super_admin', 'company_admin', 'manager'],
  '/employee': ['employee', 'manager', 'super_admin', 'company_admin'],
  '/client': ['client'],
}

// Where to send a user after login. The page they originally asked for is only
// honoured if their role can open it; otherwise (e.g. an employee who first
// visited /admin/...) they land on their own dashboard instead of a 403.
export function loginRedirect(role, from) {
  const home = homeForRole(role)
  if (typeof from !== 'string' || !from.startsWith('/')) return home
  const area = Object.keys(AREA_ROLES).find((prefix) => from === prefix || from.startsWith(prefix + '/'))
  if (!area) return from === '/login' ? home : from
  return AREA_ROLES[area].includes(role) ? from : home
}

// Target of the "Go Dashboard" button on the 404 page.
export function dashboardForRole(role) {
  if (role === 'client') return '/client/dashboard'
  if (role === 'employee') return '/employee/dashboard'
  if (role === 'company_admin' || role === 'super_admin' || role === 'manager') return '/admin/dashboard'
  return '/login'
}
