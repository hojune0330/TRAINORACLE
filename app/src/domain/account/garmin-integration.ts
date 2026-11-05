import { z } from "zod"
import { supabase } from "./supabase-client"
import { activeLocalAccount, localJournalScopeGeneration, onLocalJournalScopeChange } from "./local-journal-ownership"
import { accountDeletionBoundaryState, onAccountDeletionBoundaryChange } from "./account-deletion-boundary"
import { isStorageTransmissionHeld } from "./storage-transmission-hold"
import { currentStorageConsentRevision } from "./storage-consent-revision"
import { ACCOUNT_NETWORK_DEADLINE_MS } from "./account-network-deadline"
import { accountJournalPreviewEnabled } from "./account-journal-api"
import { prepareDeviceActivity, type PreparedDeviceActivity } from "../import/prepared-device-activity"
import { garminSummarySchema } from "./garmin-summary"

export const GARMIN_VERSION = "GARMIN_INTEGRATION_V1" as const
const version = z.literal(GARMIN_VERSION)
const revision = z.number().int().positive().max(Number.MAX_SAFE_INTEGER - 1)
const timestamp = z.iso.datetime({ offset: true })
const state = z.string().regex(/^[A-Za-z0-9_-]{43}$/u)
export const GARMIN_SAVE_CONSENT_VERSION = "GARMIN_AUTO_SAVE_2026_11_05" as const
const experienceSchema = z.object({ saveMode: z.enum(["AUTO", "REVIEW"]), preferenceRevision: z.number().int().nonnegative(), lastSavedAt: timestamp.nullable(), reviewRequiredCount: z.number().int().nonnegative(), reconnectRequired: z.boolean() }).strict()
const preferencesSchema = z.object({ schemaVersion: version, experience: experienceSchema }).strict()
const connectionSchema = z.object({ state: z.enum(["DISCONNECTED", "PENDING", "ACTIVE", "REVOKED", "ERROR"]), epoch: z.uuid().nullable(), lastSyncAt: timestamp.nullable() }).strict()
export const garminStatusSchema = z.object({ schemaVersion: version,
  capability: z.object({ enabled: z.boolean(), reason: z.enum(["READY", "PROVIDER_CONFIGURATION_PENDING", "OPERATIONS_PENDING"]) }).strict(),
  experience: experienceSchema.optional(), connection: connectionSchema, pendingCount: z.number().int().nonnegative(),
}).strict()
const observationSchema = z.unknown().transform((value, ctx): PreparedDeviceActivity => {
  const raw = value as Partial<PreparedDeviceActivity> | null
  const parsed = prepareDeviceActivity(value)
  const fields = new Set(["schemaVersion", "analysisEligible", "provider", "dataLineage", "sourceId", "sourceVersion", "sport", "startedAt", "timeZone", "distanceMeters", "durationSeconds", "durationMeaning", "laps"])
  if (!parsed || raw?.schemaVersion !== "PREPARED_DEVICE_ACTIVITY_V1" || raw.analysisEligible !== false || parsed.provider !== "GARMIN"
    || Object.keys(raw).some(key => !fields.has(key))) {
    ctx.addIssue({ code: "custom", message: "INVALID_OBSERVATION" }); return z.NEVER
  }
  return parsed
})
export const garminItemSchema = z.object({ inboxId: z.uuid(), revision,
  state: z.enum(["PENDING", "CONFIRMED", "DISMISSED", "DELETED", "CONFLICT"]), provider: z.literal("GARMIN"),
  observation: observationSchema.nullable(), documentId: z.uuid().nullable(),
  clock: z.object({ basis: z.literal("DEVICE_OFFSET"), offsetSeconds: z.number().int().min(-86400).max(86400), localDate: z.iso.date() }).strict().nullable().optional(),
  source: z.object({ manual: z.boolean(), parent: z.object({ isParent: z.boolean(), parentSummaryId: z.string().max(200).nullable() }).strict(), summaryId: z.string().min(1).max(200), lapStartOffsetsSeconds: z.array(z.number().finite().nonnegative()).max(1000), summary: garminSummarySchema.optional() }).strict().nullable().optional(),
  savedAutomatically: z.boolean().optional(), reviewRequired: z.boolean().optional(), journalEntryId: z.string().max(200).nullable().optional(), journalDate: z.iso.date().nullable().optional(),
  detailManifest: z.array(z.object({ partIndex: z.number().int().min(0).max(31), sha256: z.string().regex(/^[a-f0-9]{64}$/u), sampleCount: z.number().int().min(1).max(100000) }).strict()).max(32),
}).strict().refine(item => item.state === "DELETED" ? item.observation === null : item.observation !== null)
const inboxSchema = z.object({ schemaVersion: version, items: z.array(garminItemSchema).max(20), nextCursor: z.uuid().nullable() }).strict()
const connectSchema = z.object({ schemaVersion: version, authorizationUrl: z.string().max(8192), state, expiresAt: timestamp }).strict()
const connectionResponseSchema = z.object({ schemaVersion: version, connection: connectionSchema, remoteRevocationPending: z.boolean().optional() }).strict()
const confirmedSchema = z.object({ schemaVersion: version, kind: z.enum(["saved", "already_confirmed"]), documentId: z.uuid(), journalEntryId: z.string().min(1).max(200), revision, date: z.iso.date() }).strict()
const dismissedSchema = z.object({ schemaVersion: version, kind: z.literal("dismissed"), inboxId: z.uuid(), revision }).strict()
const sensorValue = z.number().finite().nonnegative().nullable().optional()
export const garminSampleSchema = z.object({ offsetSeconds: z.number().finite().nonnegative(), heartRateBpm: sensorValue, powerWatts: sensorValue,
  cadenceSpm: sensorValue, speedMetersPerSecond: sensorValue, altitudeMeters: z.number().finite().nullable().optional(),
  timerSeconds: sensorValue, clockSeconds: sensorValue, movingSeconds: sensorValue, totalDistanceMeters: sensorValue,
  bikeCadenceRpm: sensorValue, swimCadenceSpm: sensorValue, airTemperatureCelsius: z.number().finite().nullable().optional(),
  latitude: z.number().finite().min(-90).max(90).nullable().optional(), longitude: z.number().finite().min(-180).max(180).nullable().optional(),
}).strict()
const detailSchema = z.object({ schemaVersion: version, inboxId: z.uuid(), revision, partIndex: z.number().int().min(0).max(31), sha256: z.string().regex(/^[a-f0-9]{64}$/u),
  sampleCount: z.number().int().positive().max(100000), samples: z.array(garminSampleSchema).min(1).max(100000),
}).strict().refine(value => value.samples.length === value.sampleCount)
export type GarminSample = z.infer<typeof garminSampleSchema>
const mutation = { inboxId: z.uuid(), expectedRevision: revision, operationId: z.uuid() }
export const garminRequestSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("status"), experience: z.literal(true).optional() }).strict(),
  z.object({ action: z.literal("connect"), saveMode: z.enum(["AUTO", "REVIEW"]).optional(), consentVersion: z.literal(GARMIN_SAVE_CONSENT_VERSION).optional() }).strict(),
  z.object({ action: z.literal("preferences"), saveMode: z.enum(["AUTO", "REVIEW"]), consentVersion: z.literal(GARMIN_SAVE_CONSENT_VERSION), epoch: z.uuid(), expectedPreferenceRevision: z.number().int().nonnegative() }).strict(),
  z.object({ action: z.literal("complete"), code: z.string().min(1).max(2048), state }).strict(),
  z.object({ action: z.literal("inbox"), experience: z.literal(true).optional(), cursor: z.uuid().optional() }).strict(),
  z.object({ action: z.literal("read"), experience: z.literal(true).optional(), documentId: z.uuid() }).strict(),
  z.object({ action: z.literal("detail"), inboxId: z.uuid(), expectedRevision: revision, partIndex: z.number().int().min(0).max(31) }).strict(),
  z.object({ action: z.literal("confirm"), ...mutation }).strict(), z.object({ action: z.literal("dismiss"), ...mutation }).strict(),
  z.object({ action: z.literal("disconnect") }).strict(), z.object({ action: z.literal("refresh") }).strict(),
])
export type GarminStatus = z.infer<typeof garminStatusSchema>
export type GarminItem = z.infer<typeof garminItemSchema>
export type GarminRequest = z.infer<typeof garminRequestSchema>
export type GarminConfirmation = z.infer<typeof confirmedSchema>
export type GarminResponse = z.infer<typeof preferencesSchema> | GarminStatus | z.infer<typeof inboxSchema> | z.infer<typeof connectSchema> | z.infer<typeof connectionResponseSchema> | GarminConfirmation | z.infer<typeof dismissedSchema> | z.infer<typeof detailSchema> | { schemaVersion: typeof GARMIN_VERSION; item: GarminItem }
const serverError = z.enum(["AUTH_REQUIRED", "ACCESS_DENIED", "SOURCE_CHANGED", "CONNECTION_CHANGED", "OPERATION_CONFLICT", "CONSENT_CHANGED", "REVIEW_REQUIRED", "PROVIDER_CONFIGURATION_PENDING", "OPERATIONS_PENDING", "INVALID_INPUT", "PROVIDER_UNAVAILABLE", "PROVIDER_RESPONSE_INVALID", "PROVIDER_SCOPE_MISMATCH", "OAUTH_RESTART_REQUIRED", "JOURNAL_CONTRACT_UNAVAILABLE", "ENCRYPTED_DATA_UNAVAILABLE", "STORAGE_CONSENT_REQUIRED", "REVOKE_PENDING", "PROVIDER_PERMISSION_REQUIRED", "PROVIDER_ACCOUNT_ALREADY_BOUND", "ALREADY_CONNECTED", "BUSY", "DETAIL_UNAVAILABLE"])
export type GarminError = z.infer<typeof serverError> | "UNAVAILABLE" | "INVALID_RESPONSE" | "STALE_RESPONSE" | "LOCAL_STATE_UNAVAILABLE"
export type GarminResult = { ok: true; data: GarminResponse } | { ok: false; code: GarminError }
export type GarminTransport = (owner: string, request: GarminRequest, signal: AbortSignal, isCurrent: () => boolean) => Promise<GarminResult>

