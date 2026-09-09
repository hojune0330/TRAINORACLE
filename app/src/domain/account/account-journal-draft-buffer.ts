import { z } from "zod"
import { isValidIsoDate } from "../dates"

/** Local draft protection only, not authentication or server/account storage.
 * Callers must verify the current authenticated scope before every call and discard
 * returned plaintext on logout. Persisted device keys provide logical account
 * gating, NOT protection against a local machine operator or same-origin XSS.
 * No plaintext/key cache is retained. Browser eviction remains possible; transaction
 * completion is not a server acknowledgement. No automatic pruning is performed.
 */
export const accountJournalDraftSchema = z.object({
  version: z.literal(1),
  state: z.literal("DRAFT"),
  visibility: z.enum(["PRIVATE", "PERSONAL"]),
  date: z.string().refine(isValidIsoDate, "Invalid calendar date"),
  title: z.string().max(200),
  body: z.string().max(100_000),
}).strict()

export type AccountJournalDraft = z.infer<typeof accountJournalDraftSchema>
const uuid = z.uuid()
const revision = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER - 1)
const sequence = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const cipherSchema = z.object({
  version: z.literal(1),
  iv: z.array(z.number().int().min(0).max(255)).length(12),
  ciphertext: z.array(z.number().int().min(0).max(255)).min(16).max(1_000_000),
}).strict()
import { ACCOUNT_WRITE_REJECTIONS, type AccountJournalWriteRejection } from "./account-write-rejection"
const accountJournalWriteRejectionSchema = z.enum(ACCOUNT_WRITE_REJECTIONS)
const operationSchema = z.object({
  rejection: accountJournalWriteRejectionSchema.optional(),
  writePurpose: z.literal("MIGRATION").optional(),
  operationId: uuid,
  expectedRevision: revision,
  sequence: sequence.refine(value => value > 0),
  encryptedSnapshot: cipherSchema,
}).strict()
const blockedSchema = z.object({
  kind: z.enum(["RECEIPT", "REMOTE"]),
  operationId: uuid.nullable(),
  currentRevision: revision,
  encryptedRemote: cipherSchema.nullable(),
  deleted: z.boolean().default(false),
}).strict()
const archiveSchema = z.object({
  version: z.literal(1).default(1),
  createdAt: z.iso.datetime().nullable().default(null),
  localServerRevision: revision.nullable().default(null),
  localSequence: sequence, remoteRevision: revision,
  encryptedLocal: cipherSchema, encryptedRemote: cipherSchema.nullable(),
  operation: operationSchema.nullable(), deleted: z.boolean(),
  choice: z.enum(["LOCAL", "REMOTE", "DELETE", "REVIEW"]),
}).strict()
export const MAX_CONFLICT_ARCHIVE_ENTRIES = 128
const recordSchema = z.object({
  writePurpose: z.literal("MIGRATION").optional(),
  version: z.literal(1), ownerId: uuid, documentId: uuid,
  serverRevision: revision,
  localSequence: sequence.refine(value => value > 0),
  acknowledgedSequence: sequence,
  encryptedCurrent: cipherSchema,
  operation: operationSchema.nullable(),
  blocked: blockedSchema.nullable(),
  retiredOperationIds: z.array(uuid),
  conflictArchive: z.array(archiveSchema).default([]),
  resolvedDeletion: revision.nullable().default(null),
}).strict().superRefine((record, ctx) => {
  const invalid = () => ctx.addIssue({ code: "custom", message: "Invalid draft lineage" })
  if (record.acknowledgedSequence > record.localSequence) invalid()
  if (record.serverRevision === 0 && record.acknowledgedSequence !== 0) invalid()
  const op = record.operation
  if (op?.sequence === record.localSequence && op.writePurpose !== record.writePurpose) invalid()
  if (op && (op.sequence > record.localSequence || op.sequence <= record.acknowledgedSequence
    || op.expectedRevision !== record.serverRevision
    || record.retiredOperationIds.includes(op.operationId))) invalid()
  if (op?.sequence === record.localSequence
    && JSON.stringify(op.encryptedSnapshot) !== JSON.stringify(record.encryptedCurrent)) invalid()
  if (record.blocked?.kind === "RECEIPT" && (!op
    || record.blocked.operationId !== op.operationId
    || record.blocked.currentRevision === op.expectedRevision
    || record.blocked.encryptedRemote !== null)) invalid()
  if (record.blocked?.kind === "REMOTE" && (record.blocked.operationId !== null
    || (record.blocked.encryptedRemote === null) !== record.blocked.deleted)) invalid()
})

