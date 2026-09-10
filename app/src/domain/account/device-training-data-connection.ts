import {
  ATHLETE_RECORDS_STORAGE_KEY,
  readAthleteRecordsForAccount,
} from "../athlete-records"
import {
  PLAN_BETA_STORAGE_KEY,
  readPlanBetaStateForAccount,
} from "../plan-beta-store"
import {
  DECORATION_STORAGE_KEY_V1,
  DECORATION_STORAGE_KEY_V2,
  DECORATION_STORAGE_KEY_V2_BACKUP,
  DECORATION_STORAGE_KEY_V3,
} from "../decoration-store"
import {
  createEmptyDecorationState,
  migrateLegacyDecorationState,
  parseStoredDecorationState,
} from "../decoration-schema"
import type { DecorationState } from "../decoration-schema"
import { PLAN_ADAPTATION_CONTEXT_STORAGE_KEY } from "../plan-adaptation-ui-context"
import { contextSchema } from "../plan-adaptation-context-schema"
import {
  accountScopedStorageKeyFor,
  localAccountScopeIsCurrent,
} from "./local-account-scope"
import { accountPlanService, type AccountPlanResult, type AccountPlanService } from "./account-plan-service"
import {
  accountPlanEntry,
  accountPlanFingerprint,
  validateAccountPlanPacket,
  type AccountPlanPacket,
} from "./account-plan-document-schema"

const PLAN_LOCAL_KEYS = [
  PLAN_BETA_STORAGE_KEY,
  "trainoracle.plan-beta.history.v1",
  "trainoracle.plan-beta.adaptation.v1",
  "trainoracle.plan-beta.adaptation-activation.v1",
  "trainoracle.plan-adaptation-context.v1",
] as const
const PLAN_SESSION_KEYS = ["trainoracle.plan-beta.previous-intake.v1"] as const

export type DeviceTrainingDataResourceState =
  | { readonly kind: "available"; readonly count: number }
  | { readonly kind: "account_local"; readonly count: number }
  | { readonly kind: "none" }
  | { readonly kind: "conflict"; readonly count: number }
  | { readonly kind: "invalid" }
  | { readonly kind: "scope_mismatch" }

export type DeviceTrainingDataConnectionSummary = {
  readonly plan: DeviceTrainingDataResourceState
  readonly records: DeviceTrainingDataResourceState
  readonly decorations: DeviceTrainingDataResourceState
}

export type DeviceTrainingDataConnectionResult = {
  readonly ok: boolean
  readonly plan: "connected" | "account_local" | "preserved" | "none" | "conflict" | "invalid" | "failed" | "scope_mismatch"
  readonly records: "connected" | "none" | "conflict" | "invalid" | "failed" | "scope_mismatch"
  readonly decorations: "connected" | "none" | "conflict" | "invalid" | "failed" | "scope_mismatch"
  readonly connectedRecords: number
  readonly rollbackComplete: boolean
}

export type DevicePlanOnlineStorageStatus =
  | "none"
  | "stored_online"
  | "pending"
  | "conflict"
  | "capacity"
  | "rejected"
  | "review_required"
  | "invalid"
  | "unavailable"
  | "failed"

export type DeviceTrainingDataAccountConnectionResult = DeviceTrainingDataConnectionResult & {
  readonly planStorage: DevicePlanOnlineStorageStatus
}

type StorageSnapshot = {
  readonly storage: Storage
  readonly sourceKey: string
  readonly targetKey: string
  readonly sourceValue: string | null
  readonly targetValue: string | null
}

function storages(): { readonly local: Storage; readonly session: Storage } | null {
  try {
    if (typeof window === "undefined") return null
    return { local: window.localStorage, session: window.sessionStorage }
  } catch {
    return null
  }
}

function snapshotBundle(userId: string, baseKeys: readonly string[], storage: Storage): StorageSnapshot[] {
  return baseKeys.map((sourceKey) => ({
    storage,
    sourceKey,
    targetKey: accountScopedStorageKeyFor(sourceKey, userId),
    sourceValue: storage.getItem(sourceKey),
    targetValue: storage.getItem(accountScopedStorageKeyFor(sourceKey, userId)),
  }))
}

