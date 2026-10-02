// Central HTTP client for the FastAPI backend. Every real service goes through here so
// the base URL, Bearer token, token refresh and error shape live in ONE place.
//
// Enable it by setting VITE_API_URL (e.g. in .env.local):
//   VITE_API_URL=http://localhost:8000/api/v1
// When it is not set the app keeps running on the in-memory mock services.

export const API_URL = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '')
export const API_ENABLED = Boolean(API_URL)

const TOKEN_KEY = 'wf360-tokens'
export const AUTH_EXPIRED_EVENT = 'wf360:auth-expired'

export const tokenStore = {
  read() {
    try {
      return JSON.parse(window.localStorage.getItem(TOKEN_KEY)) || {}
    } catch {
      return {}
    }
  },
  write(tokens) {
    window.localStorage.setItem(TOKEN_KEY, JSON.stringify({ access: tokens.access_token, refresh: tokens.refresh_token }))
  },
  clear() {
    window.localStorage.removeItem(TOKEN_KEY)
  },
}

export class ApiError extends Error {
  constructor(status, message, errors = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.errors = errors // field -> message, from 422 responses
  }
}

function buildUrl(path, params) {
  const url = new URL(`${API_URL}${path}`, window.location.origin)
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value)
  })
  return url.toString()
}

// One refresh at a time: concurrent 401s wait for the same request.
let refreshing = null
async function refreshTokens() {
  const { refresh } = tokenStore.read()
  if (!refresh) return false
  refreshing ??= fetch(buildUrl('/auth/refresh'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh_token: refresh }),
  })
    .then(async (res) => {
      if (!res.ok) return false
      tokenStore.write((await res.json()).data)
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

async function send(path, { method = 'GET', params, body, auth = true, form } = {}) {
  const headers = { Accept: 'application/json' }
  const { access } = tokenStore.read()
  if (auth && access) headers.Authorization = `Bearer ${access}`
  let payload
  if (form) payload = form // FormData: the browser sets the multipart boundary
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }
  return fetch(buildUrl(path, params), { method, headers, body: payload })
}

/**
 * request('/projects', { params: { status: 'active', page: 1 } })
 * Resolves with the parsed JSON envelope: { success, message, data, ...pagination }.
 * Rejects with ApiError. A 401 triggers one silent token refresh and a retry; if that
 * fails the session is cleared and AUTH_EXPIRED_EVENT is fired so the app can go to login.
 */
export async function request(path, options = {}) {
  let res = await send(path, options)
  if (res.status === 401 && options.auth !== false && (await refreshTokens())) {
    res = await send(path, options)
  }
  if (res.status === 401 && options.auth !== false) {
    tokenStore.clear()
    window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT))
  }
  if (res.status === 204) return { success: true, data: null }
  const contentType = res.headers.get('content-type') || ''
  const body = contentType.includes('application/json') ? await res.json() : null
  if (!res.ok || body?.success === false) {
    throw new ApiError(res.status, body?.message || `Request failed (${res.status})`, body?.errors)
  }
  return body ?? { success: true, data: null }
}

export const api = {
  get: (path, params) => request(path, { params }),
  post: (path, body) => request(path, { method: 'POST', body }),
  put: (path, body) => request(path, { method: 'PUT', body }),
  patch: (path, body) => request(path, { method: 'PATCH', body }),
  delete: (path) => request(path, { method: 'DELETE' }),
  upload: (path, formData) => request(path, { method: 'POST', form: formData }),
}
