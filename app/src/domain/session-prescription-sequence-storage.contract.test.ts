import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { parsePrescriptionSequence } from "@impl/prescription/sequence"
import { projectPacePrescriptionSequence } from "@impl/prescription/pace-sequence"
import { isVerifiedPlanCandidate } from "@impl/plan-generator/adaptation"
import { hasValidCandidateIdentity, projectPlanCandidate, rebindCandidatePairIdentity } from "@impl/plan-generator/candidate-identity"
import { generatePlanFromDraft, selectPlanForActivation } from "./plan-beta-flow"
import { RUNTIME_CASES, TODAY, draftFor, saveCurrentRecord } from "./prescription-quality-matrix.test-fixtures"
import * as schemas from "./plan-session-schema"
import type { StoredPaceTargetPrescription } from "./plan-session-schema"
import { loadVersionedPlanBetaState, readPlanBetaStateFromStorage, savePlanBetaState, PLAN_BETA_STORAGE_KEY } from "./plan-beta-store"
import { parsePlanBetaState, planAdaptationCandidateSchema } from "./plan-beta-schema"
import { sessionPrescriptionSequence } from "./session-prescription-sequence"
import { hasMatchingExplanationReceipt } from "./training-explanation-receipt"
import { publicPlanCardFromState } from "./account/public-profile"

beforeEach(() => {
  localStorage.clear()
  sessionStorage.clear()
  vi.useFakeTimers()
  vi.setSystemTime(TODAY)
})
afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks() })

function selectedPlan(fixture = RUNTIME_CASES[0] as typeof RUNTIME_CASES[number]) {
  const selectedRecordId = saveCurrentRecord(fixture.eventDistanceM, fixture.performanceSeconds)
  const result = generatePlanFromDraft(draftFor(fixture), "NO_KNOWN_RISK", { selectedRecordId })
  if (result.kind !== "generated") throw new Error("Expected generated plan")
  const selection = selectPlanForActivation(result.generated.candidates[0].candidateId, result.generated, result.gate, result.intake)
  if (selection.kind !== "selected" || selection.state.version !== 3) throw new Error("Expected selected V3 plan")
  const session = selection.state.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")
  if (session === undefined || session.prescription.kind !== "PACE_TARGET") throw new Error("Expected detailed MAIN")
  return { state: selection.state, session, prescription: session.prescription, gate: result.gate, candidates: result.generated.candidates }
}

function withRecomputedFingerprint(input: Record<string, unknown>): Record<string, unknown> {
  const { prescriptionFingerprint: _fingerprint, ...content } = input
  return { ...content, prescriptionFingerprint: `canonical-json-v1:${JSON.stringify(content)}` }
}

function mutablePrescription(prescription: StoredPaceTargetPrescription) {
  return JSON.parse(JSON.stringify(prescription)) as Record<string, any>
}

