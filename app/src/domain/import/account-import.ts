import type { JournalEntry, PostSessionEntry } from "../journal-schema"
import { activeLocalAccount, onLocalJournalScopeChange } from "../account/local-journal-ownership"
import { accountJournalDeletedDocuments, accountJournalDocumentId, accountJournalEntryFingerprint, accountJournalRecordsEnabled, hydrateAccountJournalRecords, persistAccountJournalRecord, readAccountJournalWriteBase, type AccountJournalWriteBase } from "../account/account-journal-record-service"
import { readAccountJournalPrivateEntry, readAccountJournalProjection } from "../account/account-journal-projection"
import { buildImportDrafts, confirmedFileActivity, fileImportCandidateKind, importedProvenance, isWaitingCandidate, sameFileObservation, toImportedEntry } from "./import-draft"
import type { ImportDraftSelection, ImportFormat, ImportSaveResult } from "./import-draft"
import type { ImportedActivity } from "./activity-file"
import { fileAnalysisFormats } from "./file-analysis-policy"
import { validateAccountJournalRecordUpdate } from "../account/account-journal-record-schema"

/** A scope stays invalid after A -> B -> A, even if no promise settled in B. */
export function createAccountImportScope() {
  const ownerId = activeLocalAccount()
  let cancelled = false
  const unsubscribe = onLocalJournalScopeChange(() => {
    if (activeLocalAccount() !== ownerId) cancelled = true
  })
  return {
    ownerId,
    current: () => !cancelled && ownerId !== null && activeLocalAccount() === ownerId && accountJournalRecordsEnabled(),
    dispose: () => { cancelled = true; unsubscribe() },
  }
}

export async function isAccountImportDeleted(ownerId: string, entryId: string) {
  const documentId = await accountJournalDocumentId(ownerId, entryId)
  return accountJournalDeletedDocuments().some(item => item.documentId === documentId)
}

export async function buildAccountImportDrafts(activities: readonly ImportedActivity[]) {
  const scope = createAccountImportScope()
  try {
    if (!scope.current() || !await hydrateAccountJournalRecords() || !scope.current()) return null
    const drafts = buildImportDrafts(activities, readAccountJournalProjection().map(entry => ({ ...entry, syncState: "local" })))
    const bases = new Map<string, WriteBase>()
    for (const candidate of drafts.flatMap(draft => [...draft.reconciliationCandidates, ...(draft.identityCandidates ?? [])])) {
      if (bases.has(candidate.id)) continue
      const base = await readAccountJournalWriteBase(candidate.id)
      if (!scope.current() || !base?.entry || base.entry.savedAt !== candidate.savedAt) return null
      bases.set(candidate.id, { revision: base.revision, contentFingerprint: base.contentFingerprint })
    }
    return drafts.map((draft, sourceIndex) => ({ ...draft, sourceIndex,
      accountWriteBases: Object.fromEntries([...draft.reconciliationCandidates, ...(draft.identityCandidates ?? [])]
        .map(candidate => [candidate.id, bases.get(candidate.id)!])),
    }))
  } finally { scope.dispose() }
}

type WriteBase = Pick<AccountJournalWriteBase, "revision" | "contentFingerprint">
type Prepared = { entry: JournalEntry; expectedSavedAt?: string; expectedBase?: WriteBase; merged: boolean; identified?: boolean; alreadyConfirmed?: boolean; legacyConflict?: boolean }

function sameImportedSnapshot(left: JournalEntry, right: JournalEntry) {
  const normalized = (entry: JournalEntry) => {
    const { savedAt: _time, syncState: _transport, ...body } = entry
    return JSON.stringify(body, (_key, value) => value && typeof value === "object" && !Array.isArray(value)
      ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) : value)
  }
  return normalized(left) === normalized(right)
}

