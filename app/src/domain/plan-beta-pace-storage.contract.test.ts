import { beforeEach, describe, expect, it } from "vitest"
import { decideSafetyGate } from "@impl/safety-gate/gate"
import { mapD9ResultToRveSignal } from "@impl/rve/signal"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import {
  createStoredPaceTargetPrescription,
  recheckStoredDetailedPrescriptionAuthority,
} from "./plan-session-schema"
import {
  loadPlanBetaState,
  loadVersionedPlanBetaState,
  savePlanBetaState,
} from "./plan-beta-store"
import { stateFixture } from "./plan-beta-store.test-fixture"

const STORAGE_KEY = "trainoracle.plan-beta.v1"
const approval = (() => {
  const found = DETAILED_PRESCRIPTION_APPROVALS.find(
    (record) => record.templateId === "V2-SEED-05" && record.templateVersion === "1.0.0",
  )
  if (found === undefined) throw new TypeError("Trusted V2-SEED-05 approval is missing")
  return found
})()

function safetyGate(disposition: "D9_CLEARED" | "D9_ACTIVE" | "D9_UNKNOWN") {
  return decideSafetyGate(mapD9ResultToRveSignal({
    disposition,
    blocksPlanGeneration: disposition !== "D9_CLEARED",
    reasonCodes: disposition === "D9_CLEARED"
      ? ["D9_CLEARED_NO_COLLOQUIAL_RISK_SIGNAL"]
      : [disposition],
    evidence: [],
  }))
}

function prescriptionContent() {
  return {
    kind: "PACE_TARGET" as const,
    manifestVersion: approval.manifestVersion,
    templateId: approval.templateId,
    templateVersion: approval.templateVersion,
    templateContentFingerprint: approval.templateContentFingerprint,
    notation: approval.notation,
    sourceDecisionId: approval.sourceDecisionId,
    sourceEvidenceRef: approval.sourceEvidenceRef,
    approvalDecisionId: approval.approvalDecisionId,
    ownerAuthorityDecisionId: approval.ownerDecision.authorityDecisionId,
    sportsScienceEvidence: {
      evidenceId: approval.sportsScienceEvidence.evidenceId,
      decisionRef: approval.sportsScienceEvidence.decisionRef,
      fingerprint: approval.sportsScienceEvidence.canonicalEvidenceFingerprint,
    },
    populationApplicabilityEvidence: {
      evidenceId: approval.populationApplicabilityEvidence.evidenceId,
      decisionRef: approval.populationApplicabilityEvidence.decisionRef,
      fingerprint: approval.populationApplicabilityEvidence.canonicalEvidenceFingerprint,
    },
    scope: {
      eventGroup: "FIVE_K" as const,
      experienceBand: "EXPERIENCED" as const,
      population: "YOUTH_AND_ADULT" as const,
      eventEvidenceFingerprint: approval.eventScopeEvidence.evidenceFingerprint,
      experienceEvidenceFingerprint: approval.experienceScopeEvidence.evidenceFingerprint,
    },
    componentRefs: approval.componentRefs,
    operationalComponents: approval.canonicalTemplateContent.operationalComponents,
    setCount: 1,
    repetitionsPerSet: 5,
    repetitionDistanceM: 1000,
    targetEventDistanceM: 5000,
    targetRepSeconds: 222,
    repetitionRecoverySeconds: 150,
    repetitionRecoveryMode: "JOG" as const,
    setRecoverySeconds: null,
    setRecoveryMode: "NOT_APPLICABLE" as const,
    totals: {
      totalRepetitions: 5,
      qualityDistanceM: 5000,
      qualityDurationSeconds: null,
      repetitionRecoveryOccurrences: 4,
      repetitionRecoveryTotalSeconds: 600,
      setRecoveryOccurrences: 0,
      setRecoveryTotalSeconds: 0,
      plannedRecoverySeconds: 600,
      mainSessionTotalExcludingWarmupCooldown: null,
      uncomputableReasonCodes: ["WORK_DURATION_UNAVAILABLE"],
    },
    selectedAnchor: {
      anchorId: "race:5000:current",
      kind: "RECENT_RESULT" as const,
      purpose: "CURRENT_CAPABILITY" as const,
      eventDistanceM: 5000,
      performanceSeconds: 1110,
      achievedAt: "2026-07-20",
      seasonId: null,
      enteredBy: "ATHLETE" as const,
      verificationState: "SELF_REPORTED" as const,
      freshnessState: "CURRENT" as const,
      sourceRef: "athlete-record:race:5000:2026-07-20",
      elapsedLabel: "CURRENT",
    },
    displayRoundingPolicyVersion: "seconds-v1",
    stopCodes: approval.canonicalTemplateContent.operationalComponents.stopConditions.codes,
    fallbackCode: "RPE_ONLY_CONTROLLED" as const,
  }
}

function detailedPrescription(overrides: Record<string, unknown> = {}) {
  const created = createStoredPaceTargetPrescription({ ...prescriptionContent(), ...overrides })
  if (created === null) throw new TypeError("Detailed prescription fixture is invalid")
  return created
}

