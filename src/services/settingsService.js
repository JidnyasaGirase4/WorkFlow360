import { defaultCompany, defaultProfileExtras, initialSessions } from '../mockData/settings'
import { teamService } from './teamService'

function wait(ms = 450) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// In-memory stores so edits survive tab switches during a session.
let company = { ...defaultCompany }
let profileExtras = { ...defaultProfileExtras }
let profileOverrides = null
let digest = 'instant'
let twoFactor = false
let sessions = [...initialSessions]

export const settingsService = {
  async load() {
    const [team] = await Promise.all([teamService.load(), wait()])
    return {
      company: { ...company },
      profileExtras: { ...profileExtras },
      profileOverrides: profileOverrides ? { ...profileOverrides } : null,
      digest,
      team,
    }
  },

  async saveCompany(values) {
    await wait(600)
    company = { ...values }
    return { ...company }
  },

  async saveProfile(values) {
    await wait(600)
    profileOverrides = { name: values.name, email: values.email, phone: values.phone, designation: values.designation }
    profileExtras = { location: values.location, bio: values.bio }
    return { overrides: { ...profileOverrides }, extras: { ...profileExtras } }
  },

  async saveDigest(value) {
    await wait(300)
    digest = value
    return digest
  },

  getSessions() {
    return sessions.map((s) => ({ ...s }))
  },

  async signOutSession(id) {
    await wait(350)
    sessions = sessions.filter((s) => s.id !== id || s.current)
    return this.getSessions()
  },

  async signOutOthers() {
    await wait(500)
    sessions = sessions.filter((s) => s.current)
    return this.getSessions()
  },

  getTwoFactor() {
    return twoFactor
  },

  async setTwoFactor(enabled) {
    await wait(300)
    twoFactor = enabled
    return twoFactor
  },

  async changePassword() {
    await wait(700)
    return { success: true }
  },
}
