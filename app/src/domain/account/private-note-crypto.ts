import { z } from "zod"

const RECOVERY_CODE_BYTES = 16
const PBKDF2_ITERATIONS = 210_000

const recoveryCodeSchema = z.string().regex(/^(?:[A-F0-9]{4}-){7}[A-F0-9]{4}$/u, "복구 코드 형식이 올바르지 않아요.")

const encryptedPrivateNoteSchema = z.object({
  version: z.literal(1),
  algorithm: z.literal("AES-GCM"),
  derivation: z.literal("PBKDF2-SHA-256"),
  iterations: z.literal(PBKDF2_ITERATIONS),
  salt: z.string().min(1),
  iv: z.string().min(1),
  ciphertext: z.string().min(1),
})

export type EncryptedPrivateNote = z.infer<typeof encryptedPrivateNoteSchema>

class PrivateNoteCryptoError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "PrivateNoteCryptoError"
  }
}

export function createRecoveryCode(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(RECOVERY_CODE_BYTES))
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, "0").toUpperCase()).join("")
  return hex.match(/.{4}/gu)?.join("-") ?? ""
}

export function isValidRecoveryCode(value: string): boolean {
  return recoveryCodeSchema.safeParse(value.trim().toUpperCase()).success
}

export async function encryptPrivateNote(
  plaintext: string,
  recoveryCode: string,
): Promise<EncryptedPrivateNote> {
  const parsedCode = recoveryCodeSchema.safeParse(recoveryCode.trim().toUpperCase())
  if (!parsedCode.success) throw new PrivateNoteCryptoError("복구 코드 형식이 올바르지 않아요.")

  const salt = crypto.getRandomValues(new Uint8Array(16))
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await deriveKey(parsedCode.data, salt)
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    new TextEncoder().encode(plaintext),
  )
  return {
    version: 1,
    algorithm: "AES-GCM",
    derivation: "PBKDF2-SHA-256",
    iterations: PBKDF2_ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(encrypted)),
  }
}

export async function decryptPrivateNote(
  candidate: unknown,
  recoveryCode: string,
): Promise<string> {
  const payload = encryptedPrivateNoteSchema.safeParse(candidate)
  const parsedCode = recoveryCodeSchema.safeParse(recoveryCode.trim().toUpperCase())
  if (!payload.success || !parsedCode.success) {
    throw new PrivateNoteCryptoError("암호화된 메모나 복구 코드를 확인해 주세요.")
  }
  const salt = base64ToBytes(payload.data.salt)
  const iv = base64ToBytes(payload.data.iv)
  const key = await deriveKey(parsedCode.data, salt)
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(iv) },
    key,
    toArrayBuffer(base64ToBytes(payload.data.ciphertext)),
  )
  return new TextDecoder().decode(decrypted)
}

async function deriveKey(recoveryCode: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(recoveryCode),
    "PBKDF2",
    false,
    ["deriveKey"],
  )
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", hash: "SHA-256", salt: toArrayBuffer(salt), iterations: PBKDF2_ITERATIONS },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  )
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ""
  for (const value of bytes) binary += String.fromCharCode(value)
  return btoa(binary)
}

function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength)
  copy.set(bytes)
  return copy.buffer
}
