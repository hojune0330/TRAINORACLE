import { beforeEach, describe, expect, it } from "vitest"
import { canonicalJsonFingerprint } from "@impl/plan-generator/candidate-identity"
import { addToJournal, waitingJournal, watchActivity } from "../../test/progressive-journal-fixture"
import { buildImportDrafts, confirmImportDrafts, toImportedEntry } from "./import-draft"
import type { ImportDraftSelection } from "./import-draft"
import { loadEntries, loadEntriesWithPrivateMemos, nextJournalSavedAt, saveEntry, savePrivateEntry, updateEntry, updateEntryPreservingMemo, updatePrivateEntry } from "../journal-store"
import { PRIVATE_MEMO_VAULT_STORAGE_KEY } from "../private-memo-vault"
import type { PostSessionEntry } from "../journal-schema"
import { canEditJournalEntry, IMPORTED_OBJECTIVE_FIELDS } from "../journal-edit-policy"
import { toAnalysisJournalEntry } from "../safe-export"
import { toUploadPayload } from "../account/sync-local"
import { createRecoveryCode } from "../account/private-note-crypto"
import { saveSessionRecoveryCode } from "../account/private-note-sync"
import { setActiveLocalAccount } from "../account/local-journal-ownership"

beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); setActiveLocalAccount(null) })

function stored(): PostSessionEntry {
  const entry = loadEntries()[0]
  if (entry?.kind !== "post-session") throw new Error("Expected one synthetic post-session")
  return entry
}

function mixedEntry(original = waitingJournal()): PostSessionEntry {
  expect(saveEntry(original).ok).toBe(true)
  const draft = buildImportDrafts([watchActivity])[0]!
  expect(confirmImportDrafts([addToJournal(draft, original)], "csv").merged).toBe(1)
  return stored()
}

