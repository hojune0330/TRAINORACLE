import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { deriveSequenceTotals, compareMainMethods } from "@impl/prescription/sequence"
import type { PlanSession } from "@impl/plan-generator/types"
import { explainSession } from "./session-explanation"
import { createExplanationReceipt, hasMatchingExplanationReceipt } from "./training-explanation-receipt"
import { sessionPrescriptionSequence } from "./session-prescription-sequence"
import { stateFixture } from "./plan-beta-store.test-fixture"
import * as composition from "./session-explanation-content"
import { parsePlanBetaState } from "./plan-beta-schema"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { RUNTIME_CASES, TODAY, draftFor, saveCurrentRecord } from "./prescription-quality-matrix.test-fixtures"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

describe("prescription-bound explanations", () => {
  it.each(RUNTIME_CASES)("uses the exact prescription and receipt for $caseId", (fixture) => {
    const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
    const generated = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
    if (generated.kind !== "generated") throw new Error("Expected generated fixture")
    const selected = selectPlanForActivation(generated.generated.candidates[0].candidateId, generated.generated, generated.gate, generated.intake)
    if (selected.kind !== "selected" || selected.state.version !== 3) throw new Error("Expected selected fixture")
    expect(hasMatchingExplanationReceipt(selected.state.activePlan, selected.state.generatedAt, selected.state.explanationReceipt)).toBe(true)
    const saved = parsePlanBetaState(JSON.parse(JSON.stringify(selected.state)))
    expect(saved).not.toBeNull()
    for (const session of selected.state.activePlan.sessions) {
      const explanation = explainSession(session, { plan: selected.state.activePlan, kind: "SAVED", generatedAt: selected.state.generatedAt, receipt: selected.state.explanationReceipt })
      expect(explanation.originalExplanationAvailable).toBe(true)
      expect(explanation.profile.purpose.length).toBeGreaterThan(10)
      expect(explanation.work.length).toBeGreaterThan(10)
      expect(explanation.recovery.length).toBeGreaterThan(10)
      expect(explanation.sourceIds.length).toBeGreaterThan(0)
      if (session.prescription.kind !== "PACE_TARGET") continue
      const p = session.prescription
      expect(explanation.work).toContain(`${p.repetitionDistanceM}m`)
      expect(explanation.work).toContain(`총 ${p.totals.totalRepetitions}회`)
      expect(explanation.recovery).toContain(`를 ${p.totals.repetitionRecoveryOccurrences}번 넣었어요.`)
      expect(explanation.templateContent?.identity.templateId).toBe(p.templateId)
      expect(explanation.inputs[0]).toContain(String(p.selectedAnchor.eventDistanceM))
      expect(explanation.components.map((component) => component.id)).toEqual(["warmup", "strides", "main", "cooldown"])
      const sequence = sessionPrescriptionSequence(session)
      if (sequence === null) throw new Error("Expected sequence")
      const totals = deriveSequenceTotals(sequence)
      expect(totals.totalRepetitions).toBe(p.totals.totalRepetitions)
      expect(totals.qualityDistanceM).toBe(p.totals.qualityDistanceM)
      expect(totals.plannedRecoverySeconds).toBe(p.totals.plannedRecoverySeconds)
      expect(totals.qualityDurationSeconds).toBeNull()
    }
    const main = generated.generated.candidates.map((candidate) => sessionPrescriptionSequence(candidate.sessions.find((session) => session.prescription.kind === "PACE_TARGET")!))
    if (main[0] === null || main[0] === undefined || main[1] === null || main[1] === undefined) throw new Error("Expected both MAIN structures")
    expect(compareMainMethods(main[0], main[1]).kind).toBe("same")
  })

  it("keeps old plans readable and never invents an original explanation", () => {
    const state = stateFixture()
    const session = state.activePlan.sessions[0]!
    const explanation = explainSession(session, { plan: state.activePlan, kind: "SAVED", generatedAt: state.generatedAt })
    expect(explanation.originalExplanationAvailable).toBe(false)
    expect(explanation.availability).toContain("복원한 것은 아니에요")
    expect(parsePlanBetaState(state)?.activePlan).toEqual(state.activePlan)
  })

  it.each(["version", "content", "plan", "time"])("rejects a stale or altered %s explanation receipt without losing the plan", (mutation) => {
    const state = stateFixture()
    const receipt = createExplanationReceipt(state.activePlan, state.generatedAt)
    const changed = mutation === "version" ? { ...receipt, explanationVersion: "99.0.0" }
      : mutation === "content" ? { ...receipt, contentFingerprint: `sha256:${"0".repeat(64)}` }
        : mutation === "plan" ? { ...receipt, planFingerprint: `sha256:${"0".repeat(64)}` }
          : { ...receipt, capturedAt: "2000-01-01T00:00:00.000Z" }
    const saved = parsePlanBetaState({ ...state, explanationReceipt: changed })
    expect(saved?.activePlan).toEqual(state.activePlan)
    expect(hasMatchingExplanationReceipt(state.activePlan, state.generatedAt, changed)).toBe(false)
  })

  it("discarded bad explanation metadata cannot inject private text or break a prescription", () => {
    const state = stateFixture()
    const parsed = parsePlanBetaState({ ...state, explanationReceipt: { memo: "DO_NOT_RETAIN", version: 999 } })
    expect(parsed?.activePlan).toEqual(state.activePlan)
    expect(JSON.stringify(parsed)).not.toContain("DO_NOT_RETAIN")
  })

  it("a changed composed sentence invalidates its old receipt even with the same version label", () => {
    const state = stateFixture()
    const receipt = createExplanationReceipt(state.activePlan, state.generatedAt)
    const original = composition.buildSessionExplanationContent
    vi.spyOn(composition, "buildSessionExplanationContent").mockImplementation((session, context) => ({
      ...original(session, context), work: "Changed composition without a version bump",
    }))
    expect(hasMatchingExplanationReceipt(state.activePlan, state.generatedAt, receipt)).toBe(false)
  })

  it("content changes invalidate old explanations, progress does not", () => {
    const state = stateFixture()
    const receipt = createExplanationReceipt(state.activePlan, state.generatedAt)
    const session = state.activePlan.sessions[0]!
    if (session.role !== "EASY") throw new Error("Expected RPE fixture")
    const changedSession = { ...session, prescription: { ...session.prescription, durationMinutes: { minimum: 21, maximum: 30 } } }
    expect(hasMatchingExplanationReceipt({ ...state.activePlan, sessions: [changedSession] }, state.generatedAt, receipt)).toBe(false)
    expect(hasMatchingExplanationReceipt(state.activePlan, state.generatedAt, receipt)).toBe(true)
    expect(explainSession(changedSession, { plan: state.activePlan, kind: "CANDIDATE" }).originalExplanationAvailable).toBe(false)
  })

  it("does not read injected free text from a plan or a receipt source", () => {
    const state = stateFixture()
    Object.defineProperty(state.activePlan, "memo", { get: () => { throw new Error("private text accessed") } })
    const receipt = createExplanationReceipt(state.activePlan, state.generatedAt)
    expect(() => explainSession(state.activePlan.sessions[0]!, { plan: state.activePlan, kind: "SAVED", generatedAt: state.generatedAt, receipt })).not.toThrow()
    expect(JSON.stringify(receipt)).not.toMatch(/memo|athlete-record/u)
  })

  it.each(["LT_INTENT", "VO2_INTENT", "GLY_INTENT", "ATP_PC_INTENT", "MIXED_INTENT"] as const)("does not invent subdivision or recovery seconds for %s", (plannedEnergyIntent) => {
    const session: PlanSession = { day: 1, slot: "PM", role: "QUALITY", plannedEnergyIntent, prescription: { kind: "RPE_TIME_RANGE", rpe: { minimum: 6, maximum: 7 }, durationMinutes: { minimum: 30, maximum: 40 } } }
    const explanation = explainSession(session)
    expect(explanation.recovery).toContain("저장되지 않았어요")
    expect(explanation.limitations.join(" ")).toContain("전체를 높은 강도로 계속 달리는 뜻이 아니에요")
    expect(sessionPrescriptionSequence(session)).toBeNull()
    expect(explanation.components.find((component) => component.id === "main")?.label).toContain("구간 미지정")
    expect(explanation.inputs.join(" ")).toContain("개인 경기 기록으로 시간·RPE·페이스를 계산한 처방은 아니에요")
  })

  it("rest has no made-up work or energetic adaptation", () => {
    const rest: PlanSession = { day: 2, slot: "AM", role: "REST", plannedEnergyIntent: "RECOVERY_INTENT", prescription: { kind: "REST" } }
    expect(sessionPrescriptionSequence(rest)).toBeNull()
    const result = explainSession(rest)
    expect(result.work).toContain("적용하지 않아요")
    expect(result.recovery).toContain("회복이 끝났다는 판정")
  })

  it("labels current frame position separately from the stored explanation receipt", () => {
    const state = stateFixture()
    const receipt = createExplanationReceipt(state.activePlan, state.generatedAt)
    const context = { plan: state.activePlan, kind: "SAVED" as const, generatedAt: state.generatedAt, receipt }
    const first = explainSession(state.activePlan.sessions[0]!, { ...context, frameOrdinal: 1 })
    const second = explainSession(state.activePlan.sessions[0]!, { ...context, frameOrdinal: 2 })
    expect(first.cycle).toEqual(second.cycle)
    expect(second.currentFrameLabel).toContain("저장 당시의 설명과 별도로 현재 연결 상태")
    expect(second.currentFrameLabel).toContain("2번째")
    expect(second.originalExplanationAvailable).toBe(true)
  })
})
