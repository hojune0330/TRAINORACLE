import { describe, expect, it } from "vitest"
import { isVerifiedPlanCandidate } from "../src/plan-generator/adaptation"
import { rebindCandidatePairIdentity } from "../src/plan-generator/candidate-identity"
import { compileExposureLedger } from "../src/plan-generator/exposure-ledger"
import { parseFormation } from "../src/plan-generator/formation-parser"
import { generatePlanCandidates } from "../src/plan-generator/generator"
import { mainPlacementFrameScopeFingerprint } from "../src/plan-generator/main-placement-policy"
import { parsePlanGenerationRequest } from "../src/plan-generator/parser"
import { recordPlanProgress } from "../src/plan-generator/progress"
import { selectPlanCandidate } from "../src/plan-generator/selection"
import { makeCandidateSessions } from "../src/plan-generator/session-builder"
import type { LocalCivilNinePointFiveFormation, PlanCandidate, PlanSession } from "../src/plan-generator/types"
import { baseRequest, clearedGate, expectGenerated } from "./fixtures/plan-beta-request"

function pmFormation(mainTrainingDays: readonly [number, number] = [1, 10]): LocalCivilNinePointFiveFormation {
  const dayKey = (day: number) => `2026-10-${String(day).padStart(2, "0")}`
  return {
    kind: "LOCAL_CIVIL_9_5", startSlot: "PM",
    slots: Array.from({ length: 19 }, (_, slotIndex) => ({
      slotIndex, localDayKey: dayKey(Math.floor((slotIndex + 1) / 2) + 1),
      slot: slotIndex % 2 === 0 ? "PM" : "AM",
    })),
    exposures: mainTrainingDays.map((day, index) => ({
      exposureId: `fixture-main-${index + 1}`, classification: "TRAINING_MAIN",
      localDayKey: dayKey(day), component: { kind: "STANDALONE" },
    })),
  }
}
function request(mainTrainingDays: readonly [number, number] = [1, 10]) {
  const base = baseRequest()
  return { ...base, formation: pmFormation(mainTrainingDays), requestedFrameLength: 9.5,
    profile: { ...base.profile, availableTrainingDays: [1, 3, 5, 7, 10],
      secondSessionMode: "SINGLE_SESSION_ONLY", trainingTimePreference: "EVENING" } }
}

