import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"
import type { PaceTargetPlanPrescription } from "@impl/plan-generator/session-types"
import manifest from "./detailed-prescription-manifest.json"
import { TRAINING_TEMPLATE_EXPLANATIONS, templateExplanation } from "./training-template-explanations"

describe("existing template-specific explanation boundaries", () => {
  it("covers the four existing exact adoptions without changing their authority", () => {
    expect(TRAINING_TEMPLATE_EXPLANATIONS).toHaveLength(4)
    expect(TRAINING_TEMPLATE_EXPLANATIONS.map((entry) => entry.identity.templateId).sort()).toEqual(manifest.approvals.map((entry) => entry.templateId).sort())
    for (const entry of TRAINING_TEMPLATE_EXPLANATIONS) {
      const approved = manifest.approvals.find((item) => item.templateId === entry.identity.templateId)!
      expect(entry.identity.templateContentFingerprint).toBe(approved.templateContentFingerprint)
      expect(entry.identity.templateVersion).toBe(approved.templateVersion)
      for (const path of [entry.decisionPath, entry.sourceRecordPath]) {
        expect(readFileSync(resolve(process.cwd(), "..", path), "utf8")).toContain(entry.identity.templateId)
      }
      expect(entry.limitation).toMatch(/아니|않/u)
    }
  })

  it.each(TRAINING_TEMPLATE_EXPLANATIONS)("does not reuse $identity.templateId prose for a changed composition", (entry) => {
    const fixture = entry.identity as PaceTargetPlanPrescription
    expect(templateExplanation(fixture)).toBe(entry)
    for (const [key, value] of Object.entries(entry.identity)) {
      const changed = typeof value === "number" ? value + 1 : value === null ? 1 : `${value}-changed`
      expect(templateExplanation({ ...fixture, [key]: changed }), key).toBeNull()
    }
    expect(templateExplanation({ ...fixture, targetRepSeconds: 121.517 })).toBe(entry)
  })

  it("keeps the single-pattern 1500m MIX session honest", () => {
    const mixed = TRAINING_TEMPLATE_EXPLANATIONS.find((entry) => entry.identity.templateId === "MD-1500-01")!
    expect(mixed.work).toContain("동일한 500m 반복뿐")
    expect(mixed.work).toContain("서로 다른 구간을 섞었다는 뜻이 아니")
    expect(mixed.limitation).toContain("구간별 에너지 비율")
  })
})
