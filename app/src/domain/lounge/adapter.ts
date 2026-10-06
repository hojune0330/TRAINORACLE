import { supabase } from "../account/supabase-client"
import { publicLoungeUrl, type LoungeConfig } from "./config"

export type LoungeSession = { readonly userId: string }
export type LoungeGrant = { readonly version: 1; readonly grant: string; readonly expiresAt: string }
export type LoungeStatus = { readonly noticeVersion: string; readonly prepared: boolean; readonly accepted: boolean; readonly ticketExpiryVersion?: 1 }
export type LoungeEntryTicket = { readonly url: string; readonly expiresAt: string | null }
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

export function parseLoungeStatus(value: unknown): LoungeStatus & { readonly participationVersion?: 1 } {
  if (typeof value !== "object" || value === null) throw new Error("LOUNGE_STATUS_INVALID")
  const status = value as Record<string, unknown>
  const readiness = status.readiness as Record<string, unknown> | null
  if (status.version !== 1 || !validNoticeVersion(status.noticeVersion)
    || !(status.roomId === null || typeof status.roomId === "string" && status.roomId.length > 0)
    || typeof readiness !== "object" || readiness === null
    || typeof readiness.writesReady !== "boolean"
    || !(status.trainoracleEntryEnabled === undefined || typeof status.trainoracleEntryEnabled === "boolean")
    || !(status.trainoracleParticipationVersion === undefined || status.trainoracleParticipationVersion === 1)
    || !(status.trainoracleTicketExpiryVersion === undefined || status.trainoracleTicketExpiryVersion === 1)
    || !(readiness.reason === null || typeof readiness.reason === "string")) throw new Error("LOUNGE_STATUS_INVALID")
  return { noticeVersion: status.noticeVersion, prepared: readiness.writesReady && typeof status.roomId === "string" && status.trainoracleEntryEnabled === true,
    accepted: false, ...(status.trainoracleParticipationVersion === 1 ? { participationVersion: 1 as const } : {}),
    ...(status.trainoracleTicketExpiryVersion === 1 ? { ticketExpiryVersion: 1 as const } : {}) }
}