export type AccountJournalDraftRecord = z.infer<typeof recordSchema>
export type AccountJournalDraftPending<T = AccountJournalDraft> = {
  rejection?: AccountJournalWriteRejection
  writePurpose?: "MIGRATION"
  operationId: string; expectedRevision: number; sequence: number; draft: T
}
export type AccountJournalDraftView<T = AccountJournalDraft> = {
  writePurpose?: "MIGRATION"
  ownerId: string; documentId: string; serverRevision: number
  localSequence: number; acknowledgedSequence: number
  state: "LOCAL_CHANGES" | "PENDING" | "DRAFT_ACKNOWLEDGED" | "CONFLICT"
  draft: T
  pending: AccountJournalDraftPending<T> | null
  blocked: { kind: "RECEIPT" | "REMOTE"; operationId: string | null; currentRevision: number } | null
  remoteDraft: T | null
  remoteDeleted?: boolean
  resolvedDeletion?: number | null
  recoverableVersions?: number
}
export type ConflictChoice = "LOCAL" | "REMOTE" | "DELETE"
export type AccountJournalConflictArchive<T = AccountJournalDraft> = {
  version: 1; createdAt: string | null; localServerRevision: number | null
  localSequence: number; remoteRevision: number; deleted: boolean
  choice: ConflictChoice | "REVIEW"; local: T; remote: T | null
  pending: AccountJournalDraftPending<T> | null
}
export interface AccountJournalDraftBuffer<T = AccountJournalDraft> {
  saveDraft(owner: string, doc: string, draft: T, expectedLocalSequence?: number, writePurpose?: "MIGRATION"): Promise<void>
  read(owner: string, doc: string): Promise<AccountJournalDraftView<T> | null>
  list(owner: string): Promise<AccountJournalDraftView<T>[]>
  queue(owner: string, doc: string, operationId: string): Promise<void>
  ack(owner: string, doc: string, operationId: string, revision: number): Promise<boolean>
  conflict(owner: string, doc: string, operationId: string, currentRevision: number): Promise<boolean>
  importRemote(owner: string, doc: string, draft: T, serverRevision: number): Promise<"IMPORTED" | "UNCHANGED" | "CONFLICT">
  clear(owner: string, doc: string): Promise<boolean>
  reject?(owner: string, doc: string, operationId: string, reason: AccountJournalWriteRejection): Promise<boolean>
  logout(owner: string): void
  close(): void
}
/** Existing autosave/sync mocks may keep implementing the smaller base interface. */
export interface AccountJournalConflictBuffer<T = AccountJournalDraft> extends AccountJournalDraftBuffer<T> {
  captureConflict(owner: string, doc: string, remote: T | null, remoteRevision: number, expectedLocalSequence: number, isCurrent?: () => boolean): Promise<void>
  resolveConflict(owner: string, doc: string, choice: ConflictChoice, remoteRevision: number, expectedLocalSequence: number, isCurrent?: () => boolean): Promise<void>
  acceptCleanDeletion(owner: string, doc: string, remoteRevision: number, expectedLocalSequence: number): Promise<void>
  readConflictArchive(owner: string, doc: string, isCurrent?: () => boolean): Promise<AccountJournalConflictArchive<T>[]>
}
type Cipher = z.infer<typeof cipherSchema>
const DB_NAME = "trainoracle-account-journal-drafts-v1"
const RECORDS = "drafts"
const KEYS = "ownerKeys"

function parseRecord(value: unknown, ownerId: string, documentId?: string) {
  const result = recordSchema.safeParse(value)
  if (!result.success || result.data.ownerId !== ownerId
    || (documentId !== undefined && result.data.documentId !== documentId)) {
    throw new Error("Invalid stored draft record")
  }
  return result.data
}

