import { describe, expect, it } from "vitest"
import { auditPrescriptionCatalog, mainGeometry } from "../../../reports/research/prescription-catalog-audit"
import { buildPurposeSupplyCatalog } from "../../../reports/research/method-purpose-supply-v3"
describe("cross-catalog geometry audit", () => {
  it("flags identical main geometry without deleting scope-specific source records", () => {
    const report = auditPrescriptionCatalog()
    expect(report.recordCount).toBe(117)
    expect(report.distinctMainGeometriesWithinPurpose).toBeLessThan(report.recordCount)
    expect(report.overlappingGroups.some(ids => ids.includes("P-INTRO-ATP-A") && ids.includes("P-ATP-A-4"))).toBe(true)
    expect(report.originalRecordsRemoved).toBe(0)
    expect(report.runtimeActivationsGrantedByAudit).toBe(0)
    expect(report.terrainReviewIds.length).toBeGreaterThan(0)
  })
  it("ignores labels but never ignores changed dose or recovery", () => {
    const source = buildPurposeSupplyCatalog().find(card => card.id === "P-ATP-A-4")!.sequence!
    const renamed = { ...source, id: "renamed", label: "different title" }
    expect(mainGeometry(renamed)).toEqual(mainGeometry(source))
    const changed = { ...source, main: source.main.map((node, index) => index === 0 ? { ...node, repeatCount: node.repeatCount + 1 } : node) }
    expect(mainGeometry(changed)).not.toEqual(mainGeometry(source))
    expect(() => mainGeometry({})).toThrow("INVALID_AUDIT_SEQUENCE")
  })
})
