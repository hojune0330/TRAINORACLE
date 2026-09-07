import { expect, it } from "vitest"
import { compareMainMethodsV3, sequenceV3ContentIdentity } from "./sequence-v3-comparison"
import type { PrescriptionSequenceV3, SequenceNodeV3, RecoveryStepV3 } from "./sequence-v3"
const node = (id: string, role: "WORK" | "BUILDUP" = "WORK"): SequenceNodeV3 => ({
  id, kind: "segment", label: null, repeatCount: 2, role,
  work: { kind: "distance", distanceM: 200, durationSeconds: null },
  target: { kind: "RACE_PACE", eventDistanceM: 800, anchorRef: "record-a" },
  recoveryBetweenRepeats: [{ mode: "WALK_OR_STAND", seconds: 120 }], recoveryAfter: [],
})
const root = (main: readonly SequenceNodeV3[] = [node("work")]): PrescriptionSequenceV3 => ({
  kind: "PRESCRIPTION_SEQUENCE", version: 3, id: "root", label: null, warmup: [], main, cooldown: [],
})
it("count-only and label/reference-only changes are not new MAIN methods", () => {
  const a = root()
  const b = { ...a, id: "new-id", label: "different name", main: [{ ...node("renamed"), repeatCount: 6,
    target: { kind: "RACE_PACE" as const, eventDistanceM: 800, anchorRef: "record-b" } }] }
  expect(compareMainMethodsV3(a, b)).toMatchObject({ kind: "same", requiresReview: false, executionAuthority: "NONE" })
  expect(sequenceV3ContentIdentity(a)).not.toBe(sequenceV3ContentIdentity(b))
})
it("changed support does not create a different MAIN but changes full identity", () => {
  const a = root(), b = { ...a, warmup: [node("warm")] }
  expect(compareMainMethodsV3(a, b).kind).toBe("same")
  expect(sequenceV3ContentIdentity(a)).not.toBe(sequenceV3ContentIdentity(b))
})
it("ordered recoveries, including terminal recovery, are substantive differences", () => {
  const steps: RecoveryStepV3[] = [{ mode: "ACTIVE_ROLL_ON", seconds: null, distanceM: 100 }, { mode: "JOG", seconds: 120 }]
  const a = root([{ ...node("work"), recoveryAfter: steps }])
  const b = root([{ ...node("work"), recoveryAfter: [...steps].reverse() }])
  expect(compareMainMethodsV3(a, b).differences).toContain("RECOVERY_ORDER_OR_VALUE")
  expect(sequenceV3ContentIdentity(a)).not.toBe(sequenceV3ContentIdentity(b))
})
it("role and unit changes are visible, not a claim of equal dose or effect", () => {
  expect(compareMainMethodsV3(root(), root([node("work", "BUILDUP")])).differences).toContain("SEGMENT_ROLE")
  const timed: SequenceNodeV3 = { ...node("work"), kind: "segment", role: "WORK",
    work: { kind: "duration", distanceM: null, durationSeconds: 60 },
    target: { kind: "EFFORT_GUIDANCE", cue: "hard" } }
  expect(compareMainMethodsV3(root(), root([timed])).differences).toEqual(["WORK", "TARGET"])
})
it("empty unary wrappers cannot manufacture a second method", () => {
  const wrapper: SequenceNodeV3 = { kind: "group", id: "wrapper", label: null, repeatCount: 1,
    repeatUnit: "SEQUENCE", recoveryBetweenRepeats: [], recoveryAfter: [], children: [node("work")] }
  expect(compareMainMethodsV3(root(), root([wrapper])).kind).toBe("same")
})
it("strict input validation precedes comparison and identity", () => {
  expect(() => compareMainMethodsV3(root(), { ...root(), version: 2 })).toThrow("INVALID_SEQUENCE_V3")
  expect(() => sequenceV3ContentIdentity({ ...root(), authority: "APPROVED" })).toThrow("INVALID_SEQUENCE_V3")
  expect(sequenceV3ContentIdentity(JSON.parse(JSON.stringify(root())))).toBe(sequenceV3ContentIdentity(root()))
})
