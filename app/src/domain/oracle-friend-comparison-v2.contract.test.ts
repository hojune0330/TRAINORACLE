import { describe, expect, it } from "vitest"
import { createSelfReportedAthleteRecord } from "./athlete-records"
import { makeOracleProfileRevision, type OracleProfileRevision } from "./oracle-profile-snapshot"
import { scoreOracleResponses } from "./oracle-profile-v2"
import { createOracleFriendComparisonSession, formatOracleFriendFact, ORACLE_FRIEND_TOPICS, type OracleFriendManualData, type OracleFriendSelf } from "./oracle-friend-comparison-v2"
import type { OracleReadingFact } from "./oracle-content-reader"

const today = "2026-10-04"
const profile = (answers = { CHALLENGE_1: 1, CHALLENGE_2: 1, CHALLENGE_3: 1 }) => makeOracleProfileRevision({ revision: 1, answeredAt: `${today}T00:00:00.000Z`, answers })
const record = (seconds: number) => createSelfReportedAthleteRecord({ id: `race-${seconds}`, purpose: "RECENT_RESULT", eventDistanceM: 5000, performanceSeconds: seconds, achievedOn: "2026-10-01", seasonId: null }, new Date(`${today}T12:00:00`))!
const self: OracleFriendSelf = { profile: profile(), records: [record(1200)] }
function active() {
  const session = createOracleFriendComparisonSession()
  session.grantComparison(); session.selectFields(["PROFILE", "RECORDS", "GOALS", "PHASES", "TIME", "TRAINING"])
  expect(session.replacePeer({ profile: profile(), records: [record(1300)] }, today)).toBe(true)
  return session
}

