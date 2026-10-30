import { z } from "zod"
import { supabase } from "./account/supabase-client"
import { activeLocalAccount, localJournalScopeGeneration } from "./account/local-journal-ownership"
import { accountDeletionBoundaryState } from "./account/account-deletion-boundary"
import { ACCOUNT_NETWORK_DEADLINE_MS } from "./account/account-network-deadline"

export const COACHING_PURPOSE_VERSION = "2026-10-30" as const
export const COACHING_VERSION = "SELF_HOSTED_COACHING_V1" as const
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1)
const ids = z.array(z.uuid()).min(1).max(20).refine(values => new Set(values).size === values.length)
const boundedText = z.string().min(1).max(2000)
export const coachingConsentSchema = z.object({ revision, active: z.boolean(), purposeVersion: z.literal(COACHING_PURPOSE_VERSION) }).strict()
export const coachingStatusSchema = z.object({
  version: z.literal(COACHING_VERSION),
  capability: z.object({ enabled: z.boolean(), reason: z.enum(["READY", "OPERATIONS_PENDING", "PROVIDER_APPROVAL_PENDING", "SOURCE_REVIEW_REQUIRED"]) }).strict(),
  consent: coachingConsentSchema,
  records: z.array(z.object({ documentId: z.uuid(), journalEntryId: z.string().min(1).max(200).nullable(), revision, date: z.iso.date(),
    provider: z.string().min(1).max(80), label: z.string().min(1).max(200), eligible: z.boolean(),
    reason: z.enum(["READY", "PROVIDER_APPROVAL_PENDING", "SOURCE_REVIEW_REQUIRED"]),
  }).strict()).max(200),
  retention: z.literal("REQUEST_ONLY"),
}).strict()
export const coachingExplanationSchema = z.object({
  version: z.literal(COACHING_VERSION), kind: z.literal("explanation"), summary: boundedText,
  facts: z.array(z.object({ id: z.string().min(1).max(80), label: z.string().min(1).max(200),
    value: z.union([z.number().finite(), z.string().max(200)]), unit: z.string().max(80), sourceDocumentIds: ids,
  }).strict()).max(40),
  actions: z.array(z.object({ id: z.enum(["REVIEW_JOURNAL", "REVIEW_PLAN"]), label: z.string().min(1).max(100) }).strict()).max(2),
  sourceDocumentIds: ids, attribution: z.array(z.string().min(1).max(300)).max(20), generatedAt: z.iso.datetime(),
  retention: z.literal("REQUEST_ONLY"), planChanged: z.literal(false), safetyChanged: z.literal(false),
}).strict()
export const coachingRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status") }).strict(),
  z.object({ action: z.literal("consent"), expectedConsentRevision: revision,
    purposeVersion: z.literal(COACHING_PURPOSE_VERSION), documentIds: ids,
    documentRevisions: z.array(z.object({ documentId: z.uuid(), revision: revision.refine(value => value > 0) }).strict()).min(1).max(20),
  }).strict().refine(value => value.documentRevisions.length === value.documentIds.length
    && new Set(value.documentRevisions.map(item => item.documentId)).size === value.documentIds.length
    && value.documentRevisions.every(item => value.documentIds.includes(item.documentId))),
  z.object({ action: z.literal("withdraw"), expectedConsentRevision: revision }).strict(),
  z.object({ action: z.literal("infer"), documentIds: ids, consentRevision: revision }).strict(),
])
export type CoachingStatus = z.infer<typeof coachingStatusSchema>
export type CoachingConsent = z.infer<typeof coachingConsentSchema>
export type CoachingExplanation = z.infer<typeof coachingExplanationSchema>
export type CoachingRequest = z.infer<typeof coachingRequestSchema>
export type CoachingResponse = CoachingStatus | CoachingExplanation | { consent: CoachingConsent }
export type CoachingError = "AUTH_REQUIRED" | "ACCESS_DENIED" | "CONSENT_CHANGED" | "SOURCE_CHANGED" | "INFERENCE_UNAVAILABLE" | "OPERATIONS_PENDING" | "INVALID_REQUEST" | "INVALID_RESPONSE" | "UNAVAILABLE" | "STALE_RESPONSE" | "BUSY" | "CANCELLED"
export type CoachingResult = { ok: true; data: CoachingResponse } | { ok: false; code: CoachingError }
export type CoachingTransport = (ownerId: string, request: CoachingRequest, signal: AbortSignal, isCurrent: () => boolean) => Promise<CoachingResult>
const errorSchema = z.object({ error: z.enum(["AUTH_REQUIRED", "ACCESS_DENIED", "CONSENT_CHANGED", "SOURCE_CHANGED", "INFERENCE_UNAVAILABLE", "OPERATIONS_PENDING", "INVALID_REQUEST", "BUSY", "CANCELLED"]) })

export function selfHostedCoachingEnabled(env: Readonly<Record<string, unknown>> = import.meta.env) {
  return env.VITE_FEATURE_SELF_HOSTED_COACHING === "true" && env.VITE_KILL_SELF_HOSTED_COACHING !== "true"
}

/** Deployment-controlled company gateway only; no editable URL or browser-held model credential. */
export function coachingEndpoint(env: Readonly<Record<string, unknown>> = import.meta.env, origin = window.location.origin): string | null {
  const value = env.VITE_SELF_HOSTED_COACHING_URL
  if (typeof value !== "string" || value.length === 0) return null
  try {
    const url = new URL(value, origin)
    if (url.username || url.password || url.search || url.hash || url.pathname !== "/api/self-hosted-coaching") return null
    const localDev = env.DEV === true && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    return url.protocol === "https:" || (localDev && url.protocol === "http:") ? url.href : null
  } catch { return null }
}

