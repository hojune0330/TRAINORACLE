import { describe, expect, it } from "vitest"
import { DETAILED_PRESCRIPTION_APPROVALS } from "./detailed-prescription-approvals"
import { PLAN_METHOD_MAPPING_VERSION, PLAN_METHOD_REGISTRY, resolvePlanMethodMapping } from "./plan-method-registry"

describe("exact plan method identity crosswalk", () => {
  it("maps only the four approved exact refs to stable family and independent configurations", () => {
    expect(PLAN_METHOD_MAPPING_VERSION).toBe("1.0.0")
    expect(PLAN_METHOD_REGISTRY.map(row => row.templateRef.templateId)).toEqual([
      "V2-SEED-05", "MD-800-01", "MD-1500-01", "MD-3000-01",
    ])
    for (const approval of DETAILED_PRESCRIPTION_APPROVALS) {
      const ref = { templateId: approval.templateId, version: approval.templateVersion, fingerprint: approval.templateContentFingerprint }
      expect(resolvePlanMethodMapping(ref)).toEqual({
        mappingVersion: "1.0.0", templateRef: ref,
        method: { familyId: "race-pace-distance-repetitions", configurationId: ref.templateId, version: ref.version },
      })
    }
    expect(new Set(PLAN_METHOD_REGISTRY.map(row => row.method.familyId)).size).toBe(1)
  })

  it.each([
    { templateId: "UNKNOWN" },
    { version: "1.0.1" },
    { fingerprint: `sha256:${"0".repeat(64)}` },
  ])("does not fabricate a family for mismatched identity %j", (change) => {
    expect(resolvePlanMethodMapping({ ...PLAN_METHOD_REGISTRY[0]!.templateRef, ...change })).toBeNull()
  })
})