function planSnapshots(userId: string, storage: NonNullable<ReturnType<typeof storages>>): StorageSnapshot[] {
  return [
    ...snapshotBundle(userId, PLAN_LOCAL_KEYS, storage.local),
    ...snapshotBundle(userId, PLAN_SESSION_KEYS, storage.session),
  ]
}

function recordSnapshots(userId: string, storage: NonNullable<ReturnType<typeof storages>>): StorageSnapshot[] {
  return snapshotBundle(userId, [ATHLETE_RECORDS_STORAGE_KEY], storage.local)
}

function decorationSnapshots(userId: string, storage: NonNullable<ReturnType<typeof storages>>): StorageSnapshot[] {
  return snapshotBundle(
    userId,
    [DECORATION_STORAGE_KEY_V1, DECORATION_STORAGE_KEY_V2, DECORATION_STORAGE_KEY_V2_BACKUP, DECORATION_STORAGE_KEY_V3],
    storage.local,
  )
}

function decorationStateFromSnapshots(
  snapshots: readonly StorageSnapshot[],
  side: "source" | "target",
): { readonly kind: "none" | "invalid" | "loaded"; readonly state?: DecorationState } {
  const value = (snapshot: StorageSnapshot) => side === "source" ? snapshot.sourceValue : snapshot.targetValue
  const v3 = snapshots.find((snapshot) => snapshot.sourceKey === DECORATION_STORAGE_KEY_V3)
  const v2 = snapshots.find((snapshot) => snapshot.sourceKey === DECORATION_STORAGE_KEY_V2)
  const v1 = snapshots.find((snapshot) => snapshot.sourceKey === DECORATION_STORAGE_KEY_V1)
  if (v3 === undefined || v2 === undefined || v1 === undefined) return { kind: "invalid" }
  const v3Value = value(v3)
  if (v3Value !== null) {
    const state = parseStoredDecorationState(v3Value)
    return state === null ? { kind: "invalid" } : { kind: "loaded", state }
  }
  const v2Value = value(v2)
  if (v2Value !== null) {
    const state = parseStoredDecorationState(v2Value)
    return state === null ? { kind: "invalid" } : { kind: "loaded", state }
  }
  const v1Value = value(v1)
  if (v1Value === null) return { kind: "none" }
  const state = migrateLegacyDecorationState(v1Value)
  return state === null ? { kind: "invalid" } : { kind: "loaded", state }
}

function decorationStateHasUserData(state: DecorationState): boolean {
  return JSON.stringify(state) !== JSON.stringify(createEmptyDecorationState())
}

function moveDecorationState(
  snapshots: readonly StorageSnapshot[],
  state: DecorationState,
): { readonly ok: boolean; readonly rollbackComplete: boolean } {
  const v3 = snapshots.find((snapshot) => snapshot.sourceKey === DECORATION_STORAGE_KEY_V3)
  if (v3 === undefined) return { ok: false, rollbackComplete: true }
  try {
    const serialized = JSON.stringify(state)
    v3.storage.setItem(v3.targetKey, serialized)
    if (v3.storage.getItem(v3.targetKey) !== serialized) throw new Error("decoration target write failed")
    for (const snapshot of snapshots) {
      snapshot.storage.removeItem(snapshot.sourceKey)
      if (snapshot.storage.getItem(snapshot.sourceKey) !== null) throw new Error("decoration source removal failed")
    }
    return { ok: true, rollbackComplete: true }
  } catch {
    return { ok: false, rollbackComplete: restoreBundle(snapshots) }
  }
}

function targetHasData(snapshots: readonly StorageSnapshot[]): boolean {
  return snapshots.some((snapshot) => snapshot.targetValue !== null)
}

