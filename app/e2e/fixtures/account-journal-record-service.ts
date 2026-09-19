import * as service from "../../src/domain/account/account-journal-record-service"
import * as projection from "../../src/domain/account/account-journal-projection"
import { createAccountDocumentBuffer } from "../../src/domain/account/account-journal-draft-buffer"
import { accountJournalRecordSchema, correctAccountJournalImportedObservation } from "../../src/domain/account/account-journal-record-schema"
import { activeLocalAccount, setActiveLocalAccount } from "../../src/domain/account/local-journal-ownership"
import { accountJournalPreviewEnabled } from "../../src/domain/account/account-journal-api"
import { JOURNAL_STORAGE_KEY } from "../../src/domain/journal-local-storage"
import { loadEntries, loadAnalysisEntries, loadEntriesWithPrivateMemos, replaceEntriesOwnedBy, legacyJournalWritesBlocked } from "../../src/domain/journal-store"
import { waitingJournal } from "../../src/test/progressive-journal-fixture"
import { privateEntry } from "../../src/domain/private-memo-test-fixtures"
import { parseJournalEntryForWrite } from "../../src/domain/journal-schema"
import { createPlannedSessionLogDraft } from "../../src/domain/planned-session-link"
import { buildFileObservation, toFileObservationSummary } from "../../src/domain/import/file-observation"
import type { ComparisonRelationV1 } from "../../src/domain/import/comparison-relation"
import { projectStructuredJournalObservations } from "../../src/domain/journal-observation"
import { acceptsFileDistance } from "../../src/domain/analysis-field-eligibility"
import { buildFileAnalysisReport } from "../../src/domain/import/file-analysis"

export const owner = "11111111-1111-4111-8111-111111111111"
export const otherOwner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
const databaseName = "trainoracle-account-journal-records-v1"

async function view(id: string, ownerId = owner) {
  const buffer = createAccountDocumentBuffer(accountJournalRecordSchema, databaseName)
  try { return await buffer.read(ownerId, await service.accountJournalDocumentId(ownerId, id)) }
  finally { buffer.close() }
}

async function rawRecords() {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise<unknown[]>((resolve, reject) => {
      const tx = db.transaction("drafts", "readonly")
      const request = tx.objectStore("drafts").getAll()
      tx.oncomplete = () => resolve(request.result)
      tx.onabort = () => reject(tx.error)
    })
  } finally { db.close() }
}