export function garminIntegrationEnabled(env: Readonly<Record<string, unknown>> = import.meta.env) {
  return env.VITE_FEATURE_GARMIN_INTEGRATION === "true" && env.VITE_KILL_GARMIN_INTEGRATION !== "true"
}
export function garminEndpoint(env: Readonly<Record<string, unknown>> = import.meta.env, origin = window.location.origin): string | null {
  if (typeof env.VITE_GARMIN_INTEGRATION_URL !== "string" || !env.VITE_GARMIN_INTEGRATION_URL) return null
  try {
    const url = new URL(env.VITE_GARMIN_INTEGRATION_URL, origin)
    const local = env.DEV === true && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
    return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/api/garmin-integration"
      && (url.protocol === "https:" || local && url.protocol === "http:") ? url.href : null
  } catch { return null }
}
export function safeGarminAuthorizationUrl(value: string, expectedState: string, env: Readonly<Record<string, unknown>> = import.meta.env): string | null {
  try {
    if (typeof env.VITE_GARMIN_AUTHORIZATION_ORIGIN !== "string") return null
    const allowed = new URL(env.VITE_GARMIN_AUTHORIZATION_ORIGIN), url = new URL(value)
    if (allowed.protocol !== "https:" || allowed.pathname !== "/" || allowed.search || allowed.hash || allowed.username || allowed.password) return null
    return url.protocol === "https:" && url.origin === allowed.origin && !url.username && !url.password && !url.hash
      && url.searchParams.getAll("state").length === 1 && url.searchParams.get("state") === expectedState
      && url.searchParams.get("response_type") === "code" && url.searchParams.get("code_challenge_method") === "S256" ? url.href : null
  } catch { return null }
}
export function parseGarminResponse(request: GarminRequest, value: unknown): GarminResult {
  const schema = request.action === "preferences" ? preferencesSchema : request.action === "status" ? garminStatusSchema : request.action === "inbox" ? inboxSchema
    : request.action === "connect" ? connectSchema : request.action === "confirm" ? confirmedSchema
      : request.action === "dismiss" ? dismissedSchema : request.action === "detail" ? detailSchema : request.action === "read" ? z.object({ schemaVersion: version, item: garminItemSchema }).strict() : connectionResponseSchema
  const parsed = schema.safeParse(value)
  if (!parsed.success) return { ok: false, code: "INVALID_RESPONSE" }
  if (request.action === "dismiss" && "inboxId" in parsed.data && (request.inboxId !== parsed.data.inboxId || request.expectedRevision !== parsed.data.revision)) return { ok: false, code: "INVALID_RESPONSE" }
  if (request.action === "read" && "item" in parsed.data && parsed.data.item.documentId !== request.documentId) return { ok: false, code: "INVALID_RESPONSE" }
  if (request.action === "detail" && "samples" in parsed.data && (parsed.data.inboxId !== request.inboxId || parsed.data.revision !== request.expectedRevision || parsed.data.partIndex !== request.partIndex)) return { ok: false, code: "INVALID_RESPONSE" }
  if ("items" in parsed.data && new Set(parsed.data.items.map(item => item.inboxId)).size !== parsed.data.items.length) return { ok: false, code: "INVALID_RESPONSE" }
  return { ok: true, data: parsed.data }
}

