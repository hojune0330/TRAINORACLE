import { describe, expect, it } from "vitest"
import type { InstantPlanEntry } from "../instant-plan-contract"
import {
  CREATOR_PROGRAM_REGISTRY,
  creatorProgramVersionSchema,
  evaluateCreatorProgram,
  evaluateExistingCreatorCopy,
  getCreatorProgram,
  getCreatorProgramSupplyStatus,
} from "./index"
import { creatorProgramFixture } from "./creator-program.test-fixtures"

const current: InstantPlanEntry = {
  kind: "CURRENT_RECORD", eventDistanceM: 5000, performanceSeconds: 1500, achievedOn: "2026-09-19",
}
const goal: InstantPlanEntry = { kind: "GOAL_ONLY", eventDistanceM: 5000, performanceSeconds: 1320 }
const noRecord: InstantPlanEntry = { kind: "NO_RECORD", eventDistanceM: 5000 }

describe("creator public source metadata boundary", () => {
  it.each([current, goal, noRecord])("accepts explicitly reviewed $kind metadata without prescribing", entry => {
    const program = creatorProgramFixture()
    const before = JSON.stringify(program)
    expect(evaluateCreatorProgram(program, entry)).toMatchObject({ kind: "ELIGIBLE", program })
    expect(JSON.stringify(program)).toBe(before)
    expect(program).not.toHaveProperty("sessions")
  })

  it("allows source exploration before intake but does not report personal eligibility", () => {
    expect(evaluateCreatorProgram(creatorProgramFixture()).kind).toBe("NEEDS_INPUT")
  })

  it("requires explicit grant and completed review instead of inferring them from public visibility", () => {
    const program = creatorProgramFixture()
    expect(evaluateCreatorProgram({ ...program, grant: null }, current).kind).toBe("GRANT_REQUIRED")
    const { grant: omittedGrant, ...withoutGrant } = program
    expect(omittedGrant).not.toBeNull()
    expect(evaluateCreatorProgram(withoutGrant, current).kind).toBe("GRANT_REQUIRED")
    expect(evaluateCreatorProgram({ ...program, review: null }, current).kind).toBe("NOT_REVIEWED")
    expect(evaluateCreatorProgram({ ...program, review: { ...program.review, status: "PENDING" } }, current).kind).toBe("NOT_REVIEWED")
  })

  it.each(["publicListing", "personalUse"] as const)("denies new use without %s permission", field => {
    const program = creatorProgramFixture()
    expect(evaluateCreatorProgram({ ...program, grant: { ...program.grant, [field]: false } }, current).kind).toBe("GRANT_REQUIRED")
  })

  it("requires a separate goal-only adoption instead of treating a goal as a record", () => {
    const program = creatorProgramFixture()
    program.applicability = program.applicability.filter(item => item.kind === "CURRENT_RECORD")
    expect(evaluateCreatorProgram(program, current).kind).toBe("ELIGIBLE")
    expect(evaluateCreatorProgram(program, goal).kind).toBe("UNSUPPORTED_ENTRY")
    expect(evaluateCreatorProgram(program, noRecord).kind).toBe("UNSUPPORTED_ENTRY")
  })

  it("does not convert a different event or silently use a newer source version", () => {
    const program = creatorProgramFixture()
    expect(evaluateCreatorProgram(program, { ...current, eventDistanceM: 3000 }).kind).toBe("UNSUPPORTED_EVENT")
    expect(evaluateCreatorProgram(program, current, { programId: program.programId, version: "2.0.0" }).kind).toBe("VERSION_MISMATCH")
    expect(evaluateCreatorProgram(program, current, { programId: "another-program", version: program.version }).kind).toBe("VERSION_MISMATCH")
  })

  it.each(["WITHDRAWN", "RECALLED"] as const)("blocks %s sources even before user intake", status => {
    const program = creatorProgramFixture()
    program.lifecycle = { status, notice: "새 적용이 중단되었습니다." }
    expect(evaluateCreatorProgram(program).kind).toBe(status)
    expect(evaluateCreatorProgram(program, current).kind).toBe(status)
  })

  it("blocks a withdrawn grant even if the program still says active", () => {
    const program = creatorProgramFixture()
    expect(evaluateCreatorProgram({ ...program, grant: { ...program.grant, status: "WITHDRAWN" } }, current).kind).toBe("WITHDRAWN")
  })

  it("rejects private payload fields at both top-level and nested boundaries", () => {
    const program = creatorProgramFixture()
    const cases = [
      { ...program, journal: "private text" },
      { ...program, accountId: "private-account" },
      { ...program, sessions: [{ paceSeconds: 10 }] },
      { ...program, author: { ...program.author, email: "private@example.test" } },
      { ...program, source: { ...program.source, privatePlanId: "private-id" } },
      { ...program, grant: { ...program.grant, privateEvidence: "private text" } },
      { ...program, review: { ...program.review, bodyState: "normal" } },
      { ...program, schedule: { ...program.schedule, pain: "private" } },
      { ...program, applicability: [{ ...program.applicability[0], record: { seconds: 1500 } }] },
      { ...program, transformations: [{ ...program.transformations[0], healthData: "private" }] },
    ]
    for (const value of cases) expect(evaluateCreatorProgram(value, current)).toEqual({ kind: "INVALID_PROGRAM" })
  })

  it("binds grant and review to the exact source version", () => {
    const program = creatorProgramFixture()
    for (const field of ["grant", "review"] as const) {
      expect(creatorProgramVersionSchema.safeParse({ ...program, [field]: { ...program[field], version: "2.0.0" } }).success).toBe(false)
    }
    expect(creatorProgramVersionSchema.safeParse({ ...program, review: { ...program.review, reviewedOn: null } }).success).toBe(false)
  })

  it("requires exact allowed transformation references and never gives goal-only a current-record pace policy", () => {
    const program = creatorProgramFixture()
    program.applicability[0]!.transformationPolicyRefs = ["missing-policy"]
    expect(creatorProgramVersionSchema.safeParse(program).success).toBe(false)
    const goalPace = creatorProgramFixture()
    goalPace.transformations = [{ kind: "SAME_EVENT_PACE", policyRef: "fixture-shift" }]
    expect(creatorProgramVersionSchema.safeParse(goalPace).success).toBe(false)
  })

  it.each([
    "http://example.test/program", "https://user:pass@example.test/program",
    "https://example.test/program?private=secret", "https://example.test/program#private",
  ])("rejects non-public reference URL %s", publicUrl => {
    const program = creatorProgramFixture()
    expect(creatorProgramVersionSchema.safeParse({ ...program, source: { ...program.source, publicUrl } }).success).toBe(false)
  })

  it("rejects unordered, repeated, or out-of-period relative days", () => {
    const program = creatorProgramFixture()
    for (const orderedDayOffsets of [[0, 4, 2], [0, 2, 2], [0, 7], [-1, 2]]) {
      expect(creatorProgramVersionSchema.safeParse({ ...program, schedule: { kind: "RELATIVE_CYCLE", durationDays: 7, orderedDayOffsets } }).success).toBe(false)
    }
  })

  it("checks civil dates and fixed-date span without shifting the source calendar", () => {
    const program = creatorProgramFixture()
    const schedule = {
      kind: "FIXED_DATES", durationDays: 3, startsOn: "2028-02-28", endsOn: "2028-03-01",
      timeZone: "Asia/Seoul", dates: ["2028-02-28", "2028-02-29", "2028-03-01"],
    }
    expect(creatorProgramVersionSchema.safeParse({ ...program, schedule }).success).toBe(true)
    for (const invalid of [
      { ...schedule, dates: ["2027-02-29"] },
      { ...schedule, dates: ["2028-02-30"] },
      { ...schedule, dates: ["2028-03-02"] },
      { ...schedule, dates: ["2028-03-01", "2028-02-28"] },
      { ...schedule, durationDays: 2 },
      { ...schedule, timeZone: "Not/A_TimeZone" },
    ]) expect(creatorProgramVersionSchema.safeParse({ ...program, schedule: invalid }).success).toBe(false)
  })

  it("keeps real supply empty and exact lookups unavailable instead of exposing fixtures", () => {
    expect(CREATOR_PROGRAM_REGISTRY).toEqual([])
    expect(Object.isFrozen(CREATOR_PROGRAM_REGISTRY)).toBe(true)
    expect(getCreatorProgram("fixture-program", "1.0.0")).toBeUndefined()
    expect(getCreatorProgramSupplyStatus()).toBe("BLOCKED_SOURCE")
  })
})

