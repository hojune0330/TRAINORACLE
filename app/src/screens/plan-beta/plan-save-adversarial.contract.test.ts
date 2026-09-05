import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { generatePlanFromDraft } from "../../domain/plan-beta-flow"
import * as mutationLock from "../../domain/plan-mutation-lock"
import * as authority from "../../domain/detailed-prescription-runtime-authority"
import { DETAILED_PRESCRIPTION_APPROVALS } from "../../domain/detailed-prescription-approvals"
import { activeAthleteRecordsStorageKey, createSelfReportedAthleteRecord, saveAthleteRecord } from "../../domain/athlete-records"
import { setActiveLocalAccount } from "../../domain/account/local-journal-ownership"
import { JOURNAL_STORAGE_KEY } from "../../domain/journal-local-storage"
import { PLAN_ADAPTATION_CONTEXT_STORAGE_KEY } from "../../domain/plan-adaptation-ui-context"
import { readPlanBetaStateFromStorage } from "../../domain/plan-beta-store"
import { saveSelectedPlanCandidate } from "./plan-selection"

const NOW = new Date("2026-09-06T03:00:00.000Z")
const ACTIVE_KEY = "trainoracle.plan-beta.v1"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  setActiveLocalAccount(null)
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  setActiveLocalAccount(null)
})

function generated(detailed = false) {
  const approval = DETAILED_PRESCRIPTION_APPROVALS.find(item => item.targetEventDistanceM === 5000)!
  if (detailed) {
    const record = createSelfReportedAthleteRecord({
      id: "adversarial-synthetic-5k", purpose: "PERSONAL_BEST", eventDistanceM: 5000,
      performanceSeconds: 1111, achievedOn: "2026-08-01", seasonId: null,
    }, NOW)
    if (record === null) throw new Error("Invalid synthetic record")
    expect(saveAthleteRecord(record, NOW).ok).toBe(true)
  }
  const result = generatePlanFromDraft({
    eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
    experienceBand: "EXPERIENCED", availableDayCount: 3, requestedFrameLength: 9,
    trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING",
    selectedDetailedTemplateRef: detailed ? {
      templateId: approval.templateId, version: approval.templateVersion,
      fingerprint: approval.templateContentFingerprint,
    } : null,
  }, "NO_KNOWN_RISK", detailed ? { selectedRecordId: "adversarial-synthetic-5k" } : undefined)
  if (result.kind !== "generated") throw new Error("Expected real generated fixture")
  expect(result.generated.candidates[0].sessions.some(session => session.prescription.kind === "PACE_TARGET"))
    .toBe(detailed)
  return result
}

