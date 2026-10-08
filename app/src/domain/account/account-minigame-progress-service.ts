/**
 * Account sync for the minigame tour. Game-only data; never touches reward points or training.
 *
 * Unlike profile or journal documents, progress merges without asking the user:
 * stars, best scores and clear counts only grow and the newest settings win, so
 * "read → merge → compare-and-swap save" (retrying on a revision conflict) can never lose
 * a star from either device. The device copy stays the working copy while offline.
 */
import { requestAccountDocument, accountJournalPreviewEnabled, type AccountJournalRequest, type AccountJournalResult } from "./account-journal-api"
import { activeLocalAccount } from "./local-journal-ownership"
import { MINIGAME_PROGRESS_NAMESPACE, accountMinigameProgressDocumentSchema, type AccountMinigameProgressDocument as Document } from "./account-minigame-progress-schema"
import { emptyMinigameProgress, mergeMinigameProgress, sameMinigameProgress, type MinigameProgress } from "../minigame/progress"

export type MinigameSyncStatus = "LOCAL_ONLY" | "SYNCED" | "PENDING" | "UPGRADE_REQUIRED"
export type MinigameSyncResult = { status: MinigameSyncStatus; progress: MinigameProgress }
type Send = (request: AccountJournalRequest<Document>, current: () => boolean) => Promise<AccountJournalResult<Document>>

/** Account storage for the game needs the account journal and is closed by its own kill switch. */
export function minigameAccountStorageEnabled(env: Readonly<Record<string, unknown>> = import.meta.env,
  account: { preview: (env: Readonly<Record<string, unknown>>) => boolean; owner: () => string | null } = { preview: accountJournalPreviewEnabled, owner: activeLocalAccount }): boolean {
  return env.VITE_KILL_MINIGAME_PROGRESS !== "true" && account.preview(env) && account.owner() !== null
}

export async function minigameProgressDocumentId(ownerId: string) {
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify([MINIGAME_PROGRESS_NAMESPACE, ownerId]))))
  bytes[6] = (bytes[6]! & 15) | 80; bytes[8] = (bytes[8]! & 63) | 128
  const hex = [...bytes.slice(0, 16)].map(value => value.toString(16).padStart(2, "0")).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

const wrap = (progress: MinigameProgress): Document => ({ version: 3, state: "ACCOUNT_STATE", kind: "MINIGAME_PROGRESS", data: progress })

export function createMinigameProgressSync(ownerId: string, ports?: { send?: Send; isCurrent?: () => boolean }) {
  const current = () => (ports?.isCurrent?.() ?? true) && (ports?.send ? true : activeLocalAccount() === ownerId)
  const send = (request: AccountJournalRequest<Document>) => ports?.send
    ? ports.send(request, current) : requestAccountDocument(ownerId, request, current, accountMinigameProgressDocumentSchema)

  async function read(id: string): Promise<{ ok: true; revision: number; remote: MinigameProgress | null } | { ok: false; status: MinigameSyncStatus }> {
    const response = await send({ action: "read", documentId: id })
    if (!response.ok) {
      if (response.code === "NOT_FOUND") return { ok: true, revision: 0, remote: null }
      return { ok: false, status: response.code === "UPGRADE_REQUIRED" ? "UPGRADE_REQUIRED" : "PENDING" }
    }
    if (response.data.kind === "deleted") return { ok: true, revision: response.data.revision, remote: null }
    if (response.data.kind !== "document") return { ok: false, status: "PENDING" }
    return { ok: true, revision: response.data.revision, remote: response.data.document.data }
  }

  /** Merge the device copy into the account copy. Returns what the device should keep. */
  async function sync(local: MinigameProgress): Promise<MinigameSyncResult> {
    try {
      const support = await send({ action: "minigameProgressSupport" })
      if (!current()) return { status: "PENDING", progress: local }
      if (!support.ok || support.data.kind !== "minigame-progress-support") return { status: "LOCAL_ONLY", progress: local }
      const id = await minigameProgressDocumentId(ownerId)
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const remote = await read(id)
        if (!current()) return { status: "PENDING", progress: local }
        if (!remote.ok) return { status: remote.status, progress: local }
        const merged = mergeMinigameProgress(local, remote.remote ?? emptyMinigameProgress())
        if (remote.remote && sameMinigameProgress(merged, remote.remote)) return { status: "SYNCED", progress: merged }
        const saved = await send({ action: "save", documentId: id, operationId: crypto.randomUUID(), expectedRevision: remote.revision, document: wrap(merged) })
        if (!current()) return { status: "PENDING", progress: merged }
        if (saved.ok && saved.data.kind === "saved") return { status: "SYNCED", progress: merged }
        if (saved.ok && saved.data.kind === "conflict") { local = merged; continue }
        return { status: !saved.ok && saved.code === "UPGRADE_REQUIRED" ? "UPGRADE_REQUIRED" : "PENDING", progress: merged }
      }
      return { status: "PENDING", progress: local }
    } catch { return { status: "PENDING", progress: local } }
  }

  /** "Start the tour over": deletes the account copy. The caller clears the device copy only after this succeeds. */
  async function reset(): Promise<boolean> {
    try {
      const id = await minigameProgressDocumentId(ownerId)
      const remote = await read(id)
      if (!remote.ok || !current()) return false
      if (!remote.remote) return true
      const deleted = await send({ action: "delete", documentId: id, operationId: crypto.randomUUID(), expectedRevision: remote.revision })
      return deleted.ok && deleted.data.kind === "deleted"
    } catch { return false }
  }

  return { sync, reset }
}