describe("progressive import reconciliation", () => {
  it.each(["unlocked", "locked"])("P1 preserves an existing private memo during %s reconciliation", async (access) => {
    const recoveryCode = createRecoveryCode()
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    const initial = waitingJournal({ captureDepth: "DETAILED", memoPurpose: "PRIVATE_SELF_ONLY", memo: "Synthetic memo written before import" })
    expect((await savePrivateEntry(initial)).ok).toBe(true)
    const vaultBefore = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    expect(vaultBefore).not.toBeNull()
    if (access === "locked") window.sessionStorage.clear()
    const shell = stored()
    expect(shell.memo).toBe("")
    const draft = buildImportDrafts([watchActivity])[0]!
    expect(confirmImportDrafts([addToJournal(draft, shell)], "csv")).toMatchObject({ merged: 1, failed: 0 })
    expect(stored()).toMatchObject({ id: initial.id, distanceKm: "5.00", memo: "", memoPurpose: "PRIVATE_SELF_ONLY" })
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(vaultBefore)
    expect(saveSessionRecoveryCode(recoveryCode)).toBe(true)
    expect((await loadEntriesWithPrivateMemos())[0]).toMatchObject({ memo: initial.memo })
  })

  it("P2-1 keeps a detailed WAITING journal eligible for same-entry reconciliation", () => {
    const original = waitingJournal({ captureDepth: "DETAILED" })
    expect(saveEntry(original).ok).toBe(true)
    const draft = buildImportDrafts([watchActivity])[0]!
    expect(draft.reconciliationCandidates.map((entry) => entry.id)).toEqual([original.id])
    expect(confirmImportDrafts([addToJournal(draft, original)], "csv"))
      .toMatchObject({ saved: 0, merged: 1, conflicts: 0, failed: 0 })
    expect(loadEntries()).toHaveLength(1)
    expect(stored()).toMatchObject({ id: original.id, captureDepth: "DETAILED", objectiveDataState: "CONFIRMED" })
  })

  it("P2-3 saves a distinct similar activity separately despite duplicate suspicion", () => {
    const original = toImportedEntry({ ...watchActivity, distanceKm: "5.10" }, "csv")
    expect(saveEntry(original).ok).toBe(true)
    const draft = buildImportDrafts([watchActivity])[0]!
    expect(draft.duplicateOf).toBe(original.id)
    expect(confirmImportDrafts([{ draft, intent: { kind: "SAVE_SEPARATE" } }], "csv"))
      .toMatchObject({ saved: 1, merged: 0, conflicts: 0 })
    expect(loadEntries()).toHaveLength(2)
    expect(loadEntries().find((entry) => entry.id === original.id)).toEqual(original)
  })

  it("requires explicit intent and preserves both AM/PM candidates until one is selected", () => {
    const am = waitingJournal()
    const pm = waitingJournal({ id: "synthetic-pm", activitySlot: "PM" })
    expect(saveEntry(am).ok).toBe(true)
    expect(saveEntry(pm).ok).toBe(true)
    const draft = buildImportDrafts([watchActivity])[0]!
    expect(draft.reconciliationCandidates.map((entry) => entry.id)).toEqual([am.id, pm.id])
    const invalid = { draft } as ImportDraftSelection
    expect(confirmImportDrafts([invalid], "csv")).toMatchObject({ failed: 1, saved: 0, merged: 0 })
    expect(loadEntries()).toEqual([am, pm])
    expect(confirmImportDrafts([addToJournal(draft, pm)], "csv").merged).toBe(1)
    expect(loadEntries().find((entry) => entry.id === am.id)).toEqual(am)
    expect(loadEntries().find((entry) => entry.id === pm.id)).toMatchObject({ distanceKm: "5.00", activitySlot: "PM" })
  })

  it.each(["RESTED", "SKIPPED"] as const)("never reconciles a %s record, even with a crafted intent", (activityOutcome) => {
    const { activitySlot: _slot, painCheckStatus: _pain, ...original } = waitingJournal()
    const entry = { ...original, activityOutcome, objectiveDataState: "NONE" as const,
      fieldProvenance: { activityOutcome: { provenance: "EXPLICIT" as const }, plannedSessionLink: { provenance: "MISSING" as const }, planExecutionRelation: original.fieldProvenance!.planExecutionRelation! } }
    expect(saveEntry(entry).ok).toBe(true)
    const draft = buildImportDrafts([watchActivity])[0]!
    expect(draft.reconciliationCandidates).toEqual([])
    expect(confirmImportDrafts([addToJournal(draft, entry)], "csv").conflicts).toBe(1)
    expect(stored()).toEqual(entry)
  })

  it("rejects stale, wrong-date, and repeated target selections without overwriting", () => {
    const original = waitingJournal()
    expect(saveEntry(original).ok).toBe(true)
    const draft = buildImportDrafts([watchActivity])[0]!
    expect(updateEntry({ ...original, title: "New revision", savedAt: nextJournalSavedAt(original.savedAt) }, original.savedAt).ok).toBe(true)
    expect(confirmImportDrafts([addToJournal(draft, original)], "csv").conflicts).toBe(1)
    const current = stored()
    const wrongDate = { ...draft, activity: { ...watchActivity, date: "2026-09-01" } }
    expect(confirmImportDrafts([addToJournal(wrongDate, current)], "csv").conflicts).toBe(1)
    const selection = addToJournal(draft, current)
    expect(confirmImportDrafts([selection, selection], "csv")).toMatchObject({ merged: 1, conflicts: 1 })
    expect(stored().title).toBe("New revision")
  })

  it("preserves an exact plan link and never creates a link for a generic record", () => {
    const target = { planVersionId: `sha256:${"a".repeat(64)}`, candidateFingerprint: `sha256:${"b".repeat(64)}`,
      sessionContentFingerprint: `sha256:${"c".repeat(64)}`, plannedDate: watchActivity.date,
      sessionDay: 1, sessionSlot: "AM" as const, plannedRole: "EASY" as const, plannedEnergyIntent: "BASE_INTENT" as const }
    const link = { ...target, schemaVersion: 1 as const, plannedSessionId: canonicalJsonFingerprint("trainoracle.planned-session.v1", target),
      linkSource: "ATHLETE_SELECTED_FROM_PLAN" as const, linkedAt: "2026-09-02T00:00:00.000Z" }
    const q = waitingJournal()
    const entry = mixedEntry({ ...q, plannedSessionLink: link, planExecutionRelation: "AS_PLANNED",
      fieldProvenance: { ...q.fieldProvenance, plannedSessionLink: { provenance: "EXPLICIT" } } })
    expect(entry.plannedSessionLink).toEqual(link)
    expect(toUploadPayload(entry, { enabled: true, shareTrainingNotes: true })?.plannedSessionLink).toEqual(link)
    expect(updateEntry({ ...entry, plannedSessionLink: undefined, planExecutionRelation: undefined,
      savedAt: nextJournalSavedAt(entry.savedAt) }, entry.savedAt).ok).toBe(false)
    window.localStorage.clear()
    expect(mixedEntry().plannedSessionLink).toBeUndefined()
  })
})