/** IDs only; storage/auth/rights remain server authority. Never send an edited observation. */
export const requestGarminIntegration: GarminTransport = async (owner, request, signal, isCurrent) => {
  if (!garminRequestSchema.safeParse(request).success) return { ok: false, code: "INVALID_INPUT" }
  const management = request.action === "status" || request.action === "disconnect"
  const generation = localJournalScopeGeneration(), consentRevision = currentStorageConsentRevision(owner)
  let identityChanged = false
  const current = () => !identityChanged && !signal.aborted && isCurrent() && localJournalScopeGeneration() === generation
    && (activeLocalAccount() === owner || management && activeLocalAccount() === null)
    && accountDeletionBoundaryState(owner) === "OPEN"
    && (management || !isStorageTransmissionHeld(owner) && currentStorageConsentRevision(owner) === consentRevision)
  if (!current()) return { ok: false, code: "STALE_RESPONSE" }
  if (!management && (!garminIntegrationEnabled() || !accountJournalPreviewEnabled() || consentRevision < 1)) return { ok: false, code: "OPERATIONS_PENDING" }
  const endpoint = garminEndpoint()
  if (!endpoint) return { ok: false, code: "OPERATIONS_PENDING" }
  const controller = new AbortController(), abort = () => controller.abort()
  let rejectInterrupted: (() => void) | null = null
  const interrupted = new Promise<never>((_resolve, reject) => { rejectInterrupted = () => reject(new Error("REQUEST_INTERRUPTED")) })
  const interrupt = () => rejectInterrupted?.()
  controller.signal.addEventListener("abort", interrupt, { once: true })
  const within = <T>(work: PromiseLike<T>) => Promise.race([work, interrupted])
  signal.addEventListener("abort", abort, { once: true })
  const removeScopeListener = onLocalJournalScopeChange(abort)
  const removeDeletionListener = onAccountDeletionBoundaryChange(changed => { if (changed === owner) abort() })
  const deadline = setTimeout(abort, ACCOUNT_NETWORK_DEADLINE_MS)
  let unsubscribe = () => undefined as void
  try {
    const client = await within(supabase())
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    if (!client) return { ok: false, code: "AUTH_REQUIRED" }
    const { data, error } = await within(client.auth.getSession()), session = data.session
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    if (error || session?.user.id !== owner || !session.access_token) return { ok: false, code: "AUTH_REQUIRED" }
    const token = session.access_token
    const listener = client.auth.onAuthStateChange((_event, next) => { if (next?.user.id !== owner || next.access_token !== token) { identityChanged = true; abort() } })
    unsubscribe = () => listener.data.subscription.unsubscribe()
    // Management stays available when account storage is held; verify Auth remotely first.
    const verified = await within(client.auth.getUser(token))
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    if (verified.error || verified.data.user?.id !== owner) return { ok: false, code: "AUTH_REQUIRED" }
    const response = await within(fetch(endpoint, { method: "POST", credentials: "omit", cache: "no-store", redirect: "error",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, "x-trainoracle-storage-revision": String(consentRevision) }, body: JSON.stringify(request), signal: controller.signal }))
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    const value: unknown = await within(response.json())
    if (!current() || controller.signal.aborted) return { ok: false, code: "STALE_RESPONSE" }
    if (!response.ok) {
      const parsed = z.object({ error: serverError }).safeParse(value)
      return { ok: false, code: parsed.success ? parsed.data.error : response.status === 401 ? "AUTH_REQUIRED" : "UNAVAILABLE" }
    }
    return parseGarminResponse(request, value)
  } catch { return { ok: false, code: current() ? "UNAVAILABLE" : "STALE_RESPONSE" } }
  finally { clearTimeout(deadline); signal.removeEventListener("abort", abort); controller.signal.removeEventListener("abort", interrupt); removeScopeListener(); removeDeletionListener(); unsubscribe() }
}