describe("explicit PM-start canonical frame compatibility", () => {
  it("retains default AM serialization and requires an explicit PM topology marker", () => {
    const legacy = parseFormation(baseRequest().formation)
    expect(legacy).toEqual(baseRequest().formation)
    expect(legacy && "startSlot" in legacy).toBe(false)
    const formation = pmFormation()
    expect(parseFormation(formation)).toEqual(formation)
    expect(compileExposureLedger(formation)).toMatchObject({ kind: "valid", mainExposureCount: 2 })
    const { startSlot: _phase, ...unmarked } = formation
    expect(parseFormation(unmarked)).toBeUndefined()
    expect(parseFormation({ ...formation, startSlot: "AM" })).toBeUndefined()
    const malformed = { ...formation, slots: formation.slots.map((slot, index) => index === 1 ? { ...slot, slot: "PM" } : slot) }
    expect(parseFormation(malformed)).toBeUndefined()
    expect(compileExposureLedger(malformed as LocalCivilNinePointFiveFormation).kind).toBe("needs_review")
  })

  it("uses the actual PM opening and closing slots when generating and selecting a frame", () => {
    const generated = expectGenerated(generatePlanCandidates(request()))
    const candidate = generated.candidates[0]
    expect(candidate.frame).toMatchObject({ startSlot: "PM", slotCount: 19, lengthDays: 9.5 })
    expect(candidate.sessions.find(session => session.day === 1)).toMatchObject({ slot: "PM", role: "EASY" })
    expect(candidate.sessions.find(session => session.day === 10)).toMatchObject({ slot: "PM", role: "QUALITY" })
    expect(candidate.sessions.find(session => session.day === 2)).toMatchObject({ slot: "AM", role: "REST" })
    expect(candidate.sessions.every(session => {
      const position = (session.day - 1) * 2 + (session.slot === "PM" ? 1 : 0) - 1
      return position >= 0 && position < 19
    })).toBe(true)
    expect(isVerifiedPlanCandidate(candidate)).toBe(true)
    const selected = selectPlanCandidate({ kind: "PLAN_BETA_SELECTION_REQUEST", generatedPlan: generated,
      selectedCandidateId: candidate.candidateId, actor: "SELF", safetyGate: clearedGate() })
    expect(selected.kind).toBe("selected")
    if (selected.kind === "selected") {
      expect(selected.activePlan.frame).toHaveProperty("startSlot", "PM")
      expect(selected.activePlan.sessions).toEqual(candidate.sessions)
    }
  })

  it("does not invent an opening AM or a duplicate recovery session when two sessions are allowed", () => {
    const base = request()
    const parsed = parsePlanGenerationRequest({ ...base,
      profile: { ...base.profile, secondSessionMode: "RECOVERY_PM_ALLOWED", trainingTimePreference: "MORNING" } })
    expect(parsed.kind).toBe("parsed")
    if (parsed.kind !== "parsed") return
    // Exercise the boundary slot builder directly; the unchanged reviewed
    // generation policy does not normally assign QUALITY to the opening day.
    const sessions = makeCandidateSessions({ request: parsed.request, kind: "BALANCED", qualityDays: [1, 10] })
    expect(sessions.filter(session => session.day === 1)).toHaveLength(1)
    expect(sessions.find(session => session.day === 1)).toMatchObject({ slot: "PM", role: "QUALITY" })
    expect(sessions.filter(session => session.day === 10).map(session => `${session.slot}:${session.role}`).sort())
      .toEqual(["AM:QUALITY", "PM:EASY"])
    expect(new Set(sessions.map(session => `${session.day}:${session.slot}`)).size).toBe(sessions.length)
  })

  it("preserves the opening PM rest address through selection and progress validation", () => {
    const base = request([3, 10])
    const generated = expectGenerated(generatePlanCandidates({ ...base,
      profile: { ...base.profile, availableTrainingDays: [3, 5, 7, 9, 10] } }))
    const selected = selectPlanCandidate({ kind: "PLAN_BETA_SELECTION_REQUEST", generatedPlan: generated,
      selectedCandidateId: generated.candidates[0].candidateId, actor: "SELF", safetyGate: clearedGate() })
    expect(selected.kind).toBe("selected")
    if (selected.kind !== "selected") return
    expect(selected.activePlan.sessions[0]).toMatchObject({ day: 1, slot: "PM", role: "REST" })
    expect(recordPlanProgress({ kind: "PLAN_BETA_PROGRESS_REQUEST", activePlan: selected.activePlan,
      sessionDay: 1, sessionSlot: "PM", state: "SKIPPED" }).kind).toBe("recorded")
    expect(recordPlanProgress({ kind: "PLAN_BETA_PROGRESS_REQUEST", activePlan: selected.activePlan,
      sessionDay: 1, sessionSlot: "AM", state: "SKIPPED" })).toMatchObject({ kind: "rejected", code: "SESSION_SLOT_NOT_IN_ACTIVE_PLAN" })
  })

  it("rejects a rehashed out-of-frame opening AM instead of trusting candidate identity", () => {
    const generated = expectGenerated(generatePlanCandidates(request()))
    const candidates = generated.candidates.map(candidate => ({ ...candidate,
      sessions: candidate.sessions.map(session => session.day === 1 ? { ...session, slot: "AM" } as PlanSession : session),
    })) as unknown as readonly [PlanCandidate, PlanCandidate]
    const forged = rebindCandidatePairIdentity(candidates)
    expect(isVerifiedPlanCandidate(forged[0])).toBe(false)
    expect(mainPlacementFrameScopeFingerprint({ ...forged[0], athleteExperienceBand: "DEVELOPING" })).toBeNull()
    expect(selectPlanCandidate({ kind: "PLAN_BETA_SELECTION_REQUEST",
      generatedPlan: { ...generated, candidates: forged, pairId: forged[0].pairId },
      selectedCandidateId: forged[0].candidateId, actor: "SELF", safetyGate: clearedGate() }).kind).toBe("rejected")
  })
})
