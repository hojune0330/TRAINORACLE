import { expect, it } from "vitest"
import { METHOD_ADOPTION_PROTOCOLS } from "../../../reports/research/method-adoption-protocols.mjs"
import { previewMethodDurationFit } from "../../../reports/research/method-duration-fit-v3"

const protocol = (id: string) => structuredClone(METHOD_ADOPTION_PROTOCOLS.find(p => p.id === id)!)

it("counts all preparation and recovery, not just the twenty minute main", () => {
  const result = previewMethodDurationFit(protocol("P-LT-C"), "DEVELOPING")
  expect(result.exactSeconds).toBe(2960)
  expect(result.existingRangeSeconds).toEqual({ minimum: 1500, maximum: 2400 })
  expect(result.status).toBe("EXCEEDS_EXISTING_RANGE")
  expect(result.excessAtLeastSeconds).toBe(560)
  const experienced = previewMethodDurationFit(protocol("P-LT-C"), "EXPERIENCED")
  expect(experienced.status).toBe("WITHIN_EXISTING_RANGE")
  expect(experienced.wholePlanAdopted).toBe(false)
})

it("does not invent time for distance parts, but detects an already excessive lower bound", () => {
  const p = protocol("P-GLY-S")
  const unresolved = previewMethodDurationFit(p, "EXPERIENCED")
  expect(unresolved.exactSeconds).toBeNull()
  expect(unresolved.status).toBe("DURATION_UNRESOLVED")
  p.setRest!.value = 4000
  const excessive = previewMethodDurationFit(p, "EXPERIENCED")
  expect(excessive.status).toBe("EXCEEDS_EXISTING_RANGE")
  expect(excessive.exactSeconds).toBeNull()
  expect(excessive.excessAtLeastSeconds).toBeGreaterThan(0)
})

it("keeps rest not applicable and short sessions visible rather than padding them", () => {
  const rest = previewMethodDurationFit(protocol("P-OFF"), "NEW_TO_RUNNING")
  expect(rest.status).toBe("NOT_APPLICABLE")
  expect(rest.exactSeconds).toBeNull()
  const base = previewMethodDurationFit(protocol("P-BASE-C"), "EXPERIENCED")
  expect(base.status).toBe("BELOW_EXISTING_RANGE")
  expect(base.exactSeconds).toBe(1800)
  expect(base.executionAuthority).toBe("NONE")
})
