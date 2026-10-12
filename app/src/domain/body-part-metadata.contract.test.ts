import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { bodyPartMetadataSchema, journalHasPainSignal, journalPainPartsForSafety, parseBodyPartMetadata,
  preserveBodyPartMetadataForRestore, type BodyPartMetadataV1 } from "./body-part-metadata"
import { parseJournalEntry, parseJournalEntryForWrite, type EveningEntry } from "./journal-schema"
import { toAnalysisJournalEntry, toExportJournalEntry, fromStructuredJournalPayload } from "./safe-export"
import { selectStructuredJournalInput, projectStructuredJournalObservation } from "./journal-observation"
import { parseAccountJournalRecord, validateAccountJournalRecordUpdate } from "./account/account-journal-record-schema"
import { reviewPlanExecution } from "./plan-execution-review"
import { journalResultLabel } from "./journal-plan-progress"
import { painLevelsRequireReview } from "../safety/memo-safety"
import { FULL_FORMAT_V6, buildRestorePlan, readBackupFile, restoreEntries, withoutPrivateBodyPartMetadata } from "./restore/backup-file"
import { saveEntry, loadEntries, loadEntriesForPlanSafety, loadJournalEntriesSnapshot,
  exportEntriesJSON, updateEntry, deleteEntry, restoreDeletedEntry } from "./journal-store"
import { evaluatePlanSafety } from "./plan-beta-flow"
import { setActiveLocalAccount, assignJournalsToAccount } from "./account/local-journal-ownership"
import { JOURNAL_STORAGE_KEY, writeJournalEntries } from "./journal-local-storage"
import { writeVaultAndJournalAtomically } from "./private-memo-vault-storage"
import { initializeCanonicalJournalFixture } from "../test/canonical-journal-fixture"

const id = "other_11111111-1111-4111-8111-111111111111" as const
const metadata: BodyPartMetadataV1 = { schemaVersion: 1, observations: [{ id,
  labelSnapshot: "SYNTHETIC_PRIVATE_LABEL", severity: 4, note: "SYNTHETIC_PRIVATE_NOTE" }] }
const evening = (): EveningEntry => ({ id: "synthetic-body-entry", kind: "evening", date: "2026-10-12",
  savedAt: "2026-10-12T00:00:00.000Z", syncState: "local", sleepH: 0, sleepQuality: 0, weightKg: "", restingHr: "",
  painParts: {}, mood: 0, note: "", fieldProvenance: { painParts: { provenance: "EXPLICIT" } }, bodyPartMetadata: structuredClone(metadata) })
const record = (entry: EveningEntry, version: 2 | 3 | 4 = 4) => ({ version, state: "FINALIZED", kind: "JOURNAL", entry })

beforeEach(async () => {
  window.localStorage.clear(); window.sessionStorage.clear(); setActiveLocalAccount(null)
  await initializeCanonicalJournalFixture()
})
afterEach(() => { setActiveLocalAccount(null); window.localStorage.clear(); window.sessionStorage.clear() })