/** Browser validation is defense in depth. Only the authenticated company service grants rights. */
export function parseCoachingResponse(request: CoachingRequest, data: unknown): CoachingResult {
  const schema = request.action === "status" ? coachingStatusSchema
    : request.action === "infer" ? coachingExplanationSchema : z.object({ consent: coachingConsentSchema }).strict()
  const parsed = schema.safeParse(data)
  if (!parsed.success) return { ok: false, code: "INVALID_RESPONSE" }
  if (request.action === "infer" && "sourceDocumentIds" in parsed.data) {
    const requested = new Set(request.documentIds)
    const cited = new Set(parsed.data.sourceDocumentIds)
    if (parsed.data.sourceDocumentIds.some(id => !requested.has(id))
      || parsed.data.facts.some(fact => fact.sourceDocumentIds.some(id => !cited.has(id)))) return { ok: false, code: "INVALID_RESPONSE" }
  }
  if (request.action === "consent" || request.action === "withdraw") {
    if (!("consent" in parsed.data) || parsed.data.consent.revision <= request.expectedConsentRevision
      || parsed.data.consent.active !== (request.action === "consent")) return { ok: false, code: "INVALID_RESPONSE" }
  }
  return { ok: true, data: parsed.data }
}

export const requestSelfHostedCoaching: CoachingTransport = async (ownerId, request, signal, isCurrent) => {
  if (!coachingRequestSchema.safeParse(request).success) return { ok: false, code: "INVALID_REQUEST" }
  const generation = localJournalScopeGeneration()
  const management = request.action === "status" || request.action === "withdraw"
  const needsRemoteIdentityCheck = management && activeLocalAccount() === null
  // Account setup/storage holds may remove the local journal scope while Auth is
  // still signed in. They must not prevent consent withdrawal. Another local
  // owner and every inference/consent operation retain the strict owner check.
  const localOwnerMatches = () => activeLocalAccount() === ownerId || (management && activeLocalAccount() === null)
  const current = () => !signal.aborted && isCurrent() && localOwnerMatches()
    && localJournalScopeGeneration() === generation && accountDeletionBoundaryState(ownerId) === "OPEN"
  if (!current()) return { ok: false, code: "STALE_RESPONSE" }
  // Withdrawal remains reachable after the feature has been switched off.
  if (["consent", "infer"].includes(request.action) && !selfHostedCoachingEnabled()) return { ok: false, code: "OPERATIONS_PENDING" }
  const endpoint = coachingEndpoint()
  if (!endpoint) return { ok: false, code: "OPERATIONS_PENDING" }
  const controller = new AbortController()
  const abort = () => controller.abort()
  signal.addEventListener("abort", abort, { once: true })
  const deadline = setTimeout(abort, ACCOUNT_NETWORK_DEADLINE_MS)
  let unsubscribe = () => undefined as void
  try {
    const client = await supabase()
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (!client) return { ok: false, code: "AUTH_REQUIRED" }
    const { data, error } = await client.auth.getSession()
    const session = data.session
    if (!current()) return { ok: false, code: "STALE_RESPONSE" }
    if (error || session?.user.id !== ownerId || !session.access_token) return { ok: false, code: "AUTH_REQUIRED" }
    const pinnedToken = session.access_token
    // A sign out, replacement session, or token change cancels this exact operation.
    const listener = client.auth.onAuthStateChange((_event, next) => {
      if (next?.user.id !== ownerId || next.access_token !== pinnedToken) controller.abort()
    })
    unsubscribe = () => listener.data.subscription.unsubscribe()
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    if (needsRemoteIdentityCheck) {
      const verified = await client.auth.getUser(pinnedToken)
      if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
      if (verified.error || verified.data.user?.id !== ownerId) return { ok: false, code: "AUTH_REQUIRED" }
    }
    const response = await fetch(endpoint, { method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${pinnedToken}` },
      body: JSON.stringify(request), signal: controller.signal })
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    const result: unknown = await response.json()
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    if (!response.ok) {
      const failure = errorSchema.safeParse(result)
      return { ok: false, code: failure.success ? failure.data.error : response.status === 401 ? "AUTH_REQUIRED" : "UNAVAILABLE" }
    }
    return parseCoachingResponse(request, result)
  } catch { return { ok: false, code: current() ? "UNAVAILABLE" : "STALE_RESPONSE" } }
  finally { clearTimeout(deadline); signal.removeEventListener("abort", abort); unsubscribe() }
}

export const coachingErrorMessage: Record<CoachingError, string> = {
  AUTH_REQUIRED: "로그인 상태를 다시 확인해 주세요.", ACCESS_DENIED: "이 기록을 풀이할 권한을 확인하지 못했어요.",
  CONSENT_CHANGED: "동의 상태가 바뀌었어요. 현재 상태를 다시 확인해 주세요.", SOURCE_CHANGED: "선택한 기록이 바뀌었어요. 목록을 새로 확인해 주세요.",
  INFERENCE_UNAVAILABLE: "풀이를 완료하지 못했어요. 잠시 뒤 다시 시도해 주세요.", OPERATIONS_PENDING: "자체 AI 서비스의 운영 준비가 아직 완료되지 않았어요.",
  INVALID_REQUEST: "선택한 기록을 다시 확인해 주세요.", INVALID_RESPONSE: "응답의 근거를 확인하지 못해 풀이를 표시하지 않았어요.",
  UNAVAILABLE: "서버에 연결하지 못했어요. 현재 상태를 다시 확인해 주세요.", STALE_RESPONSE: "계정이나 요청이 바뀌어 이전 응답을 표시하지 않았어요.",
  BUSY: "이전 풀이를 처리하고 있어요. 잠시 뒤 다시 시도해 주세요.", CANCELLED: "풀이 처리가 취소됐어요. 원하면 다시 요청할 수 있어요.",
}
