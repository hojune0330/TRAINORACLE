import { decryptPrivateNote, encryptPrivateNote, isValidRecoveryCode } from "./account/private-note-crypto"
import { loadSessionRecoveryCode, saveSessionRecoveryCode } from "./account/private-note-sync"
import { activeLocalAccount, isJournalVisible, LOCAL_JOURNAL_OWNERSHIP_KEY, onLocalJournalScopeChange } from "./account/local-journal-ownership"
import { journalStorage } from "./journal-local-storage"
import { loadEntries, loadJournalEntriesSnapshot } from "./journal-store"
import { loadPrivateMemoVault, type PrivateMemoRecord } from "./private-memo-vault"
import { JOURNAL_STORAGE_KEY, PRIVATE_MEMO_VAULT_STORAGE_KEY } from "./journal-storage-keys"
import { JOURNAL_TRASH_STORAGE_KEY, readTrashForRecovery } from "./journal-trash"

function snapshot() {
  const storage = journalStorage()
  if (!storage) throw new Error("unavailable")
  const journal = loadJournalEntriesSnapshot()
  const vaultRaw = storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY)
  const vault = loadPrivateMemoVault(storage)
  const trash = readTrashForRecovery(storage)
  const ownership = storage.getItem(LOCAL_JOURNAL_OWNERSHIP_KEY)
  if (!vault || !trash || journal.readStatus !== "complete") throw new Error("unavailable")
  const visible = new Set(loadEntries().map(entry => entry.id))
  if (Object.keys(vault.records).some(id => !visible.has(id) || !isJournalVisible(id))
    || trash.items.some(item => item.privateMemo && !isJournalVisible(item.entry.id))) throw new Error("scope-unresolved")
  return { storage, journal: journal.raw, vaultRaw, vault, trash, ownership }
}

export function hasRetainedPrivateMemos(): boolean {
  const state = snapshot()
  return Object.keys(state.vault.records).length > 0 || state.trash.items.some(item => item.privateMemo !== undefined)
}

export type MemoPreparationResult = "READY" | "CHECK_CODES_OR_STORAGE" | "RETRY_WITH_BOTH_CODES"

// Repairs keep plaintext in memory only. A partially confirmed repair is retryable
// with the same codes; it is never reported as an all-store atomic transaction.
export async function preparePrivateMemoCode(
  primary: string,
  additional: string | undefined,
  isCurrent: () => boolean,
): Promise<MemoPreparationResult> {
  const codes = additional === undefined ? [primary] : [primary, additional]
  if (codes.some(code => !isValidRecoveryCode(code))) return "CHECK_CODES_OR_STORAGE"
  const owner = activeLocalAccount()
  const previousCode = loadSessionRecoveryCode()
  let revoked = false
  let writeAttempted = false
  const unsubscribe = onLocalJournalScopeChange(() => { revoked = true })
  try {
    const state = snapshot()
    let expectedVault = state.vaultRaw
    let expectedTrash = state.trash.raw
    const verify = () => {
      if (!isCurrent() || revoked || activeLocalAccount() !== owner
        || loadSessionRecoveryCode() !== previousCode
        || state.storage.getItem(JOURNAL_STORAGE_KEY) !== state.journal
        || state.storage.getItem(PRIVATE_MEMO_VAULT_STORAGE_KEY) !== expectedVault
        || state.storage.getItem(JOURNAL_TRASH_STORAGE_KEY) !== expectedTrash
        || state.storage.getItem(LOCAL_JOURNAL_OWNERSHIP_KEY) !== state.ownership) throw new Error("changed")
    }
    const check = async (record: PrivateMemoRecord): Promise<PrivateMemoRecord> => {
      for (const [index, code] of codes.entries()) {
        verify()
        let plaintext: string
        try { plaintext = await decryptPrivateNote(record.encrypted, code) }
        catch { verify(); continue }
        verify()
        if (index === 0) return record
        const encrypted = await encryptPrivateNote(plaintext, primary)
        verify()
        return { encrypted }
      }
      throw new Error("code-unverified")
    }
    const nextRecords: Record<string, PrivateMemoRecord> = { ...state.vault.records }
    for (const [id, record] of Object.entries(state.vault.records)) nextRecords[id] = await check(record)
    // Preserve every other raw trash field, including historical extension fields.
    const nextTrash: Record<string, unknown>[] = state.trash.raw === null ? [] : JSON.parse(state.trash.raw)
    for (const [index, item] of state.trash.items.entries()) {
      if (item.privateMemo) {
        const checked = await check(item.privateMemo)
        nextTrash[index] = { ...nextTrash[index], privateMemo: { ...(nextTrash[index]!.privateMemo as object), encrypted: checked.encrypted } }
      }
    }
    verify()
    if (additional !== undefined) {
      const rawVault = state.vaultRaw === null ? { version: 1, records: {} } : JSON.parse(state.vaultRaw)
      const nextVault = JSON.stringify({ ...rawVault, records: Object.fromEntries(Object.entries(nextRecords).map(([id, record]) => [id, { ...rawVault.records[id], encrypted: record.encrypted }])) })
      const nextTrashRaw = state.trash.raw === null ? null : JSON.stringify(nextTrash)
      if (nextVault !== expectedVault && Object.keys(nextRecords).length > 0) {
        writeAttempted = true
        state.storage.setItem(PRIVATE_MEMO_VAULT_STORAGE_KEY, nextVault)
        expectedVault = nextVault
        verify()
      }
      if (nextTrashRaw !== expectedTrash && nextTrashRaw !== null) {
        verify()
        writeAttempted = true
        state.storage.setItem(JOURNAL_TRASH_STORAGE_KEY, nextTrashRaw)
        expectedTrash = nextTrashRaw
        verify()
      }
    }
    verify()
    if (!saveSessionRecoveryCode(primary)) throw new Error("session-unavailable")
    return "READY"
  } catch {
    return writeAttempted ? "RETRY_WITH_BOTH_CODES" : "CHECK_CODES_OR_STORAGE"
  } finally { unsubscribe() }
}