describe("mixed-origin storage protections", () => {
  it.each(["text", "purpose"])("rejects a memo %s change through the source-preserving write path", async (change) => {
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    const initial = waitingJournal({ memo: "Synthetic private memo", memoPurpose: "PRIVATE_SELF_ONLY" })
    expect((await savePrivateEntry(initial)).ok).toBe(true)
    const previous = stored()
    const vaultBefore = window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
    const next = { ...previous, savedAt: nextJournalSavedAt(previous.savedAt),
      ...(change === "text" ? { memo: "Attempted replacement" } : { memoPurpose: undefined }) }
    expect(updateEntryPreservingMemo(next, previous.savedAt).ok).toBe(false)
    expect(stored()).toEqual(previous)
    expect(window.localStorage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)).toBe(vaultBefore)
  })

  it.each(["ordinary", "private"] as const)("allows subjective and diary edits through the %s write path", async (path) => {
    const entry = mixedEntry()
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    const next = { ...entry, rpe: 7, memo: "Synthetic diary only", savedAt: nextJournalSavedAt(entry.savedAt),
      memoPurpose: path === "private" ? "PRIVATE_SELF_ONLY" as const : "ANALYZABLE_TRAINING_NOTE" as const,
      fieldProvenance: { ...entry.fieldProvenance, rpe: { provenance: "EXPLICIT" as const } } }
    const result = path === "private" ? await updatePrivateEntry(next, entry.savedAt) : updateEntry(next, entry.savedAt)
    expect(result.ok).toBe(true)
    expect(stored()).toMatchObject({ id: entry.id, rpe: 7, distanceKm: "5.00" })
    for (const field of IMPORTED_OBJECTIVE_FIELDS) expect(stored().fieldProvenance?.[field]).toEqual(entry.fieldProvenance?.[field])
    const analysis = toAnalysisJournalEntry(stored())
    expect(analysis).toMatchObject({ rpe: 7, distanceKm: "", durationMin: "", avgPace: "", title: "" })
    expect(analysis).not.toHaveProperty("memo")
    const payload = toUploadPayload(next, { enabled: true, shareTrainingNotes: true })
    expect(payload).not.toHaveProperty("memo")
    expect(payload).not.toHaveProperty("memoPurpose")
    if (path === "private") {
      expect(window.localStorage.getItem("trainoracle.journal.v1")).not.toContain(next.memo)
      expect((await loadEntriesWithPrivateMemos())[0]).toMatchObject({ memo: next.memo })
    }
  })

  for (const path of ["ordinary", "private"] as const) {
    for (const field of IMPORTED_OBJECTIVE_FIELDS) {
      it.each(["value", "provenance", "missing provenance"] as const)(`rejects ${path} ${field} %s tampering`, async (mutation) => {
        const entry = mixedEntry()
        expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
        const provenance = { ...entry.fieldProvenance }
        if (mutation === "provenance") provenance[field] = { provenance: "EXPLICIT" }
        if (mutation === "missing provenance") delete provenance[field]
        const next = { ...entry, ...(mutation === "value" ? { [field]: "99" } : {}), fieldProvenance: provenance,
          savedAt: nextJournalSavedAt(entry.savedAt), memo: "Synthetic private note", memoPurpose: "PRIVATE_SELF_ONLY" as const }
        const result = path === "private" ? await updatePrivateEntry(next, entry.savedAt)
          : updateEntry({ ...next, memo: "", memoPurpose: undefined }, entry.savedAt)
        expect(result.ok).toBe(false)
        expect(stored()).toEqual(entry)
      })
    }
  }

  it("does not promote unchanged derived RPE through the private-vault path", async () => {
    const q = waitingJournal()
    const derived = { provenance: "DERIVED" as const, derivedFrom: ["durationMin"], derivationRuleId: "unregistered-test-rule" }
    const entry = mixedEntry({ ...q, rpe: 6, fieldProvenance: { ...q.fieldProvenance, rpe: derived } })
    expect(saveSessionRecoveryCode(createRecoveryCode())).toBe(true)
    expect((await updatePrivateEntry({ ...entry, memo: "Synthetic note", memoPurpose: "PRIVATE_SELF_ONLY",
      savedAt: nextJournalSavedAt(entry.savedAt), fieldProvenance: { ...entry.fieldProvenance, rpe: { provenance: "EXPLICIT" } } }, entry.savedAt)).ok).toBe(true)
    expect(stored().fieldProvenance?.rpe).toEqual(derived)
    expect(toAnalysisJournalEntry(stored())).toMatchObject({ rpe: 0 })
  })

  it("retains guards for standalone imported records, unknown imported fields, and other owners", async () => {
    const standalone = toImportedEntry(watchActivity, "csv")
    expect(canEditJournalEntry(standalone)).toBe(false)
    setActiveLocalAccount("synthetic-owner")
    const entry = mixedEntry()
    expect(canEditJournalEntry({ ...entry, fieldProvenance: { ...entry.fieldProvenance, rpe: entry.fieldProvenance!.distanceKm! } })).toBe(false)
    setActiveLocalAccount("another-synthetic-owner")
    const next = { ...entry, rpe: 7, savedAt: nextJournalSavedAt(entry.savedAt) }
    expect(updateEntry(next, entry.savedAt).ok).toBe(false)
    expect((await updatePrivateEntry({ ...next, memo: "Synthetic note", memoPurpose: "PRIVATE_SELF_ONLY" }, entry.savedAt)).ok).toBe(false)
  })
})