const attemptKey = "trainoracle.garmin.oauth.v1"
const attemptSchema = z.object({ owner: z.string().min(1), state, expiresAt: timestamp }).strict()
type Callback = { code: string; state: string; error: boolean }
let capturedCallback: Callback | null = null
export function hasGarminCallback(): boolean { return capturedCallback !== null || new URL(window.location.href).searchParams.get("garmin_callback") === "1" }
/** Capture before the general account OAuth callback. Codes never enter storage or logs. */
export function captureGarminCallback(): void {
  const url = new URL(window.location.href)
  if (url.searchParams.get("garmin_callback") !== "1") return
  capturedCallback = { code: url.searchParams.get("code") ?? "", state: url.searchParams.get("state") ?? "",
    error: url.searchParams.has("error") || url.searchParams.getAll("code").length !== 1 || url.searchParams.getAll("state").length !== 1 }
  for (const key of ["garmin_callback", "code", "state", "error", "error_description", "error_uri"]) url.searchParams.delete(key)
  window.history.replaceState(window.history.state, "", url.href)
}
export function rememberGarminAttempt(owner: string, value: z.infer<typeof connectSchema>): boolean {
  if (!safeGarminAuthorizationUrl(value.authorizationUrl, value.state) || Date.parse(value.expiresAt) <= Date.now() || Date.parse(value.expiresAt) > Date.now() + 660000) return false
  try { const raw = JSON.stringify({ owner, state: value.state, expiresAt: value.expiresAt }); sessionStorage.setItem(attemptKey, raw); return sessionStorage.getItem(attemptKey) === raw } catch { return false }
}
export function consumeGarminCallback(owner: string): Extract<GarminRequest, { action: "complete" }> | "invalid" | null {
  captureGarminCallback()
  const callback = capturedCallback
  if (!callback) return null
  capturedCallback = null
  try {
    const attempt = attemptSchema.safeParse(JSON.parse(sessionStorage.getItem(attemptKey) ?? "null"))
    sessionStorage.removeItem(attemptKey)
    if (!attempt.success || attempt.data.owner !== owner || Date.parse(attempt.data.expiresAt) <= Date.now() || callback.error || callback.state !== attempt.data.state) return "invalid"
    const request = garminRequestSchema.safeParse({ action: "complete", code: callback.code, state: callback.state })
    return request.success && request.data.action === "complete" ? request.data : "invalid"
  } catch { return "invalid" }
}

