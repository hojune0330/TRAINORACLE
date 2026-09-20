import { describe, expect, it } from "vitest"
import { FIELD_PROVENANCE } from "./field-provenance"
import type { AthleteRecord } from "./athlete-records"
import type { JournalEntry } from "./journal-schema"
import { buildOraclePersonalResult, type OracleTopicId } from "./oracle-personal-result"
import { createPlannedSessionLogDraft } from "./planned-session-link"
import { deriveCandidateId } from "@impl/plan-generator/candidate-identity"
import { planBetaStateV3Schema } from "./plan-beta-schema"
import { stateFixture } from "./plan-beta-store.test-fixture"

const provenance = {
  system: { provenance: FIELD_PROVENANCE.explicit },
  distanceKm: { provenance: FIELD_PROVENANCE.explicit },
  durationMin: { provenance: FIELD_PROVENANCE.explicit },
  avgPace: { provenance: FIELD_PROVENANCE.missing },
  rpe: { provenance: FIELD_PROVENANCE.explicit },
} as const

function session(overrides: Partial<Extract<JournalEntry, { kind: "post-session" }>> = {}): JournalEntry {
  return {
    id: "session-1",
    kind: "post-session",
    date: "2026-09-10",
    savedAt: "2026-09-10T10:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "easy",
    distanceKm: "5",
    durationMin: "30",
    avgPace: "",
    rpe: 4,
    memo: "",
    fieldProvenance: provenance,
    ...overrides,
  }
}

type RecordOverrides = {
  readonly id?: string
  readonly purpose?: AthleteRecord["purpose"]
  readonly eventDistanceM?: number
  readonly performanceSeconds?: number
  readonly achievedOn?: string | null
  readonly seasonId?: string | null
  readonly sourceRef?: string
}

const record = (overrides: RecordOverrides = {}): AthleteRecord => ({
  schemaVersion: 1,
  id: "record-1",
  purpose: "RECENT_RESULT",
  eventDistanceM: 5000,
  performanceSeconds: 1200,
  achievedOn: "2026-09-01",
  seasonId: null,
  enteredBy: "ATHLETE",
  verificationState: "SELF_REPORTED",
  sourceRef: "athlete-record:record-1",
  savedAt: "2026-09-01T10:00:00.000Z",
  ...overrides,
} as AthleteRecord)

function stateWithTwoSessions() {
  const state = planBetaStateV3Schema.parse(stateFixture())
  const first = state.activePlan.sessions[0]
  if (first === undefined) throw new Error("fixture session missing")
  if (!("formationKind" in state.activePlan.frame)) throw new Error("canonical frame missing")
  const sessions = [first, { ...first, day: 2 }]
  const candidateId = deriveCandidateId(state.activePlan.candidateId, {
    kind: state.activePlan.candidateKind,
    eventDistanceM: state.activePlan.eventDistanceM,
    selectedDetailedTemplateRef: state.activePlan.selectedDetailedTemplateRef,
    selectedEnergyIntent: state.activePlan.selectedEnergyIntent,
    sourceMode: state.activePlan.sourceMode,
    selectionAuthority: state.activePlan.selectionActor === "SELF" ? "SELF" : "COACH_REQUIRED",
    frame: state.activePlan.frame,
    sessions,
  })
  return planBetaStateV3Schema.parse({
    ...state,
    activePlan: { ...state.activePlan, candidateId, sessions },
  })
}

function linkedEntry(day: number, rpe: number): Extract<JournalEntry, { kind: "post-session" }> {
  const state = stateWithTwoSessions()
  const planned = state.activePlan.sessions.find((candidate) => candidate.day === day)
  if (planned === undefined) throw new Error("fixture session missing")
  const draft = createPlannedSessionLogDraft(state, planned, "2026-08-29T00:00:00.000Z")
  if (draft === null) throw new Error("fixture link missing")
  return {
    id: `linked-${day}`,
    kind: "post-session",
    date: draft.date,
    savedAt: "2026-08-29T01:00:00.000Z",
    syncState: "local",
    system: "base",
    title: "",
    distanceKm: "",
    durationMin: "",
    avgPace: "",
    rpe,
    memo: "private text must not be read",
    fieldProvenance: { rpe: { provenance: FIELD_PROVENANCE.explicit } },
    plannedSessionLink: draft.link,
  }
}

