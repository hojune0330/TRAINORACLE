import { describe, expect, it } from "vitest"
import { cloneExercise, describeExerciseRow, exerciseLogSchema, type ExerciseLog } from "./exercise-log"
import { parseJournalEntry, parseJournalEntryForWrite, type PostSessionEntry } from "./journal-schema"
import { parseAccountJournalRecord } from "./account/account-journal-record-schema"
import { toExportJournalEntry, fromStructuredJournalPayload, toAnalysisJournalEntry } from "./safe-export"

const exerciseLog: ExerciseLog = { version: 1, source: "SELF_REPORTED", components: [
  { id: "run", kind: "INTERVALS", name: "400m 반복", rows: [{ id: "r1", distanceM: 400, durationSeconds: 80, repetitions: 10, sets: 2, recovery: { kind: "TIMED", seconds: 60 }, setRecovery: { kind: "TIMED", seconds: 180 } }] },
  { id: "strength", kind: "STRENGTH", name: "스쿼트", rows: [{ id: "s1", loadKg: 60, repetitions: 5, sets: 4, side: "BOTH" }] },
  { id: "jump", kind: "PLYOMETRIC", name: "바운딩", rows: [{ id: "j1", distanceM: 30, side: "LEFT" }, { id: "j2", contacts: 12, side: "RIGHT" }] },
] }
const entry: PostSessionEntry = { id: "exercise-fixture", kind: "post-session", date: "2026-09-26", savedAt: "2026-09-26T00:00:00.000Z", syncState: "local", system: "", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "", exerciseLog }

describe("self-reported exercise records", () => {
  it("preserves mixed units and unequal rows through journal and account codecs", () => {
    expect(parseJournalEntry(entry)?.kind).toBe("post-session")
    expect(parseJournalEntryForWrite(entry)).toEqual(entry)
    expect(parseAccountJournalRecord({ version: 2, state: "FINALIZED", kind: "JOURNAL", entry })?.entry).toEqual(entry)
    expect(describeExerciseRow(exerciseLog.components[0]!.rows[0]!)).toContain("세트 사이 180초")
    expect(fromStructuredJournalPayload(toExportJournalEntry(entry))).toMatchObject({ exerciseLog })
  })
  it("preserves a type-only record without manufacturing metrics", () => {
    const value = { ...exerciseLog, components: [{ id: "only-kind", kind: "RUNNING", name: "", rows: [] }] }
    expect(exerciseLogSchema.parse(value)).toEqual(value)
  })
  it("distinguishes missing, no recovery and explicitly timed zero", () => {
    const value = { ...exerciseLog, components: [{ ...exerciseLog.components[0]!, rows: [
      { id: "missing" }, { id: "none", recovery: { kind: "NONE" } }, { id: "zero", recovery: { kind: "TIMED", seconds: 0 } },
    ] }] }
    const rows = exerciseLogSchema.parse(value).components[0]!.rows
    expect(rows[0]?.recovery).toBeUndefined()
    expect(rows[1]?.recovery).toEqual({ kind: "NONE" })
    expect(rows[2]?.recovery).toEqual({ kind: "TIMED", seconds: 0 })
  })
  it.each([NaN, Infinity, -1, 0, 1.5])("rejects invalid repetition count %s", repetitions => {
    expect(exerciseLogSchema.safeParse({ ...exerciseLog, components: [{ ...exerciseLog.components[0]!, rows: [{ id: "bad", repetitions }] }] }).success).toBe(false)
  })
  it("rejects duplicate IDs and unreviewed extra fields", () => {
    expect(exerciseLogSchema.safeParse({ ...exerciseLog, components: [exerciseLog.components[0], exerciseLog.components[0]] }).success).toBe(false)
    expect(exerciseLogSchema.safeParse({ ...exerciseLog, estimatedRpe: 7 }).success).toBe(false)
  })
  it("duplicates without sharing identifiers or mutable recovery objects", () => {
    const original = exerciseLog.components[0]!
    const copy = cloneExercise(original)
    expect(copy.id).not.toBe(original.id)
    expect(copy.rows[0]?.id).not.toBe(original.rows[0]?.id)
    copy.rows[0]!.distanceM = 300
    expect(original.rows[0]?.distanceM).toBe(400)
  })
  it("does not insert exercise-only facts into analysis", () => {
    const projected = toAnalysisJournalEntry(entry)
    expect(projected).toBeNull()
    const withExplicitRpe = toAnalysisJournalEntry({ ...entry, rpe: 5, fieldProvenance: { rpe: { provenance: "EXPLICIT" } } })
    expect(withExplicitRpe).not.toHaveProperty("exerciseLog")
    expect(withExplicitRpe).toMatchObject({ rpe: 5, distanceKm: "" })
  })
})
