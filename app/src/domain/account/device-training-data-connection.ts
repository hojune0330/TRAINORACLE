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
} from "../decoration-store"
import {
  createEmptyDecorationState,
  migrateLegacyDecorationState,
  parseStoredDecorationState,
} from "../decoration-schema"
import type { DecorationState } from "../decoration-schema"
import {
  accountScopedStorageKeyFor,
  localAccountScopeIsCurrent,
} from "./local-account-scope"

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
  readonly plan: "connected" | "none" | "conflict" | "invalid" | "failed" | "scope_mismatch"
  readonly records: "connected" | "none" | "conflict" | "invalid" | "failed" | "scope_mismatch"
  readonly decorations: "connected" | "none" | "conflict" | "invalid" | "failed" | "scope_mismatch"
  readonly connectedRecords: number
  readonly rollbackComplete: boolean
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
  return snapshotBundle(userId, [DECORATION_STORAGE_KEY_V1, DECORATION_STORAGE_KEY_V2], storage.local)
}

function decorationStateFromSnapshots(
  snapshots: readonly StorageSnapshot[],
  side: "source" | "target",
): { readonly kind: "none" | "invalid" | "loaded"; readonly state?: DecorationState } {
  const value = (snapshot: StorageSnapshot) => side === "source" ? snapshot.sourceValue : snapshot.targetValue
  const v2 = snapshots.find((snapshot) => snapshot.sourceKey === DECORATION_STORAGE_KEY_V2)
  const v1 = snapshots.find((snapshot) => snapshot.sourceKey === DECORATION_STORAGE_KEY_V1)
  if (v2 === undefined || v1 === undefined) return { kind: "invalid" }
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
  const v2 = snapshots.find((snapshot) => snapshot.sourceKey === DECORATION_STORAGE_KEY_V2)
  if (v2 === undefined) return { ok: false, rollbackComplete: true }
  try {
    const serialized = JSON.stringify(state)
    v2.storage.setItem(v2.targetKey, serialized)
    if (v2.storage.getItem(v2.targetKey) !== serialized) throw new Error("decoration target write failed")
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
  const plan = !planSourceExists
    ? { kind: "none" } as const
    : targetHasData(plans)
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
  const planMove = summary.plan.kind === "available" ? moveBundle(plans) : null
  const recordMove = summary.records.kind === "available" ? moveBundle(records) : null
  const deviceDecoration = decorationStateFromSnapshots(decorations, "source")
  const decorationMove = summary.decorations.kind === "available" && deviceDecoration.kind === "loaded"
    ? moveDecorationState(decorations, deviceDecoration.state!)
    : null
  const planResult = planMove === null ? summary.plan.kind : planMove.ok ? "connected" : "failed"
  const recordResult = recordMove === null ? summary.records.kind : recordMove.ok ? "connected" : "failed"
  const normalizedPlan = planResult === "available" ? "failed" : planResult
  const normalizedRecords = recordResult === "available" ? "failed" : recordResult
  const decorationResult = decorationMove === null
    ? summary.decorations.kind
    : decorationMove.ok ? "connected" : "failed"
  const normalizedDecorations = decorationResult === "available" ? "failed" : decorationResult
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