/** Only retry identifiers are retained. A lost ACK reuses its exact operation and consent. */
const pendingSchema = z.object({ action: z.enum(["confirm", "dismiss"]), ...mutation, consentRevision: revision }).strict()
export type GarminPendingOperation = z.infer<typeof pendingSchema>
const pendingKey = (owner: string, inboxId: string) => `trainoracle.garmin.pending.v1:${owner}:${inboxId}`
export function pendingGarminOperation(owner: string, inboxId: string): GarminPendingOperation | null {
  try { const parsed = pendingSchema.safeParse(JSON.parse(sessionStorage.getItem(pendingKey(owner, inboxId)) ?? "null")); return parsed.success && parsed.data.inboxId === inboxId ? parsed.data : null } catch { return null }
}
export function prepareGarminOperation(owner: string, item: GarminItem, action: "confirm" | "dismiss"): GarminPendingOperation | null {
  const existing = pendingGarminOperation(owner, item.inboxId), consentRevision = currentStorageConsentRevision(owner)
  if (existing) return existing.action === action && existing.expectedRevision === item.revision && existing.consentRevision === consentRevision ? existing : null
  const parsed = pendingSchema.safeParse({ action, inboxId: item.inboxId, expectedRevision: item.revision, operationId: crypto.randomUUID(), consentRevision })
  if (!parsed.success) return null
  try { const raw = JSON.stringify(parsed.data); sessionStorage.setItem(pendingKey(owner, item.inboxId), raw); return sessionStorage.getItem(pendingKey(owner, item.inboxId)) === raw ? parsed.data : null } catch { return null }
}
export function clearGarminOperation(owner: string, inboxId: string): void { try { sessionStorage.removeItem(pendingKey(owner, inboxId)) } catch { /* no authority */ } }