function v1RestRpeState() {
  const legacy = stateFixture()
  return {
    ...legacy,
    activePlan: {
      ...legacy.activePlan,
      sessions: [
        ...legacy.activePlan.sessions,
        {
          day: 2,
          slot: "AM" as const,
          role: "REST" as const,
          plannedEnergyIntent: "RECOVERY_INTENT" as const,
          prescription: { kind: "REST" as const },
        },
      ],
    },
  }
}

function v2DetailedState() {
  const legacy = stateFixture()
  return {
    ...legacy,
    version: 2 as const,
    intake: { ...legacy.intake, experienceBand: "EXPERIENCED" as const },
    activePlan: {
      ...legacy.activePlan,
      selectedEnergyIntent: "VO2_INTENT" as const,
      sessions: [{
        day: 1,
        slot: "AM" as const,
        role: "QUALITY" as const,
        plannedEnergyIntent: "VO2_INTENT" as const,
        prescription: detailedPrescription(),
      }],
    },
  }
}

type MutableJsonObject = { [key: string]: unknown }

function isMutableJsonObject(value: unknown): value is MutableJsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

function requireJsonObject(value: unknown, label: string): MutableJsonObject {
  if (!isMutableJsonObject(value)) {
    throw new TypeError(`${label} must be an object`)
  }
  return value
}

function requireStoredPrescription(stored: unknown): MutableJsonObject {
  const root = requireJsonObject(stored, "stored state")
  const activePlan = requireJsonObject(root["activePlan"], "active plan")
  const sessions = activePlan["sessions"]
  if (!Array.isArray(sessions) || sessions.length === 0) {
    throw new TypeError("stored sessions must contain a mutation target")
  }
  const session = requireJsonObject(sessions[0], "stored session")
  return requireJsonObject(session["prescription"], "stored prescription")
}

function tamperPrescriptionFingerprint(stored: unknown): void {
  const prescription = requireStoredPrescription(stored)
  const fingerprint = prescription["prescriptionFingerprint"]
  if (typeof fingerprint !== "string") {
    throw new TypeError("prescription fingerprint mutation target is missing")
  }
  prescription["prescriptionFingerprint"] = `${fingerprint}-tampered`
}

function tamperComponentFingerprint(stored: unknown): void {
  const prescription = requireStoredPrescription(stored)
  const componentRefs = prescription["componentRefs"]
  if (!Array.isArray(componentRefs) || componentRefs.length === 0) {
    throw new TypeError("component fingerprint mutation target is missing")
  }
  const componentRef = requireJsonObject(componentRefs[0], "component reference")
  if (typeof componentRef["componentFingerprint"] !== "string") {
    throw new TypeError("component fingerprint mutation target is missing")
  }
  componentRef["componentFingerprint"] = `sha256:${"a".repeat(64)}`
}

function addUnknownField(
  stored: unknown,
  path: readonly string[],
  field: string,
): void {
  let target = requireJsonObject(stored, "stored state")
  for (const segment of path) {
    if (segment === "firstSession") {
      const sessions = target["sessions"]
      if (!Array.isArray(sessions) || sessions.length === 0) {
        throw new TypeError("session mutation target is missing")
      }
      target = requireJsonObject(sessions[0], "stored session")
      continue
    }
    target = requireJsonObject(target[segment], `${segment} mutation target`)
  }
  target[field] = "must-reject"
  if (!(field in target)) {
    throw new TypeError(`${field} mutation target was not created`)
  }
}