function parseDocument<T>(value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value)
  // Do not propagate Zod input values into error logs.
  if (!result.success) throw new Error("Invalid journal draft")
  return result.data
}

function deviceKey(value: unknown): CryptoKey {
  if (!(value instanceof CryptoKey) || value.type !== "secret" || value.extractable
    || value.algorithm.name !== "AES-GCM" || (value.algorithm as AesKeyAlgorithm).length !== 256
    || value.usages.length !== 2 || !value.usages.includes("encrypt") || !value.usages.includes("decrypt")) {
    throw new Error("Invalid stored device key")
  }
  return value
}

function aad(ownerId: string, documentId: string, databaseName: string) {
  return new TextEncoder().encode(JSON.stringify([databaseName, 1, ownerId, documentId]))
}

async function encrypt<T>(key: CryptoKey, ownerId: string, documentId: string, draft: T, databaseName: string): Promise<Cipher> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const bytes = new TextEncoder().encode(JSON.stringify(draft))
  try {
    const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv,
      additionalData: aad(ownerId, documentId, databaseName) }, key, bytes)
    return cipherSchema.parse({ version: 1, iv: Array.from(iv), ciphertext: Array.from(new Uint8Array(ciphertext)) })
  } finally { bytes.fill(0) }
}

async function decrypt<T>(key: CryptoKey, ownerId: string, documentId: string, encrypted: Cipher, schema: z.ZodType<T>, databaseName: string) {
  let bytes: Uint8Array | undefined
  try {
    bytes = new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM",
      iv: new Uint8Array(encrypted.iv), additionalData: aad(ownerId, documentId, databaseName),
    }, key, new Uint8Array(encrypted.ciphertext)))
    return parseDocument(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)), schema)
  } catch { throw new Error("Cannot decrypt journal draft") }
  finally { bytes?.fill(0) }
}

export function createAccountJournalDraftBuffer(factory: IDBFactory = globalThis.indexedDB): AccountJournalConflictBuffer {
  return createAccountDocumentBuffer(accountJournalDraftSchema, DB_NAME, factory)
}

