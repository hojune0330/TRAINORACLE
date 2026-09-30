import { supabase } from "../account/supabase-client"
import { publicLoungeUrl, type LoungeConfig } from "./config"

export type LoungeSession = { readonly userId: string }
export type LoungeGrant = { readonly version: 1; readonly grant: string; readonly expiresAt: string }
export type LoungeStatus = { readonly noticeVersion: string; readonly prepared: boolean }
type SessionReader = () => Promise<LoungeSession | null>
const ticketPattern = /^[A-Za-z0-9_-]{43}$/u
export const LOUNGE_REQUEST_TIMEOUT_MS = 8000
const validNoticeVersion = (value: unknown): value is string => typeof value === "string"
  && value === value.trim() && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value)
const validOneUseToken = (value: unknown): value is string => typeof value === "string"
  && value.length === 43 && ticketPattern.test(value)

async function boundedRequest<T>(signal: AbortSignal, operation: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  let cancel!: () => void
  const cancellation = new Promise<never>((_resolve, reject) => {
    cancel = () => { controller.abort(); reject(new Error("LOUNGE_REQUEST_UNAVAILABLE")) }
  })
  signal.addEventListener("abort", cancel, { once: true })
  if (signal.aborted) cancel()
  const timer = setTimeout(cancel, LOUNGE_REQUEST_TIMEOUT_MS)
  try {
    return await Promise.race([operation(controller.signal), cancellation])
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", cancel)
    controller.abort()
  }
}

export async function readLoungeSession(): Promise<LoungeSession | null> {
  const client = await supabase()
  if (!client) return null
  const { data, error } = await client.auth.getSession()
  const session = data.session
  if (error || !session || typeof session.user.id !== "string" || !session.user.id) return null
  return { userId: session.user.id }
}

export function parseLoungeGrant(value: unknown): LoungeGrant {
  if (typeof value !== "object" || value === null) throw new Error("LOUNGE_GRANT_INVALID")
  const proof = value as Record<string, unknown>
  if (Object.keys(proof).length !== 3 || !Object.keys(proof).every(key => ["version", "grant", "expiresAt"].includes(key))
    || proof.version !== 1 || typeof proof.grant !== "string" || proof.grant.length !== 68
    || !/^lg1_[0-9a-f]{64}$/u.test(proof.grant) || typeof proof.expiresAt !== "string"
    || proof.expiresAt !== proof.expiresAt.trim()
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/u.test(proof.expiresAt)
    || !Number.isFinite(Date.parse(proof.expiresAt)) || Date.parse(proof.expiresAt) <= Date.now()
    || new Date(proof.expiresAt).toISOString().slice(0, 19) !== proof.expiresAt.slice(0, 19)) throw new Error("LOUNGE_GRANT_INVALID")
  return { version: 1, grant: proof.grant, expiresAt: proof.expiresAt }
}

export async function issueLoungeGrant(signal: AbortSignal): Promise<LoungeGrant> {
  const client = await supabase()
  if (!client || signal.aborted) throw new Error("LOUNGE_GRANT_UNAVAILABLE")
  // The existing SDK authenticates only to its own TrainOracle project. Never
  // forward its access JWT (which may include email/metadata) to the lounge.
  const { data, error } = await client.rpc("issue_lounge_grant").abortSignal(signal)
  if (error) throw new Error("LOUNGE_GRANT_UNAVAILABLE")
  return parseLoungeGrant(data)
}

export function parseLoungeStatus(value: unknown): LoungeStatus {
  if (typeof value !== "object" || value === null) throw new Error("LOUNGE_STATUS_INVALID")
  const status = value as Record<string, unknown>
  const readiness = status.readiness as Record<string, unknown> | null
  if (status.version !== 1 || !validNoticeVersion(status.noticeVersion)
    || !(status.roomId === null || typeof status.roomId === "string" && status.roomId.length > 0)
    || typeof readiness !== "object" || readiness === null
    || typeof readiness.writesReady !== "boolean"
    || !(status.trainoracleEntryEnabled === undefined || typeof status.trainoracleEntryEnabled === "boolean")
    || !(readiness.reason === null || typeof readiness.reason === "string")) throw new Error("LOUNGE_STATUS_INVALID")
  return { noticeVersion: status.noticeVersion, prepared: readiness.writesReady && typeof status.roomId === "string" && status.trainoracleEntryEnabled === true }
}

export function createTrainOracleLoungeClient({
  config, expectedUserId, getSession = readLoungeSession, getGrant = issueLoungeGrant, fetchImpl = fetch,
}: {
  readonly config: LoungeConfig
  readonly expectedUserId: string
  readonly getSession?: SessionReader
  readonly getGrant?: (signal: AbortSignal) => Promise<unknown>
  readonly fetchImpl?: typeof fetch
}) {
  if (!publicLoungeUrl(config.realtimeUrl) || !publicLoungeUrl(config.pageUrl)) throw new Error("LOUNGE_URL_INVALID")
  const checkSession = async (signal: AbortSignal) => {
    if (signal.aborted) throw new Error("LOUNGE_REQUEST_CANCELLED")
    const session = await getSession()
    if (signal.aborted || !session || session.userId !== expectedUserId) throw new Error("LOGIN_REQUIRED")
  }
  const post = (path: string, body: Record<string, string>, signal: AbortSignal) => boundedRequest(signal, async activeSignal => {
    await checkSession(activeSignal)
    const proof = parseLoungeGrant(await getGrant(activeSignal))
    await checkSession(activeSignal)
    const response = await fetchImpl(new URL(path, config.realtimeUrl), {
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store", signal: activeSignal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${proof.grant}` },
      body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error("LOUNGE_PARTICIPATION_UNAVAILABLE")
    const result: unknown = await response.json()
    await checkSession(activeSignal)
    return result
  })
  return {
    async status(signal: AbortSignal): Promise<LoungeStatus> {
      return boundedRequest(signal, async activeSignal => {
        const response = await fetchImpl(new URL("/api/lounge/status", config.realtimeUrl), {
          method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: activeSignal,
        })
        if (!response.ok || activeSignal.aborted) throw new Error("LOUNGE_STATUS_UNAVAILABLE")
        return parseLoungeStatus(await response.json())
      })
    },
    async enter({ noticeVersion, accepted, signal }: { noticeVersion: string; accepted: boolean; signal: AbortSignal }): Promise<string> {
      if (accepted !== true || !validNoticeVersion(noticeVersion)) throw new Error("NOTICE_REQUIRED")
      const result = await post("/api/lounge/entry/trainoracle", { noticeVersion }, signal)
      const ticket = typeof result === "object" && result !== null ? (result as Record<string, unknown>).ticket : undefined
      if (!validOneUseToken(ticket)) throw new Error("TICKET_INVALID")
      const destination = new URL(config.pageUrl)
      destination.hash = new URLSearchParams({ lounge_ticket: ticket }).toString()
      return destination.href
    },
    async link({ token, confirmed, signal }: { token: string; confirmed: boolean; signal: AbortSignal }): Promise<void> {
      if (confirmed !== true || !validOneUseToken(token)) throw new Error("LINK_CONFIRMATION_REQUIRED")
      const result = await post("/api/lounge/link/trainoracle", { token }, signal)
      if (typeof result !== "object" || result === null || (result as Record<string, unknown>).linked !== true) throw new Error("LINK_UNAVAILABLE")
    },
  }
}
