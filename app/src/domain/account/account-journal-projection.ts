import type { JournalEntry } from "../journal-schema"
import { activeLocalAccount } from "./local-journal-ownership"

let scope: string | null = null
let status: "IDLE" | "LOADING" | "READY" | "PENDING" | "REJECTED" | "FAILED" | "CONFLICT" = "IDLE"
const entries = new Map<string, JournalEntry>()
const confirmedEntries = new Map<string, JournalEntry>()
const shadowedIds = new Set<string>()

function notify() { if (typeof window !== "undefined") window.dispatchEvent(new Event("trainoracle:account-journals-changed")) }
export function resetAccountJournalProjection(ownerId: string | null) {
  entries.clear(); confirmedEntries.clear(); shadowedIds.clear(); scope = ownerId; status = ownerId ? "LOADING" : "IDLE"; notify()
}
export function setAccountJournalProjectionStatus(ownerId: string, next: typeof status) {
  if (scope === ownerId && activeLocalAccount() === ownerId) { status = next; notify() }
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
  entries.delete(id); confirmedEntries.delete(id); shadowedIds.add(id); notify(); return true
}
export function readAccountJournalPrivateEntry(id: string): JournalEntry | null {
  if (scope === null || scope !== activeLocalAccount()) return null
  const entry = entries.get(id)
  return entry ? structuredClone(entry) : null
}
/** Ordinary/statistical consumers see confirmed facts, never provisional finalization. */
export function readAccountJournalProjection(): JournalEntry[] {
  if (scope === null || scope !== activeLocalAccount()) return []
  return [...confirmedEntries.values()].map(entry => {
    const copy = structuredClone(entry)
    if (copy.memoPurpose !== "PRIVATE_SELF_ONLY") return copy
    return copy.kind === "evening" ? { ...copy, note: "" } : { ...copy, memo: "" }
  })
}
