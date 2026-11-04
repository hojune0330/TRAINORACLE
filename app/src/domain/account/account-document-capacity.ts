// The deployed journal gateway accepts at most 655,360 UTF-8 request bytes.
// Reserve space for IDs, revision, purpose and negotiated capability fields.
import { FILE_DOCUMENT_MAX_BYTES, fileDetailBaseFits, jsonBytes } from "./account-file-document-codec"
export const ACCOUNT_DOCUMENT_MAX_BYTES = 600_000
export const ACCOUNT_REQUEST_MAX_BYTES = 655_360
export function accountDocumentFits(value: unknown): boolean {
  return jsonBytes(value) <= (fileDetailBaseFits(value) ? FILE_DOCUMENT_MAX_BYTES : ACCOUNT_DOCUMENT_MAX_BYTES)
}
