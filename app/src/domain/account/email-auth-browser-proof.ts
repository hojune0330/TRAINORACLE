import { isAuthAttemptId } from "./auth-onboarding"

export const EMAIL_AUTH_BROWSER_PROOF_KEY = "trainoracle.account.email-browser-proof.v1"
const PROOF_PATTERN = /^[a-f0-9]{32}$/u
const PROOF_TTL_MS = 15 * 60 * 1000

type EmailAuthBrowserProof = {
  readonly schemaVersion: 1
  readonly attemptId: string
  readonly proof: string
  readonly createdAtMs: number
}

function storage(): Storage | null {
  return typeof window === "undefined" ? null : window.localStorage
}

function readProof(nowMs = Date.now()): EmailAuthBrowserProof | null {
  const target = storage()
  if (target === null) return null
  try {
    const raw = target.getItem(EMAIL_AUTH_BROWSER_PROOF_KEY)
    if (raw === null) return null
    const parsed = JSON.parse(raw) as Partial<EmailAuthBrowserProof>
    const valid = parsed.schemaVersion === 1
      && isAuthAttemptId(parsed.attemptId)
      && typeof parsed.proof === "string"
      && PROOF_PATTERN.test(parsed.proof)
      && typeof parsed.createdAtMs === "number"
      && Number.isFinite(parsed.createdAtMs)
      && parsed.createdAtMs <= nowMs
      && nowMs - parsed.createdAtMs <= PROOF_TTL_MS
    if (valid) return parsed as EmailAuthBrowserProof
  } catch {
    // Corrupt or inaccessible proof never authorizes a callback.
  }
  try { target.removeItem(EMAIL_AUTH_BROWSER_PROOF_KEY) } catch { /* keep failing closed */ }
  return null
}

export function createEmailAuthBrowserProof(attemptId: string): boolean {
  if (!isAuthAttemptId(attemptId)) return false
  const target = storage()
  if (target === null) return false
  const bytes = new Uint8Array(16)
  try {
    globalThis.crypto.getRandomValues(bytes)
    const marker: EmailAuthBrowserProof = {
      schemaVersion: 1,
      attemptId,
      proof: Array.from(bytes, value => value.toString(16).padStart(2, "0")).join(""),
      createdAtMs: Date.now(),
    }
    target.setItem(EMAIL_AUTH_BROWSER_PROOF_KEY, JSON.stringify(marker))
    const stored = readProof()
    return stored?.attemptId === attemptId && stored.proof === marker.proof
  } catch {
    return false
  }
}

export function hasEmailAuthBrowserProof(attemptId: string): boolean {
  return readProof()?.attemptId === attemptId
}

/** Consume immediately before verifyOtp; another browser cannot recreate it from the URL. */
export function consumeEmailAuthBrowserProof(attemptId: string): boolean {
  const target = storage()
  const proof = readProof()
  if (target === null || proof?.attemptId !== attemptId) return false
  try {
    target.removeItem(EMAIL_AUTH_BROWSER_PROOF_KEY)
    return target.getItem(EMAIL_AUTH_BROWSER_PROOF_KEY) === null
  } catch {
    return false
  }
}

export function clearEmailAuthBrowserProof(attemptId: string): void {
  const target = storage()
  if (target === null) return
  const proof = readProof()
  if (proof?.attemptId !== attemptId) return
  try { target.removeItem(EMAIL_AUTH_BROWSER_PROOF_KEY) } catch { /* expire naturally */ }
}
