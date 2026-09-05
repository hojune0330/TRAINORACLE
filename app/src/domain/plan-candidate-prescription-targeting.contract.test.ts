import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { PlanCandidate, PlanGenerationSuccess } from "@impl/plan-generator/types"
import type { PlanSession } from "@impl/plan-generator/session-types"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { createSelfReportedAthleteRecord, saveAthleteRecord } from "./athlete-records"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { loadVersionedPlanBetaState, savePlanBetaState } from "./plan-beta-store"
import { createPlannedSessionLogDraft, resolveCurrentPlannedSession } from "./planned-session-link"
import { loadEntries } from "./journal-store"
import {
  bindDetailedPrescriptionCandidates,
  bindDetailedPrescriptionPlacements,
  type DetailedPrescriptionTarget,
} from "./plan-candidate-prescription"

const TODAY = new Date("2026-08-17T03:00:00.000Z")
const approval = DETAILED_PRESCRIPTION_APPROVALS.find((entry) => entry.targetEventDistanceM === 5000)
if (approval === undefined) throw new Error("Missing approved 5000m fixture")
const DRAFT = {
  eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
  experienceBand: "EXPERIENCED", availableDayCount: "EVERY_DAY", requestedFrameLength: 9,
  trainingFocus: "VO2_INTENT", secondSessionMode: "RECOVERY_PM_ALLOWED",
  trainingTimePreference: "MORNING",
  selectedDetailedTemplateRef: {
    templateId: approval.templateId, version: approval.templateVersion,
    fingerprint: approval.templateContentFingerprint,
  },
} as const
const selection = { selectedRecordId: "targeting-current-pb" }

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
  window.localStorage.clear()
  window.sessionStorage.clear()
  const record = createSelfReportedAthleteRecord({
    id: selection.selectedRecordId, purpose: "PERSONAL_BEST", eventDistanceM: 5000,
    performanceSeconds: 1111, achievedOn: "2026-07-01", seasonId: null,
  }, TODAY)
  if (record === null) throw new Error("Invalid synthetic record")
  expect(saveAthleteRecord(record, TODAY)).toEqual({ ok: true, total: 1 })
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

function baseline(slot: "AM" | "PM" = "AM") {
  const draft = { ...DRAFT, trainingTimePreference: slot === "AM" ? "MORNING" as const : "EVENING" as const }
  const result = generatePlanFromDraft(draft, "NO_KNOWN_RISK")
  if (result.kind !== "generated") throw new Error("Expected generated RPE baseline")
  return { ...result, draft }
}

function main(candidate: PlanCandidate, index: number) {
  const quality = candidate.sessions.filter((session) => session.role === "QUALITY")
  expect(quality).toHaveLength(2)
  const session = quality[index]
  if (session === undefined) throw new Error("Missing MAIN fixture")
  return session
}

function detailedSession(candidate: PlanCandidate) {
  const sessions = candidate.sessions.filter((session) => session.prescription.kind === "PACE_TARGET")
  expect(sessions).toHaveLength(1)
  const session = sessions[0]
  if (session?.prescription.kind !== "PACE_TARGET") throw new Error("Missing detailed prescription")
  return { ...session, prescription: session.prescription }
}

function bind(input: ReturnType<typeof baseline>, target?: DetailedPrescriptionTarget, generated = input.generated) {
  return bindDetailedPrescriptionCandidates(generated, input.intake, input.gate, selection, TODAY, target)
}

