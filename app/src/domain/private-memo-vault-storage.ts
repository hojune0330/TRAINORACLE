import type { JournalEntry } from "./journal-schema"
import { parseJournalEntryList } from "./journal-schema"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import type { PrivateMemoVault } from "./private-memo-vault"
import { announceLocalJournalChange } from "./journal-change-events"
import { journalWriteRetainsBodyMetadata } from "./body-part-metadata"
import { canonicalJournalStorage, writeJournalDeviceValues } from "./journal-device-storage"
import { LOCAL_JOURNAL_OWNERSHIP_KEY, type OwnershipCommitPlan } from "./account/local-journal-ownership"

export type VaultJournalStorageSnapshot = {
  readonly vault: string | null
  readonly journal: string | null
}

export function readVaultJournalStorageSnapshot(target: Storage): VaultJournalStorageSnapshot | null {
  try {
    const storage = canonicalJournalStorage(target)
    return {
      vault: storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY),
      journal: storage.getItem(JOURNAL_STORAGE_KEY),
    }
  } catch {
    return null
  }
}

export function writeVaultAndJournalAtomically(
  storage: Storage,
  vault: PrivateMemoVault,
  entries: readonly JournalEntry[],
  expected?: VaultJournalStorageSnapshot,
  commitGuard: () => boolean = () => true,
  ownership?: OwnershipCommitPlan,
): boolean {
  const previous = expected ?? readVaultJournalStorageSnapshot(storage)
  if (previous === null) return false
  if (!journalWriteRetainsBodyMetadata(previous.journal, entries)) return false
  if (expected !== undefined && !snapshotMatches(storage, expected)) return false
  if (!guardAllowsCommit(commitGuard)) return false
  if (ownership && !ownership.ok) return false
  const ok = writeJournalDeviceValues(storage, {
    [PRIVATE_MEMO_VAULT_STORAGE_KEY]: JSON.stringify(vault),
    [JOURNAL_STORAGE_KEY]: JSON.stringify(entries),
    ...(ownership ? { [LOCAL_JOURNAL_OWNERSHIP_KEY]: ownership.nextRaw } : {}),
  }, { [PRIVATE_MEMO_VAULT_STORAGE_KEY]: previous.vault, [JOURNAL_STORAGE_KEY]: previous.journal,
    ...(ownership ? { [LOCAL_JOURNAL_OWNERSHIP_KEY]: ownership.previousRaw } : {}) }, commitGuard)
  if (ok) announceLocalJournalChange()
  return ok
}

function guardAllowsCommit(commitGuard: () => boolean): boolean {
  try {
    return commitGuard()
  } catch {
    return false
  }
}

function snapshotMatches(storage: Storage, expected: VaultJournalStorageSnapshot): boolean {
  try {
    storage = canonicalJournalStorage(storage)
    return storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY) === expected.vault
      && storage.getItem(JOURNAL_STORAGE_KEY) === expected.journal
  } catch {
    return false
  }
}

function restoreUnconfirmedStorageSnapshot(
  storage: Storage,
  previous: VaultJournalStorageSnapshot,
  nextVault: string,
  nextJournal: string,
): void {
  const current = readVaultJournalStorageSnapshot(storage)
  if (current === null || isNewerValidSnapshot(current, previous, nextVault, nextJournal)) return
  restoreStorageValue(storage, PRIVATE_MEMO_VAULT_STORAGE_KEY, previous.vault)
  restoreStorageValue(storage, JOURNAL_STORAGE_KEY, previous.journal)
}

function isNewerValidSnapshot(
  current: VaultJournalStorageSnapshot,
  previous: VaultJournalStorageSnapshot,
  nextVault: string,
  nextJournal: string,
): boolean {
  if (current.vault === nextVault && current.journal === nextJournal) return false
  if (current.vault === previous.vault && current.journal === previous.journal) return false
  if (current.vault === nextVault && current.journal === previous.journal) return false
  if (current.vault === previous.vault && current.journal === nextJournal) return false
  return isValidVaultEnvelope(current.vault) && isValidJournalList(current.journal)
}

function isValidVaultEnvelope(raw: string | null): boolean {
  if (raw === null) return false
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!isRecord(parsed) || parsed.version !== 1 || !isRecord(parsed.records)) return false
    return true
  } catch {
    return false
  }
}

function isValidJournalList(raw: string | null): boolean {
  if (raw === null) return false
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) && parseJournalEntryList(parsed).length === parsed.length
  } catch {
    return false
  }
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

export function writeStorageValueWithReadback(
  storage: Storage,
  key: string,
  next: string,
  previous: string | null,
): boolean {
  try {
    storage = canonicalJournalStorage(storage)
    storage.setItem(key, next)
    if (storage.getItem(key) === next) return true
  } catch {
    restoreStorageValue(storage, key, previous)
    return false
  }
  restoreStorageValue(storage, key, previous)
  return false
}

function restoreStorageValue(storage: Storage, key: string, previous: string | null): void {
  try {
    if (previous === null) storage.removeItem(key)
    else storage.setItem(key, previous)
  } catch {
    return
  }
}