describe("manual Oracle friend comparison permission boundary", () => {
  it("requires explicit comparison permission before accepting, reading or exporting peer data", () => {
    const session = createOracleFriendComparisonSession()
    expect(session.replacePeer({ records: [record(1300)] }, today)).toBe(false)
    expect(session.selectFields(["RECORDS"])).toBe(false)
    for (const topic of ORACLE_FRIEND_TOPICS) expect(session.read(topic, self, today)).toBeNull()
    expect(session.setExternalShare(true, ["RECORDS"], self, today)).toBe(false)
    expect(session.exportPreview(self, today)).toBeNull()
  })

  it("reads actual same-event records through E01 and requires separate external consent", () => {
    const session = active()
    expect(session.read("E01", self, today)?.facts.find(f => f.id === "friend:race-delta")?.value).toBe(100)
    expect(session.exportPreview(self, today)).toBeNull()
    expect(session.read("E06", self, today)?.status).toBe("REVOKED")
    expect(session.setExternalShare(true, ["RECORDS"], self, today)).toBe(true)
    expect(session.read("E06", self, today)?.facts.length).toBeGreaterThan(0)
    const preview = session.exportPreview(self, today)!
    expect(preview).toContain("100 초")
    expect(preview).not.toContain("CHALLENGE")
    expect(preview).not.toContain("같은 답")
    expect(preview).not.toContain("race-1300")
    expect(preview).not.toContain("sourceRefs")
    expect(preview).not.toContain("SELF_REPORTED")
  })

  it("revocation removes peer, results and export and regrant cannot resurrect them", () => {
    const session = active(); session.setExternalShare(true, ["RECORDS", "PROFILE"], self, today)
    expect(session.exportPreview(self, today)).not.toBeNull()
    session.revoke()
    expect(session.snapshot()).toEqual({ comparisonAllowed: false, fields: [], peer: {}, externalShareAllowed: false, shareFields: [] })
    for (const topic of ORACLE_FRIEND_TOPICS) expect(session.read(topic, self, today)).toBeNull()
    expect(session.exportPreview(self, today)).toBeNull()
    session.grantComparison(); session.selectFields(["RECORDS", "PROFILE"])
    expect(session.read("E01", self, today)?.facts.some(f => f.owner !== "SELF")).toBe(false)
    expect(session.read("E03", self, today)?.facts).toEqual([])
    expect(session.exportPreview(self, today)).toBeNull()
    session.close(); expect(session.snapshot().peer).toEqual({})
  })

  it("field removal purges that peer field and invalidates export without resurrection", () => {
    const session = active(); session.setExternalShare(true, ["PROFILE"], self, today)
    session.selectFields(["RECORDS"])
    expect(session.snapshot().peer.profile).toBeUndefined()
    expect(session.read("E03", self, today)?.facts).toEqual([])
    expect(session.exportPreview(self, today)).toBeNull()
    expect(session.setExternalShare(true, ["PROFILE"], self, today)).toBe(false)
    session.selectFields(["PROFILE", "RECORDS"])
    expect(session.snapshot().peer.profile).toBeUndefined()
  })

  it("external withdrawal alone keeps the permitted comparison but removes export", () => {
    const session = active(); session.setExternalShare(true, ["RECORDS"], self, today)
    session.setExternalShare(false, ["RECORDS"])
    expect(session.exportPreview(self, today)).toBeNull()
    expect(session.read("E01", self, today)?.facts.find(f => f.id === "friend:race-delta")?.value).toBe(100)
  })

  it("different question or score versions never produce answer comparisons", () => {
    const session = active()
    for (const key of ["questionVersion", "scoreVersion"] as const) {
      const unsupported = { ...profile(), [key]: "OLD_VERSION" } as unknown as OracleProfileRevision
      expect(session.read("E03", { ...self, profile: unsupported }, today)?.facts).toEqual([])
      expect(session.replacePeer({ profile: unsupported }, today)).toBe(false)
      expect(session.snapshot().peer).toEqual({})
    }
  })

  it("null is not zero and only numeric same-version answers enter the denominator", () => {
    const session = active()
    const ownProfile = makeOracleProfileRevision({ revision: 2, answeredAt: `${today}T00:00:00.000Z`, answers: { CHALLENGE_1: 1, CHALLENGE_2: 1, CHALLENGE_3: 1, SOCIAL_1: "UNKNOWN", SOCIAL_2: "SKIPPED" } })
    const peerProfile = makeOracleProfileRevision({ revision: 3, answeredAt: `${today}T00:00:00.000Z`, answers: { CHALLENGE_1: 1, CHALLENGE_2: 2, SOCIAL_1: "UNKNOWN", SOCIAL_2: "SKIPPED" } })
    expect(scoreOracleResponses(ownProfile.answers)[0]?.display).toBe(0)
    expect(scoreOracleResponses(peerProfile.answers)[0]?.display).toBeNull()
    session.replacePeer({ profile: peerProfile }, today)
    const result = session.read("E03", { ...self, profile: ownProfile }, today)!
    expect(result.facts.find(f => f.id === "friend:matching-answers")).toMatchObject({ value: 1, denominator: 2, unit: "count" })
    expect(result.facts.some(f => f.id.includes("SOCIAL") || f.unit === "%")).toBe(false)
    session.replacePeer({ profile: makeOracleProfileRevision({ revision: 1, answeredAt: `${today}T00:00:00.000Z`, answers: { SOCIAL_1: "UNKNOWN" } }) }, today)
    expect(session.read("E03", { ...self, profile: ownProfile }, today)?.facts).toEqual([])
  })

  it("distinguishes unavailable records from zero or received empty records", () => {
    const session = active()
    const unknown = session.read("E01", { ...self, records: null }, today)!
    expect(unknown.inputStates.records).toBe("UNAVAILABLE")
    expect(unknown.facts.find(f => f.id === "friend:race-delta")).toBeUndefined()
    expect(session.read("E01", { ...self, records: [] }, today)?.inputStates.records).not.toBe("UNAVAILABLE")
  })

  it("rejects raw memo, malformed records and manual claims of backend verification", () => {
    const session = active()
    for (const payload of [
      { rawmemo: "PRIVATE_SENTINEL", records: [record(1300)] },
      { records: [{ ...record(1300), rawmemo: "PRIVATE_SENTINEL" }] },
      { records: [{ ...record(1300), enteredBy: "VERIFIED_IMPORT", verificationState: "VERIFIED" }] },
      { records: [{ ...record(1300), purpose: "RACE_GOAL", achievedOn: null }] },
      { profile: { ...profile(), answers: { CHALLENGE_1: null } } },
    ]) {
      expect(session.replacePeer(payload, today)).toBe(false)
      expect(session.snapshot().peer).toEqual({})
      expect(session.exportPreview(self, today)).toBeNull()
    }
  })

  it("keeps mutable input and snapshots detached from the current permission payload", () => {
    const session = active(); const data = { profile: profile() }
    session.replacePeer(data, today); data.profile.answers.CHALLENGE_1 = 5
    const snapshot = session.snapshot(); snapshot.peer.profile!.answers.CHALLENGE_1 = 4
    expect(session.snapshot().peer.profile!.answers.CHALLENGE_1).toBe(1)
  })

  it("E02 and E04 use explicit goals, phases and matching dates without prescribing a pace", () => {
    const session = active()
    const inputs: OracleFriendManualData = { goals: ["REFRESH"], phases: ["WARMUP"], windows: [{ date: today, startMinute: 600, endMinute: 660 }] }
    session.replacePeer(inputs, today)
    const current = { ...self, goals: ["RECORD"] as const, phases: ["WARMUP"] as const, windows: [{ date: today, startMinute: 630, endMinute: 690 }] }
    const ownData: OracleFriendSelf = { ...current, goals: [...current.goals], phases: [...current.phases] }
    expect(session.read("E02", ownData, today)?.facts.find(f => f.id === "friend:meeting-minutes")?.value).toBe(30)
    expect(session.read("E02", ownData, today)?.facts.find(f => f.id === "friend:common-phases")?.value).toBeTruthy()
    expect(session.read("E04", ownData, today)?.facts.find(f => f.id === "friend:common-goals")?.value).toBe("공통 선택 없음")
    session.setExternalShare(true, ["GOALS"], ownData, today)
    const preview = session.exportPreview(ownData, today)!
    expect(preview).toContain("기분 전환")
    expect(preview).not.toContain("30 분")
    expect(preview).not.toContain("준비 운동")
  })

  it("E05 keeps unknown distance absent and compares complete equal periods only", () => {
    const session = active()
    const training: NonNullable<OracleFriendManualData["training"]> = { period: { startDate: today, endDate: today }, coverage: "COMPLETE", sessions: [{ id: "s1", date: today, provenance: "EXPLICIT", activity: "RUN", distanceKm: 0 }] }
    const ownData = { ...self, training }
    session.replacePeer({ training: { ...training, sessions: [{ id: "s2", date: today, provenance: "EXPLICIT", activity: "RUN" }] } }, today)
    expect(session.read("E05", ownData, today)?.facts.find(f => f.id === "friend:km-delta")).toBeUndefined()
    session.replacePeer({ training }, today)
    expect(session.read("E05", ownData, today)?.facts.find(f => f.id === "friend:km-delta")?.value).toBe(0)
    session.replacePeer({ training: { ...training, period: { startDate: "2026-10-03", endDate: today } } }, today)
    expect(session.read("E05", ownData, today)?.facts.find(f => f.id === "friend:km-delta")).toBeUndefined()
  })

  it("binds external consent to the current permitted facts, not a stale self revision", () => {
    const session = active(); session.setExternalShare(true, ["RECORDS", "PROFILE"], self, today)
    expect(session.exportPreview(self, today)).not.toBeNull()
    const changed = { ...self, records: [record(1100)] }
    expect(session.exportPreview(changed, today)).toBeNull()
    expect(session.read("E06", changed, today)?.status).toBe("REVOKED")
    expect(session.exportPreview({ ...self, profile: { ...self.profile!, revision: 2 } }, today)).toBeNull()
  })

  it("failed replacement with an invalid current date clears prior peer data", () => {
    const session = active()
    expect(session.replacePeer({ records: [record(1100)] }, "2026-02-30")).toBe(false)
    expect(session.snapshot().peer).toEqual({})
    expect(session.read("E01", self, today)?.facts.some(f => f.owner !== "SELF")).toBe(false)
  })

  it("exports permitted training facts with readable purpose labels and no internal payload", () => {
    const session = active()
    const training: NonNullable<OracleFriendManualData["training"]> = { period: { startDate: today, endDate: today }, coverage: "COMPLETE", sessions: [{ id: "private-training-id", date: today, provenance: "EXPLICIT", activity: "RUN", distanceKm: 5, purpose: "BASE" }] }
    const current = { ...self, training }; session.replacePeer({ training }, today)
    session.setExternalShare(true, ["TRAINING"], current, today)
    const preview = session.exportPreview(current, today)!
    expect(preview).toContain("기초 지구력 (BASE) 목적")
    expect(preview).not.toMatch(/· BASE 목적:/u)
    expect(preview).not.toContain('"purpose":"BASE"')
    expect(preview).not.toContain("sourceRefs")
    expect(preview).not.toContain("EXPLICIT")
    expect(preview).not.toContain("private-training-id")
    expect(preview).not.toContain("1200")
  })
})

describe("friend fact denominator labels", () => {
  const fact: OracleReadingFact = { id: "CHALLENGE:index", label: "기록 도전 선호", value: 0,
    unit: "index", metric: "M01", denominator: 100, sourceRefs: [], owner: "SELF" }

  it.each([0, 100])("formats self-response index %s on a point scale, not a record count", value => {
    expect(formatOracleFriendFact({ ...fact, value })).toBe(`${value} 점 (100점 만점)`)
  })

  it("preserves a reference index rather than implying a maximum for speed comparisons", () => {
    expect(formatOracleFriendFact({ ...fact, metric: "M05", value: 110 })).toBe("110 점 (기준 100)")
  })

  it("keeps compared answer counts and absent denominators distinct", () => {
    expect(formatOracleFriendFact({ ...fact, metric: "M17", unit: "count", value: 1, denominator: 2 })).toBe("1 개 (비교 가능한 2개)")
    expect(formatOracleFriendFact({ ...fact, metric: "M16", value: -5, denominator: undefined })).toBe("-5 점")
  })
})
