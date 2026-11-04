// The deployed journal gateway accepts at most 655,360 UTF-8 request bytes.
// Reserve space for IDs, revision, purpose and negotiated capability fields.
export const ACCOUNT_DOCUMENT_MAX_BYTES = 600_000
export const ACCOUNT_REQUEST_MAX_BYTES = 655_360
export function accountDocumentFits(value: unknown): boolean {
  try { return new TextEncoder().encode(JSON.stringify(value)).byteLength <= ACCOUNT_DOCUMENT_MAX_BYTES }
  catch { return false }
}