describe("owner-private body companion", () => {
  it("accepts positive supported input and rejects unknown versions, duplicate IDs and copied severity", () => {
    expect(parseJournalEntryForWrite(evening())).toEqual(evening())
    for (const invalid of [{ ...metadata, schemaVersion: 2 }, { ...metadata, observations: [metadata.observations[0], metadata.observations[0]] },
      { ...metadata, observations: [{ ...metadata.observations[0], id: "left ankle" }] },
      { ...metadata, observations: [{ ...metadata.observations[0], severity: 0 }] }]) {
      expect(parseBodyPartMetadata(invalid)).toBeNull()
      expect(parseJournalEntry({ ...evening(), bodyPartMetadata: invalid })).toBeNull()
    }
    expect(parseJournalEntryForWrite({ ...evening(), painParts: { [id]: 4 } })).toBeNull()
    expect(parseJournalEntryForWrite({ ...evening(), fieldProvenance: { painParts: { provenance: "MISSING" } } })).toBeNull()
    expect(bodyPartMetadataSchema.safeParse({ ...metadata, observations: [{ ...metadata.observations[0], labelSnapshot: "x".repeat(49) }] }).success).toBe(false)
  })

  it("keeps other 4/5 in numeric safety while removing private text and stable IDs", () => {
    for (const severity of [4, 5] as const) {
      const entry = { ...evening(), bodyPartMetadata: { ...metadata, observations: [{ ...metadata.observations[0]!, severity }] } }
      const numeric = journalPainPartsForSafety(entry)
      expect(numeric).toEqual({ other_1: severity })
      expect(painLevelsRequireReview(numeric)).toBe(true)
      expect(journalHasPainSignal(entry)).toBe(true)
      for (const output of [toExportJournalEntry(entry), toAnalysisJournalEntry(entry), selectStructuredJournalInput(entry)]) {
        const serialized = JSON.stringify(output)
        expect(serialized).not.toMatch(/SYNTHETIC_PRIVATE|other_11111111|bodyPartMetadata|labelSnapshot/u)
        expect(serialized).toContain(`"other_1":${severity}`)
      }
      const input = selectStructuredJournalInput(entry)!
      expect(projectStructuredJournalObservation(input).painMax).toBe(severity)
      const relabeled = { ...entry, bodyPartMetadata: { ...entry.bodyPartMetadata,
        observations: entry.bodyPartMetadata.observations.map(item => ({ ...item, labelSnapshot: "SYNTHETIC_RENAMED", note: "SYNTHETIC_CHANGED_NOTE" })) } }
      expect(toAnalysisJournalEntry(relabeled)).toEqual(toAnalysisJournalEntry(entry))
    }
  })

  it("adapts approved legacy fixed names without losing conflicting numeric levels", () => {
    expect(journalPainPartsForSafety({ painParts: { "오른 무릎": 4 } })).toEqual({ rKnee: 4 })
    expect(Object.values(journalPainPartsForSafety({ painParts: { rKnee: 5, "오른 무릎": 1 } }))).toEqual([5, 1])
  })

  it("keeps saved other pain in plan review and result labels", () => {
    const entry = { id: "synthetic-post", kind: "post-session" as const, date: "2026-10-12", savedAt: "2026-10-12T00:00:00Z",
      syncState: "local" as const, system: "", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
      painParts: {}, bodyPartMetadata: metadata }
    expect(reviewPlanExecution(entry, { kind: "unavailable" }).status).toBe("SAFETY_REVIEW")
    expect(journalResultLabel(entry)).toBe("몸 상태 확인 기록 있음")
  })

  it("refuses unsupported metadata instead of inventing a level or clearing a signal", () => {
    const entry = { ...evening(), bodyPartMetadata: { schemaVersion: 99, observations: [] } }
    expect(journalHasPainSignal(entry)).toBe(true)
    expect(() => journalPainPartsForSafety(entry)).toThrow("BODY_METADATA_UNSUPPORTED")
    expect(parseAccountJournalRecord(record(entry as unknown as EveningEntry))).toBeNull()
  })

  it("keeps a deliberate empty companion compatible with rest and never creates a zero-pain observation", () => {
    const entry = { id: "synthetic-rest", kind: "post-session" as const, date: "2026-10-12", savedAt: "2026-10-12T00:00:00Z",
      syncState: "local" as const, activityOutcome: "RESTED" as const, objectiveDataState: "NONE" as const,
      system: "", title: "", distanceKm: "", durationMin: "", avgPace: "", rpe: 0, memo: "",
      fieldProvenance: { painParts: { provenance: "EXPLICIT" as const } },
      bodyPartMetadata: { schemaVersion: 1 as const, observations: [] } }
    expect(parseJournalEntryForWrite(entry)).toEqual(entry)
    expect(selectStructuredJournalInput(entry)).toBeNull()
    const exported = toExportJournalEntry(entry)
    expect(exported).not.toHaveProperty("painParts")
    const restored = fromStructuredJournalPayload(exported)
    expect(parseJournalEntryForWrite(restored)).not.toBeNull()
    const original = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V6, entries: [entry] }))
    expect(parseJournalEntryForWrite(withoutPrivateBodyPartMetadata(original).entries[0])).not.toBeNull()
  })

  it("requires v4 and preserves supported snapshots through explicit edits", () => {
    const original = record(evening())
    expect(parseAccountJournalRecord(original)?.entry.bodyPartMetadata).toEqual(metadata)
    expect(parseAccountJournalRecord(record(evening(), 2))).toBeNull()
    expect(parseAccountJournalRecord(record(evening(), 3))).toBeNull()
    const next = record({ ...evening(), savedAt: "2026-10-12T00:01:00Z",
      bodyPartMetadata: { ...metadata, observations: [{ ...metadata.observations[0]!, labelSnapshot: "SYNTHETIC_RENAMED" }] } })
    expect(validateAccountJournalRecordUpdate(original, next)).toBe(true)
    expect(original.entry.bodyPartMetadata?.observations[0]?.labelSnapshot).toBe("SYNTHETIC_PRIVATE_LABEL")
    expect(validateAccountJournalRecordUpdate(original, record({ ...evening(), bodyPartMetadata: undefined }, 2))).toBe(false)
    expect(validateAccountJournalRecordUpdate(original, record({ ...evening(), bodyPartMetadata: undefined }))).toBe(false)
    expect(validateAccountJournalRecordUpdate(original, record({ ...evening(), bodyPartMetadata: { schemaVersion: 1, observations: [] } }))).toBe(true)
  })

  it("excludes private body text on safe restoration and keeps old backup omission non-destructive", () => {
    const safe = fromStructuredJournalPayload({ ...evening(), memo: "SYNTHETIC_INJECTED" })
    expect(safe?.bodyPartMetadata).toBeUndefined()
    const full = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: FULL_FORMAT_V6, entries: [evening()] }))
    expect(full.entries).toEqual([evening()])
    const selected = withoutPrivateBodyPartMetadata(full)
    expect(selected.entries[0]?.bodyPartMetadata).toBeUndefined()
    expect(selected.entries[0]?.kind === "evening" && selected.entries[0].painParts).toEqual({ other_1: 4 })
    const old = { ...evening(), bodyPartMetadata: undefined }
    expect(preserveBodyPartMetadataForRestore(evening(), old).bodyPartMetadata).toEqual(metadata)
    const injected = readBackupFile(JSON.stringify({ app: "TRAINORACLE", format: "trainoracle.journal.full-backup.v5", entries: [evening()] }))
    expect(injected.entries).toEqual([])
    expect(injected.skipped).toBe(1)
  })

  it("preserves local metadata on edit, old backup overwrite, trash restoration and owner switching", async () => {
    expect(saveEntry(evening()).ok).toBe(true)
    const saved = loadEntries()[0]!
    expect(updateEntry({ ...saved, bodyPartMetadata: undefined, savedAt: "2026-10-12T00:01:00Z" }, saved.savedAt).ok).toBe(false)
    const old = { ...evening(), bodyPartMetadata: undefined, savedAt: "2026-10-12T00:01:00Z" }
    const outcome = await restoreEntries(buildRestorePlan([old]), "overwrite-conflicts")
    expect(outcome.restored).toBe(1)
    expect(loadEntries()[0]?.bodyPartMetadata).toEqual(metadata)
    expect(JSON.parse(exportEntriesJSON({ includeRawMemos: true })).format).toBe(FULL_FORMAT_V6)
    expect(JSON.stringify(JSON.parse(exportEntriesJSON()).entries)).not.toContain("SYNTHETIC_PRIVATE")
    expect(assignJournalsToAccount([saved.id], "synthetic-A")).toBe(true)
    setActiveLocalAccount("synthetic-B")
    expect(loadEntries()).toEqual([])
    setActiveLocalAccount("synthetic-A")
    expect(loadEntries()[0]?.bodyPartMetadata).toEqual(metadata)
    const entry = loadEntries()[0]!
    expect(deleteEntry(entry.id).ok).toBe(true)
    expect(loadEntries()).toEqual([])
    expect(restoreDeletedEntry(entry.id).ok).toBe(true)
    expect(loadEntries()[0]?.bodyPartMetadata).toEqual(metadata)
  })

  it("retains an unknown-version original, blocks eligible plan safety and subsequent writes", () => {
    const unknown = { ...evening(), bodyPartMetadata: { ...metadata, schemaVersion: 99 } }
    const raw = JSON.stringify([unknown])
    window.localStorage.setItem(JOURNAL_STORAGE_KEY, raw)
    expect(loadJournalEntriesSnapshot()).toEqual({ entries: [], raw, readStatus: "uncertain" })
    expect(loadEntriesForPlanSafety()).toEqual({ status: "uncertain" })
    expect(evaluatePlanSafety("NO_KNOWN_RISK", new Date("2026-10-12T00:02:00Z")))
      .toEqual({ kind: "blocked", code: "RECENT_JOURNAL_REQUIRES_REVIEW" })
    expect(saveEntry({ ...evening(), id: "second-synthetic" }).ok).toBe(false)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(raw)
    expect(writeVaultAndJournalAtomically(window.localStorage, { version: 1, records: {} }, [])).toBe(false)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(raw)
  })

  it("rejects older whole-array writers omitting a supported companion but permits deliberate deletion", () => {
    expect(saveEntry(evening()).ok).toBe(true)
    const original = window.localStorage.getItem(JOURNAL_STORAGE_KEY)
    expect(writeJournalEntries(window.localStorage, [{ ...evening(), bodyPartMetadata: undefined }], original)).toBe(false)
    expect(writeVaultAndJournalAtomically(window.localStorage, { version: 1, records: {} }, [{ ...evening(), bodyPartMetadata: undefined }])).toBe(false)
    expect(window.localStorage.getItem(JOURNAL_STORAGE_KEY)).toBe(original)
    expect(writeJournalEntries(window.localStorage, [], original)).toBe(true)
  })
})
