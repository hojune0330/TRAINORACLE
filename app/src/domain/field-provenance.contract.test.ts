import { describe, expect, it } from "vitest"
import {
  FIELD_PROVENANCE,
  isEligibleForAnalysis,
} from "./field-provenance"

describe("field provenance eligibility", () => {
  it("accepts an explicitly entered field and rejects absent provenance", () => {
    // Given
    const provenance = {
      rpe: { provenance: FIELD_PROVENANCE.explicit },
    } as const

    // When / Then
    expect(isEligibleForAnalysis("rpe", provenance)).toBe(true)
    expect(isEligibleForAnalysis("distanceKm", provenance)).toBe(false)
  })

  it("rejects missing, unknown-rule, nested, and incomplete derived values", () => {
    // Given
    const provenance = {
      missing: { provenance: FIELD_PROVENANCE.missing },
      explicitInput: { provenance: FIELD_PROVENANCE.explicit },
      nestedDerived: {
        provenance: FIELD_PROVENANCE.derived,
        derivedFrom: ["explicitInput"],
        derivationRuleId: "UNREGISTERED",
      },
      incompleteDerived: {
        provenance: FIELD_PROVENANCE.derived,
        derivedFrom: ["missing"],
        derivationRuleId: "UNREGISTERED",
      },
    } as const

    // When / Then
    expect(isEligibleForAnalysis("missing", provenance)).toBe(false)
    expect(isEligibleForAnalysis("nestedDerived", provenance)).toBe(false)
    expect(isEligibleForAnalysis("incompleteDerived", provenance)).toBe(false)
  })
})
