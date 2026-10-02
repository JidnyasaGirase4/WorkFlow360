export const PASSWORD_RULES = [
  { id: 'length', label: 'At least 8 characters', test: (p) => p.length >= 8 },
  { id: 'case', label: 'Upper and lower case letters', test: (p) => /[a-z]/.test(p) && /[A-Z]/.test(p) },
  { id: 'number', label: 'At least one number', test: (p) => /\d/.test(p) },
  { id: 'symbol', label: 'At least one symbol (e.g. @ # $ !)', test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export function getPasswordStrength(password) {
  if (!password) return { score: 0, label: '' }
  const passed = PASSWORD_RULES.filter((r) => r.test(password)).length
  // Long passphrases earn a point even without a symbol.
  const score = Math.min(4, password.length >= 14 && passed >= 3 ? 4 : passed)
  return { score, label: ['Too weak', 'Weak', 'Fair', 'Good', 'Strong'][score] }
}