function sourceHasData(snapshots: readonly StorageSnapshot[]): boolean {
  return snapshots.some((snapshot) => snapshot.sourceValue !== null)
}

function restoreValue(storage: Storage, key: string, value: string | null): boolean {
  try {
    if (value === null) storage.removeItem(key)
    else storage.setItem(key, value)
    return storage.getItem(key) === value
  } catch {
    return false
  }
}

function restoreBundle(snapshots: readonly StorageSnapshot[]): boolean {
  return snapshots.flatMap((snapshot) => [
    restoreValue(snapshot.storage, snapshot.sourceKey, snapshot.sourceValue),
    restoreValue(snapshot.storage, snapshot.targetKey, snapshot.targetValue),
  ]).every(Boolean)
}

function moveBundle(snapshots: readonly StorageSnapshot[]): { readonly ok: boolean; readonly rollbackComplete: boolean } {
  try {
    for (const snapshot of snapshots) {
      if (snapshot.sourceValue === null) continue
      snapshot.storage.setItem(snapshot.targetKey, snapshot.sourceValue)
      if (snapshot.storage.getItem(snapshot.targetKey) !== snapshot.sourceValue) throw new Error("target write failed")
    }
    for (const snapshot of snapshots) {
      if (snapshot.sourceValue === null) continue
      snapshot.storage.removeItem(snapshot.sourceKey)
      if (snapshot.storage.getItem(snapshot.sourceKey) !== null) throw new Error("source removal failed")
    }
    return { ok: true, rollbackComplete: true }
  } catch {
    return { ok: false, rollbackComplete: restoreBundle(snapshots) }
  }
}

export function inspectDeviceTrainingDataConnection(
  userId: string,
  today: Date = new Date(),
): DeviceTrainingDataConnectionSummary {
  if (userId === "" || !localAccountScopeIsCurrent(userId)) {
    return {
      plan: { kind: "scope_mismatch" },
      records: { kind: "scope_mismatch" },
      decorations: { kind: "scope_mismatch" },
    }
  }
  const storage = storages()
  if (storage === null) {
    return { plan: { kind: "invalid" }, records: { kind: "invalid" }, decorations: { kind: "invalid" } }
  }

  let plans: StorageSnapshot[]
  let records: StorageSnapshot[]
  let decorations: StorageSnapshot[]
  try {
    plans = planSnapshots(userId, storage)
    records = recordSnapshots(userId, storage)
    decorations = decorationSnapshots(userId, storage)
  } catch {
    return { plan: { kind: "invalid" }, records: { kind: "invalid" }, decorations: { kind: "invalid" } }
  }

  const devicePlan = readPlanBetaStateForAccount(null)
  const deviceRecords = readAthleteRecordsForAccount(null, today)
  const planSourceExists = sourceHasData(plans)
  const planTargetExists = targetHasData(plans)
  const plan = !planSourceExists
    ? planTargetExists
      ? { kind: "account_local", count: 1 } as const
      : { kind: "none" } as const
    : planTargetExists
      ? { kind: "conflict", count: 1 } as const
      : devicePlan.kind === "loaded"
      ? { kind: "available", count: 1 } as const
      : { kind: "invalid" } as const
  const recordCount = deviceRecords.kind === "loaded" ? deviceRecords.records.length : 0
  const recordSourceExists = sourceHasData(records)
  const recordState = !recordSourceExists
    ? { kind: "none" } as const
    : targetHasData(records)
      ? { kind: "conflict", count: recordCount } as const
      : deviceRecords.kind === "loaded" && recordCount > 0
      ? { kind: "available", count: recordCount } as const
      : { kind: "invalid" } as const
  const deviceDecoration = decorationStateFromSnapshots(decorations, "source")
  const accountDecoration = decorationStateFromSnapshots(decorations, "target")
  const decorationState = deviceDecoration.kind === "none"
    || (deviceDecoration.kind === "loaded" && !decorationStateHasUserData(deviceDecoration.state!))
    ? { kind: "none" } as const
    : deviceDecoration.kind === "invalid"
      ? { kind: "invalid" } as const
      : accountDecoration.kind === "invalid"
        || (accountDecoration.kind === "loaded" && decorationStateHasUserData(accountDecoration.state!))
        ? { kind: "conflict", count: 1 } as const
        : { kind: "available", count: 1 } as const
  return { plan, records: recordState, decorations: decorationState }
}

