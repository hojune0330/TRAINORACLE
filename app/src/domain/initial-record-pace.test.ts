import { afterEach, beforeAll, describe, expect, it, vi } from "vitest"
import type { PlanGenerationSuccess, PlanSession } from "@impl/plan-generator/types"
import type { WorkoutCalculationInputs } from "@impl/prescription/all-workout-calculator"
import { resolveCatalogBinding } from "@impl/prescription/catalog-session-binding"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import type { AthleteRecord } from "./athlete-records"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { replaceCandidateCatalogWorkout } from "./catalog-plan-binding"
import { createSegmentRecordReference } from "./catalog-pace-reference"
import { prepareInitialRecordPaces } from "./initial-record-pace"

const TODAY = "2026-10-02"
const LT_ID = "P-LT-B-480"
const VO2_ID = "P-VO2-2-5"
type Actual = Extract<AthleteRecord, { purpose: "PERSONAL_BEST" | "RECENT_RESULT" }>
function actual(id = "recent", changes: Partial<Actual> = {}): Actual {
  return { schemaVersion: 1, id, purpose: "RECENT_RESULT", eventDistanceM: 5000,
    performanceSeconds: 1000, achievedOn: "2026-10-01", seasonId: null,
    enteredBy: "ATHLETE", verificationState: "SELF_REPORTED", sourceRef: `athlete-record:${id}`,
    savedAt: "2026-10-02T00:00:00.000Z", ...changes }
}
const recent = actual()
const goal: AthleteRecord = { ...actual("goal"), purpose: "RACE_GOAL", achievedOn: null }
function required<T>(value: T | null | undefined): T {
  if (value == null) throw Error("Expected a valid synthetic fixture or initial pace offer")
  return value
}
function binding(session: PlanSession) {
  if (session.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected catalog session")
  return required(session.prescription.catalogWorkout)
}
const main = (generated: PlanGenerationSuccess) => generated.candidates[0].sessions.filter(s => s.role === "QUALITY")
function freeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze)
    Object.freeze(value)
  }
  return value
}
function changeInputs(generated: PlanGenerationSuccess, overrides: Partial<WorkoutCalculationInputs>,
  id?: string, only?: PlanSession): PlanGenerationSuccess {
  let next = generated
  for (const session of only ? [only] : main(generated)) {
    const old = binding(session)
    next = required(replaceCandidateCatalogWorkout(next, session, id ?? old.catalogId,
      { ...old.inputs, ...overrides }, true))
  }
  expect(next.candidates.every(isVerifiedPlanCandidate)).toBe(true)
  return next
}
function fixture(focus: "LT_INTENT" | "VO2_INTENT", catalogId: string): PlanGenerationSuccess {
  const result = generatePlanFromDraft({ eventGroup: "FIVE_K", eventDistanceM: 5000,
    competitionDivision: "OPEN", experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY",
    requestedFrameLength: 9, trainingFocus: focus, secondSessionMode: "RECOVERY_PM_ALLOWED",
    trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null, startDate: TODAY }, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw Error(`Synthetic generation failed: ${result.kind}`)
  return freeze(changeInputs(result.generated, { fiveK: null, segmentPaces: [], segmentSeconds: [],
    paceReferences: [], recoverySeconds: [] }, catalogId))
}
let lt: PlanGenerationSuccess
let vo2: PlanGenerationSuccess
beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] })
  vi.setSystemTime(new Date(`${TODAY}T03:00:00Z`))
  try {
    lt = fixture("LT_INTENT", LT_ID)
    vo2 = fixture("VO2_INTENT", VO2_ID)
  } finally { vi.useRealTimers() }
})
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })

