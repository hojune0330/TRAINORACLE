import { z } from "zod"
import { ACCOUNT_PLAN_MAX_BYTES, accountPlanFingerprint } from "./account-plan-document-schema"
import { validateAccountPlanCollectionIndex, type AccountPlanCollectionParts } from "./account-plan-collection-schema"
import { readAccountPlanCollectionTransfer, type AccountPlanCollectionTransfer } from "./account-plan-collection-transfer"

export const COLLECTION_PREPARATION_DB = "trainoracle-account-plan-collection-preparations-v1"
export type AccountPlanCollectionPreparation = { transfer: AccountPlanCollectionTransfer; expectedSequence: number }
export interface AccountPlanCollectionPreparationStore {
  read(ownerId: string, isCurrent: () => boolean): Promise<AccountPlanCollectionPreparation | null>
  save(input: AccountPlanCollectionPreparation, isCurrent: () => boolean): Promise<void>
  clear(ownerId: string, operationId: string, isCurrent: () => boolean): Promise<void>
  close(): void
}
const uuid = z.uuid()
const hash = z.string().regex(/^sha256:[a-f0-9]{64}$/u)
const collection = z.object({
  index: z.custom<AccountPlanCollectionParts["index"]>(validateAccountPlanCollectionIndex),
  snapshots: z.array(hash).max(100), progress: z.array(hash).max(100),
}).strict()
const headerSchema = z.object({
  version: z.literal(1), ownerId: uuid, operationId: uuid,
  expectedRevision: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 2),
  expectedSequence: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1),
  previous: collection.nullable(), next: collection,
  legacy: z.object({ documentId: uuid, revision: z.number().int().positive(), fingerprint: hash }).strict().nullable(),
}).strict()
type Row = { ownerId: string; slot: string; operationId: string; fingerprint: string; iv: Uint8Array; ciphertext: Uint8Array }
type Key = { id: string; key: CryptoKey }
const slotFor = (kind: string, id: string) => `${kind}:${id}`
const aad = (row: Pick<Row, "ownerId" | "slot" | "operationId" | "fingerprint">) => new TextEncoder().encode(
  JSON.stringify([COLLECTION_PREPARATION_DB, 1, row.ownerId, row.operationId, row.slot, row.fingerprint]))
function keyValue(value: unknown): Key {
  const v = value as Key
  if (!v || !uuid.safeParse(v.id).success || !(v.key instanceof CryptoKey) || v.key.extractable
    || v.key.type !== "secret" || v.key.algorithm.name !== "AES-GCM"
    || (v.key.algorithm as AesKeyAlgorithm).length !== 256 || v.key.usages.length !== 2
    || !v.key.usages.includes("encrypt") || !v.key.usages.includes("decrypt")) throw Error("INVALID")
  return v
}

/** Whole intent is atomic; each encrypted physical payload still has the 500k bound.
 * This is device protection, not authentication, server ACK, or protection from XSS.
 * Crypto runs before a write transaction. No plaintext cache or automatic eviction.
 */
