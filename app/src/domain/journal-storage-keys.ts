// Storage addresses change, but journal/backup/network document formats do not.
// Older applications may enumerate and erase every trainoracle.* key.
export const CANONICAL_JOURNAL_STORAGE_PREFIX = "to-local-journal."
export const JOURNAL_STORAGE_KEY = "to-local-journal.journal.v2"
export const SYNC_RECOVERY_STORAGE_KEY = "to-local-journal.sync.recovery.v2"
export const PRIVATE_MEMO_VAULT_STORAGE_KEY = "to-local-journal.private-memo.v2"
export const PRIVATE_NOTE_RECOVERY_STORAGE_KEY = "to-local-journal.private-note.recovery.v2"
export const JOURNAL_OWNERSHIP_STORAGE_KEY = "to-local-journal.journal.ownership.v2"
export const JOURNAL_TRASH_STORAGE_KEY = "to-local-journal.journal.trash.v2"
export const JOURNAL_TOMBSTONES_STORAGE_KEY = "to-local-journal.sync.tombstones.v2"

export const LEGACY_JOURNAL_STORAGE_KEYS = {
  journal: "trainoracle.journal.v1",
  vault: "trainoracle.private-memo.v1",
  ownership: "trainoracle.journal.ownership.v1",
  trash: "trainoracle.journal.trash.v1",
  tombstones: "trainoracle.sync.tombstones.v1",
  syncRecovery: "trainoracle.sync.recovery.v1",
  privateNoteRecovery: "trainoracle.private-note.recovery.v1",
} as const

export const JOURNAL_LOCAL_STORAGE_KEY_MAPPINGS = [
  { legacy: LEGACY_JOURNAL_STORAGE_KEYS.journal, canonical: JOURNAL_STORAGE_KEY },
  { legacy: LEGACY_JOURNAL_STORAGE_KEYS.vault, canonical: PRIVATE_MEMO_VAULT_STORAGE_KEY },
  { legacy: LEGACY_JOURNAL_STORAGE_KEYS.ownership, canonical: JOURNAL_OWNERSHIP_STORAGE_KEY },
  { legacy: LEGACY_JOURNAL_STORAGE_KEYS.trash, canonical: JOURNAL_TRASH_STORAGE_KEY },
  { legacy: LEGACY_JOURNAL_STORAGE_KEYS.tombstones, canonical: JOURNAL_TOMBSTONES_STORAGE_KEY },
  { legacy: LEGACY_JOURNAL_STORAGE_KEYS.syncRecovery, canonical: SYNC_RECOVERY_STORAGE_KEY },
] as const

// Recovery codes remain tab-local. They must never enter a durable snapshot.
export const JOURNAL_SESSION_STORAGE_KEY_MAPPINGS = [
  { legacy: LEGACY_JOURNAL_STORAGE_KEYS.privateNoteRecovery, canonical: PRIVATE_NOTE_RECOVERY_STORAGE_KEY },
] as const
