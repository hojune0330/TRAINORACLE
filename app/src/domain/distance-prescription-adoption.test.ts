import { createHash } from "node:crypto"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
// Exercise a proposed adoption without granting production authority in this test.
vi.mock("./distance-prescription-adoption.json", async importOriginal => {
  const original = await importOriginal<{ default: typeof import("./distance-prescription-adoption.json") }>()
  return { default: { ...original.default, status: "OWNER_ADOPTED" } }
})
import { DISTANCE_ADOPTION, distancePrescriptionFits } from "./distance-prescription-adoption"
import { parseDetailedPrescriptionManifest } from "./detailed-prescription-approvals"
import { resolveDetailedPrescriptionRuntimeAuthority } from "./detailed-prescription-runtime-authority"
import { resolveDetailedPlanTemplateOptions } from "../screens/plan-beta/plan-template-options"
import { templateExplanation } from "./training-template-explanations"
import { REPETITION_TEST_NOW, repetitionFixture } from "./planned-repetition.test-fixture"
import { generatePlanFromDraft } from "./plan-beta-flow"
import { readFileSync } from "node:fs"

beforeEach(() => { localStorage.clear(); vi.useFakeTimers(); vi.setSystemTime(REPETITION_TEST_NOW) })
afterEach(() => vi.useRealTimers())
const expected = [
  ["RP5K-800-05", 800, 5, 1, 4000, 480],
  ["RP5K-400-08", 400, 8, 1, 3200, 630],
  ["RP5K-800-SPLIT", 800, 3, 2, 4800, 720],
  ["RP5K-1000-REST", 1000, 4, 1, 4000, 540],
] as const
describe("exact reviewed distance connection", () => {
  it("keeps the shipped artifact pending until an explicit adoption, with reproducible packet identity", () => {
    const source = JSON.parse(readFileSync("src/domain/distance-prescription-adoption.json", "utf8"))
    expect(["PREPARED_AWAITING_OWNER_DECISION", "OWNER_ADOPTED"]).toContain(source.status)
    expect(DISTANCE_ADOPTION.packetFingerprint).toBe(`sha256:${createHash("sha256").update(JSON.stringify(DISTANCE_ADOPTION.packet)).digest("hex")}`)
    expect(parseDetailedPrescriptionManifest(DISTANCE_ADOPTION.manifest)?.approvals).toHaveLength(4)
    expect(new Set(DISTANCE_ADOPTION.records.map(item => item.templateRef.fingerprint)).size).toBe(4)
    expect(new Set(DISTANCE_ADOPTION.records.map(item => item.method.familyId)).size).toBe(2)
  })
  it.each(expected)("binds %s into a replacement MAIN with exact pace/recovery and explanation", (id, distance, repetitions, sets, metres, recovery) => {
    const f = repetitionFixture(id)
    expect(f.prescription.targetRepSeconds).toBeCloseTo(1111.5 * distance / 5000, 10)
    expect(f.prescription).toMatchObject({ repetitionsPerSet: repetitions, setCount: sets, repetitionDistanceM: distance,
      totals: { qualityDistanceM: metres, plannedRecoverySeconds: recovery } })
    expect(f.result.generated.candidates.every(candidate => candidate.sessions.filter(item => item.prescription.kind === "PACE_TARGET").length === 1)).toBe(true)
    expect(templateExplanation(f.prescription)?.work).toBeTruthy()
    expect(templateExplanation({ ...f.prescription, repetitionRecoverySeconds: 1 })).toBeNull()
    expect(resolveDetailedPrescriptionRuntimeAuthority({ selectedTemplateRef: DISTANCE_ADOPTION.records.find(item => item.templateRef.templateId === id)!.templateRef,
      targetEventDistanceM: 5000, selectedEnergyIntent: "VO2_INTENT", evaluatedAt: REPETITION_TEST_NOW.toISOString() }).kind).toBe("authorized")
  })
  it("filters by actual same-event anchor, duration and full session time without using a goal", () => {
    const f = repetitionFixture(), intake = f.result.intake, at = REPETITION_TEST_NOW.toISOString()
    expect(resolveDetailedPlanTemplateOptions(intake, at, []).map(item => item.ref.templateId)).toEqual(["V2-SEED-05"])
    expect(resolveDetailedPlanTemplateOptions(intake, at, [], "NEUTRAL", { anchor: f.record })).toHaveLength(5)
    expect(resolveDetailedPlanTemplateOptions(intake, at, [], "NEUTRAL", { anchor: { ...f.record, purpose: "RACE_GOAL", achievedOn: null, seasonId: null } })).toHaveLength(1)
    expect(resolveDetailedPlanTemplateOptions(intake, at, [], "NEUTRAL", { anchor: f.record, availableMinutes: 20 })).toHaveLength(1)
    const ref = DISTANCE_ADOPTION.records[0]!.templateRef
    for (const seconds of [NaN, Infinity, 0, 59.9, 300.1]) expect(distancePrescriptionFits(ref, seconds, 4000, 2000)).toBe(false)
    expect(distancePrescriptionFits(ref, 200, 8000, 2000)).toBe(false)
  })
  it("fails closed on out-of-window personal pace at the actual binding boundary", () => {
    const f = repetitionFixture("V2-SEED-05", 1801)
    const result = generatePlanFromDraft({ ...f.result.intake, selectedDetailedTemplateRef: DISTANCE_ADOPTION.records[3]!.templateRef }, "NO_KNOWN_RISK", { selectedRecordId: f.record.id })
    expect(result.kind === "generated" && result.prescriptionBinding).toEqual({ kind: "fallback", code: "PACE_TARGET_FALLBACK_PARAMETER_SCOPE" })
  })
  it.each(["LT_INTENT", "GLY_INTENT", "ATP_PC_INTENT"] as const)("does not reuse the dose as %s", intent => {
    expect(resolveDetailedPrescriptionRuntimeAuthority({ selectedTemplateRef: DISTANCE_ADOPTION.records[0]!.templateRef,
      targetEventDistanceM: 5000, selectedEnergyIntent: intent, evaluatedAt: REPETITION_TEST_NOW.toISOString() }).kind).toBe("fallback")
  })
})
