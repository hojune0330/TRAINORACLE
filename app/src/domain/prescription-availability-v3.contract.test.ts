import { expect, it } from "vitest"
import { checkSessionAvailabilityV3, exactSessionSecondsV3 } from "./prescription-availability-v3"
import { unanchoredAdjustmentFixtureV3 } from "./unanchored-adjustment-v3.test-fixtures"
import { readOwnerAdoptedSupportV3 } from "./owner-adopted-support-v3"

function session() {
  return { day: 1, slot: "AM", prescription: { kind: "ADJUSTED_METHOD_V3",
    projection: { sequence: structuredClone(unanchoredAdjustmentFixtureV3().authority.catalog[0]!.configurations[0]!.sequence) } } }
}
it("counts all work and recovery, with an inclusive explicit limit and no default limit", () => {
  const s = session()
  expect(exactSessionSecondsV3(s)).toBe(140)
  expect(checkSessionAvailabilityV3([s], undefined).kind).toBe("checked")
  expect(checkSessionAvailabilityV3([s], [{ day: 1, slot: "AM", maximumSeconds: 140 }]).kind).toBe("checked")
  expect(checkSessionAvailabilityV3([s], [{ day: 1, slot: "AM", maximumSeconds: 139.99 }])).toMatchObject({ code: "AVAILABILITY_LIMIT_EXCEEDED" })
  const node = s.prescription.projection.sequence.main[0]!
  s.prescription.projection.sequence = { ...s.prescription.projection.sequence,
    warmup: [{ ...node, id: "warmup", repeatCount: 1, recoveryBetweenRepeats: [] }],
    cooldown: [{ ...node, id: "cooldown", repeatCount: 1, recoveryBetweenRepeats: [] }] }
  expect(exactSessionSecondsV3(s)).toBe(220)
})
it.each([0, -1, NaN, Infinity, "140", null])("rejects invalid explicit limits: %s", maximumSeconds => {
  expect(checkSessionAvailabilityV3([session()], [{ day: 1, slot: "AM", maximumSeconds }])).toMatchObject({ code: "INVALID_AVAILABILITY_LIMIT" })
})
it("rejects duplicate, missing and extra-field constraints instead of dropping them", () => {
  const limit = { day: 1, slot: "AM", maximumSeconds: 140 }
  expect(checkSessionAvailabilityV3([session()], [limit, limit]).kind).toBe("rejected")
  expect(checkSessionAvailabilityV3([session()], [{ ...limit, slot: "PM" }])).toMatchObject({ code: "INVALID_AVAILABILITY_SLOT" })
  expect(checkSessionAvailabilityV3([session()], [{ ...limit, memo: "NOT_ALLOWED" }]).kind).toBe("rejected")
})
it("does not turn estimated or unknown duration into time-limit compliance", () => {
  const s = session(), node = s.prescription.projection.sequence.main[0]!
  if (node.kind !== "segment") throw Error("Fixture changed")
  s.prescription.projection.sequence = { ...s.prescription.projection.sequence,
    main: [{ ...node, work: { kind: "distance", distanceM: 400, durationSeconds: null } }] }
  expect(exactSessionSecondsV3(s)).toBeNull()
  expect(checkSessionAvailabilityV3([s], [{ day: 1, slot: "AM", maximumSeconds: 3600 }])).toMatchObject({ code: "AVAILABILITY_DURATION_UNRESOLVED" })
  expect(checkSessionAvailabilityV3([{ day: 1, slot: "AM", prescription: { kind: "RPE_TIME_RANGE" } }], [{ day: 1, slot: "AM", maximumSeconds: 3600 }])).toMatchObject({ code: "AVAILABILITY_DURATION_UNRESOLVED" })
  expect(checkSessionAvailabilityV3([s], []).kind).toBe("checked")
})
it("retains the exact owner-adopted 760s component without granting MAIN or expert authority", () => {
  const support = readOwnerAdoptedSupportV3("P-SUPPORT-INTRO-01", "0.1")!
  expect([...support.warmup, ...support.cooldown].map(part => part.value)).toEqual([300, 20, 60, 20, 60, 300])
  expect([...support.warmup, ...support.cooldown].reduce((sum, part) => sum + part.value, 0)).toBe(760)
  expect(support).toMatchObject({ status: "OWNER_ADOPTED_COMPONENT_ONLY", executionAuthority: "NONE", independentExpertApproval: false,
    selectionMode: "USER_EXPLICIT", scope: "INTRODUCTION_REVIEWED_MAIN_AND_FULL_PLAN_REQUIRED" })
  expect(support.warmup.filter(part => part.role === "BUILDUP").every(part => part.cue === "PROGRESSIVE_NOT_ALL_OUT")).toBe(true)
  expect(readOwnerAdoptedSupportV3("P-SUPPORT-INTRO-01", "0.2")).toBeNull()
  expect(readOwnerAdoptedSupportV3("OTHER", "0.1")).toBeNull()
  expect(readOwnerAdoptedSupportV3("P-SUPPORT-INTRO-01", "0.1")).not.toBe(support)
})