describe("existing personal-copy lifecycle", () => {
  const retained = { programId: "fixture-program", version: "1.0.0", grantId: "fixture-grant", existingCopyPolicy: "RETAIN_PERSONAL_COPY" }

  it("preserves an active pinned copy without replacing it from the source", () => {
    expect(evaluateExistingCreatorCopy(creatorProgramFixture(), retained)).toEqual({
      kind: "KEEP_EXISTING", preservePerformedHistory: true, reason: "ACTIVE",
    })
  })

  it("uses the adoption-time retention grant for withdrawn sources while blocking all new applications", () => {
    const program = creatorProgramFixture()
    program.lifecycle = { status: "WITHDRAWN", notice: "배포가 종료되었습니다." }
    expect(evaluateCreatorProgram(program, current).kind).toBe("WITHDRAWN")
    expect(evaluateExistingCreatorCopy(program, retained)).toMatchObject({ kind: "KEEP_EXISTING", reason: "WITHDRAWN" })
    expect(evaluateExistingCreatorCopy(program, { ...retained, existingCopyPolicy: "HIDE_FUTURE_CONTENT" })).toEqual({
      kind: "HIDE_FUTURE_CONTENT", preservePerformedHistory: true, reason: "WITHDRAWN",
    })
  })

  it("pauses recalled future content even when a retained copy is permitted and preserves performed history", () => {
    const program = creatorProgramFixture()
    program.lifecycle = { status: "RECALLED", notice: "미래 훈련을 다시 검토해야 합니다." }
    expect(evaluateExistingCreatorCopy(program, retained)).toEqual({ kind: "PAUSE_FOR_REVIEW", preservePerformedHistory: true, reason: "RECALLED" })
  })

  it("does not replace or delete history for unavailable, different-version, or changed-grant sources", () => {
    const program = creatorProgramFixture()
    expect(evaluateExistingCreatorCopy(undefined, retained)).toMatchObject({ kind: "SOURCE_UNAVAILABLE", preservePerformedHistory: true })
    expect(evaluateExistingCreatorCopy(program, { ...retained, version: "2.0.0" })).toMatchObject({ kind: "IDENTITY_MISMATCH", preservePerformedHistory: true })
    expect(evaluateExistingCreatorCopy(program, { ...retained, grantId: "another-grant" })).toMatchObject({ kind: "PAUSE_FOR_REVIEW", reason: "GRANT_CHANGED" })
    expect(evaluateExistingCreatorCopy({ ...program, review: null }, retained)).toMatchObject({ kind: "PAUSE_FOR_REVIEW", reason: "NOT_REVIEWED" })
  })
})