describe("buildOraclePersonalResult", () => {
  it("returns a concrete missing input for all six topics with no personal data", () => {
    const topics: readonly OracleTopicId[] = ["level", "focus", "compare", "mix", "priority", "change"]
    for (const topicId of topics) {
      const result = buildOraclePersonalResult({
        topicId,
        entries: [],
        planState: null,
        today: "2026-09-21",
      })
      expect(result.status).toBe("missing")
      expect(result.requiredInput).toBeTruthy()
      expect(result.actionLabel).toBeTruthy()
      expect(result.fingerprint).toBeNull()
    }
  })

  it("shows the recent structured result beside one earlier same-distance result and never a goal", () => {
    const result = buildOraclePersonalResult({
      topicId: "level",
      entries: [],
      planState: null,
      today: "2026-09-21",
      athleteRecords: [
        record({ id: "old", sourceRef: "athlete-record:old", achievedOn: "2025-09-01", performanceSeconds: 1300 }),
        record({ id: "new", sourceRef: "athlete-record:new", achievedOn: "2026-09-01", performanceSeconds: 1200 }),
        record({ id: "goal", purpose: "RACE_GOAL", achievedOn: null, sourceRef: "athlete-record:goal", performanceSeconds: 1100 }),
      ],
    })
    expect(result.status).toBe("ready")
    expect(result.rows).toHaveLength(2)
    expect(result.rows.map((row) => row.value)).toEqual([1300, 1200])
    expect(result.detail).toContain("2026-09-01")
    expect(result.detail).toContain("이번 달")
    expect(result.detail).not.toContain("goal")
  })

  it("uses the approved energy ledger and excludes memo and save metadata from the fingerprint", () => {
    const first = session()
    const second = session({
      id: "different-source",
      savedAt: "2026-09-11T10:00:00.000Z",
      memo: "private note",
      memoPurpose: "PRIVATE_SELF_ONLY",
    })
    const left = buildOraclePersonalResult({ topicId: "mix", entries: [first], planState: null, today: "2026-09-21" })
    const right = buildOraclePersonalResult({ topicId: "mix", entries: [second], planState: null, today: "2026-09-21" })
    expect(left.status).toBe("ready")
    expect(left.rows.some((row) => row.label.startsWith("BASE"))).toBe(true)
    expect(left.fingerprint).toMatch(/^[0-9a-f]{8,64}$/u)
    expect(right.fingerprint).toBe(left.fingerprint)
    const nextDay = buildOraclePersonalResult({ topicId: "mix", entries: [first], planState: null, today: "2026-09-22" })
    expect(nextDay.fingerprint).toBe(left.fingerprint)
  })

  it("keeps focus and priority on the plan-cycle response and asks for a plan first", () => {
    const focus = buildOraclePersonalResult({ topicId: "focus", entries: [], planState: null, today: "2026-09-21" })
    const priority = buildOraclePersonalResult({ topicId: "priority", entries: [], planState: null, today: "2026-09-21" })
    expect(focus.action).toBe("plan")
    expect(focus.actionLabel).toBe("계획 만들기")
    expect(priority.requiredInput).toBe("현재 계획 1개")
  })

  it("routes an existing plan with no linked result back through plan selection", () => {
    const result = buildOraclePersonalResult({
      topicId: "focus",
      entries: [],
      planState: stateFixture(),
      today: "2026-09-21",
    })
    expect(result.status).toBe("missing")
    expect(result.action).toBe("plan")
    expect(result.actionLabel).toBe("계획에서 훈련 기록하기")
  })

  it("wraps two linked above-range RPE results with the approved reduction-review response", () => {
    const result = buildOraclePersonalResult({
      topicId: "priority",
      entries: [linkedEntry(1, 9), linkedEntry(2, 9)],
      planState: stateWithTwoSessions(),
      today: "2026-09-21",
    })
    expect(result.status).toBe("ready")
    expect(result.summary).toBe("다음 계획에서 훈련량을 줄일지 검토해요.")
    expect(result.rows.map((row) => row.value)).toEqual([9, 9])
    expect(result.source).toContain("연결 2건")
    expect(result.notice).toBeUndefined()
  })

  it("uses monthly descriptive trend APIs without making an improvement claim", () => {
    const entries = [
      session({ id: "aug", date: "2026-08-20", savedAt: "2026-08-20T10:00:00.000Z" }),
      session({ id: "sep", date: "2026-09-10", savedAt: "2026-09-10T10:00:00.000Z" }),
    ]
    const compare = buildOraclePersonalResult({ topicId: "compare", entries, planState: null, today: "2026-09-21" })
    const change = buildOraclePersonalResult({ topicId: "change", entries, planState: null, today: "2026-09-21" })
    expect(compare.status).toBe("ready")
    expect(change.status).toBe("ready")
    expect(compare.rows).toHaveLength(2)
    expect(change.detail).toContain("향상인지")
  })

  it("does not call a distance fallback an RPE comparison", () => {
    const result = buildOraclePersonalResult({
      topicId: "change",
      entries: [session({
        id: "distance-only",
        date: "2026-09-10",
        rpe: 0,
        fieldProvenance: { ...provenance, rpe: { provenance: FIELD_PROVENANCE.missing } },
      })],
      planState: null,
      today: "2026-09-21",
    })
    expect(result.status).toBe("partial")
    expect(result.headline).toContain("거리")
    expect(result.unit).toBe("km")
    expect(result.action).toBe("trends")
  })

  it("keeps the mix fingerprint when a memo-only private journal is added", () => {
    const memoOnly = session({
      id: "memo-only",
      date: "2026-09-11",
      system: "",
      distanceKm: "",
      durationMin: "",
      avgPace: "",
      rpe: 0,
      memo: "private only",
      memoPurpose: "PRIVATE_SELF_ONLY",
      fieldProvenance: undefined,
    })
    const base = buildOraclePersonalResult({ topicId: "mix", entries: [session()], planState: null, today: "2026-09-21" })
    const withMemo = buildOraclePersonalResult({ topicId: "mix", entries: [session(), memoOnly], planState: null, today: "2026-09-21" })
    expect(withMemo.fingerprint).toBe(base.fingerprint)
  })

  it("ignores malformed or future athlete records in the pure builder", () => {
    const result = buildOraclePersonalResult({
      topicId: "level",
      entries: [],
      planState: null,
      today: "2026-09-21",
      athleteRecords: [
        record({ id: "future", achievedOn: "2026-09-22" }),
        record({ id: "nan", performanceSeconds: Number.NaN }),
        record({ id: "short", eventDistanceM: 10 }),
      ],
    })
    expect(result.status).toBe("missing")
    expect(result.action).toBe("records")
  })

  it("fails closed for an invalid analysis date", () => {
    const result = buildOraclePersonalResult({ topicId: "mix", entries: [], planState: null, today: "2026-02-30" })
    expect(result.status).toBe("missing")
    expect(result.requiredInput).toContain("YYYY-MM-DD")
  })
})
