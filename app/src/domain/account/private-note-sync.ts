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
const INVALIDATED_RECOVERY_CODE = "recovery-code-cleared"

let recoveryCodeInvalidated = false

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
    const previous = window.sessionStorage.getItem(RECOVERY_KEY)
    try {
      window.sessionStorage.setItem(RECOVERY_KEY, recoveryCode)
      if (window.sessionStorage.getItem(RECOVERY_KEY) === recoveryCode) {
        recoveryCodeInvalidated = false
        return true
      }
    } catch {
      return restoreSessionRecoveryCode(previous)
    }
    return restoreSessionRecoveryCode(previous)
  } catch {
    return false
  }
}

function restoreSessionRecoveryCode(previous: string | null): false {
  try {
    if (previous === null) window.sessionStorage.removeItem(RECOVERY_KEY)
    else window.sessionStorage.setItem(RECOVERY_KEY, previous)
  } catch {
    return false
  }
  return false
}

export function loadSessionRecoveryCode(): string | null {
  if (typeof window === "undefined") return null
  try {
    const recoveryCode = window.sessionStorage.getItem(RECOVERY_KEY)
    if (recoveryCode === null) {
      recoveryCodeInvalidated = false
      return null
    }
    if (recoveryCodeInvalidated) return null
    return isValidRecoveryCode(recoveryCode) ? recoveryCode : null
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
  clearSessionRecoveryCode()
  return { ok: false }
}

export { rotatePrivateMemoVault }

export function clearSessionRecoveryCode(): void {
  if (typeof window === "undefined") return
  recoveryCodeInvalidated = true
  try {
    window.sessionStorage.setItem(RECOVERY_KEY, INVALIDATED_RECOVERY_CODE)
  } catch {
    removeStoredRecoveryCode()
    return
  }
  removeStoredRecoveryCode()
}

function removeStoredRecoveryCode(): void {
  try {
    window.sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    return
  }
}