export function connectDeviceTrainingData(
  userId: string,
  today: Date = new Date(),
  options: { readonly movePlan?: boolean } = {},
): DeviceTrainingDataConnectionResult {
  const summary = inspectDeviceTrainingDataConnection(userId, today)
  const storage = storages()
  if (storage === null || !localAccountScopeIsCurrent(userId)) {
    return {
      ok: false,
      plan: "scope_mismatch",
      records: "scope_mismatch",
      decorations: "scope_mismatch",
      connectedRecords: 0,
      rollbackComplete: true,
    }
  }

  let plans: StorageSnapshot[]
  let records: StorageSnapshot[]
  let decorations: StorageSnapshot[]
  try {
    plans = planSnapshots(userId, storage)
    records = recordSnapshots(userId, storage)
    decorations = decorationSnapshots(userId, storage)
  } catch {
    return {
      ok: false,
      plan: "failed",
      records: "failed",
      decorations: "failed",
      connectedRecords: 0,
      rollbackComplete: true,
    }
  }
  const movePlan = options.movePlan !== false
  const planMove = summary.plan.kind === "available" && movePlan ? moveBundle(plans) : null
  const recordMove = summary.records.kind === "available" ? moveBundle(records) : null
  const deviceDecoration = decorationStateFromSnapshots(decorations, "source")
  const decorationMove = summary.decorations.kind === "available" && deviceDecoration.kind === "loaded"
    ? moveDecorationState(decorations, deviceDecoration.state!)
    : null
  const planResult = summary.plan.kind === "available" && !movePlan
    ? "preserved"
    : planMove === null ? summary.plan.kind : planMove.ok ? "connected" : "failed"
  const recordResult = recordMove === null ? summary.records.kind : recordMove.ok ? "connected" : "failed"
  const normalizedPlan = planResult === "available" ? "failed" : planResult
  const normalizedRecords = recordResult === "available" || recordResult === "account_local" ? "failed" : recordResult
  const decorationResult = decorationMove === null
    ? summary.decorations.kind
    : decorationMove.ok ? "connected" : "failed"
  const normalizedDecorations = decorationResult === "available" || decorationResult === "account_local" ? "failed" : decorationResult
  return {
    ok: normalizedPlan !== "failed"
      && normalizedPlan !== "invalid"
      && normalizedPlan !== "scope_mismatch"
      && normalizedRecords !== "failed"
      && normalizedRecords !== "invalid"
      && normalizedRecords !== "scope_mismatch"
      && normalizedDecorations !== "failed"
      && normalizedDecorations !== "invalid"
      && normalizedDecorations !== "scope_mismatch",
    plan: normalizedPlan,
    records: normalizedRecords,
    decorations: normalizedDecorations,
    connectedRecords: normalizedRecords === "connected" && summary.records.kind === "available"
      ? summary.records.count
      : 0,
    rollbackComplete: (planMove?.rollbackComplete ?? true)
      && (recordMove?.rollbackComplete ?? true)
      && (decorationMove?.rollbackComplete ?? true),
  }
}

function planPacketFromDevice(
  userId: string,
  summary: DeviceTrainingDataConnectionSummary,
  storage: NonNullable<ReturnType<typeof storages>>,
): AccountPlanPacket | null {
  const sourceScope = summary.plan.kind === "available" ? null : userId
  const read = readPlanBetaStateForAccount(sourceScope)
  if (read.kind !== "loaded") return null

  const contextKey = accountScopedStorageKeyFor(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY, sourceScope)
  let context: unknown = null
  try {
    const raw = storage.local.getItem(contextKey)
    if (raw !== null) context = JSON.parse(raw)
  } catch {
    context = null
  }
  const parsedContext = contextSchema.safeParse(context)
  const withContext = parsedContext.success
    ? { state: read.state, evidence: null, context: parsedContext.data }
    : null
  if (withContext !== null && validateAccountPlanPacket(withContext)) return withContext
  const packet = { state: read.state, evidence: null }
  return validateAccountPlanPacket(packet) ? packet : null
}

