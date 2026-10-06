import { describe, expect, it } from "vitest"
import { validateAccountStateDocument } from "./account-state-schema"
import { accountOracleV2DocumentSchema, emptyOracleV2Document, prepareOracleV2Migration, validateInitialOracleV2Document, validateOracleV2Transition } from "./account-oracle-v2-schema"
import { makeOracleProfileRevision, saveOracleProfileReading } from "../oracle-profile-snapshot"

const old = { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: {
  version: "RUNNING_PROFILE_V1", answeredAt: "2026-10-04T12:00:00.000Z", answers: { intensity: ["hard"] },
} }
const revision = (number: number) => makeOracleProfileRevision({ revision: number,
  answeredAt: "2026-10-04T12:00:00.000Z", answers: { STRUCTURE_1: 4, STRUCTURE_2: 4, STRUCTURE_3: 4 } })

describe("V2 account compatibility integrity, not deployment evidence", () => {
  it("accepts optional structured context without manufacturing scores or rewriting score history", () => {
    const initial = emptyOracleV2Document()
    initial.data.context = { version: "ORACLE_CONTEXT_V1", answeredAt: "2026-10-04T12:00:00.000Z",
      answers: { company: "ALONE" }, conditions: { availableMinutes: 45 } }
    expect(validateInitialOracleV2Document(initial)).toBe(true)
    expect(initial.data.current).toBeNull()
    const changed = structuredClone(initial); changed.data.context!.conditions.availableMinutes = 30
    expect(validateOracleV2Transition(initial, changed)).toBe(true)
    expect(changed.data.current).toBeNull()
    const scored = structuredClone(initial); scored.data.current = revision(1)
    const contextOnly = structuredClone(scored); contextOnly.data.context!.answers.company = "TOGETHER"
    expect(validateOracleV2Transition(scored, contextOnly)).toBe(true)
    expect(contextOnly.data.current).toEqual(scored.data.current)
    const deleted = structuredClone(initial); deleted.data.status = "DELETED"
    expect(accountOracleV2DocumentSchema.safeParse(deleted).success).toBe(false)
    delete deleted.data.context
    expect(validateOracleV2Transition(initial, deleted)).toBe(true)
    expect(accountOracleV2DocumentSchema.safeParse({ ...initial, data: { ...initial.data,
      context: { ...initial.data.context, memo: "not accepted" } } }).success).toBe(false)
  })
  it("copies V1 choices without deriving scores and accepts both versions", () => {
    const migrated = prepareOracleV2Migration(old)
    expect(migrated.data.legacyAnswers).toEqual(old.data.answers)
    expect(migrated.data.legacyAnsweredAt).toBe(old.data.answeredAt)
    expect(migrated.data.current).toBeNull()
    migrated.data.legacyAnswers.intensity = ["easy"]
    expect(old.data.answers.intensity).toEqual(["hard"])
    expect(validateAccountStateDocument(migrated)).toBe(true)
    expect(validateAccountStateDocument(old)).toBe(true)
  })

  it("allows revision progression but prevents downgrade and historical rewriting", () => {
    const base = prepareOracleV2Migration(old)
    const one = structuredClone(base); one.data.current = revision(1)
    expect(validateOracleV2Transition(base, one)).toBe(true)
    expect(validateOracleV2Transition(one, old)).toBe(false)
    const two = structuredClone(one); two.data.current = revision(2)
    two.data.readings.push(saveOracleProfileReading(one.data.current!, "2026-10-04T12:00:00.000Z"))
    expect(validateOracleV2Transition(one, two)).toBe(true)
    const forged = structuredClone(two); forged.data.readings[0]!.source.answers.STRUCTURE_1 = 1
    expect(validateOracleV2Transition(two, forged)).toBe(false)
    const rewritten = structuredClone(two); rewritten.data.current!.answers.STRUCTURE_1 = 1
    expect(validateOracleV2Transition(two, rewritten)).toBe(false)
    const skipped = structuredClone(two); skipped.data.current!.revision = 4
    expect(validateOracleV2Transition(two, skipped)).toBe(false)
  })

  it("rejects contradictory current snapshots and duplicate histories", () => {
    const doc = prepareOracleV2Migration(old); doc.data.current = revision(1)
    doc.data.readings = [saveOracleProfileReading(doc.data.current, "2026-10-04T12:00:00.000Z")]
    expect(accountOracleV2DocumentSchema.safeParse(doc).success).toBe(true)
    const bad = structuredClone(doc); bad.data.readings[0]!.source.answers.STRUCTURE_1 = 2
    expect(accountOracleV2DocumentSchema.safeParse(bad).success).toBe(false)
    doc.data.readings.push(doc.data.readings[0]!)
    expect(accountOracleV2DocumentSchema.safeParse(doc).success).toBe(false)
  })

  it("requires removal of derived data on deletion and rejects implicit resurrection", () => {
    const current = prepareOracleV2Migration(old); current.data.current = revision(1)
    const deleted = structuredClone(current); deleted.data.status = "DELETED"
    expect(validateOracleV2Transition(current, deleted)).toBe(false)
    deleted.data.current = null; deleted.data.legacyAnswers = {}; deleted.data.legacyAnsweredAt = null; deleted.data.readings = []
    expect(validateOracleV2Transition(current, deleted)).toBe(true)
    expect(validateOracleV2Transition(deleted, current)).toBe(false)
  })
})