/** Same durable protocol for separately validated account document families. */
export function createAccountDocumentBuffer<T>(schema: z.ZodType<T>, databaseName: string,
  factory: IDBFactory = globalThis.indexedDB): AccountJournalConflictBuffer<T> {
  if (!factory || typeof factory.open !== "function") throw new Error("IndexedDB unavailable")
  if (!globalThis.crypto?.subtle) throw new Error("Web Crypto unavailable")
  const disposedOwners = new Set<string>()
  const transactions = new Map<IDBTransaction, string>()
  let closed = false
  let database: Promise<IDBDatabase> | undefined

  function scope(owner: string, document?: string) {
    const ownerId = uuid.parse(owner).toLowerCase()
    const documentId = document === undefined ? undefined : uuid.parse(document).toLowerCase()
    if (closed || disposedOwners.has(ownerId)) throw new Error("Draft buffer scope disposed")
    return { ownerId, documentId }
  }

  function open() {
    if (!database) database = new Promise<IDBDatabase>((resolve, reject) => {
      const request = factory.open(databaseName, 1)
      let refused = false
      request.onupgradeneeded = () => {
        request.result.createObjectStore(RECORDS, { keyPath: ["ownerId", "documentId"] })
          .createIndex("ownerId", "ownerId")
        request.result.createObjectStore(KEYS)
      }
      request.onerror = () => reject(new Error("Cannot open draft database"))
      request.onblocked = () => { refused = true; reject(new Error("Draft database blocked")) }
      request.onsuccess = () => {
        const db = request.result
        if (refused || closed) { db.close(); reject(new Error("Draft buffer closed")); return }
        db.onversionchange = () => { db.close(); database = undefined }
        resolve(db)
      }
    }).catch(error => { database = undefined; throw error })
    return database
  }

  // All read/modify/write work below is synchronous inside request callbacks.
  // Web Crypto must never be awaited in a live IndexedDB transaction.
  async function transaction<T>(ownerId: string, stores: string[], mode: IDBTransactionMode,
    run: (tx: IDBTransaction, finish: (value: T) => void, guard: (fn: () => void) => void) => void): Promise<T> {
    const db = await open()
    scope(ownerId)
    return new Promise<T>((resolve, reject) => {
      const tx = db.transaction(stores, mode)
      transactions.set(tx, ownerId)
      let result: T
      let finished = false
      let failure: unknown
      const guard = (fn: () => void) => {
        try { scope(ownerId); fn() }
        catch (error) { failure = error; tx.abort() }
      }
      tx.oncomplete = () => {
        transactions.delete(tx)
        if (!finished) reject(new Error("Incomplete draft transaction"))
        else resolve(result)
      }
      tx.onabort = () => { transactions.delete(tx); reject(failure ?? new Error("Draft transaction aborted")) }
      tx.onerror = () => { failure ??= new Error("Draft storage failed") }
      guard(() => run(tx, value => { result = value; finished = true }, guard))
    })
  }

  async function keyFor(ownerId: string, create: boolean) {
    const existing = await transaction<unknown>(ownerId, [KEYS], "readonly", (tx, finish, guard) => {
      const request = tx.objectStore(KEYS).get(ownerId)
      request.onsuccess = () => guard(() => finish(request.result))
    })
    if (existing !== undefined) return deviceKey(existing)
    if (!create) throw new Error("Missing device key")
    const candidate = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"])
    return transaction<CryptoKey>(ownerId, [KEYS, RECORDS], "readwrite", (tx, finish, guard) => {
      const keys = tx.objectStore(KEYS)
      const request = keys.get(ownerId)
      request.onsuccess = () => guard(() => {
        if (request.result !== undefined) { finish(deviceKey(request.result)); return }
        const count = tx.objectStore(RECORDS).index("ownerId").count(ownerId)
        count.onsuccess = () => guard(() => {
          if (count.result !== 0) throw new Error("Missing device key for existing drafts")
          keys.add(candidate, ownerId)
          finish(candidate)
        })
      })
    })
  }

  function get(ownerId: string, documentId: string) {
    return transaction<AccountJournalDraftRecord | null>(ownerId, [RECORDS], "readonly", (tx, finish, guard) => {
      const request = tx.objectStore(RECORDS).get([ownerId, documentId])
      request.onsuccess = () => guard(() => finish(request.result === undefined
        ? null : parseRecord(request.result, ownerId, documentId)))
    })
  }

  function update<T>(ownerId: string, documentId: string,
    change: (record: AccountJournalDraftRecord | null) => { record: AccountJournalDraftRecord | null; result: T }) {
    return transaction<T>(ownerId, [RECORDS], "readwrite", (tx, finish, guard) => {
      const store = tx.objectStore(RECORDS)
      const request = store.get([ownerId, documentId])
      request.onsuccess = () => guard(() => {
        const old = request.result === undefined ? null : parseRecord(request.result, ownerId, documentId)
        const next = change(old)
        if (next.record) store.put(parseRecord(next.record, ownerId, documentId))
        else if (old) store.delete([ownerId, documentId])
        finish(next.result)
      })
    })
  }

  function required(record: AccountJournalDraftRecord | null) {
    if (!record) throw new Error("Draft not found")
    return record
  }
  function initial(ownerId: string, documentId: string, encryptedCurrent: Cipher): AccountJournalDraftRecord {
    return { version: 1, ownerId, documentId, encryptedCurrent, serverRevision: 0,
      localSequence: 1, acknowledgedSequence: 0, operation: null, blocked: null, retiredOperationIds: [],
      conflictArchive: [], resolvedDeletion: null }
  }

  async function view(record: AccountJournalDraftRecord): Promise<AccountJournalDraftView<T>> {
    const { ownerId, documentId } = record
    const key = await keyFor(ownerId, false)
    const draft = await decrypt(key, ownerId, documentId, record.encryptedCurrent, schema, databaseName)
    const op = record.operation
    const pending = op ? { operationId: op.operationId, expectedRevision: op.expectedRevision,
      ...(op.writePurpose ? { writePurpose: op.writePurpose } : {}),
      sequence: op.sequence, ...(op.rejection ? { rejection: op.rejection } : {}), draft: await decrypt(key, ownerId, documentId, op.encryptedSnapshot, schema, databaseName) } : null
    const remoteDraft = record.blocked?.encryptedRemote
      ? await decrypt(key, ownerId, documentId, record.blocked.encryptedRemote, schema, databaseName) : null
    scope(ownerId)
    return { ownerId, documentId, serverRevision: record.serverRevision,
      ...(record.writePurpose ? { writePurpose: record.writePurpose } : {}),
      localSequence: record.localSequence, acknowledgedSequence: record.acknowledgedSequence,
      state: record.blocked ? "CONFLICT" : op ? "PENDING"
        : record.localSequence === record.acknowledgedSequence ? "DRAFT_ACKNOWLEDGED" : "LOCAL_CHANGES",
      draft, pending, remoteDraft, remoteDeleted: record.blocked?.deleted ?? false,
      resolvedDeletion: record.resolvedDeletion, recoverableVersions: record.conflictArchive.length,
      blocked: record.blocked ? { kind: record.blocked.kind,
        operationId: record.blocked.operationId, currentRevision: record.blocked.currentRevision } : null }
  }

  return {
    async saveDraft(owner: string, doc: string, input: T, expectedLocalSequence?: number, writePurpose?: "MIGRATION") {
      const { ownerId, documentId } = scope(owner, doc)
      z.literal("MIGRATION").optional().parse(writePurpose)
      const draft = parseDocument(input, schema)
      if (expectedLocalSequence !== undefined) sequence.parse(expectedLocalSequence)
      const encrypted = await encrypt(await keyFor(ownerId, true), ownerId, documentId!, draft, databaseName)
      await update(ownerId, documentId!, old => {
        if (writePurpose && old?.operation && old.operation.writePurpose !== writePurpose) {
          throw new Error("Pending operation purpose is immutable")
        }
        if (old?.resolvedDeletion) throw new Error("Remote deletion requires explicit restore")
        if (expectedLocalSequence !== undefined && expectedLocalSequence !== (old?.localSequence ?? 0)) {
          throw new Error("Draft local sequence mismatch")
        }
        const record = old ? { ...old, localSequence: old.localSequence + 1, encryptedCurrent: encrypted }
          : initial(ownerId, documentId!, encrypted)
        if (writePurpose) record.writePurpose = writePurpose
        return { record, result: record }
      })
    },

    async queue(owner: string, doc: string, id: string) {
      const { ownerId, documentId } = scope(owner, doc)
      const operationId = uuid.parse(id).toLowerCase()
      await update(ownerId, documentId!, old => {
        const record = required(old)
        if (record.blocked) throw new Error("Draft conflict blocked")
        if (record.operation) {
          if (record.operation.operationId !== operationId) throw new Error("Another operation pending")
          return { record, result: record.operation }
        }
        if (record.retiredOperationIds.includes(operationId)) throw new Error("Operation ID already used")
        if (record.localSequence === record.acknowledgedSequence) throw new Error("No local changes")
        const operation = operationSchema.parse({ operationId, expectedRevision: record.serverRevision,
          ...(record.writePurpose ? { writePurpose: record.writePurpose } : {}),
          sequence: record.localSequence, encryptedSnapshot: record.encryptedCurrent })
        return { record: { ...record, operation }, result: operation }
      })
    },

    async reject(owner, doc, id, reason) {
      const { ownerId, documentId } = scope(owner, doc)
      const operationId = uuid.parse(id).toLowerCase()
      accountJournalWriteRejectionSchema.parse(reason)
      return update(ownerId, documentId!, old => {
        const record = required(old)
        if (record.blocked || !record.operation || record.operation.operationId !== operationId) return { record, result: false }
        return { record: { ...record, operation: { ...record.operation, rejection: reason } }, result: true }
      })
    },

    async ack(owner: string, doc: string, id: string, serverRevision: number) {
      const { ownerId, documentId } = scope(owner, doc)
      const operationId = uuid.parse(id).toLowerCase()
      revision.parse(serverRevision)
      return update(ownerId, documentId!, old => {
        const record = required(old)
        const op = record.operation
        if (record.blocked || !op || op.operationId !== operationId || serverRevision !== op.expectedRevision + 1) {
          return { record, result: false }
        }
        return { record: { ...record, serverRevision, acknowledgedSequence: op.sequence, operation: null,
          retiredOperationIds: [...record.retiredOperationIds, operationId] }, result: true }
      })
    },

    async conflict(owner: string, doc: string, id: string, currentRevision: number) {
      const { ownerId, documentId } = scope(owner, doc)
      const operationId = uuid.parse(id).toLowerCase()
      revision.parse(currentRevision)
      return update(ownerId, documentId!, old => {
        const record = required(old)
        if (record.blocked || !record.operation || record.operation.operationId !== operationId
          || currentRevision === record.operation.expectedRevision) return { record, result: false }
        return { record: { ...record, blocked: { kind: "RECEIPT", operationId, currentRevision,
          encryptedRemote: null, deleted: false } }, result: true }
      })
    },

    /** Explicit owner-scoped plaintext read, including fixed retry snapshots. */
    async list(owner: string) {
      const { ownerId } = scope(owner)
      const records = await transaction<AccountJournalDraftRecord[]>(ownerId, [RECORDS], "readonly", (tx, finish, guard) => {
        const request = tx.objectStore(RECORDS).index("ownerId").getAll(ownerId)
        request.onsuccess = () => guard(() => finish(request.result.map(value => parseRecord(value, ownerId))))
      })
      const views: AccountJournalDraftView<T>[] = []
      for (const record of records) views.push(await view(record))
      scope(ownerId)
      return views
    },

    async read(owner: string, doc: string) {
      const { ownerId, documentId } = scope(owner, doc)
      const record = await get(ownerId, documentId!)
      if (!record) return null
      return view(record)
    },

    async importRemote(owner: string, doc: string, input: T, serverRevision: number) {
      const { ownerId, documentId } = scope(owner, doc)
      revision.refine(value => value > 0).parse(serverRevision)
      const draft = parseDocument(input, schema)
      const key = await keyFor(ownerId, true)
      const encrypted = await encrypt(key, ownerId, documentId!, draft, databaseName)
      const before = await get(ownerId, documentId!)
      const priorDraft = before ? await decrypt(key, ownerId, documentId!, before.encryptedCurrent, schema, databaseName) : null
      return update(ownerId, documentId!, old => {
        // CAS the complete encrypted record: async decryption must not mask a tab's edit/ack.
        if (JSON.stringify(old) !== JSON.stringify(before)) throw new Error("Draft changed; retry remote import")
        if (old && serverRevision < old.serverRevision) throw new Error("Stale remote revision")
        if (old?.blocked) return { record: old, result: "CONFLICT" as const }
        if (old && (old.operation || old.localSequence !== old.acknowledgedSequence)) {
          // A refresh of the confirmed base is not a concurrent remote edit.
          // Current dirty content cannot be compared against that base's content.
          if (serverRevision === old.serverRevision) return { record: old, result: "UNCHANGED" as const }
          return { record: { ...old, blocked: { kind: "REMOTE", operationId: null,
            currentRevision: serverRevision, encryptedRemote: encrypted, deleted: false } }, result: "CONFLICT" as const }
        }
        if (old && serverRevision === old.serverRevision) {
          if (JSON.stringify(priorDraft) !== JSON.stringify(draft)) throw new Error("Remote revision content mismatch")
          return { record: old, result: "UNCHANGED" as const }
        }
        const localSequence = old ? old.localSequence + 1 : 1
        const record = { ...(old ?? initial(ownerId, documentId!, encrypted)), encryptedCurrent: encrypted,
          serverRevision, localSequence, acknowledgedSequence: localSequence, resolvedDeletion: null }
        return { record, result: "IMPORTED" as const }
      })
    },

    async captureConflict(owner, doc, input, remoteRevision, expectedLocalSequence, isCurrent = () => true) {
      const { ownerId, documentId } = scope(owner, doc)
      revision.refine(value => value > 0).parse(remoteRevision)
      sequence.parse(expectedLocalSequence)
      const remote = input === null ? null : parseDocument(input, schema)
      const before = required(await get(ownerId, documentId!))
      const sameRevision = before.blocked?.kind === "REMOTE" && before.blocked.currentRevision === remoteRevision
      if (sameRevision) {
        const previous = before.blocked!.encryptedRemote
          ? await decrypt(await keyFor(ownerId, false), ownerId, documentId!, before.blocked!.encryptedRemote, schema, databaseName) : null
        if (JSON.stringify(previous) !== JSON.stringify(remote)) throw new Error("Remote revision content mismatch")
      }
      const encryptedRemote = sameRevision ? before.blocked!.encryptedRemote : remote === null ? null
        : await encrypt(await keyFor(ownerId, false), ownerId, documentId!, remote, databaseName)
      await update(ownerId, documentId!, old => {
        const record = required(old)
        if (!isCurrent() || JSON.stringify(record) !== JSON.stringify(before)
          || !record.blocked || record.localSequence !== expectedLocalSequence
          || remoteRevision < Math.max(record.serverRevision, record.blocked.currentRevision)) {
          throw new Error("Conflict changed; review again")
        }
        if (sameRevision && record.conflictArchive.some(item => item.localSequence === record.localSequence
          && item.remoteRevision === remoteRevision && JSON.stringify(item.encryptedLocal) === JSON.stringify(record.encryptedCurrent)
          && JSON.stringify(item.encryptedRemote) === JSON.stringify(encryptedRemote))) return { record, result: undefined }
        // Keep every reviewed pair, including superseded remote bodies, without expiry.
        const previous = record.blocked.kind === "REMOTE" && !sameRevision ? [{
          version: 1 as const, createdAt: new Date().toISOString(), localServerRevision: record.serverRevision,
          localSequence: record.localSequence, remoteRevision: record.blocked.currentRevision,
          encryptedLocal: record.encryptedCurrent, encryptedRemote: record.blocked.encryptedRemote,
          operation: record.operation, deleted: record.blocked.deleted, choice: "REVIEW" as const,
        }] : []
        const conflictArchive = [...record.conflictArchive, ...previous, {
          version: 1 as const, createdAt: new Date().toISOString(), localServerRevision: record.serverRevision,
          localSequence: record.localSequence, remoteRevision,
          encryptedLocal: record.encryptedCurrent, encryptedRemote,
          operation: record.operation, deleted: remote === null, choice: "REVIEW" as const,
        }]
        if (conflictArchive.length > MAX_CONFLICT_ARCHIVE_ENTRIES) throw new Error("Conflict archive full; existing versions retained")
        return { record: { ...record, conflictArchive, blocked: { kind: "REMOTE", operationId: null,
          currentRevision: remoteRevision, encryptedRemote, deleted: remote === null } }, result: undefined }
      })
    },

    async resolveConflict(owner, doc, choice, remoteRevision, expectedLocalSequence, isCurrent = () => true) {
      const { ownerId, documentId } = scope(owner, doc)
      z.enum(["LOCAL", "REMOTE", "DELETE"]).parse(choice)
      revision.parse(remoteRevision); sequence.parse(expectedLocalSequence)
      await update(ownerId, documentId!, old => {
        const record = required(old), blocked = record.blocked
        if (!isCurrent() || !blocked || blocked.kind !== "REMOTE" || record.localSequence !== expectedLocalSequence
          || blocked.currentRevision !== remoteRevision || (choice === "DELETE") !== blocked.deleted) {
          throw new Error("Conflict changed; review again")
        }
        const localSequence = record.localSequence + 1
        if (record.conflictArchive.length >= MAX_CONFLICT_ARCHIVE_ENTRIES) throw new Error("Conflict archive full; existing versions retained")
        return { record: { ...record, conflictArchive: [...record.conflictArchive, {
          version: 1 as const, createdAt: new Date().toISOString(), localServerRevision: record.serverRevision,
          localSequence: record.localSequence, remoteRevision,
          encryptedLocal: record.encryptedCurrent, encryptedRemote: blocked.encryptedRemote,
          operation: record.operation, deleted: blocked.deleted, choice,
        }], encryptedCurrent: choice === "REMOTE" ? blocked.encryptedRemote! : record.encryptedCurrent,
          serverRevision: remoteRevision, localSequence,
          acknowledgedSequence: choice === "LOCAL" ? record.acknowledgedSequence : localSequence,
          operation: null, blocked: null, resolvedDeletion: choice === "DELETE" ? remoteRevision : null,
          retiredOperationIds: record.operation
            ? [...record.retiredOperationIds, record.operation.operationId] : record.retiredOperationIds,
        }, result: undefined }
      })
    },

    /** Explicit owner-scoped recovery read. createdAt is device archival time, not
     * server replacedAt or an expiry deadline; unresolved versions are never pruned.
     */
    async readConflictArchive(owner, doc, isCurrent = () => true) {
      const { ownerId, documentId } = scope(owner, doc)
      if (!isCurrent()) throw new Error("Archive scope changed")
      const record = await get(ownerId, documentId!)
      if (!record) return []
      const key = await keyFor(ownerId, false)
      const versions: AccountJournalConflictArchive<T>[] = []
      for (const item of record.conflictArchive) {
        if (!isCurrent()) throw new Error("Archive scope changed")
        const op = item.operation
        versions.push({ version: item.version, createdAt: item.createdAt, localServerRevision: item.localServerRevision,
          localSequence: item.localSequence, remoteRevision: item.remoteRevision, deleted: item.deleted, choice: item.choice,
          local: await decrypt(key, ownerId, documentId!, item.encryptedLocal, schema, databaseName),
          remote: item.encryptedRemote ? await decrypt(key, ownerId, documentId!, item.encryptedRemote, schema, databaseName) : null,
          pending: op ? { operationId: op.operationId, expectedRevision: op.expectedRevision, sequence: op.sequence,
            ...(op.writePurpose ? { writePurpose: op.writePurpose } : {}),
            draft: await decrypt(key, ownerId, documentId!, op.encryptedSnapshot, schema, databaseName) } : null,
        })
      }
      scope(ownerId)
      if (!isCurrent()) throw new Error("Archive scope changed")
      return versions
    },

    async acceptCleanDeletion(owner, doc, remoteRevision, expectedLocalSequence) {
      const { ownerId, documentId } = scope(owner, doc)
      revision.refine(value => value > 0).parse(remoteRevision)
      sequence.parse(expectedLocalSequence)
      await update(ownerId, documentId!, old => {
        const record = required(old)
        if (record.blocked || record.operation || record.localSequence !== expectedLocalSequence
          || record.acknowledgedSequence !== expectedLocalSequence || remoteRevision <= record.serverRevision) {
          throw new Error("Deletion changed; review again")
        }
        return { record: record.conflictArchive.length
          ? { ...record, serverRevision: remoteRevision, resolvedDeletion: remoteRevision } : null, result: undefined }
      })
    },

    /** Archives are durable recovery data, never evicted as clean cache. */
    async clear(owner: string, doc: string) {
      const { ownerId, documentId } = scope(owner, doc)
      return update(ownerId, documentId!, old => {
        if (old && (old.operation || old.blocked || old.localSequence !== old.acknowledgedSequence)) {
          throw new Error("Cannot clear unsaved draft")
        }
        if (old?.conflictArchive.length) return { record: old, result: false }
        return { record: null, result: old !== null }
      })
    },

    /** Terminal for this owner's scope on this instance; re-login creates a new buffer.
     * In-flight transactions are aborted; persisted pending ciphertext and keys remain.
     * Other tabs and already-returned plaintext are the caller's responsibility.
     */
    logout(owner: string) {
      const ownerId = uuid.parse(owner).toLowerCase()
      disposedOwners.add(ownerId)
      for (const [tx, txOwner] of transactions) if (txOwner === ownerId) tx.abort()
    },
    close() {
      closed = true
      for (const tx of transactions.keys()) tx.abort()
      void database?.then(db => db.close(), () => undefined)
      database = undefined
    },
  }
}
