// Non-content metadata only. These pins never authorize the server; they keep
// old local jobs from borrowing a later consent after withdrawal/regrant.
const prefix = "trainoracle.storage-consent-revision.v1:"
function read(key: string): number | null {
  try {
    const raw = localStorage.getItem(prefix + key)
    if (raw === null || !/^\d+$/u.test(raw)) return null
    const value = Number(raw)
    return Number.isSafeInteger(value) && value >= 0 ? value : null
  } catch { return null }
}
function write(key: string, value: number) {
  try { localStorage.setItem(prefix + key, String(value)) } catch { /* fail closed on the next read */ }
}
export function rememberStorageConsentRevision(owner: string, revision: number) {
  if (Number.isSafeInteger(revision) && revision >= 0) write(owner, revision)
}
export function currentStorageConsentRevision(owner: string): number { return read(owner) ?? 0 }
export function pinStorageOperationRevision(owner: string, operation: string, fallback = currentStorageConsentRevision(owner)): number {
  const key = `${owner}:${operation}`
  if (read(key) === null) write(key, fallback)
  return read(key) ?? 0
}
