import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  generatePlanFromDraft,
  selectPlanForActivation,
} from "./plan-beta-flow"
import { selectPlanCandidate } from "@impl/plan-generator/selection"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "./athlete-records"
import { loadPlanBetaState, savePlanBetaState } from "./plan-beta-store"

const NOW = new Date("2026-08-23T03:00:00.000Z")
const DRAFT = {
  eventGroup: "MIDDLE_DISTANCE" as const,
  eventDistanceM: 1500 as const,
  competitionDivision: "OPEN" as const,
  experienceBand: "DEVELOPING" as const,
  availableDayCount: 5 as const,
  requestedFrameLength: 9 as const,
  trainingFocus: "LT_INTENT" as const,
  secondSessionMode: "SINGLE_SESSION_ONLY" as const,
  trainingTimePreference: "VARIES" as const,
  selectedDetailedTemplateRef: null,
}
const approval1500 = DETAILED_PRESCRIPTION_APPROVALS.find((approval) => approval.targetEventDistanceM === 1500)
if (approval1500 === undefined) throw new TypeError("Expected approved 1500m fixture")
const TEMPLATE_1500 = {
  templateId: approval1500.templateId,
  version: approval1500.templateVersion,
  fingerprint: approval1500.templateContentFingerprint,
} as const

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
  window.localStorage.clear()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe("stored plan v3 target and preview boundary", () => {
  it("requires and binds one exact target event plus an explicit null template selection", () => {
    const missingTarget = generatePlanFromDraft(
      { ...DRAFT, eventDistanceM: undefined },
      "NO_KNOWN_RISK",
    )
    expect(missingTarget).toEqual({
      kind: "rejected",
      code: "MALFORMED_INPUT",
    })

    const result = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return

    expect(result.generated.racePlacement).toEqual({
      kind: "NO_TARGET_RACE",
      reasonCode: "NO_TARGET_RACE_REQUESTED",
      numericTaperAuthority: "NOT_GRANTED",
    })
    expect(result.generated.pairId).toMatch(/^plan-pair:v3:/u)
    expect(result.generated.candidates).toHaveLength(2)
    for (const candidate of result.generated.candidates) {
      expect(candidate.eventDistanceM).toBe(1500)
      expect(candidate.selectedDetailedTemplateRef).toBeNull()
      expect(candidate.pairId).toBe(result.generated.pairId)
      expect(candidate.detailedPrescriptionFingerprint).toBeNull()
    }
  })

  it("returns a valid future race date only as a non-selectable in-memory preview", () => {
    const result = generatePlanFromDraft({
      ...DRAFT,
      targetRaceDate: "2026-09-12",
    }, "NO_KNOWN_RISK")

    expect(result).toMatchObject({
      kind: "preview_only",
      code: "RACE_DATE_PERSISTENCE_NOT_AUTHORIZED",
      racePlacement: {
        kind: "TARGET_RACE_PREVIEW_ONLY_RETENTION_BLOCKED",
        reasonCode: "RACE_DATE_RETENTION_NOT_AUTHORIZED",
        placementFallback: "GENERIC_PLACEMENT_NO_AUTHORITY",
        placementReasonCode: "NO_ACTIVE_RACE_PLACEMENT_ROWS",
        numericTaperAuthority: "NOT_GRANTED",
      },
      preview: {
        eventDistanceM: 1500,
        targetRaceDate: "2026-09-12",
      },
      candidates: [],
    })
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it("compares a race date with the authoritative local civil day after KST midnight", () => {
    vi.setSystemTime(new Date(2026, 7, 24, 0, 30))

    const sameLocalDay = generatePlanFromDraft({
      ...DRAFT,
      targetRaceDate: "2026-08-24",
    }, "NO_KNOWN_RISK")
    const nextLocalDay = generatePlanFromDraft({
      ...DRAFT,
      targetRaceDate: "2026-08-25",
    }, "NO_KNOWN_RISK")

    expect(sameLocalDay).toMatchObject({ kind: "rejected", code: "MALFORMED_INPUT" })
    expect(nextLocalDay).toMatchObject({
      kind: "preview_only",
      preview: { targetRaceDate: "2026-08-25" },
    })
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it("creates a v3 active snapshot from a generated candidate", () => {
    const result = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
    if (result.kind !== "generated") throw new TypeError("Expected generated v3 fixture")

    const selected = selectPlanForActivation(
      result.generated.candidates[0].candidateId,
      result.generated,
      result.gate,
      result.intake,
      result.athleteEvidence,
    )

    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") return
    expect(selected.state).toMatchObject({
      version: 3,
      intake: {
        eventDistanceM: 1500,
        selectedDetailedTemplateRef: null,
      },
      activePlan: {
        eventDistanceM: 1500,
        selectedDetailedTemplateRef: null,
        pairId: result.generated.pairId,
      },
      periodization: {
        macrocycleOrdinal: 1,
        frameOrdinal: 1,
        mesocycleOrdinal: 1,
        phase: "BASE",
        frameLengthDays: 9.5,
        targetFrameCount: 18,
        source: "NEW_PLAN",
      },
    })
  })

  it("keeps target event distinct from cross-event evidence and falls back atomically", () => {
    const record = createSelfReportedAthleteRecord({
      id: "00000000-0000-4000-8000-000000005000",
      purpose: "RECENT_RESULT",
      eventDistanceM: 5000,
      performanceSeconds: 1100,
      achievedOn: "2026-08-10",
      seasonId: null,
    }, NOW)
    if (record === null) throw new TypeError("Expected valid cross-event fixture")
    expect(saveAthleteRecord(record, NOW).ok).toBe(true)

    const result = generatePlanFromDraft({
      ...DRAFT,
      experienceBand: "EXPERIENCED",
      trainingFocus: "MIXED_INTENT",
      selectedDetailedTemplateRef: TEMPLATE_1500,
    }, "NO_KNOWN_RISK", { selectedRecordId: record.id })

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding.code).toBe("PACE_TARGET_FALLBACK_EVENT_SCOPE")
    expect(result.generated.candidates.every((candidate) => (
      candidate.eventDistanceM === 1500
      && candidate.selectedDetailedTemplateRef?.templateId === TEMPLATE_1500.templateId
      && candidate.detailedPrescriptionFingerprint === null
      && candidate.sessions.every((session) => session.prescription.kind !== "PACE_TARGET")
    ))).toBe(true)
  })

  it("binds one explicitly selected exact-event template to both candidates", () => {
    const record = createSelfReportedAthleteRecord({
      id: "00000000-0000-4000-8000-000000001500",
      purpose: "RECENT_RESULT",
      eventDistanceM: 1500,
      performanceSeconds: 245,
      achievedOn: "2026-08-10",
      seasonId: null,
    }, NOW)
    if (record === null) throw new TypeError("Expected valid same-event fixture")
    expect(saveAthleteRecord(record, NOW).ok).toBe(true)

    const result = generatePlanFromDraft({
      ...DRAFT,
      experienceBand: "EXPERIENCED",
      trainingFocus: "MIXED_INTENT",
      selectedDetailedTemplateRef: TEMPLATE_1500,
    }, "NO_KNOWN_RISK", { selectedRecordId: record.id })

    expect(result.kind).toBe("generated")
    if (result.kind !== "generated") return
    expect(result.prescriptionBinding.kind).toBe("bound")
    expect(result.generated.candidates.every((candidate) => (
      candidate.selectedDetailedTemplateRef?.fingerprint === TEMPLATE_1500.fingerprint
      && candidate.detailedPrescriptionFingerprint?.startsWith("canonical-json-v1:") === true
      && candidate.sessions.filter((session) => session.prescription.kind === "PACE_TARGET").length === 1
    ))).toBe(true)
  })

  it("invalidates coordinated candidate and pair mutations at selection", () => {
    const original = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
    if (original.kind !== "generated") throw new TypeError("Expected generated v3 fixture")
    const [balanced, conservative] = original.generated.candidates
    const forgedPairId = original.generated.pairId.replace(":lt_intent:", ":vo2_intent:")
    const forgedBalanced = { ...balanced, pairId: forgedPairId }
    const forgedConservative = { ...conservative, pairId: forgedPairId }
    const forgedGenerated = {
      ...original.generated,
      pairId: forgedPairId,
      candidates: [forgedBalanced, forgedConservative] as const,
    }

    const selection = selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      generatedPlan: forgedGenerated,
      selectedCandidateId: forgedBalanced.candidateId,
      actor: "SELF",
      safetyGate: original.gate,
    })

    expect(selection).toMatchObject({ kind: "rejected" })
  })

  it("rejects malformed, past, multiple, prioritized, and receipt-injected race input", () => {
    const malformedInputs = [
      { ...DRAFT, targetRaceDate: "2026-02-30" },
      { ...DRAFT, targetRaceDate: "2026-08-23" },
      { ...DRAFT, raceDates: ["2026-09-12"] },
      { ...DRAFT, targetRacePriority: 1 },
      { ...DRAFT, retentionReceipt: { status: "AUTHORIZED" } },
      { ...DRAFT, racePlacementAuthority: { status: "ACTIVE" } },
      { ...DRAFT, placementRow: { eventDistanceM: 1500, projectionH: 9 } },
      { ...DRAFT, numericTaperAuthority: "GRANTED" },
    ]

    for (const input of malformedInputs) {
      expect(generatePlanFromDraft(input, "NO_KNOWN_RISK")).toMatchObject({ kind: "rejected" })
    }
    expect(window.localStorage.length).toBe(0)
    expect(window.sessionStorage.length).toBe(0)
  })

  it("leaves no persistent race-date bytes and cannot select or save a preview", () => {
    const urlBefore = window.location.href
    const historyBefore = JSON.stringify(window.history.state)
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const result = generatePlanFromDraft({ ...DRAFT, targetRaceDate: "2026-09-12" }, "NO_KNOWN_RISK")
    expect(result.kind).toBe("preview_only")
    if (result.kind !== "preview_only") return

    expect(selectPlanCandidate({
      kind: "PLAN_BETA_SELECTION_REQUEST",
      generatedPlan: result,
      selectedCandidateId: "preview-candidate",
      actor: "SELF",
      safetyGate: { kind: "passed" },
    })).toMatchObject({ kind: "rejected", code: "INVALID_SELECTION_REQUEST" })

    const generic = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
    if (generic.kind !== "generated") throw new TypeError("Expected generic v3 fixture")
    const selected = selectPlanForActivation(
      generic.generated.candidates[0].candidateId, generic.generated, generic.gate, generic.intake, generic.athleteEvidence,
    )
    if (selected.kind !== "selected") throw new TypeError("Expected selected v3 fixture")
    const nonCanonicalState = { ...selected.state, targetRaceDate: result.preview.targetRaceDate }
    expect(savePlanBetaState(nonCanonicalState)).toEqual({
      ok: false,
      code: "PLAN_STORAGE_WRITE_FAILED",
      rollbackComplete: true,
    })
    expect(loadPlanBetaState()).toBeNull()

    const storageBytes = [
      ...Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.key(index)),
      ...Array.from({ length: window.sessionStorage.length }, (_, index) => window.sessionStorage.key(index)),
    ].flatMap((key) => key === null ? [] : [key, window.localStorage.getItem(key), window.sessionStorage.getItem(key)])
    expect(JSON.stringify(storageBytes)).not.toContain(result.preview.targetRaceDate)
    expect(window.location.href).toBe(urlBefore)
    expect(JSON.stringify(window.history.state)).toBe(historyBefore)
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it("preserves invalid stored bytes while rejecting identity tampering", () => {
    const generated = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
    if (generated.kind !== "generated") throw new TypeError("Expected generated v3 fixture")
    const selected = selectPlanForActivation(
      generated.generated.candidates[0].candidateId, generated.generated, generated.gate, generated.intake, generated.athleteEvidence,
    )
    if (selected.kind !== "selected") throw new TypeError("Expected selected v3 fixture")
    expect(savePlanBetaState(selected.state)).toEqual({ ok: true })
    const stored = window.localStorage.getItem("trainoracle.plan-beta.v1")
    if (stored === null) throw new TypeError("Expected stored v3 bytes")
    const parsed: unknown = JSON.parse(stored)
    if (typeof parsed !== "object" || parsed === null || !("activePlan" in parsed)) throw new TypeError("Expected stored active plan")
    const activePlan = parsed.activePlan
    if (typeof activePlan !== "object" || activePlan === null) throw new TypeError("Expected stored active snapshot")
    const tampered = JSON.stringify({ ...parsed, activePlan: { ...activePlan, pairId: "plan-pair:v3:1500:rpe-only:vo2_intent:fixture-main-1-fixture-main-2:1-3-5-7-9:no-continuity" } })
    window.localStorage.setItem("trainoracle.plan-beta.v1", tampered)

    expect(loadPlanBetaState()).toBeNull()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBe(tampered)
  })

  it("rejects retained candidate identity after stored support-session bytes change", () => {
    const generated = generatePlanFromDraft(DRAFT, "NO_KNOWN_RISK")
    if (generated.kind !== "generated") throw new TypeError("Expected generated v3 fixture")
    const selected = selectPlanForActivation(
      generated.generated.candidates[0].candidateId, generated.generated, generated.gate, generated.intake, generated.athleteEvidence,
    )
    if (selected.kind !== "selected") throw new TypeError("Expected selected v3 fixture")

    const supportIndex = selected.state.activePlan.sessions.findIndex((session) => session.role === "EASY")
    if (supportIndex < 0) throw new TypeError("Expected support session fixture")
    const tamperedSessions = selected.state.activePlan.sessions.map((session, index) => (
      index === supportIndex && session.role === "EASY"
        ? {
            ...session,
            prescription: {
              ...session.prescription,
              durationMinutes: { minimum: 999, maximum: 1000 },
            },
          }
        : session
    ))
    const tampered = JSON.stringify({
      ...selected.state,
      activePlan: { ...selected.state.activePlan, sessions: tamperedSessions },
    })
    window.localStorage.setItem("trainoracle.plan-beta.v1", tampered)

    expect(loadPlanBetaState()).toBeNull()
    expect(window.localStorage.getItem("trainoracle.plan-beta.v1")).toBe(tampered)
  })
})
