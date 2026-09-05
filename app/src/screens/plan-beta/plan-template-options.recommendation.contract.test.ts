import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MethodHistoryEntry } from "@impl/prescription/method-recommendation"
import { resolveDetailedPlanTemplateOptions } from "./plan-template-options"
import * as registry from "../../domain/plan-method-registry"

// Synthetic applicability and family identities are confined to this test module.
// The production allowlist and runtime authority are never extended.
vi.mock("../../domain/detailed-prescription-approvals", async importOriginal => {
  const actual = await importOriginal<typeof import("../../domain/detailed-prescription-approvals")>()
  return { ...actual, DETAILED_PRESCRIPTION_APPROVALS: actual.DETAILED_PRESCRIPTION_APPROVALS.slice(0, 2).map(row => ({ ...row, targetEventDistanceM: 5000 })) }
})
vi.mock("../../domain/detailed-prescription-runtime-authority", async () => {
  const { DETAILED_PRESCRIPTION_APPROVALS } = await import("../../domain/detailed-prescription-approvals")
  return { resolveDetailedPrescriptionRuntimeAuthority: ({ selectedTemplateRef }: { selectedTemplateRef: { templateId: string } }) => ({
    kind: "authorized", approval: DETAILED_PRESCRIPTION_APPROVALS.find(row => row.templateId === selectedTemplateRef.templateId),
  }) }
})

const draft = { eventDistanceM: 5000, trainingFocus: "VO2_INTENT", experienceBand: "EXPERIENCED" } as const
const now = "2026-09-05T01:00:00.000Z"
const first = { familyId: "test-family-first", configurationId: "V2-SEED-05", version: "1.0.0" }
const history: readonly MethodHistoryEntry[] = [{ selected: first, performed: { status: "PERFORMED", method: first } }]

beforeEach(() => {
  vi.spyOn(registry, "resolvePlanMethodMapping").mockImplementation(ref => ({
    mappingVersion: "1.0.0", templateRef: ref,
    method: { familyId: ref.templateId === "V2-SEED-05" ? first.familyId : "test-family-second", configurationId: ref.templateId, version: ref.version },
  }))
})

describe("bounded recommendation order", () => {
  it("defaults to neutral catalog order despite history and nonlexical IDs", () => {
    const result = resolveDetailedPlanTemplateOptions(draft, now, history)
    expect(result.map(option => option.ref.templateId)).toEqual(["V2-SEED-05", "MD-800-01"])
    expect(result.map(option => option.observedPerformedCount)).toEqual([1, 0])
    expect(result).toEqual(resolveDetailedPlanTemplateOptions(draft, now, history, "NEUTRAL"))
    expect(result[0]?.recommendationReason).toContain("우열을 뜻하지 않아요")
  })

  it("changes order only for explicit variety or repeat preference", () => {
    const before = JSON.stringify({ draft, history })
    expect(resolveDetailedPlanTemplateOptions(draft, now, history, "PREFER_VARIETY").map(option => option.ref.templateId))
      .toEqual(["MD-800-01", "V2-SEED-05"])
    expect(resolveDetailedPlanTemplateOptions(draft, now, history, "PREFER_REPEAT").map(option => option.ref.templateId))
      .toEqual(["V2-SEED-05", "MD-800-01"])
    expect(JSON.stringify({ draft, history })).toBe(before)
  })

  it("groups configurations sharing a mapped family without a duplicate catalog rejection", () => {
    vi.mocked(registry.resolvePlanMethodMapping).mockImplementation(ref => ({
      mappingVersion: "1.0.0", templateRef: ref,
      method: { familyId: first.familyId, configurationId: ref.templateId, version: ref.version },
    }))
    expect(resolveDetailedPlanTemplateOptions(draft, now, history).map(option => option.ref.templateId))
      .toEqual(["V2-SEED-05", "MD-800-01"])
  })

  it("excludes unknown mappings even when the authority fixture accepts them", () => {
    vi.mocked(registry.resolvePlanMethodMapping).mockReturnValue(null)
    expect(resolveDetailedPlanTemplateOptions(draft, now, history)).toEqual([])
  })
})
