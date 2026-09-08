import { createAccountJournalDraftBuffer } from "../../src/domain/account/account-journal-draft-buffer"
import type { AccountJournalDraft, AccountJournalDraftRecord } from "../../src/domain/account/account-journal-draft-buffer"
import { flushAccountJournalDraft } from "../../src/domain/account/account-journal-sync"
import { requestAccountJournal } from "../../src/domain/account/account-journal-api"
import type { AccountJournalRequest } from "../../src/domain/account/account-journal-api"
import type { SupabaseClient } from "@supabase/supabase-js"

// Test-only fixture served by Vite; never imported into the application.
const databaseName = "trainoracle-account-journal-drafts-v1"
export const owner = "11111111-1111-4111-8111-111111111111"
export const otherOwner = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
export const doc = "22222222-2222-4222-8222-222222222222"
export const op = "33333333-3333-4333-8333-333333333333"
export const otherOp = "44444444-4444-4444-8444-444444444444"
export const draft: AccountJournalDraft = {
  version: 1, state: "DRAFT", visibility: "PRIVATE", date: "2024-02-29",
  title: "SYNTHETIC_TITLE_ONLY", body: "SYNTHETIC_BODY_ONLY",
}

async function inspect<T>(storeName: string, mode: IDBTransactionMode,
  action: (store: IDBObjectStore, finish: (value: T) => void) => void): Promise<T> {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(databaseName, 1)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(storeName, mode)
      let result: T
      tx.oncomplete = () => resolve(result)
      tx.onabort = () => reject(tx.error ?? new Error("Inspection aborted"))
      action(tx.objectStore(storeName), value => { result = value })
    })
  } finally { db.close() }
}

export async function raw(ownerId = owner, documentId = doc) {
  return inspect<AccountJournalDraftRecord>("drafts", "readonly", (store, finish) => {
    const request = store.get([ownerId, documentId])
    request.onsuccess = () => finish(request.result)
  })
}

export async function mutate(change: (record: AccountJournalDraftRecord) => void, ownerId = owner, documentId = doc) {
  return inspect<void>("drafts", "readwrite", store => {
    const request = store.get([ownerId, documentId])
    request.onsuccess = () => {
      const record = request.result as AccountJournalDraftRecord
      change(record)
      store.put(record)
    }
  })
}

export async function keyInfo(ownerId = owner) {
  const key = await inspect<CryptoKey>("ownerKeys", "readonly", (store, finish) => {
    const request = store.get(ownerId)
    request.onsuccess = () => finish(request.result)
  })
  let exportRejected = false
  try { await crypto.subtle.exportKey("raw", key) } catch { exportRejected = true }
  return { native: key instanceof CryptoKey, extractable: key.extractable,
    algorithm: key.algorithm.name, usages: [...key.usages].sort(), exportRejected }
}

export async function removeKey(ownerId = owner) {
  await inspect<void>("ownerKeys", "readwrite", store => { store.delete(ownerId) })
}

export async function rejected(action: () => Promise<unknown>) {
  try { await action(); return null }
  catch (error) { return error instanceof Error ? error.message : "Unknown error" }
}

// Fake HTTP boundary only: real API receipt validation, sync orchestration, crypto
// and IndexedDB remain active. No external server or real session is used.
export function httpTransport(handle: (request: AccountJournalRequest) => Promise<Response>, isCurrent = () => true) {
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: owner } } }, error: null }) },
    functions: { invoke: async (_name: string, options: { body: AccountJournalRequest }) => {
      const response = await handle(options.body)
      return response.ok ? { data: await response.json(), error: null }
        : { data: null, error: { context: response } }
    } },
  }
  return (request: AccountJournalRequest) => requestAccountJournal(owner, request, isCurrent,
    { owner: () => owner, client: async () => client as unknown as SupabaseClient })
}

export function setup() {
  const harness = { buffer: createAccountJournalDraftBuffer(), create: createAccountJournalDraftBuffer,
    owner, otherOwner, doc, op, otherOp, draft, raw, mutate, keyInfo, removeKey, rejected,
    flush: flushAccountJournalDraft, httpTransport }
  window.accountDraftHarness = harness
  return harness
}

declare global {
  interface Window { accountDraftHarness: ReturnType<typeof setup> }
}
