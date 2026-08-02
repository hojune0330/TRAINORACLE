import { memoPurposeOf, parseJournalEntry } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import {
  decryptPrivateNote,
  encryptPrivateNote,
  isValidRecoveryCode,
} from "./private-note-crypto"
import type { EncryptedPrivateNote } from "./private-note-crypto"
import { restorePrivateMemo, rotatePrivateMemoVault } from "../private-memo-vault"
import { journalStorage } from "../journal-local-storage"
import { PRIVATE_NOTE_RECOVERY_STORAGE_KEY } from "../journal-storage-keys"

const RECOVERY_KEY = PRIVATE_NOTE_RECOVERY_STORAGE_KEY

export async function encryptPrivateJournalEntry(
  entry: JournalEntry,
  recoveryCode: string,
): Promise<EncryptedPrivateNote | null> {
  if (memoPurposeOf(entry) !== "PRIVATE_SELF_ONLY") return null
  const storage = journalStorage()
  const restored = storage === null ? entry : await restorePrivateMemo(storage, entry, recoveryCode)
  const text = restored.kind === "evening" ? restored.note : restored.memo
  if (text.trim() === "") return null
  return encryptPrivateNote(JSON.stringify(restored), recoveryCode)
}

export async function decryptPrivateJournalEntry(
  encrypted: unknown,
  recoveryCode: string,
): Promise<JournalEntry | null> {
  const plaintext = await decryptPrivateNote(encrypted, recoveryCode)
  try {
    const parsedJson: unknown = JSON.parse(plaintext)
    return parseJournalEntry(parsedJson)
  } catch (error) {
    if (error instanceof SyntaxError) return null
    throw error
  }
}

export function saveSessionRecoveryCode(recoveryCode: string): boolean {
  if (typeof window === "undefined") return false
  if (!isValidRecoveryCode(recoveryCode)) return false
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, recoveryCode)
    return window.sessionStorage.getItem(RECOVERY_KEY) === recoveryCode
  } catch {
    return false
  }
}

export function loadSessionRecoveryCode(): string | null {
  if (typeof window === "undefined") return null
  try {
    const recoveryCode = window.sessionStorage.getItem(RECOVERY_KEY)
    return recoveryCode !== null && isValidRecoveryCode(recoveryCode) ? recoveryCode : null
  } catch {
    return null
  }
}

export async function rotateSessionRecoveryCode(
  previousRecoveryCode: string,
  nextRecoveryCode: string,
): Promise<{ readonly ok: boolean }> {
  if (!saveSessionRecoveryCode(nextRecoveryCode)) return { ok: false }
  const result = await rotatePrivateMemoVault(previousRecoveryCode, nextRecoveryCode)
  if (result.ok) return result
  saveSessionRecoveryCode(previousRecoveryCode)
  return { ok: false }
}

export { rotatePrivateMemoVault }

export function clearSessionRecoveryCode(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    return
  }
}
