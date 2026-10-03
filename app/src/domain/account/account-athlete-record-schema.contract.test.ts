import { describe, expect, it } from "vitest"
import { createSelfReportedAthleteRecord } from "../athlete-records"
import { accountAthleteRecordDocumentSchema, accountAthleteRecordSnapshotSchema,
  validateAccountAthleteRecordDocumentUpdate } from "./account-athlete-record-schema"
import { validateAccountStateDocument, validateAccountStateDocumentUpdate } from "./account-state-schema"

const record = (id = "r-1") => createSelfReportedAthleteRecord({ id, purpose: "RECENT_RESULT",
  eventDistanceM: 5000, performanceSeconds: 1200, achievedOn: null, seasonId: null }, new Date("2026-01-01T00:00:00Z"))!
const document = (records: unknown[] = [record()]) => ({ version: 3, state: "ACCOUNT_STATE", kind: "ATHLETE_RECORDS", data: { records } })

describe("account athlete record document", () => {
  it("reuses existing parsing, preserving unknown dates and self-reported authority", () => {
    const parsed = accountAthleteRecordDocumentSchema.parse(document())
    expect(parsed.data.records[0]).toEqual(record())
    expect(parsed.data.records[0]?.achievedOn).toBeNull()
    expect(parsed.data.records[0]?.verificationState).toBe("SELF_REPORTED")
    expect(validateAccountStateDocument(parsed)).toBe(true)
  })
  it("accepts old season labels without inventing a date for unknown actuals", () => {
    expect(accountAthleteRecordDocumentSchema.safeParse(document([{ ...record(), purpose: "SEASON_BEST",
      achievedOn: "2025-12-31", seasonId: "legacy-season" }])).success).toBe(true)
    expect(accountAthleteRecordDocumentSchema.safeParse(document([{ ...record(), purpose: "SEASON_BEST", seasonId: "legacy-season" }])).success).toBe(false)
  })
  it.each([
    { memo: "private" }, { verificationState: "VERIFIED" }, { enteredBy: "VERIFIED_IMPORT", verificationState: "VERIFIED" },
    { enteredBy: "COACH" }, { achievedOn: "2099-01-01" }, { achievedOn: "2025-02-30" },
    { performanceSeconds: Infinity }, { sourceRef: "another-source" },
  ])("rejects unsupported authority, private fields and invalid values: %j", change => {
    expect(accountAthleteRecordDocumentSchema.safeParse(document([{ ...record(), ...change }])).success).toBe(false)
  })
  it("rejects duplicate IDs, envelope extras and oversized collections without trimming", () => {
    expect(accountAthleteRecordDocumentSchema.safeParse(document([record(), record()])).success).toBe(false)
    expect(accountAthleteRecordDocumentSchema.safeParse({ ...document(), memo: "private" }).success).toBe(false)
    const base = record()
    expect(accountAthleteRecordDocumentSchema.safeParse(document(Array.from({ length: 3000 }, (_, i) =>
      ({ ...base, id: `r-${i}`, sourceRef: `athlete-record:r-${i}` })))).success).toBe(false)
  })
  it("allows append or identical replay but rejects edit, deletion, reorder and kind changes", () => {
    const before = document([record(), record("r-2")])
    const after = document([record(), record("r-2"), record("r-3")])
    expect(validateAccountAthleteRecordDocumentUpdate(before, after)).toBe(true)
    expect(validateAccountStateDocumentUpdate(before, after)).toBe(true)
    expect(validateAccountStateDocumentUpdate(before, before)).toBe(true)
    for (const invalid of [document([]), document([record("r-2"), record()]),
      document([{ ...record(), performanceSeconds: 900 }, record("r-2")]), { ...before, kind: "PLAN" }]) {
      expect(validateAccountStateDocumentUpdate(before, invalid)).toBe(false)
    }
  })
  it("uses positive server revisions, never a savedAt clock as the confirmed version", () => {
    const snapshot = { documentId: "a1111111-1111-5111-8111-111111111111", serverRevision: 2, recordId: "r-1" }
    expect(accountAthleteRecordSnapshotSchema.safeParse(snapshot).success).toBe(true)
    expect(accountAthleteRecordSnapshotSchema.safeParse({ ...snapshot, serverRevision: 0 }).success).toBe(false)
    expect(accountAthleteRecordSnapshotSchema.safeParse({ ...snapshot, serverRevision: record().savedAt }).success).toBe(false)
  })
})
