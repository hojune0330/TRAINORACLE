import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { activeAthleteRecordsStorageKey, createSelfReportedAthleteRecord, saveAthleteRecord } from "./athlete-records"
import { PLAN_METHOD_REGISTRY } from "./plan-method-registry"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { bindDetailedPrescriptionCandidates } from "./plan-candidate-prescription"
import { planAnchorsStillCurrent } from "./plan-anchor-reconfirmation"
import { saveSelectedPlanCandidate } from "../screens/plan-beta/plan-selection"
import * as mutationLock from "./plan-mutation-lock"

const now = new Date("2026-09-06T03:00:00Z")
function saveRecord(seconds = 1111) {
  const record = createSelfReportedAthleteRecord({ id: "anchor-recheck", purpose: "PERSONAL_BEST",
    eventDistanceM: 5000, performanceSeconds: seconds, achievedOn: "2026-08-01", seasonId: null }, now)
  if (record === null) throw new Error("Invalid synthetic record")
  if (seconds === 1111) expect(saveAthleteRecord(record, now).ok).toBe(true)
  else localStorage.setItem(activeAthleteRecordsStorageKey(), JSON.stringify([record]))
}
function fixture() {
  saveRecord()
  const plan = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "HIGH_SCHOOL", experienceBand: "EXPERIENCED", availableDayCount: 3,
    requestedFrameLength: 9, trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
    trainingTimePreference: "EVENING", selectedDetailedTemplateRef: PLAN_METHOD_REGISTRY[0]!.templateRef,
  }, "NO_KNOWN_RISK")
  if (plan.kind !== "generated") throw new Error("Expected generated plan")
  const bound = bindDetailedPrescriptionCandidates(plan.generated, plan.intake, plan.gate,
    { selectedRecordId: "anchor-recheck" }, now)
  if (bound.kind !== "bound") throw new Error("Expected bound exact prescription")
  return { ...plan, generated: bound.generated }
}
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(now) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

it("accepts unchanged facts across a calendar-label change without modifying prescription", () => {
  const plan = fixture()
  const candidate = plan.generated.candidates[0]
  const before = JSON.stringify(candidate)
  expect(planAnchorsStillCurrent(candidate, now)).toBe(true)
  expect(planAnchorsStillCurrent(candidate, new Date("2026-10-06T03:00:00Z"))).toBe(true)
  expect(JSON.stringify(candidate)).toBe(before)
})

it("rejects changed, missing and stale anchor facts", () => {
  const candidate = fixture().generated.candidates[0]
  expect(planAnchorsStillCurrent(candidate, new Date("2028-10-06T03:00:00Z"))).toBe(false)
  saveRecord(1112)
  expect(planAnchorsStillCurrent(candidate, now)).toBe(false)
  localStorage.clear()
  expect(planAnchorsStillCurrent(candidate, now)).toBe(false)
})

it("rejects a record edit during the save lock wait and preserves the edited record", async () => {
  const plan = fixture()
  let release: (() => void) | undefined
  vi.spyOn(mutationLock, "getPlanMutationLockManager").mockReturnValue({
    request: <T,>(_name: string, _options: unknown, callback: (lock: object | null) => T | Promise<T>) =>
      new Promise<T>(resolve => { release = () => { resolve(callback({})) } }),
  })
  const save = saveSelectedPlanCandidate({ candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" },
    plan.generated, plan.gate, plan.intake, plan.athleteEvidence)
  saveRecord(1112)
  const before = Object.entries(localStorage)
  release!()
  await expect(save).resolves.toEqual({ kind: "rejected", code: "PACE_ANCHOR_RECONFIRMATION_REQUIRED" })
  expect(Object.entries(localStorage)).toEqual(before)
})

it("saves a still-current exact detailed anchor as a positive control", async () => {
  const plan = fixture()
  const saved = await saveSelectedPlanCandidate({ candidateId: plan.generated.candidates[0].candidateId, startDate: "2026-09-10" },
    plan.generated, plan.gate, plan.intake, plan.athleteEvidence)
  expect(saved.kind).toBe("saved")
})
