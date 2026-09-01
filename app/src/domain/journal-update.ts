import { hasImportedField, isImportedField } from "./field-provenance"
import type { FieldProvenanceMap } from "./field-provenance"
import { journalStorage, writeJournalEntries } from "./journal-local-storage"
import { isPrivateMemoEntry, removePrivateMemoWithJournalEntries } from "./private-memo-vault"
import { parseJournalEntryForWrite } from "./journal-schema"
import type { JournalEntry } from "./journal-schema"
import { loadJournalEntriesSnapshot } from "./journal-store"
import { isJournalVisible } from "./account/local-journal-ownership"
import { samePlannedSessionLink } from "./planned-session-link"

export type UpdateEntryResult = {
  readonly ok: boolean
  readonly total: number
}

function keepsImmutableIdentity(previous: JournalEntry, next: JournalEntry): boolean {
  const keepsPlanLink = previous.kind !== "post-session" || next.kind !== "post-session"
    ? true
    : samePlannedSessionLink(previous.plannedSessionLink, next.plannedSessionLink)
  return previous.id === next.id
    && previous.kind === next.kind
    && previous.date === next.date
    && previous.syncState === next.syncState
    && keepsPlanLink
}

function hasNewerSavedAt(previous: JournalEntry, next: JournalEntry): boolean {
  const previousTime = Date.parse(previous.savedAt)
  const nextTime = Date.parse(next.savedAt)
  return Number.isFinite(nextTime)
    && (!Number.isFinite(previousTime) || nextTime > previousTime)
}

function provenanceValues(entry: JournalEntry): Readonly<Record<string, unknown>> {
  switch (entry.kind) {
    case "post-session":
      return {
        activityOutcome: entry.activityOutcome,
        activitySlot: entry.activitySlot,
        distanceKm: entry.distanceKm,
        durationMin: entry.durationMin,
        avgPace: entry.avgPace,
        rpe: entry.rpe,
        rpeBand: entry.rpeBand,
        plannedRpe: entry.intensityAssessment?.plannedRpe,
        objectiveComponents: entry.intensityAssessment?.objectiveComponents,
      }
    case "evening":
      return {
        sleepH: entry.sleepH,
        sleepQuality: entry.sleepQuality,
        weightKg: entry.weightKg,
        restingHr: entry.restingHr,
        painParts: entry.painParts,
        mood: entry.mood,
      }
    case "race":
      return {
        tension: entry.tension,
        condition: entry.condition,
        mood: entry.mood,
        goalPace: entry.goalPace,
      }
  }
}

function sameStructuredValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true
  return JSON.stringify(left) === JSON.stringify(right)
}

function keepsImportedObjectiveFacts(previous: JournalEntry, next: JournalEntry): boolean {
  if (previous.kind !== "post-session" || next.kind !== "post-session") return true
  const fields = ["distanceKm", "durationMin", "avgPace"] as const
  return fields.every((field) => !isImportedField(field, previous.fieldProvenance)
    || (sameStructuredValue(previous[field], next[field])
      && sameStructuredValue(previous.fieldProvenance?.[field], next.fieldProvenance?.[field])))
}

function mergeProvenance(
  previous: JournalEntry,
  next: JournalEntry,
): FieldProvenanceMap | undefined {
  const previousProvenance = previous.fieldProvenance
  if (previousProvenance === undefined) return undefined

  const nextProvenance = next.fieldProvenance ?? {}
  const previousValues = provenanceValues(previous)
  const nextValues = provenanceValues(next)
  const merged: Record<string, FieldProvenanceMap[string]> = {}
  const fields = new Set([
    ...Object.keys(previousProvenance),
    ...Object.keys(nextProvenance),
  ])

  for (const field of fields) {
    const selected = sameStructuredValue(previousValues[field], nextValues[field])
      ? previousProvenance[field]
      : nextProvenance[field]
    if (selected !== undefined) merged[field] = selected
  }
  return merged
}

function preserveProvenance(previous: JournalEntry, next: JournalEntry): JournalEntry {
  const fieldProvenance = mergeProvenance(previous, next)
  if (fieldProvenance !== undefined) return { ...next, fieldProvenance }
  const { fieldProvenance: _discardedProvenance, ...legacyEntry } = next
  return legacyEntry
}

export function nextJournalSavedAt(previousSavedAt?: string): string {
  const previousTime = previousSavedAt === undefined ? Number.NaN : Date.parse(previousSavedAt)
  const nextTime = Number.isFinite(previousTime)
    ? Math.max(Date.now(), previousTime + 1)
    : Date.now()
  return new Date(nextTime).toISOString()
}

export function updateEntry(entry: unknown, expectedSavedAt: string): UpdateEntryResult {
  const snapshot = loadJournalEntriesSnapshot()
  const entries = snapshot.entries
  const nextEntry = parseJournalEntryForWrite(entry)
  if (nextEntry === null) return { ok: false, total: entries.length }
  if (!isJournalVisible(nextEntry.id)) return { ok: false, total: entries.filter((current) => isJournalVisible(current.id)).length }

  const matchingEntries = entries.filter((current) => current.id === nextEntry.id)
  if (matchingEntries.length !== 1) return { ok: false, total: entries.length }

  const entryIndex = entries.findIndex((current) => current.id === nextEntry.id)
  if (entryIndex < 0) return { ok: false, total: entries.length }
  const previous = entries[entryIndex]
  if (previous === undefined) return { ok: false, total: entries.length }
  if (previous.syncState !== "local"
    || (hasImportedField(previous.fieldProvenance) && !keepsImportedObjectiveFacts(previous, nextEntry))) {
    return { ok: false, total: entries.length }
  }
  if (previous.savedAt !== expectedSavedAt) return { ok: false, total: entries.length }
  if (!keepsImmutableIdentity(previous, nextEntry)) return { ok: false, total: entries.length }
  if (!hasNewerSavedAt(previous, nextEntry)) return { ok: false, total: entries.length }

  const localStorage = journalStorage()
  if (localStorage === null) return { ok: false, total: entries.length }
  const nextEntries = entries.slice()
  nextEntries[entryIndex] = preserveProvenance(previous, nextEntry)
  const nextText = nextEntry.kind === "evening" ? nextEntry.note : nextEntry.memo
  const removesPrivateMemo = isPrivateMemoEntry(previous)
    && (!isPrivateMemoEntry(nextEntry) || nextText.trim() === "")
  const ok = removesPrivateMemo
    ? removePrivateMemoWithJournalEntries(localStorage, nextEntries, previous.id, snapshot.raw)
    : writeJournalEntries(localStorage, nextEntries, snapshot.raw)
  return { ok, total: entries.length }
}