export function setup(ownerId = owner) {
  setActiveLocalAccount(ownerId)
  const base = waitingJournal()
  const ordinary = waitingJournal({ id: "ordinary", memo: "SYNTHETIC_ORDINARY_BODY", memoPurpose: "ANALYZABLE_TRAINING_NOTE",
    rpe: 6, fieldProvenance: { ...base.fieldProvenance, rpe: { provenance: "EXPLICIT" } } })
  const privateRecord = { ...privateEntry("private", "SYNTHETIC_PRIVATE_BODY"),
    rpe: 4, fieldProvenance: { rpe: { provenance: "EXPLICIT" as const } } }
  if (!parseJournalEntryForWrite(ordinary) || !parseJournalEntryForWrite(privateRecord)) throw new Error("Invalid existing fixture")
  const harness = { ...service, ...projection, owner, otherOwner, ordinary, privateRecord,
    currentFileAnalysis() {
      const cached = projection.readAccountJournalProjection(), current = projection.readCurrentConfirmedAccountJournalProjection()
      return { accepted: projectStructuredJournalObservations(cached, { formats: ["tcx"] }).some(acceptsFileDistance),
        included: buildFileAnalysisReport(current, { formats: ["tcx"], sourceContext: "ACCOUNT_CONFIRMED",
          startDate: ordinary.date, endDate: ordinary.date }).includedSourceCount }
    },
    comparisonRelation(): ComparisonRelationV1 {
      const { entry } = harness.fileRecord()
      const session = { day: 1, slot: "AM" as const, role: "EASY" as const, plannedEnergyIntent: "BASE_INTENT" as const, prescription: null }
      const link = createPlannedSessionLogDraft({ intake: { startDate: entry.date }, generatedAt: entry.savedAt,
        activePlan: { candidateId: "synthetic-original", sessions: [session] } }, session, entry.savedAt)!.link
      return { schemaVersion: 1, relationId: "10000000-0000-4000-8000-000000000001", journalId: entry.id,
        journalRevisionAtConfirmation: 1, contentRevisionFingerprint: entry.fileObservation.contentRevisionFingerprint,
        observationInterpretationFingerprint: `sha256:${"a".repeat(64)}`, original: { planFingerprint: `sha256:${"b".repeat(64)}`, session: link },
        mappingVersion: 1, mappingConfirmation: "USER_CONFIRMED", createdAt: "2026-01-01T00:00:00Z", releasedAt: null,
        segmentMappings: [{ planSegmentId: "SYNTHETIC_COMPARISON_SEGMENT", sourceLapIndex: 0, confirmedKind: "WORK", confirmedTargetUnit: "DISTANCE",
          confirmedDurationMeaning: "TIMER", confirmedRecoveryMode: null }] }
    },
    createRecordBuffer: () => createAccountDocumentBuffer(accountJournalRecordSchema, databaseName),
    correctAccountJournalImportedObservation,
    fileRecord() {
      const fileObservation = buildFileObservation({ format: "tcx", sourceProfile: "TCX_ACTIVITY_V1", parserVersion: "tcx-v1",
        sourceActivityId: "SYNTHETIC_OBSERVATION_ONLY", date: ordinary.date, startedAt: null, timeZone: null,
        sport: "RUNNING", distanceMeters: 5000, durationSeconds: 1800, durationMeaning: "SOURCE_DEFINED",
        laps: [{ sourceIndex: 0, distanceMeters: 5000, durationSeconds: 1800, durationMeaning: "SOURCE_DEFINED", kind: "UNKNOWN" }],
        confirmation: { sport: null, durationMeaning: null } })
      const entry = { ...ordinary, ...toFileObservationSummary(fileObservation), objectiveDataState: "CONFIRMED" as const, fileObservation }
      const { schemaVersion, source, completeness, contentRevisionFingerprint, sourceObservationKey, ...input } = fileObservation
      const replacement = buildFileObservation({ ...input, distanceMeters: 5100, laps: [{ ...input.laps[0]!, distanceMeters: 5100 }] })
      return { entry, replacement }
    },
    setActiveLocalAccount, activeLocalAccount, loadEntries, loadAnalysisEntries, loadEntriesWithPrivateMemos,
    parseJournalEntryForWrite,
    linkedEntry() {
      const session = { day: 1, slot: "AM" as const, role: "EASY" as const, plannedEnergyIntent: "BASE_INTENT" as const, prescription: {} }
      const draft = createPlannedSessionLogDraft({ intake: { startDate: ordinary.date }, generatedAt: ordinary.savedAt,
        activePlan: { candidateId: "synthetic-candidate", sessions: [session] } }, session, ordinary.savedAt)
      if (!draft) throw new Error("Synthetic link failed")
      return waitingJournal({ ...ordinary, plannedSessionLink: draft.link, planExecutionRelation: "AS_PLANNED",
        fieldProvenance: { ...ordinary.fieldProvenance, plannedSessionLink: { provenance: "EXPLICIT" } } })
    },
    seedLegacy(syncState: "local" | "synced", count = 1) {
      // Reproduce a legitimate pre-cutover owned sync snapshot through the
      // guarded legacy writer, then restore cutover before testing migration.
      const previousFlag = window.__accountRecordFeatureEnabled
      window.__accountRecordFeatureEnabled = false
      try {
        if (accountJournalPreviewEnabled() || legacyJournalWritesBlocked(ownerId)) throw new Error("Seeding must precede cutover")
        if (!replaceEntriesOwnedBy(ownerId, Array.from({ length: count }, (_, index) => ({ ...ordinary,
          id: index === 0 ? ordinary.id : `${ordinary.id}-${index}`, syncState }))).ok) throw new Error("Synthetic seeding failed")
        return localStorage.getItem(JOURNAL_STORAGE_KEY)
      } finally { window.__accountRecordFeatureEnabled = previousFlag }
    },
    legacyWritesBlocked: () => legacyJournalWritesBlocked(ownerId),
    legacyRaw: () => localStorage.getItem(JOURNAL_STORAGE_KEY),
    view, rawRecords, pending: null as Promise<unknown> | null }
  window.accountRecordHarness = harness
  return harness
}

declare global {
  interface Window { accountRecordHarness: ReturnType<typeof setup>; __accountRecordFeatureEnabled?: boolean }
}
