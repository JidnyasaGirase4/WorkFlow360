import { findUserByEmail } from '../mockData/users'
import { API_ENABLED, api, request, tokenStore } from './apiClient'

const DELAY = 500

function wait(ms = DELAY) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ---- real API (used when VITE_API_URL is set) --------------------------------
// The backend returns snake_case users; the UI expects { id, name, email, role, company, ... }.
function toUiUser(apiUser, company, employee) {
  return {
    id: apiUser.id,
    name: apiUser.name,
    email: apiUser.email,
    role: apiUser.role,
    company: company?.name ?? null,
    avatar: apiUser.profile_image,
    designation: employee?.designation ?? null,
    department: employee?.department_name ?? null,
    phone: apiUser.phone,
  }
}

async function loadUiUser(apiUser) {
  const me = await api.get('/auth/me')
  let employee = null
  if (me.data.employee_id) {
    // Best effort: designation/department are nice-to-have for the profile header.
    employee = await api.get('/employees/me').then((r) => r.data).catch(() => null)
  }
  return toUiUser(apiUser, me.data.company, employee)
}

const realAuthService = {
  async login({ email, password }) {
    const res = await request('/auth/login', { method: 'POST', body: { email, password }, auth: false })
    tokenStore.write(res.data)
    return { user: await loadUiUser(res.data.user), token: res.data.access_token }
  },

  async register(payload) {
    if (payload.accountType && payload.accountType !== 'company_admin') {
      // Employees and clients are invited by their company admin; only a company admin can self-register.
      throw new Error('Employee and client accounts are created by your company administrator.')
    }
    const res = await request('/auth/register', {
      method: 'POST',
      auth: false,
      body: {
        name: payload.fullName,
        email: payload.email,
        phone: payload.phone || null,
        company_name: payload.company,
        password: payload.password,
        confirm_password: payload.confirmPassword ?? payload.password,
      },
    })
    tokenStore.write(res.data)
    return { user: await loadUiUser(res.data.user), token: res.data.access_token }
  },

  async forgotPassword(email) {
    const res = await request('/auth/forgot-password', { method: 'POST', body: { email }, auth: false })
    return { message: res.message }
  },

  async resetPassword({ token, password, confirmPassword }) {
    const res = await request('/auth/reset-password', {
      method: 'POST',
      auth: false,
      body: { token, new_password: password, confirm_password: confirmPassword ?? password },
    })
    return { message: res.message }
  },

  async verifyEmail(token) {
    await request('/auth/verify-email', { method: 'POST', body: { token }, auth: false })
  },

  async changePassword({ currentPassword, newPassword, confirmPassword }) {
    await api.post('/auth/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword ?? newPassword,
    })
  },

  async logout() {
    const { refresh } = tokenStore.read()
    tokenStore.clear()
    if (refresh) await request('/auth/logout', { method: 'POST', body: { refresh_token: refresh }, auth: false }).catch(() => {})
    return { message: 'Logged out' }
  },
}

// ---- mock (default) -----------------------------------------------------------
// Swap-in contract is identical: same method names and return shapes.
const mockAuthService = {
  async login({ email, password }) {
    await wait()
    const user = findUserByEmail(email)
    if (!user || user.password !== password) {
      const error = new Error('Invalid email or password')
      error.code = 'INVALID_CREDENTIALS'
      throw error
    }
    const { password: _pw, ...safeUser } = user
    const token = `mock-jwt-${user.id}-${Date.now()}`
    return { user: safeUser, token }
  },

  async register(payload) {
    await wait()
    const existing = findUserByEmail(payload.email)
    if (existing) {
      const error = new Error('An account with this email already exists')
      error.code = 'EMAIL_TAKEN'
      throw error
    }
    const user = {
      id: `u-${Date.now()}`,
      name: payload.fullName,
      email: payload.email,
      phone: payload.phone,
      role: payload.accountType,
      company: payload.company || 'My Company',
      avatar: null,
    }
    const token = `mock-jwt-${user.id}-${Date.now()}`
    return { user, token }
  },

  async forgotPassword(email) {
    await wait()
    return { message: `If an account exists for ${email}, a reset link has been sent.` }
  },

  async resetPassword() {
    await wait()
    return { message: 'Password has been reset successfully.' }
  },

  async verifyEmail() {
    await wait()
  },

  async changePassword() {
    await wait()
  },

  async logout() {
    await wait(150)
    return { message: 'Logged out' }
  },
}

export const authService = API_ENABLED ? realAuthService : mockAuthService
