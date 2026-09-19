import type { JournalEntry } from "../journal-schema"
import { activeLocalAccount } from "./local-journal-ownership"

let scope: string | null = null
let status: "IDLE" | "LOADING" | "READY" | "PENDING" | "REJECTED" | "FAILED" | "CONFLICT" = "IDLE"
const entries = new Map<string, JournalEntry>()
const confirmedEntries = new Map<string, JournalEntry>()
const currentConfirmations = new Map<string, { entry: JournalEntry; revision: number }>()
const shadowedIds = new Set<string>()

function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event("trainoracle:account-journals-changed")) }
export function resetAccountJournalProjection(ownerId: string | null) {
  entries.clear(); confirmedEntries.clear(); currentConfirmations.clear(); shadowedIds.clear(); scope = ownerId; status = ownerId ? "LOADING" : "IDLE"; notify()
}
export function setAccountJournalProjectionStatus(ownerId: string, next: typeof status) {
  if (scope === ownerId && activeLocalAccount() === ownerId) {
    if (next === "LOADING" || next === "FAILED") currentConfirmations.clear()
    status = next; notify()
  }
}
export function accountJournalProjectionStatus() {
  return scope === activeLocalAccount() ? status : "IDLE"
}
export function putAccountJournalProjection(ownerId: string, entry: JournalEntry, confirmed = true) {
  if (scope !== ownerId || activeLocalAccount() !== ownerId) return false
  if (confirmed) confirmedEntries.set(entry.id, structuredClone(entry))
  entries.set(entry.id, structuredClone(entry)); shadowedIds.add(entry.id); notify(); return true
}
/** A server base can advance while the recovery/editor projection remains dirty. */
export function confirmAccountJournalProjection(ownerId: string, entry: JournalEntry) {
  if (scope !== ownerId || activeLocalAccount() !== ownerId) return false
  confirmedEntries.set(entry.id, structuredClone(entry)); shadowedIds.add(entry.id); notify(); return true
}
export function suppressAccountJournalLocalCopy(ownerId: string, id: string) {
  if (scope !== ownerId || activeLocalAccount() !== ownerId) return false
  shadowedIds.add(id); notify(); return true
}
export function isAccountJournalLocalCopyShadowed(id: string) {
  return scope !== null && scope === activeLocalAccount() && shadowedIds.has(id)
}
export function removeAccountJournalProjection(ownerId: string, id: string) {
  if (scope !== ownerId || activeLocalAccount() !== ownerId) return false
  entries.delete(id); confirmedEntries.delete(id); currentConfirmations.delete(id); shadowedIds.add(id); notify(); return true
}
export function readAccountJournalPrivateEntry(id: string): JournalEntry | null {
  if (scope === null || scope !== activeLocalAccount()) return null
  const entry = entries.get(id)
  return entry ? structuredClone(entry) : null
}
function redact(entry: JournalEntry): JournalEntry {
  const copy = structuredClone(entry)
  if (copy.memoPurpose !== "PRIVATE_SELF_ONLY") return copy
  return copy.kind === "evening" ? { ...copy, note: "" } : { ...copy, memo: "" }
}

/** Retained acknowledged cache for offline UI; not current-session analysis authority. */
export function readAccountJournalProjection(): JournalEntry[] {
  if (scope === null || scope !== activeLocalAccount()) return []
  return [...confirmedEntries.values()].map(redact)
}

/** Only the service may call this after an authenticated current read/list or exact write receipt. */
export function markCurrentConfirmedAccountJournalProjection(ownerId: string, entry: JournalEntry, revision: number) {
  if (scope !== ownerId || activeLocalAccount() !== ownerId || !Number.isSafeInteger(revision) || revision < 1) return false
  if ((currentConfirmations.get(entry.id)?.revision ?? 0) > revision) return false
  currentConfirmations.set(entry.id, { entry: structuredClone(entry), revision }); notify(); return true
}

export function currentConfirmedAccountJournalRevision(id: string): number | null {
  return scope !== null && scope === activeLocalAccount() ? currentConfirmations.get(id)?.revision ?? null : null
}

export function readCurrentConfirmedAccountJournalProjection(): JournalEntry[] {
  if (scope === null || scope !== activeLocalAccount()) return []
  return [...currentConfirmations.values()].map(value => redact(value.entry))
}