describe("prescription-bound V2 sequence persistence", () => {
  it.each(RUNTIME_CASES)("preserves structure, pace and explanation after reload for $caseId", fixture => {
    const { state, session, prescription, gate } = selectedPlan(fixture)
    expect(prescription.sequence?.version).toBe(2)
    expect(prescription.sequence?.terminalRecovery).toEqual({ mode: "NOT_APPLICABLE", seconds: null })
    expect(prescription.sequence).toEqual(projectPacePrescriptionSequence(prescription))
    expect(prescription.targetRepSeconds).toBe(fixture.targetRepSeconds)
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const bytes = localStorage.getItem(PLAN_BETA_STORAGE_KEY)
    const loaded = loadVersionedPlanBetaState()
    expect(loaded).toEqual(state)
    expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(bytes)
    expect(sessionPrescriptionSequence(session)).toEqual(prescription.sequence)
    expect(hasMatchingExplanationReceipt(state.activePlan, state.generatedAt, state.explanationReceipt)).toBe(true)
    expect(schemas.recheckStoredDetailedPrescriptionAuthority({
      operation: "START", prescription, evaluatedAt: TODAY.toISOString(), safetyGate: gate,
    }).kind).toBe("permitted")
    expect(state.activePlan.sessions.filter(item => item.prescription.kind === "PACE_TARGET")).toHaveLength(1)
    expect(state.intake.secondSessionMode).toBe(fixture.secondSessionMode)
  })

  it("loads legacy prescriptions without retroactively adding a sequence or changing identities", () => {
    const original = schemas.createStoredPaceTargetPrescription
    vi.spyOn(schemas, "createStoredPaceTargetPrescription").mockImplementation(input => {
      const created = original(input)
      if (created === null) return null
      const { sequence: _sequence, ...legacy } = created
      return schemas.paceTargetPlanItemSchema.parse(withRecomputedFingerprint(legacy))
    })
    const { state, session, prescription } = selectedPlan()
    expect(prescription).not.toHaveProperty("sequence")
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const bytes = localStorage.getItem(PLAN_BETA_STORAGE_KEY)
    const loaded = loadVersionedPlanBetaState()
    expect(loaded).toEqual(state)
    expect(sessionPrescriptionSequence(session)?.version).toBe(1)
    expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(bytes)
    expect(hasMatchingExplanationReceipt(state.activePlan, state.generatedAt, state.explanationReceipt)).toBe(true)
    expect(JSON.stringify(loaded)).not.toContain('"sequence":')
  })

  it.each([
    ["repeat count", (p: Record<string, any>) => { p.sequence.main[0].children[0].repeatCount -= 1 }],
    ["work distance", (p: Record<string, any>) => { p.sequence.main[0].children[0].work.distanceM += 100 }],
    ["recovery time", (p: Record<string, any>) => { p.sequence.main[0].children[0].recoveryBetweenRepeats.seconds += 1 }],
    ["recovery mode", (p: Record<string, any>) => { p.sequence.main[0].children[0].recoveryBetweenRepeats.mode = "WALK" }],
    ["recovery unit", (p: Record<string, any>) => { p.sequence.main[0].children[0].recoveryBetweenRepeats = { mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 100 } }],
    ["terminal recovery", (p: Record<string, any>) => { p.sequence.terminalRecovery = { mode: "JOG", seconds: 60 } }],
    ["anchor reference", (p: Record<string, any>) => { p.sequence.main[0].children[0].target.anchorRef = "athlete-record:other" }],
    ["warmup", (p: Record<string, any>) => { p.sequence.warmup[0].work.durationSeconds += 60 }],
    ["cooldown", (p: Record<string, any>) => { p.sequence.cooldown[0].work.durationSeconds += 60 }],
    ["label text", (p: Record<string, any>) => { p.sequence.label = "PRIVATE_TEXT_MUST_NOT_PASS" }],
  ] as const)("rejects a well-formed changed %s even when its fingerprint is recomputed", (_name, mutate) => {
    const { prescription, session, gate, candidates } = selectedPlan()
    const changed = mutablePrescription(prescription)
    mutate(changed)
    expect(parsePrescriptionSequence(changed.sequence).kind).toBe("parsed")
    const forged = withRecomputedFingerprint(changed)
    expect(schemas.paceTargetPlanItemSchema.safeParse(forged).success).toBe(false)
    expect(schemas.createStoredPaceTargetPrescription((({ prescriptionFingerprint: _f, ...content }) => content)(forged))).toBeNull()
    expect(sessionPrescriptionSequence({ ...session, prescription: forged } as unknown as typeof session)).toBeNull()
    const [candidate] = rebindCandidatePairIdentity([{
      ...candidates[0],
      detailedPrescriptionFingerprint: forged.prescriptionFingerprint as string,
      sessions: candidates[0].sessions.map(item => item.prescription.kind === "PACE_TARGET"
        ? { ...item, prescription: forged as unknown as StoredPaceTargetPrescription } : item),
    }, candidates[1]])
    expect(hasValidCandidateIdentity(candidate.candidateId, projectPlanCandidate(candidate))).toBe(true)
    expect(isVerifiedPlanCandidate(candidate)).toBe(false)
    expect(planAdaptationCandidateSchema.safeParse(candidate).success).toBe(false)
    for (const operation of ["START", "RESTART"] as const) {
      expect(schemas.recheckStoredDetailedPrescriptionAuthority({ operation, prescription: forged, evaluatedAt: TODAY.toISOString(), safetyGate: gate }))
        .toMatchObject({ kind: "blocked", code: "STORED_PRESCRIPTION_INVALID" })
    }
  })

  it.each(["missing-terminal", "old-version", "unknown-version", "unknown-key", "empty-main"])("rejects %s without silently repairing the stored structure", mutation => {
    const { prescription } = selectedPlan()
    const changed = mutablePrescription(prescription)
    if (mutation === "missing-terminal") delete changed.sequence.terminalRecovery
    if (mutation === "old-version") { changed.sequence.version = 1; delete changed.sequence.terminalRecovery }
    if (mutation === "unknown-version") changed.sequence.version = 999
    if (mutation === "unknown-key") changed.sequence.memo = "PRIVATE_TEXT_MUST_NOT_PASS"
    if (mutation === "empty-main") changed.sequence.main = []
    expect(schemas.paceTargetPlanItemSchema.safeParse(withRecomputedFingerprint(changed)).success).toBe(false)
  })

  it("retains damaged plan bytes and refuses a guessed replacement", () => {
    const { state } = selectedPlan()
    const changed = JSON.parse(JSON.stringify(state)) as typeof state
    const p = changed.activePlan.sessions.find(item => item.prescription.kind === "PACE_TARGET")!.prescription as StoredPaceTargetPrescription
    const corrupted = mutablePrescription(p)
    corrupted.sequence.terminalRecovery = { mode: "JOG", seconds: 99 }
    Object.assign(p, withRecomputedFingerprint(corrupted))
    const bytes = JSON.stringify(changed)
    localStorage.setItem(PLAN_BETA_STORAGE_KEY, bytes)
    expect(readPlanBetaStateFromStorage()).toEqual({ kind: "invalid" })
    expect(savePlanBetaState(changed)).toMatchObject({ ok: false })
    expect(localStorage.getItem(PLAN_BETA_STORAGE_KEY)).toBe(bytes)
  })

  it("does not add private sequence or record references to the public card", () => {
    const { state, prescription } = selectedPlan()
    const restored = parsePlanBetaState(JSON.parse(JSON.stringify(state)))
    expect(restored).toEqual(state)
    const card = publicPlanCardFromState(state)
    expect(JSON.stringify(card)).not.toMatch(/sequence|anchor|athlete-record|Fingerprint|prescription/u)
    expect(JSON.stringify(card)).not.toContain(prescription.selectedAnchor.anchorId)
  })
})
