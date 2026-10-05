import { expect, test } from "@playwright/test"
test("Oracle V2 encrypts per-answer drafts, replays CAS, resolves edits and preserves the V1 database", async ({ page }) => {
  await page.goto("/?app=1")
  const result = await page.evaluate(async () => {
    const servicePath = "/src/domain/account/account-oracle-v2-service.ts"
    const schemaPath = "/src/domain/account/account-oracle-v2-schema.ts"
    const oldPath = "/src/domain/account/account-running-profile-schema.ts"
    const idPath = "/src/domain/account/account-running-profile-service.ts"
    const bufferPath = "/src/domain/account/account-journal-draft-buffer.ts"
    const { createOracleV2Service, oracleV2EditToken } = await import(servicePath)
    const { accountOracleCompatibleDocumentSchema, emptyOracleV2Document } = await import(schemaPath)
    const { accountRunningProfileDocumentSchema } = await import(oldPath)
    const { runningProfileDocumentId } = await import(idPath)
    const { createAccountDocumentBuffer } = await import(bufferPath)
    const owner = "a1111111-1111-4111-8111-111111111111", other = "b2222222-2222-4222-8222-222222222222"
    const dbName = `oracle-v2-browser-${crypto.randomUUID()}`, legacyDb = `${dbName}-legacy`
    const id = await runningProfileDocumentId(owner)
    const old = createAccountDocumentBuffer(accountRunningProfileDocumentSchema, legacyDb)
    const legacy = { version: 3, state: "ACCOUNT_STATE", kind: "RUNNING_PROFILE", data: {
      version: "RUNNING_PROFILE_V1", answeredAt: "2026-10-04T00:00:00.000Z", answers: { intensity: ["hard"] },
    } }
    await old.saveDraft(owner, id, legacy, 0)
    const preserved = await old.read(owner, id)
    old.close()
    let remote: { revision: number; document: any } | null = null, lost = false
    const receipts = new Map(), writes: any[] = []
    const send = async (request: any) => {
      if (request.action === "oracleV2Support") return { ok: true, data: { kind: "oracle-v2-support", version: 2 } }
      if (request.action === "oracleV2RestartSupport") return { ok: true, data: { kind: "oracle-v2-restart-support", version: 1 } }
      if (request.action === "read") return remote ? { ok: true, data: { kind: "document", documentId: request.documentId, ...structuredClone(remote) } } : { ok: false, code: "NOT_FOUND" }
      writes.push(structuredClone(request))
      if (receipts.has(request.operationId)) return receipts.get(request.operationId)
      if (request.expectedRevision !== (remote?.revision ?? 0)) return { ok: true, data: {
        kind: "conflict", documentId: id, operationId: request.operationId, currentRevision: remote!.revision } }
      remote = { revision: request.expectedRevision + 1, document: request.action === "restartOracleV2" ? emptyOracleV2Document() : structuredClone(request.document) }
      const receipt = { ok: true, data: { kind: "saved", documentId: id, operationId: request.operationId, revision: remote.revision } }
      receipts.set(request.operationId, receipt)
      return lost ? { ok: false, code: "UNAVAILABLE" } : receipt
    }
    const make = (legacyName = `${dbName}-empty-legacy`) => createOracleV2Service(owner, () => {}, {
      buffer: createAccountDocumentBuffer(accountOracleCompatibleDocumentSchema, dbName),
      legacyBuffer: createAccountDocumentBuffer(accountRunningProfileDocumentSchema, legacyName),
      send, isOwner: () => true, exclusive: (work: () => Promise<unknown>) => navigator.locks.request(dbName, work),
    })
    const blocked = make(legacyDb); await blocked.hydrate(); const legacyStatus = blocked.snapshot().status; blocked.close()
    const first = make(); await first.hydrate()
    await first.saveDraft({ STRUCTURE_1: 5 }, oracleV2EditToken(first.snapshot()))
    const answers = { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }
    await first.saveDraft(answers, oracleV2EditToken(first.snapshot())); first.close()
    const second = make(); await second.hydrate()
    const unfinished = second.snapshot(), automaticWrites = writes.length
    const committed = await second.commitAnswers(answers, "STRUCTURE", oracleV2EditToken(second.snapshot()))
    lost = true
    const lostResult = await second.commitAnswers({ STRUCTURE_1: 1 }, null, oracleV2EditToken(second.snapshot()))
    second.close(); lost = false
    const third = make(); await third.hydrate()
    const recovered = third.snapshot()
    await third.saveDraft(answers, oracleV2EditToken(third.snapshot()))
    remote = { revision: recovered.revision + 1, document: structuredClone(recovered.document) }
    remote.document.data.current.revision += 1
    remote.document.data.current.answers = { SOCIAL_1: 1 }
    await third.hydrate()
    const conflict = third.snapshot().status
    const resolved = await third.resolve(third.snapshot(), "LOCAL")
    const resolvedRevision = third.snapshot().draftDocument.data.current.revision
    const contextual = structuredClone(third.snapshot().draftDocument)
    contextual.data.context = { version: "ORACLE_CONTEXT_V1", answeredAt: "2026-10-04T00:00:00.000Z",
      answers: { company: "ALONE" }, conditions: { places: ["TRACK"] } }
    await third.saveDraft(contextual, oracleV2EditToken(third.snapshot()))
    const contextInDraft = third.snapshot().draftDocument.data.context.answers.company
    const deleted = await third.deleteProfile(oracleV2EditToken(third.snapshot()))
    const final = third.snapshot()
    const restarted = await third.restartProfile(oracleV2EditToken(third.snapshot()), "START_NEW_ORACLE_V2")
    const blankAfterRestart = JSON.stringify(third.snapshot().confirmedDocument) === JSON.stringify(emptyOracleV2Document())
    const answeredAgain = await third.commitAnswers(answers, null, oracleV2EditToken(third.snapshot()))
    const freshScoreRevision = third.snapshot().confirmedDocument.data.current.revision
    third.close()
    const inspect = createAccountDocumentBuffer(accountOracleCompatibleDocumentSchema, dbName)
    const foreign = await inspect.read(other, id)
    const archive = await inspect.readConflictArchive(owner, id, () => true); inspect.close()
    const inspectOld = createAccountDocumentBuffer(accountRunningProfileDocumentSchema, legacyDb)
    const legacyUnchanged = JSON.stringify(preserved) === JSON.stringify(await inspectOld.read(owner, id)); inspectOld.close()
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(dbName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const raw: unknown[] = []
    for (const name of Array.from(db.objectStoreNames)) raw.push(await new Promise((resolve, reject) => {
      const request = db.transaction(name).objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
    }))
    db.close()
    return { legacyStatus, legacyUnchanged, automaticWrites, unfinished: unfinished.status,
      answers: unfinished.draftDocument.data.current.answers, completedDuringEditing: unfinished.document,
      draftState: unfinished.draftState, committed, lostResult, recovered: recovered.status,
      replay: JSON.stringify(writes[1]) === JSON.stringify(writes[2]), conflict, resolved, resolvedRevision, deleted,
      final: final.status, activeMaterial: final.document.data.current, foreign, archived: archive.length > 0,
      contextInDraft, contextDeleted: final.document.data.context === undefined, restarted, blankAfterRestart, answeredAgain, freshScoreRevision,
      plaintextLeak: /STRUCTURE|SOCIAL|RUNNING_PROFILE_V2|SELF_RESPONSE_INDEX|ORACLE_CONTEXT_V1|TRACK|ALONE/.test(JSON.stringify(raw)) }
  })
  expect(result).toEqual({ legacyStatus: "LEGACY_DRAFT", legacyUnchanged: true, automaticWrites: 0, unfinished: "PENDING",
    answers: { STRUCTURE_1: 5, STRUCTURE_2: 5, STRUCTURE_3: 5 }, completedDuringEditing: null,
    draftState: "EDITING", committed: true, lostResult: false, recovered: "READY",
    replay: true, conflict: "CONFLICT", resolved: true, resolvedRevision: 4, deleted: true, final: "DELETED",
    activeMaterial: null, foreign: null, archived: true, contextInDraft: "ALONE", contextDeleted: true,
    restarted: true, blankAfterRestart: true, answeredAgain: true, freshScoreRevision: 1, plaintextLeak: false })
})

test("real encrypted IndexedDB profile survives lost receipt, reopen, conflict and account isolation", async ({ page }) => {
  await page.goto("/?app=1")
  const result = await page.evaluate(async () => {
    const servicePath = "/src/domain/account/account-running-profile-service.ts"
    const bufferPath = "/src/domain/account/account-journal-draft-buffer.ts"
    const schemaPath = "/src/domain/account/account-running-profile-schema.ts"
    const { createRunningProfileService, runningProfileEditToken, runningProfileDocumentId } = await import(servicePath)
    const { createAccountDocumentBuffer } = await import(bufferPath)
    const { accountRunningProfileDocumentSchema } = await import(schemaPath)
    const owner = "a1111111-1111-4111-8111-111111111111", other = "b2222222-2222-4222-8222-222222222222"
    const dbName = `profile-browser-${crypto.randomUUID()}`
    let remote: { revision: number; document: unknown } | null = null, lost = true
    const receipts = new Map(), saves: unknown[] = []
    const send = async (request: { action: string; documentId: string; operationId: string; expectedRevision: number; document: unknown }) => {
      if (request.action === "runningProfileSupport") return { ok: true, data: { kind: "running-profile-support", version: 1 } }
      if (request.action === "read") return remote ? { ok: true, data: { kind: "document", documentId: request.documentId, ...remote } } : { ok: false, code: "NOT_FOUND" }
      saves.push(structuredClone(request))
      if (receipts.has(request.operationId)) return receipts.get(request.operationId)
      if (request.expectedRevision !== (remote?.revision ?? 0)) return { ok: true, data: { kind: "conflict", documentId: request.documentId, operationId: request.operationId, currentRevision: remote!.revision } }
      remote = { revision: request.expectedRevision + 1, document: request.document }
      const receipt = { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: remote.revision } }
      receipts.set(request.operationId, receipt)
      return lost ? { ok: false, code: "UNAVAILABLE" } : receipt
    }
    const make = () => createRunningProfileService(owner, () => {}, { buffer: createAccountDocumentBuffer(accountRunningProfileDocumentSchema, dbName),
      send, isOwner: () => true, exclusive: (work: () => Promise<unknown>) => navigator.locks.request(dbName, work) })
    const first = make(); await first.hydrate()
    const saved = await first.save({ motives: ["health"], events: ["800", "marathon"] }, runningProfileEditToken(first.snapshot()))
    const pending = first.snapshot().status; first.close(); lost = false
    const second = make(); await second.hydrate()
    const restored = second.snapshot()
    remote = { revision: 2, document: { ...restored.document, data: { ...restored.document.data, answers: { motives: ["friends"] } } } }
    await second.save({ motives: ["record"] }, runningProfileEditToken(restored)); await second.hydrate()
    const conflict = second.snapshot()
    const resolved = await second.resolve(conflict, "REMOTE")
    const final = second.snapshot(); second.close()
    const buffer = createAccountDocumentBuffer(accountRunningProfileDocumentSchema, dbName)
    const foreign = await buffer.read(other, await runningProfileDocumentId(owner)); buffer.close()
    const db = await new Promise<IDBDatabase>((resolve, reject) => { const request = indexedDB.open(dbName); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) })
    const raw: unknown[] = []
    for (const name of Array.from(db.objectStoreNames)) {
      raw.push(await new Promise((resolve, reject) => { const request = db.transaction(name).objectStore(name).getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error) }))
    }
    db.close()
    const plaintext = JSON.stringify(raw)
    return { saved, pending, replay: JSON.stringify(saves[0]) === JSON.stringify(saves[1]), restored: restored.document.data.answers,
      conflict: conflict.status, resolved, final: final.document.data.answers, foreign, plaintextLeak: /motives|marathon|RUNNING_PROFILE_V1/.test(plaintext) }
  })
  expect(result).toEqual({ saved: false, pending: "PENDING", replay: true, restored: { motives: ["health"], events: ["800", "marathon"] },
    conflict: "CONFLICT", resolved: true, final: { motives: ["friends"] }, foreign: null, plaintextLeak: false })
})