function onlineStatus(result: AccountPlanResult): DevicePlanOnlineStorageStatus {
  if (result === "ACCOUNT") return "stored_online"
  if (result === "PENDING") return "pending"
  if (result === "CONFLICT" || result === "HISTORY_CONFLICT") return "conflict"
  if (result === "CAPACITY") return "capacity"
  if (result === "REJECTED") return "rejected"
  if (result === "REVIEW_REQUIRED") return "review_required"
  if (result === "INVALID") return "invalid"
  return "failed"
}

/**
 * Stores a validated device plan in the authenticated account before changing
 * its local ownership. A failed or unacknowledged upload always leaves the
 * original plan bytes in place.
 */
export async function connectDeviceTrainingDataToAccount(
  userId: string,
  today: Date = new Date(),
  serviceFactory: () => AccountPlanService | null = accountPlanService,
): Promise<DeviceTrainingDataAccountConnectionResult> {
  const summary = inspectDeviceTrainingDataConnection(userId, today)
  if (summary.plan.kind !== "available" && summary.plan.kind !== "account_local") {
    return { ...connectDeviceTrainingData(userId, today), planStorage: "none" }
  }
  const storage = storages()
  if (storage === null || !localAccountScopeIsCurrent(userId)) {
    return { ...connectDeviceTrainingData(userId, today, { movePlan: false }), planStorage: "unavailable" }
  }
  const packet = planPacketFromDevice(userId, summary, storage)
  if (packet === null) {
    return { ...connectDeviceTrainingData(userId, today, { movePlan: false }), planStorage: "invalid" }
  }
  const service = serviceFactory()
  if (service === null) {
    return { ...connectDeviceTrainingData(userId, today, { movePlan: false }), planStorage: "unavailable" }
  }

  const hydrated = await service.hydrate()
  if (hydrated && "migrateLegacy" in service && service.snapshot().migrationRequired) {
    const migration = onlineStatus(await service.migrateLegacy())
    if (migration !== "stored_online") {
      return { ...connectDeviceTrainingData(userId, today, { movePlan: false }), planStorage: migration }
    }
  }
  if (hydrated && "loadHistory" in service && !await service.loadHistory()) {
    return { ...connectDeviceTrainingData(userId, today, { movePlan: false }), planStorage: "failed" }
  }
  const view = service.snapshot()
  if (!hydrated || view.fingerprint === null || !["EMPTY", "READY"].includes(view.status)) {
    const status: DevicePlanOnlineStorageStatus = view.status === "PENDING" ? "pending"
      : view.status === "CONFLICT" ? "conflict"
      : view.status === "REJECTED" ? "rejected"
      : view.status === "INVALID" ? "invalid"
      : "failed"
    return { ...connectDeviceTrainingData(userId, today, { movePlan: false }), planStorage: status }
  }

  const desired = accountPlanEntry(packet)
  const existing = view.document?.data.plans.find((entry) => entry.planId === desired.planId)
  const needsHistoryRepair = existing !== undefined && existing.archivedAt === null
    && view.document?.data.currentPlanId !== existing.planId
  const stored = existing === undefined || needsHistoryRepair
    ? onlineStatus(await service.mutate({ kind: "SAVE_HISTORY", packet }, view.fingerprint))
    : accountPlanFingerprint(existing.progress) === accountPlanFingerprint(desired.progress)
      ? "stored_online"
      : "conflict"
  return {
    ...connectDeviceTrainingData(userId, today, { movePlan: stored === "stored_online" }),
    planStorage: stored,
  }
}
