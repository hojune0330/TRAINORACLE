import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  ATHLETE_RECORDS_STORAGE_KEY,
  createSelfReportedAthleteRecord,
  saveAthleteRecord,
} from "./athlete-records"
import {
  generatePlanFromDraft,
  selectPlanForActivation,
} from "./plan-beta-flow"
import { bindDetailedPrescriptionCandidates } from "./plan-candidate-prescription"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import * as d9Module from "@impl/d9/evaluator"
import * as approvalModule from "./detailed-prescription-approvals"
import {
  loadVersionedPlanBetaState,
  savePlanBetaState,
} from "./plan-beta-store"

const TODAY = new Date("2026-08-17T03:00:00.000Z")
const DRAFT = {
  eventGroup: "FIVE_K" as const,
  competitionDivision: "OPEN" as const,
  experienceBand: "EXPERIENCED" as const,
  availableDayCount: 5 as const,
  requestedFrameLength: 9 as const,
  trainingFocus: "VO2_INTENT" as const,
  secondSessionMode: "SINGLE_SESSION_ONLY" as const,
  trainingTimePreference: "VARIES" as const,
}

function saveCurrentFiveKilometreRecord(): void {
  const record = createSelfReportedAthleteRecord({
    id: "current-5000",
    purpose: "RECENT_RESULT",
    eventDistanceM: 5000,
    performanceSeconds: 1110,
    achievedOn: "2026-08-10",
    seasonId: null,
  }, TODAY)
  if (record === null) throw new TypeError("Current 5000m fixture is invalid")
  expect(saveAthleteRecord(record, TODAY)).toEqual({ ok: true, total: 1 })
}

function bindingInput() {
  return {
    selectedRecordId: "current-5000",
  }
}

type MutableJsonObject = { [key: string]: unknown }

function isMutableJsonObject(value: unknown): value is MutableJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function mutateStoredRecord(field: string, value: unknown): void {
  const raw = window.localStorage.getItem(ATHLETE_RECORDS_STORAGE_KEY)
  if (raw === null) throw new TypeError("Stored record mutation target is missing")
  const parsed: unknown = JSON.parse(raw)
  if (!Array.isArray(parsed) || !isMutableJsonObject(parsed[0])) {
    throw new TypeError("Stored record mutation target is malformed")
  }
  const before = JSON.stringify(parsed)
  parsed[0][field] = value
  const after = JSON.stringify(parsed)
  expect(after).not.toBe(before)
  expect(parsed[0][field]).toBe(value)
  window.localStorage.setItem(ATHLETE_RECORDS_STORAGE_KEY, after)
}

function expectGeneratedBaseline() {
  const result = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new TypeError("RPE baseline was not generated")
  return result
}

function blockedGate(disposition: "D9_ACTIVE" | "D9_UNKNOWN") {
  return decideSafetyGate(mapD9ResultToRveSignal({
    disposition,
    blocksPlanGeneration: true,
    reasonCodes: [disposition],
    evidence: [],
  }))
}

