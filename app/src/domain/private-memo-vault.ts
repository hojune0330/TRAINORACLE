import { z } from "zod"
import type { JournalEntry } from "./journal-schema"
import { JOURNAL_STORAGE_KEY } from "./journal-storage-keys"
import {
  decryptPrivateNote,
  encryptPrivateNote,
  isValidRecoveryCode,
} from "./account/private-note-crypto"
import type { EncryptedPrivateNote } from "./account/private-note-crypto"

export const PRIVATE_MEMO_VAULT_STORAGE_KEY = "trainoracle.private-memo.v1"

const encryptedRecordSchema: z.ZodType<{ readonly encrypted: EncryptedPrivateNote }> = z.object({
  encrypted: z.object({
    version: z.literal(1),
    algorithm: z.literal("AES-GCM"),
    derivation: z.literal("PBKDF2-SHA-256"),
    iterations: z.literal(210_000),
    salt: z.string().min(1),
    iv: z.string().min(1),
    ciphertext: z.string().min(1),
  }),
})

const privateMemoVaultSchema = z.object({
  version: z.literal(1),
  records: z.record(z.string(), encryptedRecordSchema),
})

export type PrivateMemoVault = {
  readonly version: 1
  readonly records: Readonly<Record<string, { readonly encrypted: EncryptedPrivateNote }>>
}

function privateTextOf(entry: JournalEntry): string {
  return entry.kind === "evening" ? entry.note : entry.memo
}

export function isPrivateMemoEntry(entry: JournalEntry): boolean {
  return entry.memoPurpose === "PRIVATE_SELF_ONLY"
}

export function hasPrivateMemoText(entry: JournalEntry): boolean {
  return isPrivateMemoEntry(entry) && privateTextOf(entry).trim() !== ""
}

export function privateMemoShell(entry: JournalEntry): JournalEntry {
  if (!isPrivateMemoEntry(entry)) return entry
  switch (entry.kind) {
    case "evening":
      return { ...entry, note: "" }
    case "post-session":
    case "race":
      return { ...entry, memo: "" }
  }
}

export function restorePrivateMemoShell(entry: JournalEntry, memo: string): JournalEntry {
  if (!isPrivateMemoEntry(entry)) return entry
  switch (entry.kind) {
    case "evening":
      return { ...entry, note: memo }
    case "post-session":
    case "race":
      return { ...entry, memo }
  }
}

export function loadPrivateMemoVault(storage: Storage): PrivateMemoVault | null {
  const raw = storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
  if (raw === null) return { version: 1, records: {} }
  try {
    const parsed: unknown = JSON.parse(raw)
    const result = privateMemoVaultSchema.safeParse(parsed)
    return result.success ? result.data : null
  } catch {
    return null
  }
}

export async function savePrivateMemoWithJournalShell(
  storage: Storage,
  entries: readonly JournalEntry[],
  entry: JournalEntry,
  recoveryCode: string,
): Promise<boolean> {
  if (!hasPrivateMemoText(entry) || !isValidRecoveryCode(recoveryCode)) return false
  const vault = loadPrivateMemoVault(storage)
  if (vault === null) return false

  try {
    const encrypted = await encryptPrivateNote(privateTextOf(entry), recoveryCode)
    const nextVault: PrivateMemoVault = {
      version: 1,
      records: { ...vault.records, [entry.id]: { encrypted } },
    }
    const shell = privateMemoShell(entry)
    const nextEntries = entries.map((current) => current.id === entry.id ? shell : current)
    if (nextEntries.some(hasPrivateMemoText)) return false
    return writeVaultAndJournalAtomically(storage, nextVault, nextEntries)
  } catch {
    return false
  }
}

export async function restorePrivateMemo(
  storage: Storage,
  entry: JournalEntry,
  recoveryCode: string,
): Promise<JournalEntry> {
  if (!isPrivateMemoEntry(entry) || !isValidRecoveryCode(recoveryCode)) return entry
  const vault = loadPrivateMemoVault(storage)
  const record = vault?.records[entry.id]
  if (record === undefined) return entry
  try {
    return restorePrivateMemoShell(entry, await decryptPrivateNote(record.encrypted, recoveryCode))
  } catch {
    return entry
  }
}

export async function rotatePrivateMemoVault(
  previousRecoveryCode: string,
  nextRecoveryCode: string,
  storage: Storage = window.localStorage,
): Promise<{ readonly ok: boolean }> {
  if (!isValidRecoveryCode(previousRecoveryCode) || !isValidRecoveryCode(nextRecoveryCode)) return { ok: false }
  const vault = loadPrivateMemoVault(storage)
  if (vault === null) return { ok: false }

  try {
    const rotatedRecords: Record<string, { readonly encrypted: EncryptedPrivateNote }> = {}
    for (const [entryId, record] of Object.entries(vault.records)) {
      const plaintext = await decryptPrivateNote(record.encrypted, previousRecoveryCode)
      rotatedRecords[entryId] = { encrypted: await encryptPrivateNote(plaintext, nextRecoveryCode) }
    }
    const nextVault: PrivateMemoVault = { version: 1, records: rotatedRecords }
    storage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, JSON.stringify(nextVault))
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

export function removePrivateMemoWithJournalEntries(
  storage: Storage,
  entries: readonly JournalEntry[],
  entryId: string,
): boolean {
  const vault = loadPrivateMemoVault(storage)
  if (vault === null) return false
  const { [entryId]: _removed, ...remainingRecords } = vault.records
  const nextVault: PrivateMemoVault = { version: 1, records: remainingRecords }
  return writeVaultAndJournalAtomically(storage, nextVault, entries)
}

function writeVaultAndJournalAtomically(
  storage: Storage,
  vault: PrivateMemoVault,
  entries: readonly JournalEntry[],
): boolean {
  const previousVault = storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
  const previousJournal = storage.getItem(JOURNAL_STORAGE_KEY)
  const nextVault = JSON.stringify(vault)
  const nextJournal = JSON.stringify(entries)

  try {
    storage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, nextVault)
    storage.setItem(JOURNAL_STORAGE_KEY, nextJournal)
    return true
  } catch {
    restoreStorageValue(storage, PRIVATE_MEMO_VAULT_STORAGE_KEY, previousVault)
    restoreStorageValue(storage, JOURNAL_STORAGE_KEY, previousJournal)
    return false
  }
}

function restoreStorageValue(storage: Storage, key: string, previous: string | null): void {
  try {
    if (previous === null) storage.removeItem(key)
    else storage.setItem(key, previous)
  } catch {
    return
  }
}
