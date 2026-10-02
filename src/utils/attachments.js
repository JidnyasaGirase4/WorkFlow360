// Lightweight client-side checks for attachment pickers (mock — nothing is uploaded).
export const MAX_ATTACHMENT_MB = 10
const ALLOWED = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt', 'csv', 'zip', 'fig']
export const ATTACHMENT_ACCEPT = ALLOWED.map((e) => `.${e}`).join(',')

export function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// Returns an error message, or '' when the file is acceptable.
export function validateAttachment(file) {
  if (!file) return ''
  const ext = file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : ''
  if (!ALLOWED.includes(ext)) return `Unsupported file type. Allowed: ${ALLOWED.join(', ').toUpperCase()}.`
  if (file.size === 0) return 'This file is empty.'
  if (file.size > MAX_ATTACHMENT_MB * 1024 * 1024) return `File is too large. Maximum size is ${MAX_ATTACHMENT_MB} MB.`
  return ''
}

export function toAttachment(file) {
  return { name: file.name, size: formatBytes(file.size) }
}