function expectAtomicFallback(
  result: ReturnType<typeof generatePlanFromDraft>,
  baseline: ReturnType<typeof expectGeneratedBaseline>,
  code: string,
): void {
  expect(result.kind).toBe("generated")
  if (result.kind !== "generated") return
  expect(result.prescriptionBinding).toEqual({ kind: "fallback", code })
  expect(result.generated.candidates).toStrictEqual(baseline.generated.candidates)
  for (const candidate of result.generated.candidates) {
    expect(candidate.sessions.every((session) => (
      session.role !== "QUALITY" || session.prescription.kind === "RPE_TIME_RANGE"
    ))).toBe(true)
  }
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("production candidate detailed-prescription binding", () => {
  it("characterizes production candidates as RPE-only without explicit evidence", () => {
    const result = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({
      kind: "fallback",
      code: "PACE_TARGET_FALLBACK_NO_EXPLICIT_ANCHOR",
    })

    for (const candidate of result.generated.candidates) {
      expect(candidate.sessions.filter((session) => session.role === "QUALITY")).not.toHaveLength(0)
      expect(candidate.sessions.every((session) => (
        session.role !== "QUALITY" || session.prescription.kind === "RPE_TIME_RANGE"
      ))).toBe(true)
    }
  })

  it("binds the exact current 5000m prescription into both candidates", () => {
    saveCurrentFiveKilometreRecord()

    const result = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput())

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding).toEqual({
      kind: "bound",
      code: "PACE_TARGET_BOUND",
    })
    const baseline = expectGeneratedBaseline()
    for (const [index, candidate] of result.generated.candidates.entries()) {
      const detailed = candidate.sessions.filter((session) => (
        session.role === "QUALITY" && session.prescription.kind === "PACE_TARGET"
      ))
      expect(detailed).toHaveLength(1)
      const detailedSession = detailed[0]
      if (
        detailedSession?.role !== "QUALITY"
        || detailedSession.prescription.kind !== "PACE_TARGET"
      ) {
        throw new TypeError("Detailed candidate mutation target is missing")
      }
      expect(detailedSession.prescription).toMatchObject({
        kind: "PACE_TARGET",
        setCount: 1,
        repetitionsPerSet: 5,
        repetitionDistanceM: 1000,
        targetEventDistanceM: 5000,
        targetRepSeconds: 222,
        repetitionRecoverySeconds: 150,
        repetitionRecoveryMode: "JOG",
        totals: {
          qualityDistanceM: 5000,
          repetitionRecoveryOccurrences: 4,
          repetitionRecoveryTotalSeconds: 600,
        },
        operationalComponents: {
          warmup: { componentRef: "WU-V2-5K-01" },
          cooldown: { componentRef: "CD-V2-5K-01" },
          fallback: { code: "RPE_ONLY_CONTROLLED" },
          stopConditions: { codes: expect.arrayContaining([
            "STOP_NEW_OR_WORSENING_PAIN",
            "STOP_DIZZINESS_OR_FAINTNESS",
            "STOP_CHEST_PAIN_OR_UNUSUAL_BREATHING",
            "STOP_LOSS_OF_CONTROLLED_FORM",
          ]) },
        },
      })
      expect(candidate.candidateId).toContain(
        detailedSession.prescription.prescriptionFingerprint,
      )
      const beforeQualityDays = baseline.generated.candidates[index]?.sessions
        .filter((session) => session.role === "QUALITY")
        .map((session) => `${session.day}:${session.slot}`)
      const afterQualityDays = candidate.sessions
        .filter((session) => session.role === "QUALITY")
        .map((session) => `${session.day}:${session.slot}`)
      expect(afterQualityDays).toStrictEqual(beforeQualityDays)
    }
    expect(JSON.stringify(result.generated)).not.toMatch(
      /rawMemo|symptomNarrative|guardianNarrative|medicalNarrative/u,
    )
  })

  it("is deterministic for the same stored anchor and generation input", () => {
    saveCurrentFiveKilometreRecord()
    const first = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput())
    const second = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput())
    expect(second).toStrictEqual(first)
  })

  it("derives STALE from an old achievedOn and rejects an attempted CURRENT label", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    mutateStoredRecord("achievedOn", "2024-08-10")

    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput()),
      baseline,
      "PACE_TARGET_FALLBACK_ANCHOR_NOT_CURRENT",
    )

    const forged = { ...bindingInput(), selectedFreshness: "CURRENT" }
    expect(Object.hasOwn(forged, "selectedFreshness")).toBe(true)
    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", forged),
      baseline,
      "PACE_TARGET_FALLBACK_INVALID_SELECTION",
    )
  })

  it("falls back both candidates for a mutated 1500m cross-event record", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    mutateStoredRecord("eventDistanceM", 1500)

    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput()),
      baseline,
      "PACE_TARGET_FALLBACK_EVENT_SCOPE",
    )
  })

  it("falls back both candidates outside the approved experience scope", () => {
    saveCurrentFiveKilometreRecord()
    const developingDraft = { ...DRAFT, experienceBand: "DEVELOPING" as const }
    const baseline = generatePlanFromDraft(developingDraft, "NO_KNOWN_RISK")
    if (baseline.kind !== "generated") throw new TypeError("Developing RPE baseline was not generated")
    expect(developingDraft.experienceBand).not.toBe(DRAFT.experienceBand)

    expectAtomicFallback(
      generatePlanFromDraft(developingDraft, "NO_KNOWN_RISK", bindingInput()),
      baseline,
      "PACE_TARGET_FALLBACK_EXPERIENCE_SCOPE",
    )
  })

  it("falls back both candidates when trusted authority is expired or unavailable", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    vi.setSystemTime(new Date("2027-08-17T03:00:00.000Z"))

    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput()),
      baseline,
      "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT",
    )
  })

  it("falls back both candidates before the trusted authority decision time", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    vi.setSystemTime(new Date("2026-08-17T01:59:59.000Z"))

    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput()),
      baseline,
      "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT",
    )
  })

  it("rejects a split-clock attempt instead of backdating authority evaluation", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    vi.setSystemTime(new Date("2027-08-17T03:00:00.000Z"))
    const splitClock = {
      ...bindingInput(),
      evaluatedAt: "2026-08-17T03:00:00.000Z",
      today: "2027-08-17",
    }
    expect(splitClock.evaluatedAt).not.toContain(splitClock.today)

    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", splitClock),
      baseline,
      "PACE_TARGET_FALLBACK_INVALID_SELECTION",
    )
  })

  it("falls back atomically when the trusted manifest resolver yields no authority", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    vi.spyOn(approvalModule, "resolveDetailedPrescriptionApproval").mockReturnValue(undefined)

    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput()),
      baseline,
      "PACE_TARGET_FALLBACK_AUTHORITY_OR_COMPONENT",
    )
  })

  it.each(["D9_ACTIVE", "D9_UNKNOWN"] as const)(
    "keeps both original RPE candidates when binding sees %s",
    (disposition) => {
      saveCurrentFiveKilometreRecord()
      const baseline = expectGeneratedBaseline()
      const result = bindDetailedPrescriptionCandidates(
        baseline.generated,
        baseline.intake,
        blockedGate(disposition),
        bindingInput(),
        TODAY,
      )

      expect(result).toMatchObject({
        kind: "fallback",
        code: "PACE_TARGET_FALLBACK_SAFETY_GATE",
      })
      expect(result.generated.candidates).toStrictEqual(baseline.generated.candidates)
    },
  )

  it.each(["D9_ACTIVE", "D9_UNKNOWN"] as const)(
    "blocks production before exposing candidates for %s",
    (disposition) => {
      saveCurrentFiveKilometreRecord()
      if (disposition === "D9_UNKNOWN") {
        vi.spyOn(d9Module, "evaluateD9ColloquialLayer").mockImplementation(() => {
          throw new TypeError("deterministic evaluator failure")
        })
      }

      const result = generatePlanFromDraft(
        DRAFT,
        disposition === "D9_ACTIVE" ? "REVIEW_REQUIRED" : "NO_KNOWN_RISK",
        bindingInput(),
      )

      expect(result).toEqual({
        kind: "blocked",
        code: "CURRENT_CHECK_REQUIRES_REVIEW",
      })
      expect(Object.hasOwn(result, "generated")).toBe(false)
    },
  )

  it("rolls back atomically when either candidate has no eligible QUALITY target", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    const conservative = baseline.generated.candidates[1]
    const sessions = conservative.sessions.filter((session) => session.role !== "QUALITY")
    expect(sessions).not.toHaveLength(conservative.sessions.length)
    const broken = {
      ...baseline.generated,
      candidates: [
        baseline.generated.candidates[0],
        { ...conservative, sessions },
      ] as const,
    }

    const result = bindDetailedPrescriptionCandidates(
      broken,
      baseline.intake,
      baseline.gate,
      bindingInput(),
      TODAY,
    )
    expect(result).toMatchObject({
      kind: "fallback",
      code: "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY",
    })
    expect(result.generated.candidates).toStrictEqual(broken.candidates)
  })

  it("rejects caller-invented selection fields at the strict binding boundary", () => {
    saveCurrentFiveKilometreRecord()
    const baseline = expectGeneratedBaseline()
    const forged = { ...bindingInput(), lifecycleStatus: "ACTIVE" }
    expect(Object.hasOwn(forged, "lifecycleStatus")).toBe(true)

    expectAtomicFallback(
      generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", forged),
      baseline,
      "PACE_TARGET_FALLBACK_INVALID_SELECTION",
    )
  })

  it("selects and stores a bound candidate as a strict version-2 snapshot", () => {
    saveCurrentFiveKilometreRecord()
    const result = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK", bindingInput())
    if (result.kind !== "generated") throw new TypeError("Detailed candidates were not generated")
    const candidate = result.generated.candidates[0]
    const selected = selectPlanForActivation(
      candidate,
      result.generated,
      result.gate,
      result.intake,
      result.athleteEvidence,
    )
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") return
    expect(selected.state.version).toBe(2)
    expect(selected.state.activePlan.sessions.some((session) => (
      session.role === "QUALITY" && session.prescription.kind === "PACE_TARGET"
    ))).toBe(true)
    expect(savePlanBetaState(selected.state)).toEqual({ ok: true })
    expect(loadVersionedPlanBetaState()).toStrictEqual(selected.state)
  })
})