describe("versioned detailed prescription storage", () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  it("characterizes v1 REST/RPE load without byte mutation and migrates deterministically", () => {
    const legacy = v1RestRpeState()
    const raw = JSON.stringify(legacy)
    window.localStorage.setItem(STORAGE_KEY, raw)
    const first = loadPlanBetaState()
    const second = loadPlanBetaState()

    expect(first?.version).toBe(2)
    expect(first?.activePlan.sessions).toStrictEqual(legacy.activePlan.sessions)
    expect(second).toStrictEqual(first)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it("roundtrips a valid v2 detailed QUALITY prescription", () => {
    const state = v2DetailedState()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    expect(JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}").version).toBe(2)
    expect(loadVersionedPlanBetaState()).toStrictEqual(state)
  })

  it.each([
    ["prescription fingerprint", tamperPrescriptionFingerprint],
    ["component fingerprint", tamperComponentFingerprint],
  ])("rejects a tampered %s without deleting or repairing storage", (_name, mutate) => {
    const state = v2DetailedState()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}")
    const before = JSON.stringify(parsed)
    mutate(parsed)
    const tampered = JSON.stringify(parsed)
    expect(tampered).not.toBe(before)
    window.localStorage.setItem(STORAGE_KEY, tampered)

    expect(loadPlanBetaState()).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(tampered)
  })

  it("rejects malformed v2 without deleting its bytes", () => {
    const malformed = '{"version":2,"activePlan":{"kind":"BETA_ACTIVE_PLAN_SNAPSHOT"}}'
    window.localStorage.setItem(STORAGE_KEY, malformed)
    expect(loadPlanBetaState()).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(malformed)
  })

  it.each(["D9_ACTIVE", "D9_UNKNOWN"] as const)(
    "blocks START under %s without deleting the stored snapshot",
    (disposition) => {
      const state = v2DetailedState()
      expect(savePlanBetaState(state)).toEqual({ ok: true })
      const raw = window.localStorage.getItem(STORAGE_KEY)
      expect(recheckStoredDetailedPrescriptionAuthority({
        operation: "START",
        prescription: detailedPrescription(),
        evaluatedAt: "2026-08-17T03:00:00.000Z",
        safetyGate: safetyGate(disposition),
      })).toEqual({
        kind: "blocked",
        operation: "START",
        code: "CURRENT_SAFETY_GATE_BLOCKED",
      })
      expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw)
    },
  )

  it("blocks expired authority at START and revoked authority at RESTART without deletion", () => {
    const state = v2DetailedState()
    expect(savePlanBetaState(state)).toEqual({ ok: true })
    const raw = window.localStorage.getItem(STORAGE_KEY)

    expect(recheckStoredDetailedPrescriptionAuthority({
      operation: "START",
      prescription: detailedPrescription(),
      evaluatedAt: "2027-08-17T02:00:00.000Z",
      safetyGate: safetyGate("D9_CLEARED"),
    })).toMatchObject({ kind: "blocked", code: "TRUSTED_APPROVAL_UNAVAILABLE" })

    expect(recheckStoredDetailedPrescriptionAuthority({
      operation: "RESTART",
      prescription: detailedPrescription(),
      evaluatedAt: "2026-08-17T03:00:00.000Z",
      safetyGate: safetyGate("D9_CLEARED"),
    }, () => undefined)).toEqual({
      kind: "blocked",
      operation: "RESTART",
      code: "TRUSTED_APPROVAL_UNAVAILABLE",
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(raw)
  })

  it("permits CLEARED start only with exact current manifest identity", () => {
    expect(recheckStoredDetailedPrescriptionAuthority({
      operation: "START",
      prescription: detailedPrescription(),
      evaluatedAt: "2026-08-17T03:00:00.000Z",
      safetyGate: safetyGate("D9_CLEARED"),
    })).toEqual({ kind: "permitted", operation: "START" })

    const stale = detailedPrescription({ templateContentFingerprint: `sha256:${"b".repeat(64)}` })
    expect(recheckStoredDetailedPrescriptionAuthority({
      operation: "RESTART",
      prescription: stale,
      evaluatedAt: "2026-08-17T03:00:00.000Z",
      safetyGate: safetyGate("D9_CLEARED"),
    })).toMatchObject({ kind: "blocked", code: "TRUSTED_APPROVAL_UNAVAILABLE" })
  })

  it("fails closed on a stored raw narrative field", () => {
    expect(createStoredPaceTargetPrescription({
      ...prescriptionContent(),
      rawMemo: "must-not-persist",
    })).toBeNull()
  })

  it.each([
    ["root rawMemo", (stored: unknown) => addUnknownField(stored, [], "rawMemo")],
    ["intake symptomNarrative", (stored: unknown) => addUnknownField(stored, ["intake"], "symptomNarrative")],
    ["active-plan medicalNarrative", (stored: unknown) => addUnknownField(stored, ["activePlan"], "medicalNarrative")],
    ["frame coachNarrative", (stored: unknown) => addUnknownField(stored, ["activePlan", "frame"], "coachNarrative")],
    ["session guardianNarrative", (stored: unknown) => addUnknownField(stored, ["activePlan", "firstSession"], "guardianNarrative")],
    ["RPE prescription rawMemo", (stored: unknown) => addUnknownField(stored, ["activePlan", "firstSession", "prescription"], "rawMemo")],
    ["root benign extraKey", (stored: unknown) => addUnknownField(stored, [], "extraKey")],
  ])("rejects unknown %s atomically on save and load", (_name, mutate) => {
    const existing = v2DetailedState()
    expect(savePlanBetaState(existing)).toEqual({ ok: true })
    const existingRaw = window.localStorage.getItem(STORAGE_KEY)
    const candidate: unknown = JSON.parse(JSON.stringify(v1RestRpeState()))
    const before = JSON.stringify(candidate)
    mutate(candidate)
    const mutatedRaw = JSON.stringify(candidate)
    expect(mutatedRaw).not.toBe(before)

    expect(savePlanBetaState(candidate)).toEqual({
      ok: false,
      code: "PLAN_STORAGE_WRITE_FAILED",
    })
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(existingRaw)

    window.localStorage.setItem(STORAGE_KEY, mutatedRaw)
    expect(loadVersionedPlanBetaState()).toBeNull()
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(mutatedRaw)
  })
})