/** One confirmed batch freezes IDs, timestamps and bodies across retries. No file is uploaded. */
export function createAccountImportConfirmation(selections: readonly ImportDraftSelection[], format: ImportFormat) {
  const scope = createAccountImportScope()
  const chosen = structuredClone(selections)
  const prepared = new Map<number, Prepared>()
  const includeFileObservation = fileAnalysisFormats().includes(format)
  const acknowledged = new Set<number>()
  const duplicateRows = new Map<number, number>()
  const invalidRows = new Set<number>()
  const groups = new Map<string, number[]>()
  for (const [index, { draft, intent }] of chosen.entries()) {
    if (!includeFileObservation || intent.kind === "EXCLUDE" || !draft.activity.observation) continue
    const observation = draft.activity.observation
    const keys = observation.sourceActivityId === null ? [] : [`source:${observation.sourceObservationKey}`]
    if (intent.kind === "ADD_TO_EXISTING" || intent.kind === "USE_EXISTING") keys.push(`target:${intent.entryId}`)
    for (const key of keys) groups.set(key, [...(groups.get(key) ?? []), index])
  }
  // Resolve the whole batch before writing: conflicting copies cannot pick a winner by row order.
  for (const indices of groups.values()) {
    const first = indices[0]!, leader = chosen[first]!
    const target = (intent: ImportDraftSelection["intent"]) => "entryId" in intent ? intent.entryId : null
    if (indices.some(index => !sameFileObservation(leader.draft.activity.observation!, chosen[index]!.draft.activity.observation!)
      || leader.draft.activity.observation!.sourceObservationKey !== chosen[index]!.draft.activity.observation!.sourceObservationKey
      || target(leader.intent) !== target(chosen[index]!.intent))) indices.forEach(index => invalidRows.add(index))
    else indices.slice(1).forEach(index => duplicateRows.set(index, first))
  }
  let lastResult: ImportSaveResult | null = null
  let running: Promise<ImportSaveResult | null> | null = null
  for (const [index, selection] of chosen.entries()) {
    if (selection.intent.kind === "SAVE_SEPARATE") prepared.set(index, {
      entry: toImportedEntry(selection.draft.activity, format, {
        includeFileObservation: includeFileObservation && selection.draft.activity.observation !== undefined,
      }), merged: false,
    })
  }
  const run = async (): Promise<ImportSaveResult | null> => {
    const result = { account: 0, pending: 0, saved: 0, merged: 0, reused: 0, excluded: 0, conflicts: 0, failed: 0, total: chosen.length }
    const pendingRows = new Set<number>()
    if (!scope.current()) return null
    if (chosen.every(row => row.intent.kind === "EXCLUDE")) {
      lastResult = { ...result, excluded: chosen.length }
      return lastResult
    }
    if (!await hydrateAccountJournalRecords()) return scope.current()
      ? { ...(lastResult ?? { ...result, failed: chosen.length }), stopReason: "ACCOUNT_UNAVAILABLE" } : null
    const freshDrafts = includeFileObservation ? buildImportDrafts(chosen.filter(row => row.intent.kind !== "EXCLUDE")
      .map(row => row.draft.activity), readAccountJournalProjection()) : []
    for (const [index, { draft, intent }] of chosen.entries()) {
      if (!scope.current()) return null
      if (intent.kind === "EXCLUDE") { result.excluded++; continue }
      if (invalidRows.has(index)) { result.conflicts++; continue }
      const duplicateRow = duplicateRows.get(index)
      if (duplicateRow !== undefined) {
        if (acknowledged.has(duplicateRow)) { acknowledged.add(index); result.reused++ }
        else if (pendingRows.has(duplicateRow)) { pendingRows.add(index); result.pending++ }
        else result.conflicts++
        continue
      }
      let item = prepared.get(index)
      if (item && !item.merged && !item.identified) {
        const observation = item.entry.kind === "post-session" ? item.entry.fileObservation : undefined
        const freshDraft = freshDrafts.find(candidate => candidate.activity === draft.activity)
        if (observation && intent.kind === "SAVE_SEPARATE" && intent.confirmedSeparate !== true
          && (draft.requiresIdentityChoice || freshDraft?.requiresIdentityChoice)) { result.conflicts++; continue }
        // Keep the legacy lookup shape, but never use its row number as new observation identity.
        const { observation: _observation, ...legacyActivity } = draft.activity
        const legacyId = await accountJournalDocumentId(scope.ownerId!, JSON.stringify([
          "confirmed-activity-import-v1", format, draft.sourceIndex ?? index, observation ? legacyActivity : draft.activity,
        ]))
        let id = observation
          ? observation.sourceActivityId === null ? item.entry.id
            : await accountJournalDocumentId(scope.ownerId!, JSON.stringify(["file-observation-import-v1", observation.sourceObservationKey]))
          : legacyId
        const sourceMatches = observation?.sourceActivityId != null ? readAccountJournalProjection().filter((entry): entry is PostSessionEntry =>
          entry.kind === "post-session" && entry.fileObservation?.sourceObservationKey === observation.sourceObservationKey) : []
        if (sourceMatches.length > 1) item.legacyConflict = true
        const matchedSource = sourceMatches[0]
        if (matchedSource) {
          id = matchedSource.id
          const sameFacts = sameFileObservation(matchedSource.fileObservation!, observation!)
          if (!sameFacts) item.legacyConflict = true
          else {
            const base = await readAccountJournalWriteBase(id)
            if (!scope.current()) return null
            if (!base?.entry || base.entry.kind !== "post-session" || !base.entry.fileObservation
              || base.entry.fileObservation.sourceObservationKey !== observation!.sourceObservationKey
              || !sameFileObservation(base.entry.fileObservation, observation!)) item.legacyConflict = true
            else { item.entry = { ...base.entry, syncState: "local" }; item.alreadyConfirmed = true }
          }
        }
        if (!scope.current()) return null
        item.entry = { ...item.entry, id }; item.identified = true
        item.expectedBase = { revision: 0, contentFingerprint: null }
        const existing = readAccountJournalPrivateEntry(id)
        if (!item.alreadyConfirmed && existing && sameImportedSnapshot(existing, item.entry)) {
          const base = await readAccountJournalWriteBase(id)
          if (!scope.current()) return null
          item.entry = { ...existing, syncState: "local" }
          item.alreadyConfirmed = Boolean(observation && base?.entry && sameImportedSnapshot(base.entry, item.entry))
        }
        // A legacy row is never silently promoted or duplicated by the new identity scheme.
        if (observation && !item.alreadyConfirmed && legacyId !== id && readAccountJournalPrivateEntry(legacyId)
          && !(intent.kind === "SAVE_SEPARATE" && intent.confirmedSeparate)) {
          item.legacyConflict = true
        }
      }
      if (item?.legacyConflict) { result.conflicts++; continue }
      if (acknowledged.has(index)) {
        result.account++; if (item?.alreadyConfirmed) result.reused++; else if (item?.merged) result.merged++; else result.saved++
        continue
      }
      const entryId = "entryId" in intent ? intent.entryId : item?.entry.id
      if (!entryId) { result.failed++; continue }
      // Rehydrate immediately before overwriting, including on retry.
      if ("entryId" in intent && !await hydrateAccountJournalRecords()) {
        if (!scope.current()) return null
        result.failed++; continue
      }
      if (!scope.current()) return null
      const deleted = await isAccountImportDeleted(scope.ownerId!, entryId)
      if (!scope.current()) return null
      if (deleted) { result.conflicts++; continue }
      if (item?.alreadyConfirmed) {
        acknowledged.add(index); result.account++; result.reused++; continue
      }
      if (!item && "entryId" in intent) {
        const observation = includeFileObservation ? draft.activity.observation : undefined
        if (observation?.sourceActivityId != null && readAccountJournalProjection().some(entry => entry.id !== intent.entryId
          && entry.kind === "post-session" && entry.fileObservation?.sourceObservationKey === observation.sourceObservationKey)) {
          result.conflicts++; continue
        }
        const expectedBase = draft.accountWriteBases?.[intent.entryId]
        const base = await readAccountJournalWriteBase(intent.entryId)
        if (!scope.current()) return null
        if (!expectedBase || !base || base.revision !== expectedBase.revision
          || base.contentFingerprint !== expectedBase.contentFingerprint) { result.conflicts++; continue }
        const full = base.entry
        const current = full ? { ...full, syncState: "local" as const } : null
        const candidateKind = current ? fileImportCandidateKind(current, draft.activity) : null
        if (!current || current.kind !== "post-session" || current.savedAt !== intent.expectedSavedAt
          || (intent.kind === "ADD_TO_EXISTING" ? !isWaitingCandidate(current, draft.activity.date) || current.fieldProvenance === undefined
            : !includeFileObservation || !draft.identityCandidates?.some(candidate => candidate.id === current.id && candidate.kind === candidateKind)
              || candidateKind !== "REUSE" && candidateKind !== "ATTACH")) {
          result.conflicts++; continue
        }
        if (intent.kind === "USE_EXISTING" && candidateKind === "REUSE") {
          prepared.set(index, { entry: current, merged: false, identified: true, alreadyConfirmed: true })
          acknowledged.add(index); result.account++; result.reused++; continue
        }
        const source = includeFileObservation && draft.activity.observation !== undefined
          ? confirmedFileActivity(draft.activity, format) : draft.activity
        if (!source) { result.failed++; continue }
        const imported = importedProvenance(source, format)
        const entry: PostSessionEntry = { ...current,
          savedAt: new Date(Math.max(Date.now(), Date.parse(current.savedAt) + 1)).toISOString(),
          ...(current.objectiveDataState === "WAITING" && [source.distanceKm, source.durationMin, source.avgPace].some(value => value !== "")
            ? { objectiveDataState: "CONFIRMED" as const } : {}), distanceKm: source.distanceKm,
          durationMin: source.durationMin, avgPace: source.avgPace,
          ...(includeFileObservation && source.observation ? { fileObservation: source.observation } : {}),
          fieldProvenance: { ...current.fieldProvenance,
            ...Object.fromEntries((["distanceKm", "durationMin", "avgPace"] as const).map(field => [field,
              current[field] === source[field] && current.fieldProvenance?.[field] ? current.fieldProvenance[field] : imported[field]!])),
          },
        }
        if (entry.fileObservation && !validateAccountJournalRecordUpdate(
          { version: current.fileObservation ? 3 : 2, state: "FINALIZED", kind: "JOURNAL", entry: current },
          { version: 3, state: "FINALIZED", kind: "JOURNAL", entry }, "FILE_OBSERVATION")) { result.conflicts++; continue }
        item = { entry, expectedSavedAt: intent.expectedSavedAt, expectedBase, merged: true }
        prepared.set(index, item)
      }
      if (!item || !scope.current()) return null
      const current = readAccountJournalPrivateEntry(entryId)
      const fingerprint = current ? await accountJournalEntryFingerprint(current) : null
      const retryFingerprint = await accountJournalEntryFingerprint(item.entry)
      if (!scope.current()) return null
      if (fingerprint !== retryFingerprint && fingerprint !== item.expectedBase?.contentFingerprint) { result.conflicts++; continue }
      try {
        const purpose = item.entry.kind === "post-session" && item.entry.fileObservation ? "FILE_OBSERVATION" : "MIGRATION"
        const saved = await persistAccountJournalRecord(item.entry, item.expectedSavedAt, purpose, item.expectedBase)
        if (!scope.current()) return null
        if (!saved.ok) {
          result.failed += chosen.slice(index).filter(row => row.intent.kind !== "EXCLUDE").length
          result.excluded += chosen.slice(index).filter(row => row.intent.kind === "EXCLUDE").length
          lastResult = { ...result, stopReason: "SAVE_REJECTED" }
          return lastResult
        }
        else if (saved.storage === "CONFLICT") result.conflicts++
        else if (saved.storage === "PENDING") { pendingRows.add(index); result.pending++ }
        else { acknowledged.add(index); result.account++; if (item.merged) result.merged++; else result.saved++ }
      } catch { if (!scope.current()) return null; result.failed++ }
    }
    lastResult = { ...result }
    return result
  }
  return {
    confirm: () => {
      if (running) return running
      running = run().finally(() => { running = null })
      return running
    },
    dispose: scope.dispose,
  }
}