export function parseLoungeParticipation(value: unknown, noticeVersion: string): boolean {
  if (typeof value !== "object" || value === null || Array.isArray(value)) throw new Error("LOUNGE_PARTICIPATION_INVALID")
  const state = value as Record<string, unknown>
  if (Object.keys(state).length !== 3 || !Object.keys(state).every(key => ["version", "noticeVersion", "accepted"].includes(key))
    || state.version !== 1 || !validNoticeVersion(state.noticeVersion) || state.noticeVersion !== noticeVersion
    || typeof state.accepted !== "boolean") throw new Error("LOUNGE_PARTICIPATION_INVALID")
  return state.accepted
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
  // Reuse only the opaque credential within this account's mounted client.
  // Every POST still rechecks the session and the server revalidates admission.
  let proof: LoungeGrant | null = null
  // This binds the UI's resume choice to its latest authenticated read; the
  // ticket endpoint must check the stored notice again, including deletion races.
  let acceptedVersion: string | null = null
  let authorityEpoch = 0
  const invalidate = () => { authorityEpoch++; proof = null; acceptedVersion = null }
  const checkSession = async (signal: AbortSignal) => {
    if (signal.aborted) throw new Error("LOUNGE_REQUEST_CANCELLED")
    const session = await getSession()
    if (signal.aborted || !session || session.userId !== expectedUserId) throw new Error("LOGIN_REQUIRED")
  }
  const post = (path: string, body: Record<string, string | boolean>, signal: AbortSignal) => boundedRequest(signal, async activeSignal => {
    await checkSession(activeSignal)
    const epoch = authorityEpoch
    if (proof && Date.parse(proof.expiresAt) <= Date.now()) proof = null
    const currentProof = proof ?? parseLoungeGrant(await getGrant(activeSignal))
    await checkSession(activeSignal)
    if (epoch !== authorityEpoch) throw new Error("LOUNGE_REQUEST_CANCELLED")
    proof = currentProof
    const response = await fetchImpl(new URL(path, config.realtimeUrl), {
      method: "POST", credentials: "omit", redirect: "error", cache: "no-store", signal: activeSignal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${currentProof.grant}` },
      body: JSON.stringify(body),
    })
    if (!response.ok) {
      if (response.status === 409) {
        const failure: unknown = await response.json()
        if (typeof failure === "object" && failure !== null && (failure as Record<string, unknown>).code === "NOTICE_REQUIRED") throw new Error("NOTICE_REQUIRED")
      }
      throw new Error("LOUNGE_PARTICIPATION_UNAVAILABLE")
    }
    const result: unknown = await response.json()
    await checkSession(activeSignal)
    if (epoch !== authorityEpoch) throw new Error("LOUNGE_REQUEST_CANCELLED")
    return result
  })
  const guarded = async <T>(signal: AbortSignal, operation: () => Promise<T>): Promise<T> => {
    signal.addEventListener("abort", invalidate, { once: true })
    try {
      if (signal.aborted) throw new Error("LOUNGE_REQUEST_CANCELLED")
      return await operation()
    } catch (error) { invalidate(); throw error }
    finally { signal.removeEventListener("abort", invalidate) }
  }
  const enterTicket = async ({ noticeVersion, accepted, signal, requireExpiry = false }: {
    noticeVersion: string; accepted: boolean; signal: AbortSignal; requireExpiry?: boolean
  }): Promise<LoungeEntryTicket> => guarded(signal, async () => {
    if (proof && Date.parse(proof.expiresAt) <= Date.now()) invalidate()
    if (!validNoticeVersion(noticeVersion) || accepted !== true && acceptedVersion !== noticeVersion) throw new Error("NOTICE_REQUIRED")
    const result = await post("/api/lounge/entry/trainoracle", accepted ? { noticeVersion } : { noticeVersion, resume: true }, signal)
    const record = typeof result === "object" && result !== null ? result as Record<string, unknown> : null
    const ticket = record?.ticket
    if (!validOneUseToken(ticket)) throw new Error("TICKET_INVALID")
    const expiry = record?.expiresAt
    if (expiry !== undefined && (typeof expiry !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|\+00:00)$/u.test(expiry)
      || !Number.isFinite(Date.parse(expiry)) || new Date(expiry).toISOString().slice(0, 19) !== expiry.slice(0, 19))) throw new Error("TICKET_INVALID")
    if (requireExpiry && expiry === undefined) throw new Error("TICKET_INVALID")
    if (typeof expiry === "string" && Date.parse(expiry) <= Date.now()) throw new Error("TICKET_EXPIRED")
    const destination = new URL(config.pageUrl)
    destination.hash = new URLSearchParams({ lounge_ticket: ticket }).toString()
    return { url: destination.href, expiresAt: typeof expiry === "string" ? expiry : null }
  })
  return {
    invalidate,
    enterTicket,
    async status(signal: AbortSignal): Promise<LoungeStatus> {
      acceptedVersion = null
      return guarded(signal, () => boundedRequest(signal, async activeSignal => {
        const response = await fetchImpl(new URL("/api/lounge/status", config.realtimeUrl), {
          method: "GET", credentials: "omit", redirect: "error", cache: "no-store", signal: activeSignal,
        })
        if (!response.ok || activeSignal.aborted) throw new Error("LOUNGE_STATUS_UNAVAILABLE")
        const { participationVersion, ...state } = parseLoungeStatus(await response.json())
        if (!state.prepared || participationVersion !== 1) return state
        const accepted = parseLoungeParticipation(await post("/api/lounge/participation/trainoracle", {}, activeSignal), state.noticeVersion)
        acceptedVersion = accepted ? state.noticeVersion : null
        return { ...state, accepted }
      }))
    },
    async enter({ noticeVersion, accepted, signal }: { noticeVersion: string; accepted: boolean; signal: AbortSignal }): Promise<string> {
      return (await enterTicket({ noticeVersion, accepted, signal })).url
    },
    async link({ token, confirmed, signal }: { token: string; confirmed: boolean; signal: AbortSignal }): Promise<void> {
      return guarded(signal, async () => {
        if (confirmed !== true || !validOneUseToken(token)) throw new Error("LINK_CONFIRMATION_REQUIRED")
        const result = await post("/api/lounge/link/trainoracle", { token }, signal)
        if (typeof result !== "object" || result === null || (result as Record<string, unknown>).linked !== true) throw new Error("LINK_UNAVAILABLE")
        acceptedVersion = null
      })
    },
  }
}
