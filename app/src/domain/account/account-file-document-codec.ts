/** Lossless, bounded FILE storage codec. This is storage permission, never AI permission. */
export const FILE_DOCUMENT_CODEC = "trainoracle.file-document.gzip.v1" as const
// A synthetic 7.6MB document exceeded the hosted 2s CPU budget. Keep the measured
// document/page budget bounded; increasing this requires a separately chunked protocol.
export const FILE_DOCUMENT_MAX_BYTES = 3_500_000
export const FILE_MUTATION_MAX_BYTES = 4 * 1024 * 1024
// Corrections validate both the immutable original and the complete proposal.
// A 3.38MB correction measured 3.78s CPU; refuse before queueing on the Edge route.
export const FILE_CORRECTION_MAX_BYTES = 1_200_000
export const FILE_COMPRESSED_MAX_BYTES = 400 * 1024
export const FILE_LOCAL_MUTATION_MAX_BYTES = 2 * FILE_MUTATION_MAX_BYTES
export type CompressedFileDocument = { format: typeof FILE_DOCUMENT_CODEC; uncompressedBytes: number; sha256: string; data: string }
const encoder = new TextEncoder()
const record = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
export function isFileDetailDocument(value: unknown): boolean {
  return record(value) && value.version === 5 && value.state === "FINALIZED" && value.kind === "JOURNAL"
    && record(value.entry) && value.entry.kind === "post-session" && record(value.entry.fileObservation)
    && record(value.entry.fileObservation.detail)
}
export function isFileDetailMutation(value: unknown): boolean {
  return record(value) && (value.action === "save" && isFileDetailDocument(value.document)
    || value.action === "correctImportedObservation" && record(value.replacementObservation) && record(value.replacementObservation.detail))
}
export function isFileDetailLocalPayload(value: unknown): boolean {
  return isFileDetailDocument(value) || record(value) && record(value.original) && record(value.mutation)
    && (isFileDetailDocument(value.original) && ["correctImportedObservation", "confirmComparisonRelation", "releaseComparisonRelation"].includes(String(value.mutation.action))
      || value.mutation.action === "correctImportedObservation" && record(value.mutation.replacementObservation) && record(value.mutation.replacementObservation.detail))
}
/** Only the sensor detail receives a larger budget; memo/other fields keep their original bound. */
export function fileDetailBaseFits(value: unknown): boolean {
  if (!isFileDetailDocument(value) || !record(value) || !record(value.entry) || !record(value.entry.fileObservation)) return false
  return jsonBytes({ ...value, entry: { ...value.entry, fileObservation: { ...value.entry.fileObservation, detail: undefined } } }) <= 600_000
}
export function jsonBytes(value: unknown): number {
  try { const text = JSON.stringify(value); return typeof text === "string" ? encoder.encode(text).byteLength : Infinity } catch { return Infinity }
}
const invalid = () => new Error("FILE_DOCUMENT_CODEC_INVALID")
function base64(bytes: Uint8Array): string {
  let text = ""
  for (let i = 0; i < bytes.length; i += 8192) text += String.fromCharCode(...bytes.subarray(i, i + 8192))
  return btoa(text)
}
function unbase64(value: unknown): Uint8Array {
  if (typeof value !== "string" || !value.length || value.length > 4 * Math.ceil(FILE_COMPRESSED_MAX_BYTES / 3)
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value)) throw invalid()
  const bytes = Uint8Array.from(atob(value), c => c.charCodeAt(0))
  if (bytes.length > FILE_COMPRESSED_MAX_BYTES || base64(bytes) !== value) throw invalid()
  return bytes
}
async function digest(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), x => x.toString(16).padStart(2, "0")).join("")
}
async function transform(bytes: Uint8Array<ArrayBuffer>, mode: "compress" | "decompress", maximum: number): Promise<Uint8Array<ArrayBuffer>> {
  const source = new ReadableStream<Uint8Array<ArrayBuffer>>({ start(controller) { controller.enqueue(bytes); controller.close() } })
  const stream = source.pipeThrough(mode === "compress" ? new CompressionStream("gzip") : new DecompressionStream("gzip"))
  const reader = stream.getReader(), parts: Uint8Array[] = []
  let length = 0
  try {
    while (true) {
      const next = await reader.read()
      if (next.done) break
      length += next.value.byteLength
      if (length > maximum) { await reader.cancel().catch(() => {}); throw invalid() }
      parts.push(next.value)
    }
  } finally { reader.releaseLock() }
  const result = new Uint8Array(length)
  let offset = 0
  for (const part of parts) { result.set(part, offset); offset += part.length }
  return result
}
export async function compressFileJson(value: unknown, maximum = FILE_DOCUMENT_MAX_BYTES): Promise<CompressedFileDocument> {
  try {
    const text = JSON.stringify(value)
    if (typeof text !== "string" || text.length > maximum) throw invalid()
    const bytes = encoder.encode(text)
    if (!bytes.length || bytes.length > maximum) throw invalid()
    const compressed = await transform(bytes, "compress", FILE_COMPRESSED_MAX_BYTES)
    return { format: FILE_DOCUMENT_CODEC, uncompressedBytes: bytes.length, sha256: await digest(bytes), data: base64(compressed) }
  } catch { throw invalid() }
}
export async function decompressFileJson(value: unknown, maximum = FILE_DOCUMENT_MAX_BYTES): Promise<unknown> {
  try {
    if (!record(value) || Object.keys(value).sort().join(",") !== "data,format,sha256,uncompressedBytes"
      || value.format !== FILE_DOCUMENT_CODEC || !Number.isSafeInteger(value.uncompressedBytes)
      || Number(value.uncompressedBytes) < 1 || Number(value.uncompressedBytes) > maximum
      || typeof value.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.sha256)) throw invalid()
    // The declared byte count is a limit, not an allocation hint. Stop reading immediately on overflow.
    const bytes = await transform(new Uint8Array(unbase64(value.data)), "decompress", Number(value.uncompressedBytes))
    if (bytes.length !== value.uncompressedBytes || await digest(bytes) !== value.sha256) throw invalid()
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch { throw invalid() }
}
/** Call only after authenticating/decrypting the original owner/document AAD. */
export async function decodeAccountStoredJson(text: string): Promise<unknown> {
  const value: unknown = JSON.parse(text)
  if (!record(value) || value.format !== FILE_DOCUMENT_CODEC) return value
  const restored = await decompressFileJson(value)
  if (!fileDetailBaseFits(restored)) throw invalid()
  return restored
}
/** Cheap preflight plus actual encoded bound before the durable outbox is written. */
export async function accountFileDocumentFits(value: unknown): Promise<boolean> {
  if (!fileDetailBaseFits(value) || jsonBytes(value) > FILE_DOCUMENT_MAX_BYTES) return false
  try { await compressFileJson(value); return true } catch { return false }
}
