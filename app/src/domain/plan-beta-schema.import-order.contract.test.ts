import { webcrypto } from "node:crypto"
import { afterEach, describe, expect, it, vi } from "vitest"

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  localStorage.clear()
  sessionStorage.clear()
  vi.resetModules()
})

describe("plan schema production import order", () => {
  it("validates pace anchor IDs after athlete-records is imported first", async () => {
    vi.resetModules()
    localStorage.clear()
    sessionStorage.clear()
    vi.useFakeTimers({ toFake: ["Date"] })
    const now = new Date("2026-10-02T03:00:00.000Z")
    vi.setSystemTime(now)
    vi.stubGlobal("crypto", webcrypto)

    // Do not statically import application helpers above this point. Starting
    // with the record store traverses ownership -> canonical storage -> journal
    // schema -> plan schema before the athlete record ID schema is initialized.
    const records = await import("./athlete-records")
    const { planAdaptationCandidateSchema } = await import("./plan-beta-schema")

    for (const id of ["schema-order-goal-5000", "track:2026.10_01", "a"]) {
      expect(records.athleteRecordIdSchema.safeParse(id).success).toBe(true)
    }
    for (const id of ["", "record id", "/record", "private-note-record", "a".repeat(129)]) {
      expect(records.athleteRecordIdSchema.safeParse(id).success).toBe(false)
    }

    const { initializeCanonicalJournalStorage } = await import("./canonical-journal-storage")
    expect(await initializeCanonicalJournalStorage(localStorage, sessionStorage, operation => operation()))
      .toEqual({ status: "ready" })
    const { DETAILED_PRESCRIPTION_APPROVALS } = await import("./detailed-prescription-approvals")
    const { generatePlanFromDraft } = await import("./plan-beta-flow")
    const { createStoredPaceTargetPrescription } = await import("./plan-session-schema")
    const approval = DETAILED_PRESCRIPTION_APPROVALS.find(item => item.templateId === "V2-SEED-05")
    if (!approval) throw new Error("IMPORT_ORDER_FIXTURE_MISSING_APPROVAL")
    const goal = records.createSelfReportedAthleteRecord({
      id: "schema-order-goal-5000", purpose: "RACE_GOAL", eventDistanceM: 5000,
      performanceSeconds: 1200, achievedOn: null, seasonId: null,
    }, now)
    if (!goal) throw new Error("IMPORT_ORDER_FIXTURE_INVALID_RECORD")
    expect(records.saveAthleteRecord(goal, now).ok).toBe(true)
    const generated = generatePlanFromDraft({
      eventGroup: "FIVE_K", eventDistanceM: 5000, competitionDivision: "OPEN",
      experienceBand: "EXPERIENCED", availableDayCount: 4, requestedFrameLength: 9,
      trainingFocus: "VO2_INTENT", secondSessionMode: "SINGLE_SESSION_ONLY",
      trainingTimePreference: "VARIES", startDate: "2026-10-02",
      selectedDetailedTemplateRef: {
        templateId: approval.templateId, version: approval.templateVersion,
        fingerprint: approval.templateContentFingerprint,
      },
    }, "NO_KNOWN_RISK", { selectedRecordId: goal.id })
    if (generated.kind !== "generated") throw new Error(`IMPORT_ORDER_FIXTURE_${generated.kind}`)
    const candidate = generated.generated.candidates[0]!
    const index = candidate.sessions.findIndex(session => session.prescription.kind === "PACE_TARGET")
    expect(index).toBeGreaterThanOrEqual(0)
    const prescription = candidate.sessions[index]?.prescription
    if (prescription?.kind !== "PACE_TARGET") throw new Error("IMPORT_ORDER_FIXTURE_MISSING_PACE_TARGET")
    expect(prescription.selectedAnchor.anchorId).toBe(goal.id)

    // This reaches the plan schema's imported ID validator, not merely the
    // record store's own validator. A captured undefined alias throws here.
    expect(planAdaptationCandidateSchema.safeParse(candidate).success).toBe(true)

    const { prescriptionFingerprint: _fingerprint, ...content } = prescription
    const invalidId = "private-note-record"
    const invalidPrescription = createStoredPaceTargetPrescription({
      ...content,
      selectedAnchor: {
        ...prescription.selectedAnchor, anchorId: invalidId, sourceRef: `athlete-record:${invalidId}`,
      },
    })
    // The production builder rejects this anchor before a candidate exists.
    // Do not bypass that guard merely to reach another schema rejection path.
    expect(invalidPrescription).toBeNull()
  })
})
