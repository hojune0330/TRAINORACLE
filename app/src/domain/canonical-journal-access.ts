import { assertCanonicalJournalReadable, assertCanonicalJournalWritable } from "./canonical-journal-storage"
import { CANONICAL_JOURNAL_STORAGE_PREFIX } from "./journal-storage-keys"

const adapters = new WeakMap<Storage, Storage>()
const originals = new WeakMap<Storage, Storage>()

/** Only explicit journal consumers use this adapter. Never patches browser Storage. */
export function canonicalJournalAccess(storage: Storage): Storage {
  const raw = canonicalJournalRawStorage(storage)
  const existing = adapters.get(raw)
  if (existing) return existing
  const check = (key: string) => {
    if (key.startsWith(CANONICAL_JOURNAL_STORAGE_PREFIX)) assertCanonicalJournalWritable(raw)
  }
  const access: Storage = {
    get length() { return raw.length },
    key: index => raw.key(index),
    getItem(key) {
      if (key.startsWith(CANONICAL_JOURNAL_STORAGE_PREFIX)) assertCanonicalJournalReadable(raw)
      return raw.getItem(key)
    },
    setItem(key, value) { check(key); raw.setItem(key, value) },
    removeItem(key) { check(key); raw.removeItem(key) },
    clear() { throw new Error("CANONICAL_JOURNAL_BULK_CLEAR_REQUIRES_LIFECYCLE") },
  }
  adapters.set(raw, access)
  originals.set(access, raw)
  return access
}

/** For verified rollback/lifecycle only, never as a normal write bypass. */
export function canonicalJournalRawStorage(storage: Storage): Storage {
  return originals.get(storage) ?? storage
}
