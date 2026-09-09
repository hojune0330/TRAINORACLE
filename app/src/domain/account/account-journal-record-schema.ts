import { z } from "zod"
import { parseJournalEntryForWrite } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import { canEditJournalEntry, keepsImportedObjectiveFacts, preserveJournalProvenance } from "../journal-edit-policy"
import { samePlannedSessionLink } from "../planned-session-link"

/** Plaintext codec only for the approved encrypted account-storage path.
 * This does not authorize sharing, analytics, logging, or journal completion.
 */
export type AccountJournalRecord = {
  readonly version: 2
  readonly state: "FINALIZED"
  readonly kind: "JOURNAL"
  readonly entry: JournalEntry
}

// Validate JSON before parsing: never silently drop undefined, invoke getters/toJSON,
// or accept sparse arrays, non-finite numbers, cycles, or non-JSON objects.
function canonicalJson(value: unknown, ancestors = new Set<object>()): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value)
  if (typeof value === "number" && Number.isFinite(value)) return JSON.stringify(value)
  if (typeof value !== "object" || value === null || ancestors.has(value)) throw new Error("Invalid document")
  const array = Array.isArray(value)
  if (!array && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) {
    throw new Error("Invalid document")
  }
  ancestors.add(value)
  try {
    const keys = Reflect.ownKeys(value).filter(key => !(array && key === "length"))
    if (keys.some(key => typeof key !== "string")) throw new Error("Invalid document")
    if (array && (keys.length !== value.length || keys.some((key, index) => key !== String(index)))) {
      throw new Error("Invalid document")
    }
    const parts = (keys as string[]).sort().map(key => {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (!descriptor?.enumerable || !("value" in descriptor)) throw new Error("Invalid document")
      return [key, canonicalJson(descriptor.value, ancestors)] as const
    })
    if (array) return `[${parts.sort((a, b) => Number(a[0]) - Number(b[0])).map(part => part[1]).join(",")}]`
    return `{${parts.map(([key, item]) => `${JSON.stringify(key)}:${item}`).join(",")}}`
  } finally {
    ancestors.delete(value)
  }
}

/** Returns null for every invalid document; raw parser errors never escape. */
export function parseAccountJournalRecord(value: unknown): AccountJournalRecord | null {
  try {
    const input = canonicalJson(value)
    const candidate = JSON.parse(input) as Record<string, unknown> | null
    if (candidate === null || candidate.version !== 2 || candidate.state !== "FINALIZED" || candidate.kind !== "JOURNAL") return null
    const entry = parseJournalEntryForWrite(candidate.entry)
    if (entry === null) return null
    const record: AccountJournalRecord = { version: 2, state: "FINALIZED", kind: "JOURNAL", entry }
    // Parser-added optional undefined values have no JSON representation.
    if (input !== canonicalJson(JSON.parse(JSON.stringify(record)))) return null
    return record
  } catch {
    return null
  }
}

export function validateAccountJournalRecord(value: unknown): value is AccountJournalRecord {
  return parseAccountJournalRecord(value) !== null
}

/** Existing immutable facts and provenance rules also apply at the server boundary. */
export function validateAccountJournalRecordUpdate(previousValue: unknown, nextValue: unknown): boolean {
  const previous = parseAccountJournalRecord(previousValue)?.entry
  const next = parseAccountJournalRecord(nextValue)?.entry
  if (!previous || !next || previous.id !== next.id || previous.kind !== next.kind || previous.date !== next.date
    || !canEditJournalEntry(previous) || !keepsImportedObjectiveFacts(previous, next)) return false
  if (previous.kind === "post-session" && next.kind === "post-session"
    && !samePlannedSessionLink(previous.plannedSessionLink, next.plannedSessionLink)) return false
  try { return canonicalJson(JSON.parse(JSON.stringify(preserveJournalProvenance(previous, next)))) === canonicalJson(next) }
  catch { return false }
}

export const accountJournalRecordSchema = z.unknown().transform((value, context): AccountJournalRecord => {
  const record = parseAccountJournalRecord(value)
  if (record !== null) return record
  context.addIssue({ code: "custom", message: "Invalid account journal record" })
  return z.NEVER
})