export const garminErrorMessage: Record<GarminError, string> = {
  AUTH_REQUIRED: "로그인 상태를 다시 확인해 주세요.", ACCESS_DENIED: "이 계정에서 기록을 열 권한을 확인하지 못했어요.",
  SOURCE_CHANGED: "원본 기록이 바뀌었어요. 목록을 다시 불러와 검토해 주세요.", CONNECTION_CHANGED: "연결 상태가 바뀌었어요. 현재 상태를 다시 확인해 주세요.",
  OPERATION_CONFLICT: "다른 저장 요청과 겹쳤어요. 목록과 일지를 다시 확인해 주세요.", CONSENT_CHANGED: "보관 동의가 바뀌었어요. 계정 설정을 확인해 주세요.",
  REVIEW_REQUIRED: "이 기록은 변경 내용을 다시 확인해야 해요.", PROVIDER_CONFIGURATION_PENDING: "Garmin 연결을 준비하고 있어요. 지금은 파일로 가져올 수 있어요.",
  OPERATIONS_PENDING: "계정 연동 서비스를 아직 사용할 수 없어요.", INVALID_INPUT: "선택한 기록을 다시 확인해 주세요.",
  PROVIDER_UNAVAILABLE: "Garmin 응답을 확인하지 못했어요. 현재 연결 상태를 다시 확인해 주세요.", PROVIDER_RESPONSE_INVALID: "Garmin 응답을 확인하지 못했어요.",
  PROVIDER_SCOPE_MISMATCH: "Garmin에서 허용한 범위를 다시 확인해야 해요.", OAUTH_RESTART_REQUIRED: "Garmin 계정을 다시 연결해 주세요.",
  JOURNAL_CONTRACT_UNAVAILABLE: "현재 계정 일지 저장을 사용할 수 없어요.", ENCRYPTED_DATA_UNAVAILABLE: "보관된 기록을 읽지 못했어요. 원본 기록은 변경하지 않았어요.",
  STORAGE_CONSENT_REQUIRED: "계정의 기록 보관 동의를 확인해 주세요.", UNAVAILABLE: "응답을 받지 못했어요. 저장을 요청했다면 같은 요청으로 결과를 다시 확인할 수 있어요.",
  INVALID_RESPONSE: "응답을 확인하지 못했어요. 완료로 표시하지 않았어요.", STALE_RESPONSE: "계정이나 요청이 바뀌어 이전 응답을 표시하지 않았어요.",
  LOCAL_STATE_UNAVAILABLE: "요청 정보를 안전하게 보관하지 못했어요. 계정 설정과 이전 저장 결과를 확인해 주세요.",
  REVOKE_PENDING: "이전 Garmin 권한 해제를 먼저 확인해야 다시 연결할 수 있어요. 연결 해제를 다시 시도하거나 Garmin Connect에서 앱 권한을 확인해 주세요.",
  PROVIDER_PERMISSION_REQUIRED: "Garmin 활동 기록 제공 권한이 허용되지 않았어요. Garmin Connect에서 앱의 활동 기록 권한을 확인해 주세요.",
  PROVIDER_ACCOUNT_ALREADY_BOUND: "이 Garmin 계정은 다른 TrainOracle 계정에 연결돼 있어요. 기존 연결을 해제한 뒤 다시 시도해 주세요.",
  ALREADY_CONNECTED: "이미 연결된 계정이 있어요. 현재 연결 상태를 다시 확인해 주세요.",
  BUSY: "이전 요청을 처리하고 있어요. 잠시 뒤 같은 요청 결과를 다시 확인해 주세요.",
  DETAIL_UNAVAILABLE: "이 기록의 센서 상세가 제공되지 않았어요. 받은 요약과 구간은 그대로 확인할 수 있어요.",
}