function save(plan: ReturnType<typeof generated>) {
  return saveSelectedPlanCandidate(
    { candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" },
    plan.generated, plan.gate, plan.intake, plan.athleteEvidence,
  )
}

function delayedLock() {
  const releases: Array<() => void> = []
  vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({
    request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
      new Promise<T>(resolve => { releases.push(() => resolve(callback({}))) }),
  })
  return () => {
    const release = releases.shift()
    if (release === undefined) throw new Error("Save never reached the lock")
    release()
  }
}

describe("adversarial plan save transaction", () => {
  it("persists the exact detailed candidate and context after an unchanged lock wait", async () => {
    const plan = generated(true)
    const release = delayedLock()
    const pending = save(plan)
    release()
    const result = await pending
    expect(result.kind).toBe("saved")
    if (result.kind !== "saved") throw new Error("Expected successful detailed save")
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "loaded", state: result.state })
    expect(result.state.activePlan.sessions).toEqual(plan.generated.candidates[0].sessions)
    expect(JSON.parse(localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)!))
      .toMatchObject({ activeCandidateId: result.state.activePlan.candidateId, candidates: plan.generated.candidates })
  })

  it("rejects authority withdrawn after preview without silently saving RPE fallback", async () => {
    const plan = generated(true)
    const release = delayedLock()
    const pending = save(plan)
    // Boundary fault injection only: no source registry or real approval is changed.
    const withdrawn = vi.spyOn(authority, "resolveDetailedPrescriptionRuntimeAuthority")
      .mockReturnValue({ kind: "fallback", code: "RUNTIME_AUTHORITY_UNAVAILABLE" })
    const before = Object.entries(localStorage)
    release()
    await expect(pending).resolves.toEqual({ kind: "rejected", code: "DETAILED_TEMPLATE_AUTHORITY_UNAVAILABLE" })
    expect(withdrawn).toHaveBeenCalled()
    expect(Object.entries(localStorage)).toEqual(before)
  })

  it.each(["deleted", "duplicate", "unreadable", "stale"] as const)(
    "rejects an anchor that becomes %s during the lock wait without rebinding",
    async change => {
      const plan = generated(true)
      const candidateBefore = JSON.stringify(plan.generated)
      const release = delayedLock()
      const pending = save(plan)
      const key = activeAthleteRecordsStorageKey()
      if (change === "deleted") localStorage.removeItem(key)
      if (change === "duplicate") {
        const records = JSON.parse(localStorage.getItem(key)!)
        localStorage.setItem(key, JSON.stringify([...records, records[0]]))
      }
      if (change === "unreadable") localStorage.setItem(key, "{unreadable")
      if (change === "stale") vi.setSystemTime(new Date("2028-09-06T03:00:00Z"))
      const before = Object.entries(localStorage)
      release()
      await expect(pending).resolves.toEqual({ kind: "rejected", code: "PACE_ANCHOR_RECONFIRMATION_REQUIRED" })
      expect(Object.entries(localStorage)).toEqual(before)
      expect(JSON.stringify(plan.generated)).toBe(candidateBefore)
    },
  )

  it("preserves confirmed anchor content when only elapsed display changes during the lock wait", async () => {
    const plan = generated(true)
    const release = delayedLock()
    const pending = save(plan)
    vi.setSystemTime(new Date("2026-10-06T03:00:00Z"))
    release()
    const result = await pending
    expect(result.kind).toBe("saved")
    if (result.kind !== "saved") throw new Error("Expected unchanged anchor to save")
    expect(result.state.activePlan.sessions).toEqual(plan.generated.candidates[0].sessions)
  })

  it("rejects account changes during the lock wait without writing either account", async () => {
    const plan = generated()
    const release = delayedLock()
    const pending = save(plan)
    setActiveLocalAccount("synthetic-account-b")
    const before = Object.entries(localStorage)
    release()
    await expect(pending).resolves.toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
    expect(Object.entries(localStorage)).toEqual(before)
  })

  it("fails closed when the journal becomes unreadable during the lock wait", async () => {
    const plan = generated()
    const release = delayedLock()
    const pending = save(plan)
    const original = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(function (this: Storage, key: string) {
      if (key === JOURNAL_STORAGE_KEY) throw new Error("Synthetic journal read failure")
      return original.call(this, key)
    })
    const before = Object.entries(localStorage)
    release()
    await expect(pending).resolves.toEqual({ kind: "rejected", code: "RECENT_JOURNAL_REQUIRES_REVIEW" })
    expect(Object.entries(localStorage)).toEqual(before)
  })

  it("allows a valid empty journal arriving during the lock wait", async () => {
    const plan = generated()
    const release = delayedLock()
    const pending = save(plan)
    localStorage.setItem(JOURNAL_STORAGE_KEY, "[]")
    release()
    expect((await pending).kind).toBe("saved")
    expect(localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe("[]")
  })

  it("reports uncertain state when context failure leaves an unremovable active plan", async () => {
    const plan = generated()
    const set = Storage.prototype.setItem
    const remove = Storage.prototype.removeItem
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (this: Storage, key: string, value: string) {
      if (key === PLAN_ADAPTATION_CONTEXT_STORAGE_KEY) throw new Error("Synthetic quota failure")
      return set.call(this, key, value)
    })
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (this: Storage, key: string) {
      if (key === ACTIVE_KEY) throw new Error("Synthetic rollback failure")
      return remove.call(this, key)
    })
    await expect(save(plan)).resolves.toEqual({ kind: "rejected", code: "PLAN_STORAGE_STATE_UNCERTAIN" })
    expect(readPlanBetaStateFromStorage().kind).toBe("loaded")
    expect(localStorage.getItem(PLAN_ADAPTATION_CONTEXT_STORAGE_KEY)).toBeNull()
  })

  it("rejects a second delayed save after the first transaction commits without overwriting", async () => {
    const plan = generated()
    const release = delayedLock()
    const first = save(plan)
    const second = save(plan)
    release()
    expect((await first).kind).toBe("saved")
    const before = Object.entries(localStorage)
    release()
    await expect(second).resolves.toEqual({ kind: "rejected", code: "STALE_BASE" })
    expect(Object.entries(localStorage)).toEqual(before)
  })
})