function expectTargetFallback(input: ReturnType<typeof baseline>, target: DetailedPrescriptionTarget, generated = input.generated) {
  const before = JSON.stringify(generated)
  const result = bind(input, target, generated)
  expect(result).toMatchObject({ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY" })
  expect(result.generated).toBe(generated)
  expect(JSON.stringify(generated)).toBe(before)
}

describe("approved detailed prescription per-session binding", () => {
  it.each(["AM", "PM"] as const)("binds the shared second %s MAIN and preserves all other session references and totals", (slot) => {
    const input = baseline(slot)
    const before = JSON.stringify(input.generated)
    const target = main(input.generated.candidates[0], 1)
    expect(target.slot).toBe(slot)
    const result = bind(input, target)
    expect(result.kind).toBe("bound")
    const legacy = bind(input)
    expect(legacy.kind).toBe("bound")
    result.generated.candidates.forEach((candidate, index) => {
      const original = input.generated.candidates[index]
      const legacyCandidate = legacy.generated.candidates[index]
      if (original === undefined || legacyCandidate === undefined) throw new Error("Missing pair")
      const selected = detailedSession(candidate)
      expect(selected).toMatchObject({ day: target.day, slot: target.slot })
      expect(selected.prescription).toStrictEqual(detailedSession(legacyCandidate).prescription)
      expect(selected.prescription.totals).toMatchObject({
        qualityDistanceM: 5000, totalRepetitions: 5,
        repetitionRecoveryOccurrences: 4, repetitionRecoveryTotalSeconds: 600,
      })
      original.sessions.forEach((session, sessionIndex) => {
        if (session.day !== target.day || session.slot !== target.slot) {
          expect(candidate.sessions[sessionIndex]).toBe(session)
        }
      })
      expect(candidate.mainExposureLedger).toBe(original.mainExposureLedger)
      expect(candidate.frame).toBe(original.frame)
      expect(isVerifiedPlanCandidate(candidate)).toBe(true)
      expect(candidate.candidateId).not.toContain(":target:")
      expect(candidate.candidateId).not.toBe(legacyCandidate.candidateId)
      expect(Object.isFrozen(candidate)).toBe(true)
      expect(Object.isFrozen(candidate.sessions)).toBe(true)
    })
    expect(result.generated.pairId).not.toBe(legacy.generated.pairId)
    expect(JSON.stringify(input.generated)).toBe(before)
    expect(bind(input, target)).toStrictEqual(result)
  })

  it.each([
    { slot: "AM", candidateIndex: 0 }, { slot: "AM", candidateIndex: 1 },
    { slot: "PM", candidateIndex: 0 }, { slot: "PM", candidateIndex: 1 },
  ] as const)("selects and round-trips the second $slot MAIN in candidate $candidateIndex through production flow", ({ slot, candidateIndex }) => {
    const input = baseline(slot)
    const target = main(input.generated.candidates[0], 1)
    const generated = generatePlanFromDraft(input.draft, "NO_KNOWN_RISK", selection, target)
    if (generated.kind !== "generated") throw new Error("Expected targeted generation")
    expect(generated.prescriptionBinding).toEqual({ kind: "bound", code: "PACE_TARGET_BOUND" })
    const candidate = generated.generated.candidates[candidateIndex]
    expect(detailedSession(candidate)).toMatchObject({ day: target.day, slot })
    const selected = selectPlanForActivation(
      candidate.candidateId, generated.generated, generated.gate, generated.intake, generated.athleteEvidence,
    )
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") throw new Error("Second MAIN activation rejected")
    expect(savePlanBetaState(selected.state)).toEqual({ ok: true })
    const loaded = loadVersionedPlanBetaState()
    expect(loaded).toStrictEqual(selected.state)
    const stored = loaded?.activePlan.sessions.filter((session) => session.prescription.kind === "PACE_TARGET")
    expect(stored).toHaveLength(1)
    expect(stored?.[0]).toMatchObject({ day: target.day, slot, prescription: detailedSession(candidate).prescription })
    if (loaded === null || stored?.[0] === undefined) throw new Error("Missing stored MAIN")
    const journalDraft = createPlannedSessionLogDraft(loaded, stored[0], TODAY.toISOString())
    expect(journalDraft?.link).toMatchObject({ sessionDay: target.day, sessionSlot: slot })
    expect(resolveCurrentPlannedSession(loaded, journalDraft?.link)).toStrictEqual(stored[0])
    expect(createPlannedSessionLogDraft(loaded, target, TODAY.toISOString())).toBeNull()
    expect(loadEntries()).toHaveLength(0)
  })

  it("keeps legacy omitted and undefined targets exactly equivalent to explicit first MAIN", () => {
    const input = baseline()
    const omitted = generatePlanFromDraft(input.draft, "NO_KNOWN_RISK", selection)
    const undefinedTarget = generatePlanFromDraft(input.draft, "NO_KNOWN_RISK", selection, undefined)
    const explicit = generatePlanFromDraft(input.draft, "NO_KNOWN_RISK", selection, main(input.generated.candidates[0], 0))
    expect(omitted).toStrictEqual(undefinedTarget)
    expect(explicit).toStrictEqual(omitted)
    expect(bind(input).generated).toStrictEqual(bind(input, main(input.generated.candidates[0], 0)).generated)
  })

  it.each(["REST", "EASY"] as const)("does not silently redirect an explicit %s request", (role) => {
    const input = baseline()
    const target = input.generated.candidates[0].sessions.find((session) => session.role === role)
    if (target === undefined) throw new Error(`Missing ${role} fixture`)
    expectTargetFallback(input, target)
  })

  it("rejects a missing day or wrong AM/PM slot even with eligible MAINs elsewhere", () => {
    const input = baseline()
    const target = main(input.generated.candidates[0], 1)
    expectTargetFallback(input, { day: target.day, slot: "PM" })
    expectTargetFallback(input, { day: 99, slot: "AM" })
  })

  it.each(["missing", "purpose", "duplicate", "candidate-purpose", "event", "template"] as const)(
    "falls back atomically when only candidate B has a %s mismatch", (change) => {
      const input = baseline()
      const target = main(input.generated.candidates[1], 1)
      const conservative = input.generated.candidates[1]
      const sessions: readonly PlanSession[] = change === "missing"
        ? conservative.sessions.filter((session) => session !== target)
        : change === "duplicate" ? [...conservative.sessions, target]
          : conservative.sessions.map((session) => session === target && (change === "purpose" || change === "candidate-purpose")
            ? { ...target, plannedEnergyIntent: "GLY_INTENT" } : session)
      const changed: PlanCandidate = {
        ...conservative, sessions,
        ...(change === "candidate-purpose" ? { selectedEnergyIntent: "GLY_INTENT" as const } : {}),
        ...(change === "event" ? { eventDistanceM: 3000 as const } : {}),
        ...(change === "template" ? { selectedDetailedTemplateRef: null } : {}),
      }
      const generated: PlanGenerationSuccess = {
        ...input.generated, candidates: [input.generated.candidates[0], changed],
      }
      expectTargetFallback(input, target, generated)
    },
  )

  it("rejects repeat binding to the same or another MAIN without changing the already-bound pair", () => {
    const input = baseline()
    const target = main(input.generated.candidates[0], 1)
    const bound = bind(input, target)
    expect(bound.kind).toBe("bound")
    expectTargetFallback(input, target, bound.generated)
    expectTargetFallback(input, main(input.generated.candidates[0], 0), bound.generated)
    expect(bind(input, undefined, bound.generated).generated).toBe(bound.generated)
  })

  it("rejects two slots that reuse the same approved method instead of presenting fake variety", () => {
    const input = baseline()
    const first = main(input.generated.candidates[0], 0)
    const second = main(input.generated.candidates[0], 1)
    const before = JSON.stringify(input.generated)
    const result = bindDetailedPrescriptionPlacements(
      input.generated,
      input.intake,
      input.gate,
      [first, second].map(target => ({
        selectedRecordId: selection.selectedRecordId,
        selectedTemplateRef: DRAFT.selectedDetailedTemplateRef,
        target: { day: target.day, slot: target.slot },
      })),
      TODAY,
    )
    expect(result).toMatchObject({ kind: "fallback", code: "PACE_TARGET_FALLBACK_NO_ELIGIBLE_QUALITY" })
    expect(result.generated).toBe(input.generated)
    expect(JSON.stringify(input.generated)).toBe(before)
  })
})
