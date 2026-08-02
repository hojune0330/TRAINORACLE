import { z } from "zod"
import type { JournalEntry } from "../journal-schema"
import { toExportJournalEntry } from "../safe-export"
import { tombstonedIds } from "./tombstone"

const CONSENT_KEY = "trainoracle.sync.consent.v1"
const BINDING_KEY = "trainoracle.sync.owner.v1"

const syncConsentSchema = z.object({
  enabled: z.boolean(),
  shareTrainingNotes: z.boolean(),
})

export type SyncConsent = z.infer<typeof syncConsentSchema>

const DEFAULT_CONSENT: SyncConsent = { enabled: false, shareTrainingNotes: false }

function storage(): Storage | null {
  try {
    if (typeof window === "undefined") return null
    return window.localStorage
  } catch {
    return null
  }
}

export function loadSyncConsent(): SyncConsent {
  const localStorage = storage()
  if (localStorage === null) return DEFAULT_CONSENT
  try {
    const raw = localStorage.getItem(CONSENT_KEY)
    if (raw === null) return DEFAULT_CONSENT
    const parsedJson: unknown = JSON.parse(raw)
    const parsed = syncConsentSchema.safeParse(parsedJson)
    return parsed.success ? parsed.data : DEFAULT_CONSENT
  } catch (error) {
    if (error instanceof SyntaxError) return DEFAULT_CONSENT
    throw error
  }
}

export function saveSyncConsent(consent: SyncConsent): boolean {
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(consent))
    return true
  } catch {
    return false
  }
}

export function claimSyncBinding(userId: string): boolean {
  if (userId === "") return false
  const localStorage = storage()
  if (localStorage === null) return false
  try {
    const boundUserId = localStorage.getItem(BINDING_KEY)
    if (boundUserId !== null) return boundUserId === userId
    localStorage.setItem(BINDING_KEY, userId)
    return localStorage.getItem(BINDING_KEY) === userId
  } catch {
    return false
  }
}

export function mergeEntries(
  local: readonly JournalEntry[],
  remote: readonly JournalEntry[],
  deletedIds: ReadonlySet<string> = tombstonedIds(),
): JournalEntry[] {
  const byId = new Map<string, JournalEntry>()
  for (const entry of remote) byId.set(entry.id, entry)
  for (const entry of local) {
    const existing = byId.get(entry.id)
    if (existing === undefined || entry.savedAt >= existing.savedAt) {
      byId.set(entry.id, entry)
    }
  }
  for (const id of deletedIds) byId.delete(id)
  return [...byId.values()].sort((left, right) => (
    left.date === right.date
      ? left.savedAt.localeCompare(right.savedAt)
      : left.date.localeCompare(right.date)
  ))
}

export function toUploadPayload(
  entry: JournalEntry,
  consent: SyncConsent,
): Record<string, unknown> | null {
  if (consent.shareTrainingNotes && entry.memoPurpose === "ANALYZABLE_TRAINING_NOTE") {
    return { ...entry }
  }
  const safe = toExportJournalEntry(entry)
  return safe === null ? null : { ...safe }
}
