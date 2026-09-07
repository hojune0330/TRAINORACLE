import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { adjustedPlanSelectionV3Fixture } from "./adjusted-plan-selection-v3.test-fixtures"
import { prepareMultiAdjustedPlanCandidateV3 } from "./adjusted-plan-multi-candidate-v3"
import * as single from "./adjusted-plan-candidate"
import { setActiveLocalAccount } from "./account/local-journal-ownership"
import { TODAY } from "./prescription-quality-matrix.test-fixtures"

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); setActiveLocalAccount(null); vi.useFakeTimers(); vi.setSystemTime(TODAY) })
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers() })

it("preserves a genuinely validated slot without writing or granting selection authority", () => {
  const input = adjustedPlanSelectionV3Fixture().request.preparation
  const write = vi.spyOn(Storage.prototype, "setItem"), before = JSON.stringify(input)
  const result = prepareMultiAdjustedPlanCandidateV3([input])
  if (result.kind !== "prepared") throw Error(result.code)
  expect(result.candidate.changedSlots).toHaveLength(1)
  expect(result.candidate).toMatchObject({ activationState: "NOT_ACCEPTED", selectionAuthority: "NONE",
    requiredNextGate: "MULTI_FULL_PLAN_SELECTION_REVALIDATION" })
  expect(JSON.stringify(input)).toBe(before)
  expect(write).not.toHaveBeenCalled()
})

it("rejects duplicate slots, expiry, and unsupported RPE slots without a partial candidate", () => {
  const input = adjustedPlanSelectionV3Fixture().request.preparation
  const other = input.candidate.sessions.find(s => s.role === "QUALITY" && s.prescription.kind === "RPE_TIME_RANGE")!
  expect(other).toBeDefined()
  expect(prepareMultiAdjustedPlanCandidateV3([input, input])).toMatchObject({ kind: "unavailable", code: "DUPLICATE_ADJUSTED_SLOT" })
  expect(prepareMultiAdjustedPlanCandidateV3([input, { ...input, address: { day: other.day, slot: other.slot } }]))
    .toMatchObject({ kind: "unavailable", code: "ORIGINAL_CANDIDATE_OR_SLOT_UNAVAILABLE" })
  expect(prepareMultiAdjustedPlanCandidateV3([{ ...input, source: { ...input.source, nowMs: TODAY.getTime() + 100 } }]).kind).toBe("unavailable")
  expect(prepareMultiAdjustedPlanCandidateV3([]).kind).toBe("unavailable")
})

it("orchestrates two independently validated results in stable address order (isolated boundary test)", () => {
  const input = adjustedPlanSelectionV3Fixture().request.preparation
  const validated = single.prepareAdjustedPlanCandidateV3(input)
  if (validated.kind !== "prepared") throw Error(validated.code)
  const second = input.candidate.sessions.find(s => s.role === "QUALITY" && s.prescription.kind === "RPE_TIME_RANGE")!
  const address = { day: second.day, slot: second.slot }, secondInput = { ...input, address }
  const changed = validated.candidate.sessions.find(s => s.prescription.kind === "ADJUSTED_METHOD_V3")!
  // Assembly only: not evidence of RPE resolution or operating multi-slot approval.
  vi.spyOn(single, "prepareAdjustedPlanCandidateV3").mockImplementation(value => value.address.day === input.address.day
    && value.address.slot === input.address.slot ? validated : { kind: "prepared", candidate: {
      ...validated.candidate, changedSlot: { ...validated.candidate.changedSlot, ...address },
      sessions: input.candidate.sessions.map(s => s === second ? { ...changed, ...address } : s),
    } })
  const result = prepareMultiAdjustedPlanCandidateV3([input, secondInput])
  if (result.kind !== "prepared") throw Error(result.code)
  expect(result.candidate.changedSlots).toHaveLength(2)
  expect(result.candidate.sessions.filter(s => s.prescription.kind === "ADJUSTED_METHOD_V3")).toHaveLength(2)
  expect(prepareMultiAdjustedPlanCandidateV3([secondInput, input])).toEqual(result)
  for (const original of input.candidate.sessions) {
    if ([input.address, address].some(a => a.day === original.day && a.slot === original.slot)) continue
    expect(result.candidate.sessions.find(s => s.day === original.day && s.slot === original.slot)).toEqual(original)
  }
})
