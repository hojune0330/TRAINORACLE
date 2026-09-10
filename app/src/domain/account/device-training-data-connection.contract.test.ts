import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ATHLETE_RECORDS_STORAGE_KEY,
  createSelfReportedAthleteRecord,
} from "../athlete-records"
import { PLAN_BETA_STORAGE_KEY } from "../plan-beta-store"
import { stateFixture } from "../plan-beta-store.test-fixture"
import { DECORATION_STORAGE_KEY_V1, DECORATION_STORAGE_KEY_V2, DECORATION_STORAGE_KEY_V3 } from "../decoration-store"
import { createEmptyDecorationState, parseStoredDecorationState } from "../decoration-schema"
import {
  connectDeviceTrainingData,
  connectDeviceTrainingDataToAccount,
  inspectDeviceTrainingDataConnection,
} from "./device-training-data-connection"
import type { AccountPlanService } from "./account-plan-service"
import { accountPlanEntry, emptyAccountPlanDocument } from "./account-plan-document-schema"
import { accountPlanPacketFixture } from "./account-plan.test-fixtures"
import { setActiveLocalAccount } from "./local-journal-ownership"
import { accountScopedStorageKeyFor } from "./local-account-scope"

const TODAY = new Date("2026-08-25T12:00:00.000Z")
const USER_ID = "athlete-a"
const PLAN_KEYS = [
  PLAN_BETA_STORAGE_KEY,
  "trainoracle.plan-beta.history.v1",
  "trainoracle.plan-beta.adaptation.v1",
  "trainoracle.plan-beta.adaptation-activation.v1",
  "trainoracle.plan-adaptation-context.v1",
] as const
const PREVIOUS_INTAKE_KEY = "trainoracle.plan-beta.previous-intake.v1"

function validRecord(id = "pb-5000") {
  const record = createSelfReportedAthleteRecord({
    id,
    purpose: "PERSONAL_BEST",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2026-08-01",
    seasonId: null,
  }, TODAY)
  if (record === null) throw new TypeError("Expected a valid record fixture")
  return record
}

function seedDevicePlanBundle() {
  const values = new Map<string, string>()
  for (const key of PLAN_KEYS) {
    const value = key === PLAN_BETA_STORAGE_KEY
      ? JSON.stringify(stateFixture())
      : JSON.stringify({ source: key })
    window.localStorage.setItem(key, value)
    values.set(key, value)
  }
  const previous = JSON.stringify(stateFixture().intake)
  window.sessionStorage.setItem(PREVIOUS_INTAKE_KEY, previous)
  values.set(PREVIOUS_INTAKE_KEY, previous)
  return values
}

function legacyDevicePlanState() {
  const current = stateFixture()
  if (current.version !== 3) throw new TypeError("Expected current v3 fixture")
  const { eventDistanceM: _distance, selectedDetailedTemplateRef: _intakeTemplate, ...intake } = current.intake
  const { pairId: _pairId, selectedDetailedTemplateRef: _activeTemplate, ...activePlan } = current.activePlan
  return { ...current, version: 1 as const, intake, activePlan }
}

beforeEach(() => {
  window.localStorage.clear()
  window.sessionStorage.clear()
  setActiveLocalAccount(USER_ID)
})

afterEach(() => {
  vi.restoreAllMocks()
  setActiveLocalAccount(null)
})

