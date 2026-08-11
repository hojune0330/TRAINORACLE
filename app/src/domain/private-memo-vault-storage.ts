import type { JournalEntry } from "./journal-schema"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import type { PrivateMemoVault } from "./private-memo-vault"

export type VaultJournalStorageSnapshot = {
  readonly vault: string | null
  readonly journal: string | null
}

export function readVaultJournalStorageSnapshot(storage: Storage): VaultJournalStorageSnapshot | null {
  try {
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
): boolean {
  const previous = expected ?? readVaultJournalStorageSnapshot(storage)
  if (previous === null) return false
  if (expected !== undefined && !snapshotMatches(storage, expected)) return false
  const nextVault = JSON.stringify(vault)
  const nextJournal = JSON.stringify(entries)

  try {
    storage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, nextVault)
    storage.setItem(JOURNAL_STORAGE_KEY, nextJournal)
    if (storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY) === nextVault
      && storage.getItem(JOURNAL_STORAGE_KEY) === nextJournal) return true
  } catch {
    restoreStorageValue(storage, PRIVATE_MEMO_VAULT_STORAGE_KEY, previous.vault)
    restoreStorageValue(storage, JOURNAL_STORAGE_KEY, previous.journal)
    return false
  }
  restoreStorageValue(storage, PRIVATE_MEMO_VAULT_STORAGE_KEY, previous.vault)
  restoreStorageValue(storage, JOURNAL_STORAGE_KEY, previous.journal)
  return false
}

function snapshotMatches(storage: Storage, expected: VaultJournalStorageSnapshot): boolean {
  try {
    return storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY) === expected.vault
      && storage.getItem(JOURNAL_STORAGE_KEY) === expected.journal
  } catch {
    return false
  }
}

export function writeStorageValueWithReadback(
  storage: Storage,
  key: string,
  next: string,
  previous: string | null,
): boolean {
  try {
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
