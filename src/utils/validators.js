const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
// Indian mobile: optional +91 / 91 / 0 prefix, then 10 digits starting 6-9.
const PHONE_PATTERN = /^(?:\+?91[\s-]?|0)?[6-9]\d{4}[\s-]?\d{5}$/

export function isValidEmail(value = '') {
  return EMAIL_PATTERN.test(value.trim())
}

export function isValidIndianPhone(value = '') {
  return PHONE_PATTERN.test(value.trim())
}

export function normalizeIndianPhone(value = '') {
  const digits = value.replace(/\D/g, '').slice(-10)
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`
}

export const ALLOWED_DOCUMENT_TYPES = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'csv', 'ppt', 'pptx', 'txt', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'fig', 'zip']
export const MAX_FILE_BYTES = 10 * 1024 * 1024

export function fileExtension(name = '') {
  return name.includes('.') ? name.split('.').pop().toLowerCase() : ''
}

// Returns an error message, or '' when the file is acceptable.
export function validateFile(file, allowed = ALLOWED_DOCUMENT_TYPES, maxBytes = MAX_FILE_BYTES) {
  const ext = fileExtension(file.name)
  if (!allowed.includes(ext)) return `.${ext || 'unknown'} files are not supported. Allowed: ${allowed.map((a) => a.toUpperCase()).join(', ')}`
  if (file.size > maxBytes) return `File is ${formatBytes(file.size)}. Maximum allowed size is ${formatBytes(maxBytes)}.`
  if (file.size === 0) return 'This file is empty.'
  return ''
}

export function formatBytes(bytes = 0) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}