export function createAccountPlanCollectionPreparationStore(factory: IDBFactory = globalThis.indexedDB): AccountPlanCollectionPreparationStore {
  if (!factory?.open || !globalThis.crypto?.subtle) throw Error("Preparation storage unavailable")
  let database: Promise<IDBDatabase> | undefined, closed = false
  const transactions = new Set<IDBTransaction>()
  const check = (current: () => boolean) => { if (closed || !current()) throw Error("STALE") }
  function open() {
    if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(COLLECTION_PREPARATION_DB, 1)
      let blocked = false
      request.onupgradeneeded = () => {
        request.result.createObjectStore("payloads", { keyPath: ["ownerId", "slot"] }).createIndex("ownerId", "ownerId")
        request.result.createObjectStore("ownerKeys")
      }
      request.onerror = () => reject(Error("Preparation storage failed"))
      request.onblocked = () => { blocked = true; reject(Error("Preparation storage blocked")) }
      request.onsuccess = () => {
        const db = request.result
        if (closed || blocked) { db.close(); reject(Error("STALE")); return }
        db.onversionchange = () => { db.close(); database = undefined }
        resolve(db)
      }
    }).catch(error => { database = undefined; throw error })
    return database
  }
  async function transaction<T>(current: () => boolean, mode: IDBTransactionMode,
    run: (tx: IDBTransaction, finish: (value: T) => void, guard: (fn: () => void) => void) => void) {
    check(current)
    const db = await open(); check(current)
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(["payloads", "ownerKeys"], mode)
      transactions.add(tx)
      let result: T, finished = false, failure: unknown
      const guard = (fn: () => void) => {
        try { check(current); fn() } catch (error) { failure = error; tx.abort() }
      }
      tx.onabort = () => { transactions.delete(tx); reject(failure ?? Error("Preparation transaction aborted")) }
      tx.onerror = () => { failure ??= Error("Preparation storage failed") }
      tx.oncomplete = () => {
        transactions.delete(tx)
        try { check(current); if (!finished) throw Error("Incomplete preparation transaction"); resolve(result) }
        catch (error) { reject(error) }
      }
      guard(() => run(tx, value => { result = value; finished = true }, guard))
    })
  }
  function raw(ownerId: string, current: () => boolean) {
    uuid.parse(ownerId)
    return transaction<{ rows: Row[]; key: unknown }>(current, "readonly", (tx, finish, guard) => {
      const rows = tx.objectStore("payloads").index("ownerId").getAll(ownerId)
      rows.onsuccess = () => guard(() => {
        const key = tx.objectStore("ownerKeys").get(ownerId)
        key.onsuccess = () => guard(() => finish({ rows: rows.result, key: key.result }))
      })
    })
  }
  return {
    async save(input, current) {
      check(current)
      // Capture all caller-owned values synchronously, before the first await.
      const captured = structuredClone({ transfer: input.transfer, expectedSequence: input.expectedSequence })
      const transfer = readAccountPlanCollectionTransfer(captured.transfer)
      if (!transfer) throw Error("INVALID")
      const { ownerId, operationId } = transfer
      const references = (c: AccountPlanCollectionParts) => ({ index: c.index,
        snapshots: c.snapshots.map(p => p.id), progress: c.progress.map(p => p.id) })
      const header = headerSchema.parse({ ...transfer, expectedSequence: captured.expectedSequence,
        previous: transfer.previous ? references(transfer.previous) : null, next: references(transfer.next) })
      const fingerprint = accountPlanFingerprint(captured)
      const payloads = new Map<string, unknown>([["intent", header]])
      for (const c of [transfer.previous, transfer.next]) if (c) {
        for (const part of [...c.snapshots, ...c.progress]) {
          const slot = slotFor(part.kind, part.id), old = payloads.get(slot)
          if (old && accountPlanFingerprint(old) !== accountPlanFingerprint(part)) throw Error("INVALID")
          payloads.set(slot, part)
        }
      }
      const before = await raw(ownerId, current); check(current)
      if (before.rows.length && before.key === undefined) throw Error("INVALID")
      const key: Key = before.key === undefined ? { id: crypto.randomUUID(),
        key: await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]) }
        : keyValue(before.key)
      check(current)
      const encrypted: Row[] = []
      for (const [slot, value] of payloads) {
        check(current)
        const bytes = new TextEncoder().encode(JSON.stringify(value))
        try {
          if (bytes.byteLength > ACCOUNT_PLAN_MAX_BYTES) throw Error("CAPACITY")
          const row = { ownerId, slot, operationId, fingerprint, iv: crypto.getRandomValues(new Uint8Array(12)) }
          const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: row.iv,
            additionalData: aad(row) }, key.key, bytes))
          check(current); encrypted.push({ ...row, ciphertext })
        } finally { bytes.fill(0) }
      }
      await transaction<void>(current, "readwrite", (tx, finish, guard) => {
        const store = tx.objectStore("payloads"), keys = tx.objectStore("ownerKeys")
        const existing = store.index("ownerId").getAll(ownerId)
        existing.onsuccess = () => guard(() => {
          const storedKey = keys.get(ownerId)
          storedKey.onsuccess = () => guard(() => {
            if (storedKey.result === undefined ? before.key !== undefined || existing.result.length > 0
              : keyValue(storedKey.result).id !== key.id) throw Error("CONFLICT")
            if (existing.result.length) {
              const root = (existing.result as Row[]).find(row => row.slot === "intent")
              if (!root || root.operationId !== operationId || root.fingerprint !== fingerprint) throw Error("CONFLICT")
              finish(); return
            }
            if (storedKey.result === undefined) keys.add(key, ownerId)
            for (const row of encrypted) { check(current); store.add(row) }
            // A request callback scope loss still aborts every queued write, including the key.
            const verify = store.get([ownerId, "intent"])
            verify.onsuccess = () => guard(() => finish())
          })
        })
      })
    },
    async read(ownerId, current) {
      const stored = await raw(ownerId, current); check(current)
      if (!stored.rows.length) return null
      if (stored.rows.length > 401) throw Error("INVALID")
      const key = keyValue(stored.key), root = stored.rows.find(row => row.slot === "intent")
      if (!root || !uuid.safeParse(root.operationId).success || !hash.safeParse(root.fingerprint).success) throw Error("INVALID")
      const decoded = new Map<string, unknown>()
      for (const row of stored.rows) {
        check(current)
        if (row.ownerId !== ownerId || row.operationId !== root.operationId || row.fingerprint !== root.fingerprint
          || !(row.iv instanceof Uint8Array) || row.iv.length !== 12 || !(row.ciphertext instanceof Uint8Array)
          || row.ciphertext.length < 16 || row.ciphertext.length > ACCOUNT_PLAN_MAX_BYTES + 16) throw Error("INVALID")
        let bytes: Uint8Array | undefined
        try {
          bytes = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(row.iv),
            additionalData: aad(row) }, key.key, new Uint8Array(row.ciphertext)))
          check(current)
          decoded.set(row.slot, JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
        } catch { check(current); throw Error("INVALID") }
        finally { bytes?.fill(0) }
      }
      const header = headerSchema.safeParse(decoded.get("intent"))
      if (!header.success || header.data.ownerId !== ownerId || header.data.operationId !== root.operationId) throw Error("INVALID")
      const expand = (c: z.infer<typeof collection>) => ({ index: c.index,
        snapshots: c.snapshots.map(id => decoded.get(slotFor("PLAN_SNAPSHOT", id))),
        progress: c.progress.map(id => decoded.get(slotFor("PLAN_PROGRESS", id))) })
      const { expectedSequence, ...intent } = header.data
      const transfer = readAccountPlanCollectionTransfer({ ...intent,
        previous: intent.previous ? expand(intent.previous) : null, next: expand(intent.next) })
      check(current)
      if (!transfer || accountPlanFingerprint({ transfer, expectedSequence }) !== root.fingerprint) throw Error("INVALID")
      return { transfer, expectedSequence }
    },
    async clear(ownerId, operationId, current) {
      uuid.parse(ownerId); uuid.parse(operationId)
      await transaction<void>(current, "readwrite", (tx, finish, guard) => {
        const store = tx.objectStore("payloads"), request = store.index("ownerId").getAll(ownerId)
        request.onsuccess = () => guard(() => {
          const rows = request.result as Row[]
          if (!rows.length) { finish(); return }
          if (!rows.some(row => row.slot === "intent") || rows.some(row => row.operationId !== operationId)) throw Error("CONFLICT")
          for (const row of rows) { check(current); store.delete([ownerId, row.slot]) }
          const verify = store.get([ownerId, "intent"])
          verify.onsuccess = () => guard(() => finish())
        })
      })
    },
    close() {
      closed = true
      for (const tx of transactions) tx.abort()
      void database?.then(db => db.close(), () => undefined)
      database = undefined
    },
  }
}