function assertOffer(generated: PlanGenerationSuccess, records: readonly AthleteRecord[], selected: AthleteRecord,
  today = TODAY) {
  const offer = required(prepareInitialRecordPaces(generated, freeze(records), today))
  expect(offer.record).toEqual(selected)
  expect(offer.changed).toEqual(main(generated).map(({ day, slot }) => ({ day, slot })))
  expect(offer.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
  for (const candidate of offer.generated.candidates) {
    for (const session of candidate.sessions.filter(s => s.role === "QUALITY")) {
      const b = binding(session)
      expect(b.inputs.paceReferences?.length).toBeGreaterThan(0)
      for (const ref of b.inputs.paceReferences ?? []) {
        expect(ref).toMatchObject({ recordId: selected.id, recordVersion: selected.savedAt,
          eventDistanceM: 5000, performanceSeconds: selected.performanceSeconds,
          achievedOn: selected.achievedOn, evaluatedOn: today, kind: "ACTUAL", confirmed: true,
          model: b.catalogId === VO2_ID ? "RACE_AVERAGE_V1" : "FIVE_K_THRESHOLD_V1" })
      }
      expect(resolveCatalogBinding(b)?.unavailable).toEqual([])
    }
  }
  return offer
}

// Synthetic foundation cases, not observations of real athletes or browser acceptance tests.
describe("initial record pace: 24 synthetic foundation personas", () => {
  it("P01 recent self-reported 5k supplies only the approved LT mapping", () => {
    assertOffer(lt, [recent], recent)
  })
  it("P02 a slower latest actual wins over the rolling fastest actual", () => {
    assertOffer(lt, [actual("fast", { performanceSeconds: 900, achievedOn: "2026-09-01" }), recent], recent)
  })
  it("P03 a historic personal best cannot replace the current actual", () => {
    assertOffer(lt, [actual("pb", { purpose: "PERSONAL_BEST", performanceSeconds: 800, achievedOn: "2024-01-01" }), recent], recent)
  })
  it("P04 no saved records produces no offer", () => {
    expect(prepareInitialRecordPaces(lt, [], TODAY)).toBeNull()
  })
  it("P05 goal-only records never become an initial recommendation", () => {
    expect(prepareInitialRecordPaces(lt, [goal], TODAY)).toBeNull()
  })
  it("P06 a faster goal does not compete with the latest actual", () => {
    assertOffer(lt, [{ ...goal, performanceSeconds: 800 }, recent], recent)
  })
  it("P07 differing times on the latest date block automatic selection", () => {
    expect(prepareInitialRecordPaces(lt, [recent, actual("conflict", { performanceSeconds: 1001 })], TODAY)).toBeNull()
  })
  it("P08 equal times on the same date select deterministically in either order", () => {
    const first = actual("a"), second = actual("z")
    assertOffer(lt, [second, first], first)
    assertOffer(lt, [first, second], first)
  })
  it("P09 an undated actual cannot become the recent recommendation", () => {
    expect(prepareInitialRecordPaces(lt, [actual("undated", { achievedOn: null })], TODAY)).toBeNull()
  })
  it("P10 an actual one day outside twelve calendar months is excluded", () => {
    expect(prepareInitialRecordPaces(lt, [actual("old", { achievedOn: "2025-10-01" })], TODAY)).toBeNull()
  })
  it("P11 exact calendar boundaries include leap-day clamping and month end", () => {
    for (const [today, start] of [[TODAY, "2025-10-02"], ["2024-02-29", "2023-02-28"],
      ["2025-03-31", "2024-03-31"]] as const) {
      const record = actual("boundary", { achievedOn: start })
      assertOffer(lt, [record], record, today)
    }
  })
  it("P12 invalid and future dates do not silently normalize into recent actuals", () => {
    for (const achievedOn of ["2026-02-30", "not-a-date", "2026-10-03"]) {
      expect(prepareInitialRecordPaces(lt, [actual("invalid", { achievedOn })], TODAY)).toBeNull()
    }
    expect(prepareInitialRecordPaces(lt, [recent], "2026-02-30")).toBeNull()
  })
  it("P13 other events including the legacy half alias never seed the 5k mapping", () => {
    for (const eventDistanceM of [800, 1500, 3000, 10000, 21097, 21097.5, 42195]) {
      expect(prepareInitialRecordPaces(lt, [actual("other", { eventDistanceM })], TODAY)).toBeNull()
    }
  })
  it("P14 unverified-only records produce no initial offer", () => {
    expect(prepareInitialRecordPaces(lt, [actual("unverified", { verificationState: "UNVERIFIED" })], TODAY)).toBeNull()
  })
  it("P15 a newer unverified record cannot displace the latest eligible record", () => {
    assertOffer(lt, [actual("unverified", { verificationState: "UNVERIFIED", achievedOn: TODAY }), recent], recent)
  })
  it("P16 a recent season best remains an actual with its exact source snapshot", () => {
    const season: AthleteRecord = { ...actual("season", { verificationState: "VERIFIED", enteredBy: "VERIFIED_IMPORT" }),
      purpose: "SEASON_BEST", achievedOn: "2026-10-01", seasonId: "2026-track" }
    assertOffer(lt, [season], season)
  })
  it("P17 VO2 uses the approved 5k race-average mapping, not threshold", () => {
    assertOffer(vo2, [recent], recent)
  })
  it("P18 existing legacy fiveK choices are not overwritten", () => {
    const draft = changeInputs(lt, { fiveK: { recordId: "chosen", seconds: 1100,
      achievedAt: "2026-09-01", evaluatedAt: TODAY } })
    const before = JSON.stringify(draft)
    expect(prepareInitialRecordPaces(draft, [recent], TODAY)).toBeNull()
    expect(JSON.stringify(draft)).toBe(before)
  })
  it("P19 existing explicit actual or goal references are retained", () => {
    for (const record of [actual("chosen"), goal]) {
      const draft = changeInputs(lt, { paceReferences: [createSegmentRecordReference("part-0", record,
        TODAY, "FIVE_K_THRESHOLD_V1")] })
      const before = JSON.stringify(draft)
      expect(prepareInitialRecordPaces(draft, [recent], TODAY)).toBeNull()
      expect(JSON.stringify(draft)).toBe(before)
    }
  })
  it("P20 explicit custom segment pace is never overwritten", () => {
    const draft = changeInputs(lt, { segmentPaces: [{ segmentId: "part-0", secondsPerKm: 240 }] })
    expect(prepareInitialRecordPaces(freeze(draft), [recent], TODAY)).toBeNull()
  })
  it("P21 explicit custom segment seconds are never overwritten", () => {
    const draft = changeInputs(vo2, { segmentSeconds: [{ segmentId: "X-VO2-01-1-1", seconds: 40 }] }, "X-VO2-01")
    expect(prepareInitialRecordPaces(freeze(draft), [recent], TODAY)).toBeNull()
  })
  it("P22 mixed draft skips the customized slot but offers the remaining eligible slots", () => {
    const custom = required(main(lt)[0])
    expect(main(lt).length).toBeGreaterThan(1)
    const draft = changeInputs(lt, { segmentPaces: [{ segmentId: "part-0", secondsPerKm: 240 }] }, undefined, custom)
    const offer = required(prepareInitialRecordPaces(freeze(draft), [recent], TODAY))
    expect(offer.changed).toEqual(main(draft).filter(s => s.day !== custom.day || s.slot !== custom.slot)
      .map(({ day, slot }) => ({ day, slot })))
    for (const [index, candidate] of offer.generated.candidates.entries()) {
      expect(candidate.sessions.find(s => s.day === custom.day && s.slot === custom.slot))
        .toEqual(required(draft.candidates[index]).sessions.find(s => s.day === custom.day && s.slot === custom.slot))
    }
  })
  it("P23 pure draft preview preserves volume, recoveries, support sessions and storage", () => {
    const write = vi.spyOn(Storage.prototype, "setItem")
    const remove = vi.spyOn(Storage.prototype, "removeItem")
    const clear = vi.spyOn(Storage.prototype, "clear")
    const fetch = vi.fn(() => { throw Error("Synthetic pure helper must not use the network") })
    vi.stubGlobal("fetch", fetch)
    for (const draft of [lt, vo2]) {
      const before = JSON.stringify(draft)
      const offer = assertOffer(draft, [recent], recent)
      expect(offer.generated).not.toBe(draft)
      expect(JSON.stringify(draft)).toBe(before)
      for (const [index, candidate] of offer.generated.candidates.entries()) {
        const original = required(draft.candidates[index])
        expect(candidate.sessions).toHaveLength(original.sessions.length)
        for (const [sessionIndex, session] of candidate.sessions.entries()) {
          const old = required(original.sessions[sessionIndex])
          expect({ ...session, prescription: null }).toEqual({ ...old, prescription: null })
          if (session.role !== "QUALITY") { expect(session).toEqual(old); continue }
          const previous = required(resolveCatalogBinding(binding(old)))
          const next = required(resolveCatalogBinding(binding(session)))
          expect(next.totals).toEqual(previous.totals)
          expect(next.steps.filter(s => s.phase !== "main" || s.kind !== "WORK"))
            .toEqual(previous.steps.filter(s => s.phase !== "main" || s.kind !== "WORK"))
          expect(next.steps.map(s => ({ id: s.segmentId, kind: s.kind, distanceM: s.distanceM, seconds: s.seconds })))
            .toEqual(previous.steps.map(s => ({ id: s.segmentId, kind: s.kind, distanceM: s.distanceM, seconds: s.seconds })))
          expect(binding(session).inputs.recoverySeconds).toEqual(binding(old).inputs.recoverySeconds)
        }
      }
      expect(prepareInitialRecordPaces(offer.generated, [recent], TODAY)).toBeNull()
      expect(prepareInitialRecordPaces(draft, [recent], TODAY)).toEqual(offer)
    }
    expect(write).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(clear).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })
  it("P24 duplicate-ID unverified input cannot substitute the selected verified snapshot", () => {
    const accepted = actual("shared", { verificationState: "VERIFIED" })
    const rejected = actual("shared", { verificationState: "UNVERIFIED", performanceSeconds: 900,
      savedAt: "2026-10-02T01:00:00.000Z" })
    // Malformed-input robustness, not a claim that the normal record store permits duplicate IDs.
    expect(prepareInitialRecordPaces(lt, [rejected, accepted], TODAY)).toBeNull()
    expect(prepareInitialRecordPaces(lt, [accepted, rejected], TODAY)).toBeNull()
  })
})

describe("initial long-event race pace offers", () => {
  for (const [eventDistanceM, performanceSeconds, eventGroup] of [
    [10000, 2400, "TEN_K"], [21097.5, 5400, "GENERAL_ENDURANCE"], [42195, 10800, "GENERAL_ENDURANCE"],
  ] as const) {
    it(`${eventDistanceM}: actual and explicitly chosen goal reach a verified first draft`, () => {
      // The existing plan intake keeps its legacy half alias; all new pace arithmetic uses 21097.5m.
      const planDistance = eventDistanceM === 21097.5 ? 21097 : eventDistanceM
      const result = generatePlanFromDraft({ eventGroup, eventDistanceM: planDistance, competitionDivision: "OPEN",
        experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY", requestedFrameLength: 9,
        trainingFocus: "MIXED_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED",
        trainingTimePreference: "MORNING", selectedDetailedTemplateRef: null, startDate: TODAY }, "NO_KNOWN_RISK")
      if (result.kind !== "generated") throw Error(`Long-event generation failed: ${result.kind}`)
      const draft = freeze(result.generated)
      const current = actual(`actual-${eventDistanceM}`, { eventDistanceM, performanceSeconds })
      const target: AthleteRecord = { ...actual(`goal-${eventDistanceM}`, { eventDistanceM, performanceSeconds: performanceSeconds * 0.98 }),
        purpose: "RACE_GOAL", achievedOn: null }
      expect(prepareInitialRecordPaces(draft, [target], TODAY)).toBeNull()
      for (const selected of [current, target]) {
        const offer = required(prepareInitialRecordPaces(draft, [current, target], TODAY,
          selected.purpose === "RACE_GOAL" ? selected.id : undefined))
        expect(offer.record).toEqual(selected)
        expect(offer.generated.candidates.every(isVerifiedPlanCandidate)).toBe(true)
        for (const slot of offer.changed) {
          const session = required(offer.generated.candidates[0].sessions.find(row => row.day === slot.day && row.slot === slot.slot))
          expect(session.plannedEnergyIntent).toBe("MIXED_INTENT")
          const b = binding(session)
          expect(b.catalogId).toMatch(/^RP-/)
          expect(b.inputs.paceReferences?.every(reference => reference.recordId === selected.id
            && reference.eventDistanceM === eventDistanceM
            && reference.kind === (selected.purpose === "RACE_GOAL" ? "GOAL" : "ACTUAL"))).toBe(true)
          expect(resolveCatalogBinding(b)?.unavailable).toEqual([])
        }
        for (const change of offer.durationChanges) {
          const original = required(draft.candidates[0].sessions.find(row => row.day === change.day && row.slot === change.slot))
          const updated = required(offer.generated.candidates[0].sessions.find(row => row.day === change.day && row.slot === change.slot))
          if (original.prescription.kind !== "RPE_TIME_RANGE" || updated.prescription.kind !== "RPE_TIME_RANGE") throw Error("Expected ranges")
          expect(change.before).toEqual(original.prescription.durationMinutes)
          expect(change.after).toEqual(updated.prescription.durationMinutes)
        }
        expect(prepareInitialRecordPaces(offer.generated, [current], TODAY)).toBeNull()
      }
    })
  }
})
