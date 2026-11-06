const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.replace(/\/$/, '')
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY

export const supabaseConfigured = Boolean(supabaseUrl && publishableKey)

export type AuthUser = { id: string; email?: string; user_metadata?: Record<string, unknown> }
export type AuthSession = {
  access_token: string
  refresh_token: string
  expires_at?: number
  expires_in?: number
  user: AuthUser
}

const sessionKey = 'gestfy-planos-auth-v1'

const requireConfiguration = () => {
  if (!supabaseConfigured) throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY.')
}

const headers = (token?: string, extra?: HeadersInit) => ({
  apikey: publishableKey ?? '',
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
  ...extra,
})

const parseResponse = async <T>(response: Response): Promise<T> => {
  const raw = await response.text()
  const body = raw ? JSON.parse(raw) : null
  if (!response.ok) throw new Error(body?.message ?? body?.msg ?? body?.error_description ?? body?.hint ?? body?.details ?? body?.error ?? 'Não foi possível concluir a operação.')
  return body as T
}

const readStoredSession = (): AuthSession | null => {
  try {
    const raw = localStorage.getItem(sessionKey)
    return raw ? JSON.parse(raw) as AuthSession : null
  } catch {
    return null
  }
}

let currentSession = readStoredSession()

const storeSession = (session: AuthSession | null) => {
  currentSession = session
  if (session) localStorage.setItem(sessionKey, JSON.stringify(session))
  else localStorage.removeItem(sessionKey)
}

const normalizeSession = (session: AuthSession): AuthSession => ({
  ...session,
  expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600),
})

export const consumeAuthHashError = (): string | null => {
  const hash = window.location.hash
  if (!hash.includes('error=')) return null
  const params = new URLSearchParams(hash.slice(1))
  window.history.replaceState(null, '', window.location.pathname + window.location.search)
  if (params.get('error_code') === 'otp_expired') return 'Esse link expirou ou já foi usado. Solicite um novo link de recuperação.'
  const description = params.get('error_description')
  return description ? description.replace(/\+/g, ' ') : 'Não foi possível validar o link. Solicite um novo.'
}

export const auth = {
  session: () => currentSession,

  async signIn(email: string, password: string) {
    requireConfiguration()
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: headers(undefined, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password }),
    })
    const session = normalizeSession(await parseResponse<AuthSession>(response))
    storeSession(session)
    return session
  },

  async signUp(email: string, password: string, fullName: string) {
    requireConfiguration()
    const response = await fetch(`${supabaseUrl}/auth/v1/signup`, {
      method: 'POST',
      headers: headers(undefined, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email, password, data: { full_name: fullName } }),
    })
    const result = await parseResponse<AuthSession & { access_token?: string }>(response)
    if (result.access_token) storeSession(normalizeSession(result as AuthSession))
    return result
  },

  async refresh() {
    if (!currentSession?.refresh_token) return null
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: headers(undefined, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ refresh_token: currentSession.refresh_token }),
    })
    if (!response.ok) {
      storeSession(null)
      return null
    }
    const session = normalizeSession(await parseResponse<AuthSession>(response))
    storeSession(session)
    return session
  },

  async ensureSession() {
    if (!currentSession) return null
    if ((currentSession.expires_at ?? 0) <= Math.floor(Date.now() / 1000) + 30) return auth.refresh()
    return currentSession
  },

  async signOut() {
    const token = currentSession?.access_token
    if (token) await fetch(`${supabaseUrl}/auth/v1/logout`, { method: 'POST', headers: headers(token) }).catch(() => undefined)
    storeSession(null)
  },

  async requestPasswordReset(email: string, redirectTo = `${window.location.origin}${window.location.pathname}`) {
    requireConfiguration()
    const response = await fetch(`${supabaseUrl}/auth/v1/recover?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: headers(undefined, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ email }),
    })
    await parseResponse(response)
  },

  async resendActivationEmail(email: string) {
    requireConfiguration()
    const redirectTo = `${window.location.origin}/`
    const response = await fetch(`${supabaseUrl}/auth/v1/resend?redirect_to=${encodeURIComponent(redirectTo)}`, {
      method: 'POST',
      headers: headers(undefined, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ type: 'signup', email }),
    })
    await parseResponse(response)
  },

  async beginRecoverySession() {
    const hash = window.location.hash
    if (!hash.includes('type=recovery')) return null
    const params = new URLSearchParams(hash.slice(1))
    window.history.replaceState(null, '', window.location.pathname + window.location.search)
    const access_token = params.get('access_token')
    const refresh_token = params.get('refresh_token')
    if (!access_token || !refresh_token) return null
    const user = await parseResponse<AuthUser>(await fetch(`${supabaseUrl}/auth/v1/user`, { headers: headers(access_token) }))
    const session = normalizeSession({ access_token, refresh_token, expires_in: Number(params.get('expires_in')) || 3600, user })
    storeSession(session)
    return session
  },

  async updatePassword(newPassword: string) {
    requireConfiguration()
    if (!currentSession) throw new Error('Sessão de recuperação inválida ou expirada. Solicite um novo link.')
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: 'PUT',
      headers: headers(currentSession.access_token, { 'Content-Type': 'application/json' }),
      body: JSON.stringify({ password: newPassword }),
    })
    return parseResponse<AuthUser>(response)
  },
}

type DbOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE'
  query?: string
  body?: unknown
  prefer?: string
}

export const db = async <T>(table: string, options: DbOptions = {}, retried = false): Promise<T> => {
  requireConfiguration()
  const session = await auth.ensureSession()
  if (!session) throw new Error('Sua sessão expirou. Entre novamente.')
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}${options.query ? `?${options.query}` : ''}`, {
    method: options.method ?? 'GET',
    headers: headers(session.access_token, {
      'Content-Type': 'application/json',
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    }),
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  })
  if (response.status === 401 && !retried && await auth.refresh()) return db<T>(table, options, true)
  return parseResponse<T>(response)
}

export const rpc = <T>(name: string, parameters: Record<string, unknown> = {}) => db<T>(`rpc/${name}`, { method: 'POST', body: parameters })

export const uploadClinicLogo = async (clinicId: string, file: File) => {
  requireConfiguration()
  const session = await auth.ensureSession()
  if (!session) throw new Error('Sua sessão expirou. Entre novamente.')
  const extension = file.name.split('.').pop()?.toLowerCase() || 'png'
  const path = `${clinicId}/logo-${Date.now()}.${extension}`
  const response = await fetch(`${supabaseUrl}/storage/v1/object/clinic-logos/${path}`, {
    method: 'POST',
    headers: headers(session.access_token, { 'Content-Type': file.type, 'x-upsert': 'true' }),
    body: file,
  })
  await parseResponse(response)
  return { path, publicUrl: `${supabaseUrl}/storage/v1/object/public/clinic-logos/${path}` }
}