describe("explicit device training data connection", () => {
  it("moves the complete plan bundle and records only after an explicit call", () => {
    const planValues = seedDevicePlanBundle()
    const recordsValue = JSON.stringify([validRecord()])
    window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, recordsValue)

    expect(inspectDeviceTrainingDataConnection(USER_ID, TODAY)).toEqual({
      plan: { kind: "available", count: 1 },
      records: { kind: "available", count: 1 },
      decorations: { kind: "none" },
    })

    const result = connectDeviceTrainingData(USER_ID, TODAY)

    expect(result).toEqual({
      ok: true,
      plan: "connected",
      records: "connected",
      decorations: "none",
      connectedRecords: 1,
      rollbackComplete: true,
    })
    for (const key of PLAN_KEYS) {
      expect(window.localStorage.getItem(key)).toBeNull()
      expect(window.localStorage.getItem(accountScopedStorageKeyFor(key, USER_ID))).toBe(planValues.get(key))
    }
    expect(window.sessionStorage.getItem(PREVIOUS_INTAKE_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(accountScopedStorageKeyFor(PREVIOUS_INTAKE_KEY, USER_ID))).toBe(planValues.get(PREVIOUS_INTAKE_KEY))
    expect(window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(ATHLETE_RECORDS_STORAGE_KEY, USER_ID))).toBe(recordsValue)
  })

  it("recognizes an account-scoped device plan that still needs online storage", () => {
    window.localStorage.setItem(
      accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID),
      JSON.stringify(stateFixture()),
    )
    window.localStorage.setItem(
      accountScopedStorageKeyFor(ATHLETE_RECORDS_STORAGE_KEY, USER_ID),
      JSON.stringify([validRecord()]),
    )

    expect(inspectDeviceTrainingDataConnection(USER_ID, TODAY)).toEqual({
      plan: { kind: "account_local", count: 1 },
      records: { kind: "none" },
      decorations: { kind: "none" },
    })
  })

  it("stores a device plan online before moving its original into account-local storage", async () => {
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, source)
    const mutate = vi.fn(async () => "ACCOUNT" as const)
    const service = {
      hydrate: vi.fn(async () => true),
      snapshot: vi.fn(() => ({ status: "EMPTY", document: null, confirmedDocument: null,
        fingerprint: "server-empty", currentPlan: null })),
      mutate,
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result.planStorage).toBe("stored_online")
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ kind: "SAVE_HISTORY" }), "server-empty")
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBeNull()
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
  })

  it("uploads a plan that an older connection already moved into account-local storage", async () => {
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), source)
    const mutate = vi.fn(async () => "ACCOUNT" as const)
    const service = {
      hydrate: vi.fn(async () => true),
      snapshot: vi.fn(() => ({ status: "EMPTY", document: null, confirmedDocument: null,
        fingerprint: "server-empty", currentPlan: null })),
      mutate,
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result).toMatchObject({ plan: "account_local", planStorage: "stored_online" })
    expect(mutate).toHaveBeenCalledOnce()
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
  })

  it("repairs an acknowledged non-current plan that is missing its history marker", async () => {
    const state = stateFixture()
    if (state.version !== 3) throw new TypeError("Expected current v3 fixture")
    const source = JSON.stringify(state)
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), source)
    const packet = { state, evidence: null } as const
    const entry = accountPlanEntry(packet)
    const document = emptyAccountPlanDocument()
    document.data.plans.push(entry)
    const mutate = vi.fn(async () => "ACCOUNT" as const)
    const service = {
      hydrate: vi.fn(async () => true),
      loadHistory: vi.fn(async () => true),
      snapshot: vi.fn(() => ({ status: "READY", document, confirmedDocument: document,
        fingerprint: "server-history", currentPlan: null, migrationRequired: false })),
      mutate,
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result).toMatchObject({ plan: "account_local", planStorage: "stored_online" })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ kind: "SAVE_HISTORY" }), "server-history")
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
  })

  it("normalizes a legacy device plan into read-only online history while preserving its exact local bytes", async () => {
    const source = JSON.stringify(legacyDevicePlanState())
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), source)
    const mutate = vi.fn(async () => "ACCOUNT" as const)
    const service = {
      hydrate: vi.fn(async () => true),
      snapshot: vi.fn(() => ({ status: "EMPTY", document: null, confirmedDocument: null,
        fingerprint: "server-empty", currentPlan: null })),
      mutate,
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result).toMatchObject({ plan: "account_local", planStorage: "stored_online" })
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({
      kind: "SAVE_HISTORY",
      packet: expect.objectContaining({ state: expect.objectContaining({ version: 2 }), evidence: null }),
    }), "server-empty")
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
  })

  it("migrates a legacy server document before adding an account-local device plan", async () => {
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), source)
    const calls: string[] = []
    let migrationRequired = true
    const migrateLegacy = vi.fn(async () => {
      calls.push("migrate")
      migrationRequired = false
      return "ACCOUNT" as const
    })
    const mutate = vi.fn(async () => {
      calls.push("store")
      return "ACCOUNT" as const
    })
    const service = {
      hydrate: vi.fn(async () => true),
      loadHistory: vi.fn(async () => true),
      migrateLegacy,
      snapshot: vi.fn(() => ({ status: "EMPTY", document: null, confirmedDocument: null,
        fingerprint: "server-empty", currentPlan: null, migrationRequired })),
      mutate,
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result).toMatchObject({ plan: "account_local", planStorage: "stored_online" })
    expect(calls).toEqual(["migrate", "store"])
    expect(migrateLegacy).toHaveBeenCalledOnce()
    expect(mutate).toHaveBeenCalledWith(expect.objectContaining({ kind: "SAVE_HISTORY" }), "server-empty")
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
  })

  it("preserves the device plan when legacy server migration is not acknowledged", async () => {
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), source)
    const service = {
      hydrate: vi.fn(async () => true),
      migrateLegacy: vi.fn(async () => "CONFLICT" as const),
      snapshot: vi.fn(() => ({ status: "READY", document: emptyAccountPlanDocument(),
        confirmedDocument: emptyAccountPlanDocument(), fingerprint: "server-legacy", currentPlan: null,
        migrationRequired: true })),
      mutate: vi.fn(async () => "ACCOUNT" as const),
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result).toMatchObject({ plan: "account_local", planStorage: "conflict" })
    expect(service.mutate).not.toHaveBeenCalled()
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(source)
  })

  it("preserves the exact device plan when the server has not acknowledged storage", async () => {
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, source)
    const service = {
      hydrate: vi.fn(async () => true),
      snapshot: vi.fn(() => ({ status: "EMPTY", document: null, confirmedDocument: null,
        fingerprint: "server-empty", currentPlan: null })),
      mutate: vi.fn(async () => "PENDING" as const),
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result.planStorage).toBe("pending")
    expect(result.plan).toBe("preserved")
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(source)
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBeNull()
  })

  it("treats an identical plan already confirmed online as stored without writing it twice", async () => {
    const packet = accountPlanPacketFixture(3)
    const state = packet.state
    const document = emptyAccountPlanDocument()
    document.data.plans.push({ ...accountPlanEntry(packet), archivedAt: TODAY.toISOString() })
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), JSON.stringify(state))
    const mutate = vi.fn(async () => "INVALID" as const)
    const service = {
      hydrate: vi.fn(async () => true),
      loadHistory: vi.fn(async () => true),
      snapshot: vi.fn(() => ({ status: "READY", document, confirmedDocument: document,
        fingerprint: "server-ready", currentPlan: null })),
      mutate,
    } as unknown as AccountPlanService

    const result = await connectDeviceTrainingDataToAccount(USER_ID, TODAY, () => service)

    expect(result.planStorage).toBe("stored_online")
    expect(mutate).not.toHaveBeenCalled()
  })

  it("preserves a conflicting device plan while independently connecting device records", () => {
    const devicePlan = JSON.stringify(stateFixture())
    const accountPlan = JSON.stringify({ ...stateFixture(), generatedAt: "2026-08-25T00:00:00.000Z" })
    const records = JSON.stringify([validRecord()])
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, devicePlan)
    window.localStorage.setItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID), accountPlan)
    window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, records)

    const result = connectDeviceTrainingData(USER_ID, TODAY)

    expect(result).toMatchObject({ ok: true, plan: "conflict", records: "connected", connectedRecords: 1 })
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(devicePlan)
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBe(accountPlan)
    expect(window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBeNull()
  })

  it("fails closed on malformed device data without changing either storage space", () => {
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, "{not-json")
    window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, JSON.stringify([{ rawMemo: "private" }]))

    expect(connectDeviceTrainingData(USER_ID, TODAY)).toMatchObject({
      ok: false,
      plan: "invalid",
      records: "invalid",
    })
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe("{not-json")
    expect(window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)).toBe(JSON.stringify([{ rawMemo: "private" }]))
  })

  it("rejects a stale account scope before reading or moving data", () => {
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, JSON.stringify(stateFixture()))

    expect(connectDeviceTrainingData("athlete-b", TODAY)).toEqual({
      ok: false,
      plan: "scope_mismatch",
      records: "scope_mismatch",
      decorations: "scope_mismatch",
      connectedRecords: 0,
      rollbackComplete: true,
    })
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).not.toBeNull()
  })

  it("restores exact source and target bytes if source removal fails", () => {
    const source = JSON.stringify(stateFixture())
    window.localStorage.setItem(PLAN_BETA_STORAGE_KEY, source)
    const originalRemove = Storage.prototype.removeItem
    let blocked = false
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key: string) {
      if (!blocked && this === window.localStorage && key === PLAN_BETA_STORAGE_KEY) {
        blocked = true
        return
      }
      originalRemove.call(this, key)
    })

    const result = connectDeviceTrainingData(USER_ID, TODAY)

    expect(result).toMatchObject({ ok: false, plan: "failed", rollbackComplete: true })
    expect(window.localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(source)
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(PLAN_BETA_STORAGE_KEY, USER_ID))).toBeNull()
  })

  it("moves meaningful device decorations without inventing or refunding points", () => {
    /* 보유 목록은 로드 시 카탈로그 순서로 정규화되므로 기대 바이트도 정규화 후로 만든다. */
    const state = parseStoredDecorationState(JSON.stringify({
      ...createEmptyDecorationState(),
      spentPoints: 12,
      ownedItemIds: [...createEmptyDecorationState().ownedItemIds, "STICKER_FINISH_LINE"],
    }))
    const serialized = JSON.stringify(state)
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, serialized)

    expect(inspectDeviceTrainingDataConnection(USER_ID, TODAY).decorations).toEqual({ kind: "available", count: 1 })
    const result = connectDeviceTrainingData(USER_ID, TODAY)

    expect(result).toMatchObject({ ok: true, decorations: "connected" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBeNull()
    /* P4 스키마 v3부터 계정 이동 대상 키는 v3다 — 소스의 v2/v1 키는 이동 후 제거된다. */
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(DECORATION_STORAGE_KEY_V3, USER_ID))).toBe(serialized)
  })

  it("treats an account default as empty but preserves two meaningful decoration histories", () => {
    const empty = JSON.stringify(createEmptyDecorationState())
    const device = JSON.stringify({
      ...createEmptyDecorationState(),
      library: { favoriteItemIds: ["INK_NAVY"], recentItemIds: [] },
    })
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, device)
    window.localStorage.setItem(accountScopedStorageKeyFor(DECORATION_STORAGE_KEY_V2, USER_ID), empty)

    expect(connectDeviceTrainingData(USER_ID, TODAY)).toMatchObject({ ok: true, decorations: "connected" })

    setActiveLocalAccount(null)
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V2, device)
    setActiveLocalAccount(USER_ID)
    const account = JSON.stringify({
      ...createEmptyDecorationState(),
      library: { favoriteItemIds: [], recentItemIds: ["INK_NAVY"] },
    })
    window.localStorage.setItem(accountScopedStorageKeyFor(DECORATION_STORAGE_KEY_V2, USER_ID), account)

    expect(connectDeviceTrainingData(USER_ID, TODAY)).toMatchObject({ ok: true, decorations: "conflict" })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V2)).toBe(device)
    expect(window.localStorage.getItem(accountScopedStorageKeyFor(DECORATION_STORAGE_KEY_V2, USER_ID))).toBe(account)
  })

  it("normalizes a legacy device decoration payload into account v3 storage", () => {
    window.localStorage.setItem(DECORATION_STORAGE_KEY_V1, JSON.stringify({
      version: 1,
      spentPoints: 12,
      ownedItemIds: ["STICKER_FINISH_LINE"],
      pointMeaning: "NON_ECONOMIC_NON_TRANSFERABLE_BETA",
    }))

    const result = connectDeviceTrainingData(USER_ID, TODAY)
    const target = window.localStorage.getItem(accountScopedStorageKeyFor(DECORATION_STORAGE_KEY_V3, USER_ID))

    expect(result).toMatchObject({ ok: true, decorations: "connected" })
    expect(target).not.toBeNull()
    expect(JSON.parse(target!)).toMatchObject({ version: 3, spentPoints: 12 })
    expect(window.localStorage.getItem(DECORATION_STORAGE_KEY_V1)).toBeNull()
  })
})
