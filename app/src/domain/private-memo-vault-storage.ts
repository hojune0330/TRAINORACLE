import type { JournalEntry } from "./journal-schema"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import type { PrivateMemoVault } from "./private-memo-vault"
import { announceLocalJournalChange } from "./journal-change-events"
import { journalWriteRetainsBodyMetadata } from "./body-part-metadata"
import { canonicalJournalAccess, canonicalJournalRawStorage } from "./canonical-journal-access"
import { CANONICAL_JOURNAL_MANIFEST_KEY, isCanonicalJournalWritable } from "./canonical-journal-storage"

export type VaultJournalStorageSnapshot = {
  readonly vault: string | null
  readonly journal: string | null
}

// Preserve the public snapshot shape while binding snapshots passed across an
// async encryption step to the migration/deletion epoch in which they were read.
const snapshotEpochs = new WeakMap<VaultJournalStorageSnapshot, string | null>()

function sameEpoch(storage: Storage, epoch: string | null): boolean {
  try { return canonicalJournalRawStorage(storage).getItem(CANONICAL_JOURNAL_MANIFEST_KEY) === epoch }
  catch { return false }
}

export function readVaultJournalStorageSnapshot(storage: Storage): VaultJournalStorageSnapshot | null {
  return readSnapshot(canonicalJournalAccess(storage))
}

function readSnapshot(storage: Storage): VaultJournalStorageSnapshot | null {
  try {
    const epoch = canonicalJournalRawStorage(storage).getItem(CANONICAL_JOURNAL_MANIFEST_KEY)
    const snapshot = {
      vault: storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY),
      journal: storage.getItem(JOURNAL_STORAGE_KEY),
    }
    if (!sameEpoch(storage, epoch)) return null
    snapshotEpochs.set(snapshot, epoch)
    return snapshot
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
): boolean {
  storage = canonicalJournalAccess(storage)
  let epoch: string | null
  try { epoch = canonicalJournalRawStorage(storage).getItem(CANONICAL_JOURNAL_MANIFEST_KEY) }
  catch { return false }
  const previous = expected ?? readVaultJournalStorageSnapshot(storage)
  if (previous === null) return false
  if (snapshotEpochs.has(previous) && snapshotEpochs.get(previous) !== epoch) return false
  if (!journalWriteRetainsBodyMetadata(previous.journal, entries)) return false
  if (expected !== undefined && !snapshotMatches(storage, expected)) return false
  if (!guardAllowsCommit(commitGuard)) return false
  const nextVault = JSON.stringify(vault)
  const nextJournal = JSON.stringify(entries)

  try {
    if (!sameEpoch(storage, epoch)) return false
    storage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, nextVault)
    if (!sameEpoch(storage, epoch)) return false
    storage.setItem(JOURNAL_STORAGE_KEY, nextJournal)
    if (storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY) === nextVault
      && storage.getItem(JOURNAL_STORAGE_KEY) === nextJournal
      && guardAllowsCommit(commitGuard)
      && sameEpoch(storage, epoch)
      && isCanonicalJournalWritable(canonicalJournalRawStorage(storage))) {
      announceLocalJournalChange()
      return true
    }
  } catch {
    restoreUnconfirmedStorageSnapshot(storage, previous, nextVault, nextJournal, epoch)
    return false
  }
  restoreUnconfirmedStorageSnapshot(storage, previous, nextVault, nextJournal, epoch)
  return false
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
  epoch: string | null,
): void {
  storage = canonicalJournalRawStorage(storage)
  if (!sameEpoch(storage, epoch)) return
  const current = readSnapshot(storage)
  if (current === null || !sameEpoch(storage, epoch)
    || isForeignCompleteValue(current.vault, previous.vault, nextVault)
    || isForeignCompleteValue(current.journal, previous.journal, nextJournal)) return
  restoreStorageValue(storage, PRIVATE_MEMO_VAULT_STORAGE_KEY, previous.vault, current.vault, epoch)
  restoreStorageValue(storage, JOURNAL_STORAGE_KEY, previous.journal, current.journal, epoch)
}

function isForeignCompleteValue(current: string | null, previous: string | null, next: string): boolean {
  if (current === previous || current === next) return false
  if (current === null) return true
  try { JSON.parse(current); return true }
  catch { return false }
}

export function writeStorageValueWithReadback(
  storage: Storage,
  key: string,
  next: string,
  previous: string | null,
): boolean {
  storage = canonicalJournalAccess(storage)
  let epoch: string | null
  try { epoch = canonicalJournalRawStorage(storage).getItem(CANONICAL_JOURNAL_MANIFEST_KEY) }
  catch { return false }
  let attempted = false
  const rollback = () => {
    if (!attempted) return
    const raw = canonicalJournalRawStorage(storage)
    try {
      if (!sameEpoch(raw, epoch)) return
      const current = raw.getItem(key)
      // A malformed partial write needs raw rollback because the normal guard
      // correctly refuses it. Never replace another complete vault version.
      if (current === previous || current === null) return
      if (current !== next) {
        try { JSON.parse(current); return }
        catch { /* Only a syntactically partial write is eligible for rollback. */ }
      }
      restoreStorageValue(raw, key, previous, current, epoch)
    } catch { /* An unreadable current value is not authority to overwrite it. */ }
  }
  try {
    if (storage.getItem(key) !== previous) return false
    if (!sameEpoch(storage, epoch)) return false
    attempted = true
    storage.setItem(key, next)
    if (storage.getItem(key) === next
      && sameEpoch(storage, epoch)
      && isCanonicalJournalWritable(canonicalJournalRawStorage(storage))) return true
  } catch {
    rollback()
    return false
  }
  rollback()
  return false
}

function restoreStorageValue(storage: Storage, key: string, previous: string | null, expectedCurrent: string | null, epoch: string | null): void {
  try {
    if (!sameEpoch(storage, epoch) || storage.getItem(key) !== expectedCurrent || expectedCurrent === previous) return
    if (previous === null) storage.removeItem(key)
    else storage.setItem(key, previous)
  } catch {
    return
  }
}
