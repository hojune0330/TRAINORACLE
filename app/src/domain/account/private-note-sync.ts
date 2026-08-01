import { memoPurposeOf, parseJournalEntry } from "../journal-schema"
import type { JournalEntry } from "../journal-schema"
import {
  decryptPrivateNote,
  encryptPrivateNote,
} from "./private-note-crypto"
import type { EncryptedPrivateNote } from "./private-note-crypto"

const RECOVERY_KEY = "trainoracle.private-note.recovery.v1"

export async function encryptPrivateJournalEntry(
  entry: JournalEntry,
  recoveryCode: string,
): Promise<EncryptedPrivateNote | null> {
  if (memoPurposeOf(entry) !== "PRIVATE_SELF_ONLY") return null
  const text = entry.kind === "evening" ? entry.note : entry.memo
  if (text.trim() === "") return null
  return encryptPrivateNote(JSON.stringify(entry), recoveryCode)
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
    return window.sessionStorage.getItem(RECOVERY_KEY)
  } catch {
    return null
  }
}

export function clearSessionRecoveryCode(): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(RECOVERY_KEY)
  } catch {
    return
  }
}
