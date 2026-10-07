// Client-side sign-in gate. The app has no backend, so this keeps casual visitors out of
// the workspace; it is not a substitute for server-side authentication.
export const AUTH_USER = 'USER1'
const SALT = 'smartload-3d/auth/v1'
const ITERATIONS = 150_000
// PBKDF2-SHA256 of the password; the plain password is never stored in the bundle.
const PASSWORD_HASH = 'cd6afca15509b1e661a678a7d833d31de99dce2a898131fc3b4a6c59bb6ce545'
const SESSION_KEY = 'smartload-session'

export async function hashPassword(password: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('Sign-in needs a secure connection (HTTPS or localhost).')
  const encoder = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: encoder.encode(SALT), iterations: ITERATIONS }, key, 256)
  return [...new Uint8Array(bits)].map(byte => byte.toString(16).padStart(2, '0')).join('')
}

export async function verifyCredentials(username: string, password: string): Promise<boolean> {
  const hash = await hashPassword(password)
  return username.trim() === AUTH_USER && hash === PASSWORD_HASH
}

export function getSession(): string | null {
  try { return sessionStorage.getItem(SESSION_KEY) === AUTH_USER ? AUTH_USER : null } catch { return null }
}
export function startSession(): void { try { sessionStorage.setItem(SESSION_KEY, AUTH_USER) } catch { /* session lasts until reload */ } }
export function endSession(): void { try { sessionStorage.removeItem(SESSION_KEY) } catch { /* nothing stored */ } }
