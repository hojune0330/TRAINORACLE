import { expect, test } from "@playwright/test"
import { loadRecordHarness, mockRecordServer } from "./fixtures/account-journal-record-server"
import type {} from "./fixtures/account-journal-record-service"
import type { AccountJournalRecord } from "../src/domain/account/account-journal-record-schema"

let server: ReturnType<typeof mockRecordServer<AccountJournalRecord>>
test.beforeEach(async ({ context, page }) => {
  server = mockRecordServer()
  await server.install(context)
  await loadRecordHarness(page)
})

test("persisted ACK cache survives failed hydration without current-session authority or a cached write base", async ({ page }) => {
  let unavailable = false
  await page.route("**/__record_api__", route => unavailable
    ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : route.fallback())
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  expect(await page.evaluate(() => window.accountRecordHarness.readCurrentConfirmedAccountJournalProjection())).toHaveLength(1)
  expect(await page.evaluate(() => window.accountRecordHarness.currentFileAnalysis())).toEqual({ accepted: true, included: 1 })
  unavailable = true
  await page.reload(); await loadRecordHarness(page)
  const failed = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return { hydrated: await h.hydrateAccountJournalRecords(), status: h.accountJournalProjectionStatus(),
      cached: h.readAccountJournalProjection(), current: h.readCurrentConfirmedAccountJournalProjection(),
      base: await h.readAccountJournalWriteBase("ordinary"), raw: await h.rawRecords(), analysis: h.currentFileAnalysis() }
  })
  expect(failed.hydrated).toBe(false)
  expect(failed.status).toBe("FAILED")
  expect(failed.cached).toHaveLength(1)
  expect(failed.cached[0]).toMatchObject({ syncState: "synced", fileObservation: { distanceMeters: 5000 } })
  expect(failed.current).toEqual([])
  expect(failed.analysis).toEqual({ accepted: false, included: 0 })
  expect(failed.base).toBeNull()
  expect(failed.raw).toHaveLength(1)
  unavailable = false
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
  expect(await page.evaluate(() => window.accountRecordHarness.readCurrentConfirmedAccountJournalProjection())).toHaveLength(1)
  expect(await page.evaluate(() => window.accountRecordHarness.readAccountJournalWriteBase("ordinary"))).toMatchObject({ revision: 1 })
  expect(await page.evaluate(() => window.accountRecordHarness.currentFileAnalysis())).toEqual({ accepted: true, included: 1 })
  unavailable = true
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(false)
  expect(await page.evaluate(() => window.accountRecordHarness.readCurrentConfirmedAccountJournalProjection())).toEqual([])
  expect(await page.evaluate(() => window.accountRecordHarness.readAccountJournalProjection())).toHaveLength(1)
})

test("older list revisions cannot promote an unverified newer ACK cache", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness, entry = h.fileRecord().entry
    await h.persistAccountJournalRecord(entry, undefined, "FILE_OBSERVATION")
    await h.correctAccountJournalFileObservation(entry.id, h.fileRecord().replacement,
      (await h.readAccountJournalWriteBase(entry.id))!, ["distanceMeters", "laps"])
  })
  const [key, current] = [...server.documents.entries()][0]!
  const original = server.history.get(key)![0]!
  server.documents.set(key, { documentId: current.documentId, revision: original.revision, document: original.document })
  await page.reload(); await loadRecordHarness(page)
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return { hydrated: await h.hydrateAccountJournalRecords(), current: h.readCurrentConfirmedAccountJournalProjection(),
      cached: h.readAccountJournalProjection(), base: await h.readAccountJournalWriteBase("ordinary"), view: await h.view("ordinary") }
  })
  expect(result.hydrated).toBe(false)
  expect(result.current).toEqual([])
  expect(result.cached[0]).toMatchObject({ fileObservation: { distanceMeters: 5100 } })
  expect(result.view?.serverRevision).toBe(2)
  expect(result.base).toBeNull()
})

test("file correction stays encrypted and leaves original visible until ACK; no sticky attachment purpose", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const { entry } = h.fileRecord()
    await h.persistAccountJournalRecord(entry, undefined, "FILE_OBSERVATION")
  })
  server.offline(true)
  const pending = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const { entry, replacement } = h.fileRecord()
    const base = (await h.readAccountJournalWriteBase(entry.id))!
    const saved = await h.correctAccountJournalFileObservation(entry.id, replacement, base, ["distanceMeters", "laps"])
    const before = await h.rawRecords()
    const overwrite = await h.persistAccountJournalRecord({ ...entry, memo: "FORBIDDEN_OVERWRITE", savedAt: "2026-09-02T02:00:00.000Z" }, entry.savedAt)
    const differentCorrection = await h.correctAccountJournalFileObservation(entry.id, replacement, base, ["distanceMeters"])
    return { saved, overwrite, differentCorrection, before, after: await h.rawRecords(), view: await h.view(entry.id),
      visible: h.readAccountJournalPrivateEntry(entry.id), analysis: h.loadAnalysisEntries() }
  })
  expect(pending.saved).toEqual({ ok: true, storage: "PENDING" })
  expect(pending.overwrite).toEqual({ ok: false, storage: "FAILED" })
  expect(pending.differentCorrection).toEqual({ ok: false, storage: "FAILED" })
  expect(pending.before).toEqual(pending.after)
  expect(pending.visible).toMatchObject({ distanceKm: "5", rpe: 6, fileObservation: { distanceMeters: 5000 } })
  expect(pending.view).toMatchObject({ serverRevision: 1, pending: { mutation: { action: "correctImportedObservation" },
    originalDraft: { entry: { distanceKm: "5" } }, draft: { entry: { distanceKm: "5.1" } } } })
  for (const text of ["SYNTHETIC_OBSERVATION_ONLY", "SYNTHETIC_ORDINARY_BODY", "replacementObservation", "confirmedChangedFields", "sourceObservationKey"])
    expect(JSON.stringify(pending.before)).not.toContain(text)
  expect(pending.before[0]).toHaveProperty("encryptedMutation")
  server.offline(false)
  const done = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const saved = await h.retryAccountJournalFileObservation("ordinary")
    const base = (await h.readAccountJournalWriteBase("ordinary"))!
    const entry = base.entry!
    if (entry.kind !== "post-session") throw new Error("Expected post-session fixture")
    const edited = await h.persistAccountJournalRecord({ ...entry, savedAt: "2026-09-02T02:00:00.000Z", memo: "ORDINARY_EDIT_AFTER_FILE" }, entry.savedAt)
    return { saved, base, edited, view: await h.view("ordinary") }
  })
  expect(done.saved).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(done.base.entry).toMatchObject({ distanceKm: "5.1", savedAt: "2026-09-02T01:00:00.000Z", rpe: 6 })
  expect(done.edited).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(done.view?.pending).toBeNull()
  expect(done.view?.writePurpose).toBeUndefined()
  const ordinarySave = server.calls.filter(call => call.request.action === "save").at(-1)!.request
  expect(ordinarySave).not.toHaveProperty("writePurpose")
  expect(server.calls.filter(call => call.request.action === "correctImportedObservation")).toHaveLength(2)
})

test("file correction lost receipt reload replays identical encrypted snapshot nonce and request", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  server.loseReceipt("correctImportedObservation")
  const pending = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const { entry, replacement } = h.fileRecord()
    const base = (await h.readAccountJournalWriteBase(entry.id))!
    return { result: await h.correctAccountJournalFileObservation(entry.id, replacement, base, ["laps", "distanceMeters"]), raw: await h.rawRecords() }
  })
  expect(pending.result).toEqual({ ok: true, storage: "PENDING" })
  await page.reload(); await loadRecordHarness(page)
  expect(await page.evaluate(() => window.accountRecordHarness.rawRecords())).toEqual(pending.raw)
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ state: "DRAFT_ACKNOWLEDGED", serverRevision: 2,
    pending: null, draft: { entry: { distanceKm: "5.1", savedAt: "2026-09-02T01:00:00.000Z" } } })
  const requests = server.calls.filter(call => call.request.action === "correctImportedObservation")
  expect(requests).toHaveLength(2)
  expect(requests[1]!.request).toEqual(requests[0]!.request)
  expect([...server.documents.values()][0]!.revision).toBe(2)
})

test("file correction tombstone hydration preserves ciphertext without retry or resurrection", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  server.offline(true)
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.correctAccountJournalFileObservation("ordinary", h.fileRecord().replacement, (await h.readAccountJournalWriteBase("ordinary"))!, ["laps", "distanceMeters"])
  })
  const [key, old] = [...server.documents.entries()][0]!
  server.documents.delete(key); server.tombstones.set(key, { documentId: old.documentId, revision: 2 })
  server.offline(false)
  await page.reload(); await loadRecordHarness(page)
  await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return { retry: await h.retryAccountJournalFileObservation("ordinary"), view: await h.view("ordinary"), entries: h.loadEntries(), raw: await h.rawRecords() }
  })
  expect(result.retry).toEqual({ ok: false, storage: "FAILED" })
  expect(result.view).toMatchObject({ state: "CONFLICT", blocked: { currentRevision: 2 }, pending: { mutation: { action: "correctImportedObservation" } } })
  expect(result.entries).toEqual([])
  expect(result.raw).toHaveLength(1)
  expect(server.calls.filter(call => call.request.action === "correctImportedObservation")).toHaveLength(1)
})

test("file correction A-B-A invalidates late ACK but leaves original operation retryable", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  const release = server.holdNext("correctImportedObservation")
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const base = (await h.readAccountJournalWriteBase("ordinary"))!
    h.pending = h.correctAccountJournalFileObservation("ordinary", h.fileRecord().replacement, base, ["laps", "distanceMeters"])
  })
  await expect.poll(() => server.calls.filter(call => call.request.action === "correctImportedObservation").length).toBe(1)
  await page.evaluate(() => {
    const h = window.accountRecordHarness
    h.setActiveLocalAccount(h.otherOwner); h.setActiveLocalAccount(h.owner)
  })
  release()
  expect(await page.evaluate(() => window.accountRecordHarness.pending)).toEqual({ ok: false, storage: "FAILED" })
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ serverRevision: 1, state: "PENDING" })
  expect(await page.evaluate(() => window.accountRecordHarness.retryAccountJournalFileObservation("ordinary"))).toEqual({ ok: true, storage: "ACCOUNT" })
  const corrections = server.calls.filter(call => call.request.action === "correctImportedObservation")
  expect(corrections).toHaveLength(2)
  expect(corrections.every(call => call.ownerId === "11111111-1111-4111-8111-111111111111")).toBe(true)
  expect(corrections[1]!.request).toEqual(corrections[0]!.request)
})

test("file correction rejects stale reviewed fingerprint and invalid fields before durable writes", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const { entry, replacement } = h.fileRecord()
    await h.persistAccountJournalRecord(entry, undefined, "FILE_OBSERVATION")
    const base = (await h.readAccountJournalWriteBase(entry.id))!
    const before = await h.rawRecords()
    const results = [
      await h.correctAccountJournalFileObservation(entry.id, replacement, { ...base, contentFingerprint: `sha256:${"0".repeat(64)}` }, ["laps", "distanceMeters"]),
      await h.correctAccountJournalFileObservation(entry.id, replacement, { ...base, revision: 2 }, ["laps", "distanceMeters"]),
      await h.correctAccountJournalFileObservation(entry.id, replacement, base, ["distanceMeters"]),
    ]
    return { before, after: await h.rawRecords(), results }
  })
  expect(result.results).toEqual(Array(3).fill({ ok: false, storage: "FAILED" }))
  expect(result.after).toEqual(result.before)
  expect(server.calls.filter(call => call.request.action === "correctImportedObservation")).toHaveLength(0)
})

for (const [rejection, status] of [["UPGRADE_REQUIRED", 426], ["FILE_EVIDENCE_DISABLED", 409],
  ["INVALID_FILE_OBSERVATION", 422], ["FILE_OBSERVATION_CONFLICT", 409], ["OPERATION_REPLAY_UNAVAILABLE", 409]] as const) {
  test(`file correction ${rejection} persists terminal rejection and does not retry after reload`, async ({ page }) => {
    await page.evaluate(async () => {
      const h = window.accountRecordHarness
      await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
    })
    let attempts = 0
    await page.route("**/__record_api__", route => {
      if (route.request().postDataJSON().request.action !== "correctImportedObservation") return route.fallback()
      attempts++
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: rejection }) })
    })
    expect(await page.evaluate(async () => {
      const h = window.accountRecordHarness
      return h.correctAccountJournalFileObservation("ordinary", h.fileRecord().replacement,
        (await h.readAccountJournalWriteBase("ordinary"))!, ["laps", "distanceMeters"])
    })).toEqual({ ok: false, storage: "FAILED", rejection })
    await page.reload(); await loadRecordHarness(page)
    expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
    const retained = await page.evaluate(async () => {
      const h = window.accountRecordHarness
      return { retry: await h.retryAccountJournalFileObservation("ordinary"), view: await h.view("ordinary"),
        visible: h.readAccountJournalPrivateEntry("ordinary"), status: h.accountJournalProjectionStatus() }
    })
    expect(retained).toMatchObject({ retry: { ok: false, storage: "FAILED", rejection }, status: "REJECTED",
      view: { pending: { rejection, mutation: { action: "correctImportedObservation" } }, blocked: null, serverRevision: 1 },
      visible: { distanceKm: "5", rpe: 6 } })
    expect(attempts).toBe(1)
    expect([...server.documents.values()][0]!.revision).toBe(1)
  })
}

test("file correction buffer validates proposal, complete CAS, scope and immutable encrypted command", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const { entry, replacement } = h.fileRecord()
    await h.persistAccountJournalRecord(entry, undefined, "FILE_OBSERVATION")
    const documentId = await h.accountJournalDocumentId(h.owner, entry.id)
    const buffer = h.createRecordBuffer()
    try {
      const view = (await buffer.read(h.owner, documentId))!
      const mutation = { action: "correctImportedObservation" as const,
        previousContentRevisionFingerprint: entry.fileObservation.contentRevisionFingerprint,
        replacementObservation: replacement, confirmedChangedFields: ["distanceMeters", "laps"] as ("distanceMeters" | "laps")[] }
      const proposal = h.correctAccountJournalImportedObservation(view.draft, mutation.previousContentRevisionFingerprint,
        replacement, mutation.confirmedChangedFields)!
      if (proposal.entry.kind !== "post-session") throw new Error("Expected post-session proposal")
      const operationId = crypto.randomUUID()
      const before = await h.rawRecords()
      const refused: boolean[] = []
      for (const [draft, sequence, revision, current] of [
        [{ ...proposal, entry: { ...proposal.entry, memo: "FORBIDDEN_PROPOSAL" } }, view.localSequence, 1, true],
        [proposal, view.localSequence + 1, 1, true], [proposal, view.localSequence, 2, true],
        [proposal, view.localSequence, 1, false],
      ] as const) {
        try { await buffer.saveMutation!(h.owner, documentId, draft, mutation, operationId, sequence, revision, () => current); refused.push(false) }
        catch { refused.push(true) }
      }
      const afterInvalid = await h.rawRecords()
      await buffer.saveMutation!(h.owner, documentId, proposal, mutation, operationId, view.localSequence, 1)
      const afterValid = await h.rawRecords()
      try { await buffer.saveDraft(h.owner, documentId, proposal); refused.push(false) } catch { refused.push(true) }
      try { await buffer.saveMutation!(h.owner, documentId, proposal, mutation, crypto.randomUUID(), view.localSequence, 1); refused.push(false) }
      catch { refused.push(true) }
      return { refused, before, afterInvalid, afterValid, afterOverwrite: await h.rawRecords(), pending: await buffer.read(h.owner, documentId) }
    } finally { buffer.close() }
  })
  expect(result.refused).toEqual(Array(6).fill(true))
  expect(result.afterInvalid).toEqual(result.before)
  expect(result.afterOverwrite).toEqual(result.afterValid)
  expect(result.pending).toMatchObject({ serverRevision: 1, state: "PENDING", pending: {
    originalDraft: { entry: { distanceKm: "5" } }, draft: { entry: { distanceKm: "5.1" } } } })
  expect(server.calls.filter(call => call.request.action === "correctImportedObservation")).toHaveLength(0)
})

test("file correction CAS conflict requires fresh review and archives encrypted mutation on remote choice", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  const stored = [...server.documents.values()][0]!
  if (stored.document.entry.kind !== "post-session") throw new Error("Expected post-session fixture")
  stored.revision = 2
  stored.document = { ...stored.document, entry: { ...stored.document.entry, memo: "REMOTE_WINNER" } }
  const conflict = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return h.correctAccountJournalFileObservation("ordinary", h.fileRecord().replacement,
      (await h.readAccountJournalWriteBase("ordinary"))!, ["laps", "distanceMeters"])
  })
  expect(conflict).toEqual({ ok: true, storage: "CONFLICT" })
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const documentId = await h.accountJournalDocumentId(h.owner, "ordinary")
    const review = (await h.reviewAccountJournalConflict(documentId))!
    const local = await h.resolveAccountJournalConflict(review, "LOCAL")
    const remote = await h.resolveAccountJournalConflict(review, "REMOTE")
    return { local, remote, archive: await h.readAccountJournalConflictArchive(h.owner, documentId),
      raw: await h.rawRecords(), view: await h.view("ordinary") }
  })
  expect(result.local).toBe("FAILED")
  expect(result.remote).toBe("ACCOUNT")
  expect(result.view).toMatchObject({ state: "DRAFT_ACKNOWLEDGED", pending: null, draft: { entry: { distanceKm: "5", memo: "REMOTE_WINNER" } } })
  expect(result.archive?.at(-1)).toMatchObject({ choice: "REMOTE", pending: { mutation: { action: "correctImportedObservation" },
    originalDraft: { entry: { distanceKm: "5" } }, draft: { entry: { distanceKm: "5.1" } } } })
  expect(JSON.stringify(result.raw)).not.toContain("replacementObservation")
  expect(JSON.stringify(result.raw)).not.toContain("REMOTE_WINNER")
  expect(server.calls.filter(call => call.request.action === "correctImportedObservation")).toHaveLength(1)
})

test("file correction original-until-ACK assertion detects a route-only projection mutation", async ({ page }) => {
  await page.route("**/src/domain/account/account-journal-record-service.ts*", async route => {
    const response = await route.fetch()
    const body = await response.text()
    const guard = "const confirmed = view.remoteDraft ?? view.pending.originalDraft;"
    expect(body.split(guard)).toHaveLength(2)
    await route.fulfill({ response, body: body.replace(guard, "const confirmed = view.draft;") })
  })
  await loadRecordHarness(page)
  expect(await page.evaluate(() => {
    const h = window.accountRecordHarness
    return h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })).toEqual({ ok: true, storage: "ACCOUNT" })
  server.offline(true)
  const distance = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.correctAccountJournalFileObservation("ordinary", h.fileRecord().replacement,
      (await h.readAccountJournalWriteBase("ordinary"))!, ["laps", "distanceMeters"])
    const entry = h.readAccountJournalPrivateEntry("ordinary")
    return entry?.kind === "post-session" ? entry.distanceKm : null
  })
  // The positive path's unchanged projection assertion must detect this defect.
  expect(() => expect(distance).toBe("5")).toThrow()
})

test("comparison mutations preserve original until ACK and freeze confirm/release request across reload", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  server.loseReceipt("confirmComparisonRelation")
  const pending = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const base = (await h.readAccountJournalWriteBase("ordinary"))!
    const result = await h.confirmAccountJournalComparison("ordinary", h.comparisonRelation(), base)
    const correction = await h.correctAccountJournalFileObservation("ordinary", h.fileRecord().replacement, base, ["distanceMeters", "laps"])
    const release = await h.releaseAccountJournalComparison("ordinary", h.comparisonRelation().relationId, base)
    return { result, correction, release, raw: await h.rawRecords(), original: h.readAccountJournalPrivateEntry("ordinary") }
  })
  expect(pending.result).toEqual({ ok: true, storage: "PENDING" })
  expect(pending.correction).toEqual({ ok: false, storage: "FAILED" })
  expect(pending.release).toEqual({ ok: false, storage: "FAILED" })
  expect(pending.original).not.toHaveProperty("comparisonRelations")
  expect(JSON.stringify(pending.raw)).not.toContain("SYNTHETIC_COMPARISON_SEGMENT")
  expect(JSON.stringify(pending.raw)).not.toContain("relationId")
  await page.reload(); await loadRecordHarness(page)
  expect(await page.evaluate(() => window.accountRecordHarness.rawRecords())).toEqual(pending.raw)
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
  const confirms = server.calls.filter(call => call.request.action === "confirmComparisonRelation")
  expect(confirms).toHaveLength(2)
  expect(confirms[1]!.request).toEqual(confirms[0]!.request)
  server.offline(true)
  const releasing = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const base = (await h.readAccountJournalWriteBase("ordinary"))!
    const result = await h.releaseAccountJournalComparison("ordinary", h.comparisonRelation().relationId, base)
    const raw = await h.rawRecords()
    const retry = await h.releaseAccountJournalComparison("ordinary", h.comparisonRelation().relationId, base)
    return { result, retry, raw, after: await h.rawRecords(), original: h.readAccountJournalPrivateEntry("ordinary") }
  })
  expect(releasing.result).toEqual({ ok: true, storage: "PENDING" })
  expect(releasing.retry).toEqual(releasing.result)
  expect(releasing.after).toEqual(releasing.raw)
  expect(releasing.original).toMatchObject({ comparisonRelations: [{ releasedAt: null }] })
  await page.reload(); await loadRecordHarness(page)
  server.offline(false)
  expect(await page.evaluate(() => window.accountRecordHarness.retryAccountJournalComparison("ordinary"))).toEqual({ ok: true, storage: "ACCOUNT" })
  const releases = server.calls.filter(call => call.request.action === "releaseComparisonRelation")
  expect(releases).toHaveLength(3)
  expect(releases.every(call => JSON.stringify(call.request) === JSON.stringify(releases[0]!.request))).toBe(true)
  const view = await page.evaluate(() => window.accountRecordHarness.view("ordinary"))
  expect(view).toMatchObject({ serverRevision: 3, pending: null, draft: { entry: { savedAt: "2026-09-02T01:00:00.000Z", rpe: 6,
    distanceKm: "5", comparisonRelations: [{ releasedAt: expect.any(String) }] } } })
  expect(view?.writePurpose).toBeUndefined()
})

for (const [rejection, status] of [["COMPARISON_ORIGINAL_UNAVAILABLE", 409], ["INVALID_COMPARISON_RELATION", 422], ["COMPARISON_CAPACITY_EXCEEDED", 409]] as const) {
  test(`comparison mutation ${rejection} stays terminal across reload`, async ({ page }) => {
    await page.evaluate(async () => {
      const h = window.accountRecordHarness
      await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
    })
    let attempts = 0
    await page.route("**/__record_api__", route => {
      if (route.request().postDataJSON().request.action !== "confirmComparisonRelation") return route.fallback()
      attempts++
      return route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: rejection }) })
    })
    expect(await page.evaluate(async () => {
      const h = window.accountRecordHarness
      return h.confirmAccountJournalComparison("ordinary", h.comparisonRelation(), (await h.readAccountJournalWriteBase("ordinary"))!)
    })).toEqual({ ok: false, storage: "FAILED", rejection })
    await page.reload(); await loadRecordHarness(page)
    await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
    expect(await page.evaluate(() => window.accountRecordHarness.retryAccountJournalComparison("ordinary"))).toEqual({ ok: false, storage: "FAILED", rejection })
    expect(await page.evaluate(() => window.accountRecordHarness.readAccountJournalPrivateEntry("ordinary"))).not.toHaveProperty("comparisonRelations")
    expect(attempts).toBe(1)
  })
}

test("comparison mutation A-B-A drops late ACK and tombstone prevents pending release resurrection", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  const release = server.holdNext("confirmComparisonRelation")
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const base = (await h.readAccountJournalWriteBase("ordinary"))!
    h.pending = h.confirmAccountJournalComparison("ordinary", h.comparisonRelation(), base)
  })
  await expect.poll(() => server.calls.filter(call => call.request.action === "confirmComparisonRelation").length).toBe(1)
  await page.evaluate(() => { const h = window.accountRecordHarness; h.setActiveLocalAccount(h.otherOwner); h.setActiveLocalAccount(h.owner) })
  release()
  expect(await page.evaluate(() => window.accountRecordHarness.pending)).toEqual({ ok: false, storage: "FAILED" })
  expect(await page.evaluate(() => window.accountRecordHarness.retryAccountJournalComparison("ordinary"))).toEqual({ ok: true, storage: "ACCOUNT" })
  server.offline(true)
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.releaseAccountJournalComparison("ordinary", h.comparisonRelation().relationId, (await h.readAccountJournalWriteBase("ordinary"))!)
  })
  const [key, current] = [...server.documents.entries()][0]!
  server.documents.delete(key); server.tombstones.set(key, { documentId: current.documentId, revision: 3 })
  server.offline(false)
  await page.reload(); await loadRecordHarness(page)
  await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
  expect(await page.evaluate(() => window.accountRecordHarness.retryAccountJournalComparison("ordinary"))).toEqual({ ok: false, storage: "FAILED" })
  expect(await page.evaluate(() => window.accountRecordHarness.loadEntries())).toEqual([])
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ state: "CONFLICT", pending: { mutation: { action: "releaseComparisonRelation" } } })
  expect(server.calls.filter(call => call.request.action === "releaseComparisonRelation")).toHaveLength(1)
})

test("comparison capacity refuses without durable write or evicting any relation", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.fileRecord().entry, undefined, "FILE_OBSERVATION")
  })
  const stored = [...server.documents.values()][0]!
  const relation = await page.evaluate(() => window.accountRecordHarness.comparisonRelation())
  if (stored.document.entry.kind !== "post-session") throw new Error("Expected post-session fixture")
  stored.document = { ...stored.document, entry: { ...stored.document.entry,
    comparisonRelations: Array.from({ length: 32 }, (_, index) => ({ ...relation, relationId: `10000000-0000-4000-8000-${String(index + 10).padStart(12, "0")}` })) } }
  stored.revision = 2
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.hydrateAccountJournalRecords()
    const before = await h.rawRecords()
    const saved = await h.confirmAccountJournalComparison("ordinary", { ...h.comparisonRelation(), journalRevisionAtConfirmation: 2 },
      (await h.readAccountJournalWriteBase("ordinary"))!)
    return { saved, before, after: await h.rawRecords(), view: await h.view("ordinary") }
  })
  expect(result.saved).toEqual({ ok: false, storage: "FAILED", rejection: "COMPARISON_CAPACITY_EXCEEDED" })
  expect(result.after).toEqual(result.before)
  expect(result.view?.draft.entry.kind === "post-session" && result.view.draft.entry.comparisonRelations).toHaveLength(32)
  expect(server.calls.filter(call => call.request.action === "confirmComparisonRelation")).toHaveLength(0)
})

test("owned migration terminal rejection stops later writes and retains all device originals", async ({ page }) => {
  let writes = 0
  await page.route("**/__record_api__", route => {
    if (route.request().postDataJSON().request.action !== "save") return route.fallback()
    writes++
    return route.fulfill({ status: 426, contentType: "application/json", body: JSON.stringify({ error: "UPGRADE_REQUIRED" }) })
  })
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const before = h.seedLegacy("synced", 2)
    const migrated = await h.migrateOwnedAccountJournals()
    return { before, after: h.legacyRaw(), migrated }
  })
  expect(result.migrated).toEqual({ saved: 0, pending: 0, attention: 1, ok: false })
  expect(result.after).toEqual(result.before)
  expect(writes).toBe(1)
})

test("reviewed write base includes full private content and rejects same-savedAt remote change before any draft/save", async ({ page }) => {
  const reviewed = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.privateRecord)
    return (await h.readAccountJournalWriteBase(h.privateRecord.id))!
  })
  if (reviewed.entry?.kind !== "post-session") throw new Error("Expected synthetic post-session review")
  expect(reviewed.entry.memo).toBe("SYNTHETIC_PRIVATE_BODY")
  expect(reviewed.revision).toBe(1)
  const [key, remote] = [...server.documents.entries()][0]!
  if (remote.document.entry.kind !== "post-session") throw new Error("Expected synthetic post-session document")
  server.documents.set(key, { ...remote, revision: 2, document: { ...remote.document,
    entry: { ...remote.document.entry, memo: "REMOTE_PRIVATE_SAME_SAVED_AT" } } })
  await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
  const savesBefore = server.calls.filter(call => call.request.action === "save").length
  const result = await page.evaluate(async base => {
    const h = window.accountRecordHarness
    const before = await h.rawRecords()
    const saved = await h.persistAccountJournalRecord({ ...h.privateRecord, memo: "RESTORE_REVIEWED_COPY",
      savedAt: "2026-09-09T02:00:00.000Z" }, h.privateRecord.savedAt, "MIGRATION", base)
    return { saved, before, after: await h.rawRecords(), current: await h.readAccountJournalWriteBase(h.privateRecord.id) }
  }, reviewed)
  expect(result.saved).toEqual({ ok: false, storage: "FAILED" })
  expect(result.after).toEqual(result.before)
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(savesBefore)
  if (result.current?.entry?.kind !== "post-session") throw new Error("Expected synthetic post-session current version")
  expect(result.current.entry.memo).toBe("REMOTE_PRIVATE_SAME_SAVED_AT")
})

test("review fingerprint excludes syncState only and checks fingerprint even when revision matches", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.ordinary)
    const base = (await h.readAccountJournalWriteBase(h.ordinary.id))!
    const fingerprints = await Promise.all([h.ordinary, { ...h.ordinary, syncState: "synced" as const },
      { ...h.ordinary, memo: "OTHER_PRIVATE_MEMO" }, { ...h.ordinary, savedAt: "2026-09-09T01:00:00.000Z" },
      { ...h.ordinary, fieldProvenance: undefined }].map(h.accountJournalEntryFingerprint))
    const before = await h.rawRecords()
    const saved = await h.persistAccountJournalRecord({ ...h.ordinary, memo: "RESTORED",
      savedAt: "2026-09-09T02:00:00.000Z" }, h.ordinary.savedAt, "MIGRATION", { ...base, contentFingerprint: fingerprints[2]! })
    return { fingerprints, saved, before, after: await h.rawRecords() }
  })
  expect(result.fingerprints[0]).toBe(result.fingerprints[1])
  expect(new Set(result.fingerprints.slice(1)).size).toBe(4)
  expect(result.saved).toEqual({ ok: false, storage: "FAILED" })
  expect(result.after).toEqual(result.before)
})

test("frozen absence token cannot overwrite a target created after review", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const base = (await h.readAccountJournalWriteBase(h.ordinary.id))!
    await h.persistAccountJournalRecord(h.ordinary)
    const before = await h.rawRecords()
    const changed = await h.persistAccountJournalRecord({ ...h.ordinary, memo: "RESTORE_NEW_COPY",
      savedAt: "2026-09-09T02:00:00.000Z" }, undefined, "MIGRATION", base)
    const relabelled = await h.persistAccountJournalRecord(h.ordinary, undefined, "MIGRATION", base)
    return { base, changed, relabelled, before, after: await h.rawRecords() }
  })
  expect(result.base).toEqual({ entry: null, revision: 0, contentFingerprint: null })
  expect(result.changed).toEqual({ ok: false, storage: "FAILED" })
  expect(result.relabelled).toEqual({ ok: false, storage: "FAILED" })
  expect(result.after).toEqual(result.before)
})

test("same-body MIGRATION retry keeps original base through reload pending and ACK; dirty state is not a new review base", async ({ page }) => {
  server.loseReceipt()
  const frozen = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const base = (await h.readAccountJournalWriteBase(h.ordinary.id))!
    const result = await h.persistAccountJournalRecord(h.ordinary, undefined, "MIGRATION", base)
    return { base, result, dirtyBase: await h.readAccountJournalWriteBase(h.ordinary.id) }
  })
  expect(frozen.result).toEqual({ ok: true, storage: "PENDING" })
  expect(frozen.dirtyBase).toBeNull()
  await page.reload(); await loadRecordHarness(page)
  const result = await page.evaluate(async base => {
    const h = window.accountRecordHarness
    const wrongPurpose = await h.persistAccountJournalRecord(h.ordinary, undefined, undefined, base)
    const retry = await h.persistAccountJournalRecord(h.ordinary, undefined, "MIGRATION", base)
    const ackRetry = await h.persistAccountJournalRecord(h.ordinary, undefined, "MIGRATION", base)
    return { wrongPurpose, retry, ackRetry, view: await h.view(h.ordinary.id) }
  }, frozen.base)
  expect(result.wrongPurpose).toEqual({ ok: false, storage: "FAILED" })
  expect(result.retry).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(result.ackRetry).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(result.view?.serverRevision).toBe(1)
  const saves = server.calls.filter(call => call.request.action === "save")
  expect(saves).toHaveLength(2)
  expect(saves[1]!.request).toEqual(saves[0]!.request)
})

test("unacknowledged finalizations stay recoverable but never enter ordinary metrics", async ({ page }) => {
  server.offline(true)
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const saved = await h.persistAccountJournalRecord(h.ordinary)
    return { saved, ordinary: h.loadEntries(), analysis: h.loadAnalysisEntries(),
      recovery: h.readAccountJournalPrivateEntry(h.ordinary.id), status: h.accountJournalProjectionStatus() }
  })).toMatchObject({ saved: { ok: true, storage: "PENDING" }, ordinary: [], analysis: [],
    recovery: { id: "ordinary", rpe: 6 }, status: "PENDING" })
  server.offline(false)
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.hydrateAccountJournalRecords()
    return { ordinary: h.loadEntries().length, analysis: h.loadAnalysisEntries().length, status: h.accountJournalProjectionStatus() }
  })).toEqual({ ordinary: 1, analysis: 1, status: "READY" })
})

test("pending edits keep the acknowledged metrics and hydrate the server base after reload", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })
  await page.route("**/__record_api__", route => route.request().postDataJSON().request.action === "save"
    ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : route.fallback())
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return h.persistAccountJournalRecord({ ...h.ordinary, rpe: 9, savedAt: "2026-09-02T02:00:00.000Z" }, h.ordinary.savedAt)
  })).toEqual({ ok: true, storage: "PENDING" })
  for (const reload of [false, true]) {
    if (reload) { await page.reload(); await loadRecordHarness(page); await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords()) }
    expect(await page.evaluate(() => {
      const h = window.accountRecordHarness
      return { ordinary: h.loadEntries()[0], recovery: h.readAccountJournalPrivateEntry("ordinary"), status: h.accountJournalProjectionStatus() }
    })).toMatchObject({ ordinary: { rpe: 6, syncState: "synced" }, recovery: { rpe: 9 }, status: "PENDING" })
  }
})

for (const rejection of ["PLANNED_SESSION_ALREADY_RECORDED", "INSUFFICIENT_POINTS", "OPERATION_REPLAY_UNAVAILABLE"] as const) {
  test(`controlled ${rejection} is durable, nonstatistical and not an invented revision conflict`, async ({ page }) => {
    let saves = 0
    await page.route("**/__record_api__", route => {
      if (route.request().postDataJSON().request.action !== "save") return route.fallback()
      saves++
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: rejection }) })
    })
    expect(await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) }))
      .toEqual({ ok: false, storage: "FAILED", rejection })
    await page.reload(); await loadRecordHarness(page)
    await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
    expect(await page.evaluate(async () => {
      const h = window.accountRecordHarness
      return { view: await h.view("ordinary"), ordinary: h.loadEntries(), analysis: h.loadAnalysisEntries(), status: h.accountJournalProjectionStatus() }
    })).toMatchObject({ view: { pending: { rejection }, serverRevision: 0, blocked: null, draft: { entry: { id: "ordinary" } } },
      ordinary: [], analysis: [], status: "REJECTED" })
    expect(saves).toBe(1)
    expect(server.documents.size).toBe(0)
  })
}

test("online ordinary/private records survive reload and hydrate on a fresh native-IDB device", async ({ page, browser }) => {
  const created = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return [await h.persistAccountJournalRecord(h.ordinary), await h.persistAccountJournalRecord(h.privateRecord)]
  })
  expect(created).toEqual([{ ok: true, storage: "ACCOUNT" }, { ok: true, storage: "ACCOUNT" }])
  const check = async () => page.evaluate(async () => {
    const h = window.accountRecordHarness
    return { loaded: h.loadEntries(), analysis: h.loadAnalysisEntries(), privateRead: h.readAccountJournalPrivateEntry("private"),
      full: await h.loadEntriesWithPrivateMemos(), raw: JSON.stringify(await h.rawRecords()) }
  })
  const initial = await check()
  expect(initial.loaded).toHaveLength(2)
  expect(initial.loaded.find(entry => entry.id === "ordinary")).toMatchObject({ memo: "SYNTHETIC_ORDINARY_BODY" })
  // Nonempty positive controls prevent a reject-all analysis path from passing.
  expect(initial.analysis).toHaveLength(2)
  expect(initial.analysis.find(entry => entry.id === "ordinary")).toMatchObject({ rpe: 6 })
  expect(initial.analysis.find(entry => entry.id === "private")).toMatchObject({ rpe: 4 })
  expect(JSON.stringify(initial.loaded)).not.toContain("SYNTHETIC_PRIVATE_BODY")
  expect(JSON.stringify(initial.analysis)).not.toContain("SYNTHETIC_PRIVATE_BODY")
  expect(JSON.stringify(initial.analysis)).not.toContain("SYNTHETIC_ORDINARY_BODY")
  expect(initial.privateRead).toMatchObject({ memo: "SYNTHETIC_PRIVATE_BODY" })
  expect(initial.full.find(entry => entry.id === "private")).toMatchObject({ memo: "SYNTHETIC_PRIVATE_BODY" })
  expect(initial.raw).not.toContain("SYNTHETIC_PRIVATE_BODY")
  expect(initial.raw).not.toContain("SYNTHETIC_ORDINARY_BODY")
  await page.reload()
  await loadRecordHarness(page)
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
  expect((await check()).loaded).toEqual(initial.loaded)
  const fresh = await browser.newContext({ serviceWorkers: "block" })
  try {
    await server.install(fresh)
    const device = await fresh.newPage()
    await loadRecordHarness(device)
    expect(await device.evaluate(async () => {
      const h = window.accountRecordHarness
      const before = await indexedDB.databases()
      return { clean: !before.some(db => db.name === "trainoracle-account-journal-records-v1"),
        hydrated: await h.hydrateAccountJournalRecords(), entries: h.loadEntries(), privateRead: h.readAccountJournalPrivateEntry("private") }
    })).toMatchObject({ clean: true, hydrated: true, entries: initial.loaded, privateRead: initial.privateRead })
  } finally { await fresh.close() }
})

test("projection reads are detached and account switching hides private, ordinary and analysis views", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.privateRecord)
    const copy = h.readAccountJournalPrivateEntry("private")
    if (copy?.kind === "post-session") Object.assign(copy, { memo: "MUTATED_COPY" })
    const original = h.readAccountJournalPrivateEntry("private")
    h.setActiveLocalAccount(h.otherOwner)
    const other = { entries: h.loadEntries(), privateRead: h.readAccountJournalPrivateEntry("private"), analysis: h.loadAnalysisEntries(), status: h.accountJournalProjectionStatus() }
    await h.hydrateAccountJournalRecords()
    h.setActiveLocalAccount(null)
    return { original, other, anonymous: h.loadEntries(), privateAnonymous: h.readAccountJournalPrivateEntry("private") }
  })
  expect(result).toMatchObject({ original: { memo: "SYNTHETIC_PRIVATE_BODY" },
    other: { entries: [], privateRead: null, analysis: [], status: "IDLE" }, anonymous: [], privateAnonymous: null })
})

test("failed server save retains encrypted pending queue and retries the same operation after reload", async ({ page }) => {
  server.offline(true)
  expect(await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.privateRecord) })).toEqual({ ok: true, storage: "PENDING" })
  expect(await page.evaluate(async () => { const h = window.accountRecordHarness; return (await h.view("private"))?.state })).toBe("PENDING")
  server.offline(false)
  await page.reload()
  await loadRecordHarness(page)
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
  const saves = server.calls.filter(call => call.request.action === "save")
  expect(saves).toHaveLength(2)
  expect(saves[1]).toEqual(saves[0])
  expect(await page.evaluate(async () => { const h = window.accountRecordHarness; return (await h.view("private"))?.state })).toBe("DRAFT_ACKNOWLEDGED")
})

test("lost success receipt replays immutable operation without duplicate server revision", async ({ page }) => {
  server.loseReceipt()
  expect(await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })).toEqual({ ok: true, storage: "PENDING" })
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
  const saves = server.calls.filter(call => call.request.action === "save")
  expect(saves).toHaveLength(2)
  expect(saves[1]).toEqual(saves[0])
  expect([...server.documents.values()].map(doc => doc.revision)).toEqual([1])
})

test("duplicate creates and simultaneous stale edits cannot overwrite the winning savedAt CAS", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const creates = await Promise.all([h.persistAccountJournalRecord(h.ordinary), h.persistAccountJournalRecord(h.ordinary)])
    const first = { ...h.ordinary, savedAt: "2026-09-02T02:00:00.000Z", memo: "EDIT_ONE" }
    const second = { ...h.ordinary, savedAt: "2026-09-02T03:00:00.000Z", memo: "EDIT_TWO" }
    const edits = await Promise.all([h.persistAccountJournalRecord(first, h.ordinary.savedAt), h.persistAccountJournalRecord(second, h.ordinary.savedAt)])
    return { creates, edits, view: await h.view("ordinary") }
  })
  // An identical create is now an idempotent replay, not a second revision.
  expect(result.creates).toEqual([{ ok: true, storage: "ACCOUNT" }, { ok: true, storage: "ACCOUNT" }])
  expect(result.edits.filter(value => value.ok)).toHaveLength(1)
  expect(result.view).toMatchObject({ state: "DRAFT_ACKNOWLEDGED", serverRevision: 2 })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(2)
})

test("remote revision conflict retains local edit and reports CONFLICT rather than saved", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })
  for (const document of server.documents.values()) document.revision = 2
  expect(await page.evaluate(() => {
    const h = window.accountRecordHarness
    return h.persistAccountJournalRecord({ ...h.ordinary, savedAt: "2026-09-02T02:00:00.000Z", memo: "LOCAL_CONFLICT" }, h.ordinary.savedAt)
  })).toEqual({ ok: true, storage: "CONFLICT" })
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({
    blocked: { currentRevision: 2 }, draft: { entry: { memo: "LOCAL_CONFLICT" } }, serverRevision: 1,
  })
  expect(await page.evaluate(() => window.accountRecordHarness.accountJournalProjectionStatus())).toBe("CONFLICT")
})

test("late A save acknowledgement cannot populate B projection or acknowledge A queue", async ({ page }) => {
  const release = server.holdNext("save")
  try {
    await page.evaluate(() => { const h = window.accountRecordHarness; h.pending = h.persistAccountJournalRecord(h.privateRecord) })
    await expect.poll(() => server.calls.filter(call => call.request.action === "save").length).toBe(1)
    await page.evaluate(() => { const h = window.accountRecordHarness; h.setActiveLocalAccount(h.otherOwner) })
    release()
    expect(await page.evaluate(() => window.accountRecordHarness.pending)).toEqual({ ok: false, storage: "FAILED" })
    expect(await page.evaluate(() => { const h = window.accountRecordHarness; return { entries: h.loadEntries(), privateRead: h.readAccountJournalPrivateEntry("private") } })).toEqual({ entries: [], privateRead: null })
    expect(await page.evaluate(() => window.accountRecordHarness.view("private"))).toMatchObject({ state: "PENDING", serverRevision: 0 })
  } finally { release() }
})

test("late A hydration cannot overwrite an initialized B projection", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.privateRecord) })
  const release = server.holdNext("list")
  try {
    await page.evaluate(() => { const h = window.accountRecordHarness; h.pending = h.hydrateAccountJournalRecords() })
    await expect.poll(() => server.calls.filter(call => call.request.action === "list").length).toBe(1)
    await page.evaluate(async () => { const h = window.accountRecordHarness; h.setActiveLocalAccount(h.otherOwner); await h.hydrateAccountJournalRecords() })
    release()
    expect(await page.evaluate(() => window.accountRecordHarness.pending)).toBe(false)
    expect(await page.evaluate(() => { const h = window.accountRecordHarness; return { entries: h.loadEntries(), status: h.accountJournalProjectionStatus() } })).toEqual({ entries: [], status: "READY" })
  } finally { release() }
})

test("two native-IDB tabs editing the same base retain one winner without double CAS advancement", async ({ page, context }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })
  const tab = await context.newPage()
  try {
    await loadRecordHarness(tab)
    expect(await tab.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
    const edits = await Promise.all([page, tab].map((target, index) => target.evaluate(async index => {
      const h = window.accountRecordHarness
      return h.persistAccountJournalRecord({ ...h.ordinary, memo: `TAB_${index}`, savedAt: `2026-09-02T0${index + 2}:00:00.000Z` }, h.ordinary.savedAt)
    }, index)))
    expect(edits.filter(value => value.ok)).toHaveLength(1)
    expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ state: "DRAFT_ACKNOWLEDGED", serverRevision: 2 })
    expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(2)
  } finally { await tab.close() }
})

test("finalization rejects missing memo purpose and invalid body checks before API or projection writes", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const missingPurpose = { ...h.ordinary }
    delete (missingPurpose as { memoPurpose?: unknown }).memoPurpose
    const writes = [await h.persistAccountJournalRecord(missingPurpose),
      await h.persistAccountJournalRecord({ ...h.ordinary, painCheckStatus: "SIGNAL_REPORTED" })]
    return { writes, entries: h.loadEntries(), view: await h.view("ordinary") }
  })
  expect(result).toEqual({ writes: [{ ok: false, storage: "FAILED" }, { ok: false, storage: "FAILED" }], entries: [], view: null })
  expect(server.calls).toHaveLength(0)
})

test("runtime-style disposal invalidates an old A response even after switching back to A", async ({ page }) => {
  const release = server.holdNext("save")
  try {
    await page.evaluate(() => { const h = window.accountRecordHarness; h.pending = h.persistAccountJournalRecord(h.privateRecord) })
    await expect.poll(() => server.calls.filter(call => call.request.action === "save").length).toBe(1)
    await page.evaluate(() => {
      const h = window.accountRecordHarness
      // Mirrors useAccountJournalRuntime's scope-change lifecycle contract.
      h.setActiveLocalAccount(h.otherOwner); h.disposeAccountJournalRecords()
      h.setActiveLocalAccount(h.owner); h.disposeAccountJournalRecords()
    })
    release()
    expect(await page.evaluate(() => window.accountRecordHarness.pending)).toEqual({ ok: false, storage: "FAILED" })
    expect(await page.evaluate(() => window.accountRecordHarness.loadEntries())).toEqual([])
    expect(await page.evaluate(() => window.accountRecordHarness.view("private"))).toMatchObject({ state: "PENDING" })
  } finally { release() }
})

test("privacy assertion detects a route-only projection redaction mutation", async ({ page }) => {
  await page.route("**/src/domain/account/account-journal-projection.ts*", async route => {
    const response = await route.fetch()
    const body = await response.text()
    const guard = 'if (copy.memoPurpose !== "PRIVATE_SELF_ONLY") return copy;'
    expect(body.split(guard)).toHaveLength(2)
    await route.fulfill({ response, body: body.replace(guard, 'if (true) return copy;') })
  })
  await loadRecordHarness(page)
  const leaked = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const result = await h.persistAccountJournalRecord(h.privateRecord)
    if (!result.ok) throw new Error("Positive control must save")
    return JSON.stringify(h.loadEntries()).includes("SYNTHETIC_PRIVATE_BODY")
  })
  // The same no-leak assertion used above must fail with the injected defect.
  expect(() => expect(leaked).toBe(false)).toThrow()
})

test("lifecycle private history, delete and restore preserve identity and protected body", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.privateRecord)
    await h.persistAccountJournalRecord({ ...h.privateRecord, memo: "PRIVATE_REVISION_TWO", savedAt: "2026-09-02T03:00:00.000Z" }, h.privateRecord.savedAt)
    const documentId = await h.accountJournalDocumentId(h.owner, "private")
    const history = await h.accountJournalRecordHistory(documentId)
    const removed = await h.deleteAccountJournalRecord("private")
    const deleted = { view: await h.view("private"), entries: h.loadEntries(), tombstones: h.accountJournalDeletedDocuments() }
    const restored = await h.restoreAccountJournalVersion(documentId, 2, 3)
    return { documentId, history, removed, deleted, restored, view: await h.view("private"),
      privateRead: h.readAccountJournalPrivateEntry("private"), entries: h.loadEntries(), tombstones: h.accountJournalDeletedDocuments() }
  })
  expect(result.history).toMatchObject({ versions: [{ revision: 1, reason: "replaced", document: { entry: { memo: "SYNTHETIC_PRIVATE_BODY" } } }] })
  expect(result.removed).toBe(true)
  expect(result.deleted).toEqual({ view: null, entries: [], tombstones: [{ documentId: result.documentId, revision: 3 }] })
  expect(result.restored).toBe(true)
  expect(result.view).toMatchObject({ serverRevision: 4, state: "DRAFT_ACKNOWLEDGED" })
  expect(result.privateRead).toMatchObject({ memo: "PRIVATE_REVISION_TWO" })
  expect(JSON.stringify(result.entries)).not.toContain("PRIVATE_REVISION_TWO")
  expect(result.tombstones).toEqual([])
})

test("lifecycle restore is rejected before server mutation when a local edit is pending", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.ordinary)
    await h.persistAccountJournalRecord({ ...h.ordinary, savedAt: "2026-09-02T02:00:00.000Z" }, h.ordinary.savedAt)
  })
  server.offline(true)
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord({ ...h.ordinary, memo: "DIRTY_LOCAL", savedAt: "2026-09-02T03:00:00.000Z" }, "2026-09-02T02:00:00.000Z")
  })
  server.offline(false)
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return h.restoreAccountJournalVersion(await h.accountJournalDocumentId(h.owner, "ordinary"), 1, 2)
  })).toBe(false)
  expect(server.calls.filter(call => call.request.action === "restore")).toHaveLength(0)
  expect([...server.documents.values()][0]?.revision).toBe(2)
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ draft: { entry: { memo: "DIRTY_LOCAL" } }, state: "PENDING" })
})

test("lifecycle uncertain delete retries the identical operation ID and clears only confirmed clean data", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.privateRecord) })
  server.loseReceipt("delete")
  expect(await page.evaluate(() => window.accountRecordHarness.deleteAccountJournalRecord("private"))).toBe(false)
  expect(await page.evaluate(() => window.accountRecordHarness.view("private"))).not.toBeNull()
  expect(await page.evaluate(() => window.accountRecordHarness.deleteAccountJournalRecord("private"))).toBe(true)
  const requests = server.calls.filter(call => call.request.action === "delete")
  expect(requests).toHaveLength(2)
  expect(requests[1]).toEqual(requests[0])
  expect(await page.evaluate(() => window.accountRecordHarness.view("private"))).toBeNull()
})

test("lifecycle uncertain restore retries the identical operation ID without another revision", async ({ page }) => {
  await page.evaluate(async () => { const h = window.accountRecordHarness; await h.persistAccountJournalRecord(h.privateRecord); await h.deleteAccountJournalRecord("private") })
  server.loseReceipt("restore")
  const restore = () => page.evaluate(async () => { const h = window.accountRecordHarness; return h.restoreAccountJournalVersion(await h.accountJournalDocumentId(h.owner, "private"), 1, 2) })
  expect(await restore()).toBe(false)
  expect(await restore()).toBe(true)
  const requests = server.calls.filter(call => call.request.action === "restore")
  expect(requests).toHaveLength(2)
  expect(requests[1]).toEqual(requests[0])
  expect([...server.documents.values()][0]?.revision).toBe(3)
})

test("lifecycle reload reconciles uncertain restore before any fresh mutation", async ({ page }) => {
  await page.evaluate(async () => { const h = window.accountRecordHarness; await h.persistAccountJournalRecord(h.privateRecord); await h.deleteAccountJournalRecord("private") })
  server.loseReceipt("restore")
  await page.evaluate(async () => { const h = window.accountRecordHarness; await h.restoreAccountJournalVersion(await h.accountJournalDocumentId(h.owner, "private"), 1, 2) })
  await loadRecordHarness(page)
  expect(await page.evaluate(async () => { const h = window.accountRecordHarness; return h.restoreAccountJournalVersion(await h.accountJournalDocumentId(h.owner, "private"), 1, 2) })).toBe(false)
  expect(server.calls.filter(call => call.request.action === "restore")).toHaveLength(1)
  expect(await page.evaluate(() => window.accountRecordHarness.view("private"))).toMatchObject({ serverRevision: 3, state: "DRAFT_ACKNOWLEDGED" })
})

test("lifecycle concurrent hydration calls share one reconciliation and do not race IDB import", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })
  const release = server.holdNext("list")
  try {
    await page.evaluate(() => { const h = window.accountRecordHarness; h.pending = Promise.all([h.hydrateAccountJournalRecords(), h.hydrateAccountJournalRecords()]) })
    await expect.poll(() => server.calls.filter(call => call.request.action === "list").length).toBeGreaterThan(0)
    release()
    expect(await page.evaluate(() => window.accountRecordHarness.pending)).toEqual([true, true])
    expect(server.calls.filter(call => call.request.action === "list")).toHaveLength(1)
  } finally { release() }
})

test("lifecycle dirty pending edit survives server tombstone without another save attempt", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })
  server.offline(true)
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord({ ...h.ordinary, memo: "DIRTY_TOMBSTONE", savedAt: "2026-09-02T02:00:00.000Z" }, h.ordinary.savedAt) })
  const [key, stored] = [...server.documents.entries()][0]!
  server.documents.delete(key)
  server.tombstones.set(key, { documentId: stored.documentId, revision: 2 })
  server.offline(false)
  const before = server.calls.filter(call => call.request.action === "save").length
  await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(before)
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ draft: { entry: { memo: "DIRTY_TOMBSTONE" } }, state: "CONFLICT" })
  expect(await page.evaluate(() => window.accountRecordHarness.accountJournalProjectionStatus())).toBe("CONFLICT")
  expect(await page.evaluate(() => window.accountRecordHarness.deleteAccountJournalRecord("ordinary"))).toBe(false)
  await loadRecordHarness(page)
  await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ draft: { entry: { memo: "DIRTY_TOMBSTONE" } }, state: "CONFLICT" })
  expect(await page.evaluate(() => window.accountRecordHarness.accountJournalProjectionStatus())).toBe("CONFLICT")
})

test("lifecycle stale tombstone cannot evict a newer acknowledged local record", async ({ page }) => {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.ordinary)
    await h.persistAccountJournalRecord({ ...h.ordinary, savedAt: "2026-09-02T02:00:00.000Z" }, h.ordinary.savedAt)
  })
  const [key, stored] = [...server.documents.entries()][0]!
  server.documents.delete(key)
  server.tombstones.set(key, { documentId: stored.documentId, revision: 1 })
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(false)
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ serverRevision: 2, state: "DRAFT_ACKNOWLEDGED" })
})

test("migration normalizes legacy synced metadata without altering the owned source", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const before = h.seedLegacy("synced")
    return { before, cutoverRestored: h.accountJournalRecordsEnabled() && h.legacyWritesBlocked(),
      result: await h.migrateOwnedAccountJournals(), after: h.legacyRaw(), entries: h.loadEntries() }
  })
  expect(result.cutoverRestored).toBe(true)
  expect(result.result).toEqual({ saved: 1, pending: 0, attention: 0, ok: true })
  expect(result.after).toBe(result.before)
  expect(result.entries).toMatchObject([{ syncState: "synced", memo: "SYNTHETIC_ORDINARY_BODY" }])
  expect([...server.documents.values()][0]?.document.entry).toMatchObject({ syncState: "local", memo: "SYNTHETIC_ORDINARY_BODY" })
})

test("migration identical pending retry acknowledges and republishes synced projection", async ({ page }) => {
  server.offline(true)
  await page.evaluate(() => window.accountRecordHarness.seedLegacy("local"))
  expect(await page.evaluate(() => window.accountRecordHarness.migrateOwnedAccountJournals())).toEqual({ saved: 0, pending: 1, attention: 0, ok: true })
  server.offline(false)
  expect(await page.evaluate(() => window.accountRecordHarness.migrateOwnedAccountJournals())).toEqual({ saved: 1, pending: 0, attention: 0, ok: true })
  expect(await page.evaluate(() => window.accountRecordHarness.loadEntries())).toMatchObject([{ syncState: "synced" }])
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(2)
})

test("after-local-save projection failure reports pending and identical retry finishes without another local version", async ({ page }) => {
  await page.route("**/src/domain/account/account-journal-projection.ts*", async route => {
    const response = await route.fetch()
    const body = await response.text()
    const marker = 'function putAccountJournalProjection(ownerId, entry, confirmed = true) {'
    expect(body.split(marker)).toHaveLength(2)
    await route.fulfill({ response, body: body.replace(marker, `${marker}
      if (globalThis.__recordProjectionFailOnce) { globalThis.__recordProjectionFailOnce = false; throw new Error('Synthetic projection failure'); }
    `) })
  })
  await loadRecordHarness(page)
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    Object.assign(window, { __recordProjectionFailOnce: true })
    const first = await h.persistAccountJournalRecord(h.ordinary)
    const saved = await h.view("ordinary")
    const retryEntry = Object.fromEntries(Object.entries(h.ordinary).reverse()) as typeof h.ordinary
    const retry = await h.persistAccountJournalRecord(retryEntry)
    return { first, saved, retry, final: await h.view("ordinary") }
  })
  expect(result.first).toEqual({ ok: true, storage: "PENDING" })
  expect(result.saved).toMatchObject({ localSequence: 1, draft: { entry: { id: "ordinary" } } })
  expect(result.retry).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(result.final).toMatchObject({ localSequence: 1, serverRevision: 1, state: "DRAFT_ACKNOWLEDGED" })
})

test("migration delete then reload suppresses the retained owned backup without resurrecting it", async ({ page }) => {
  const before = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const raw = h.seedLegacy("synced")
    await h.migrateOwnedAccountJournals()
    return { raw, removed: await h.deleteAccountJournalRecord("ordinary"), entries: h.loadEntries(), retained: h.legacyRaw() }
  })
  expect(before.removed).toBe(true)
  expect(before.entries).toEqual([])
  expect(before.retained).toBe(before.raw)
  await loadRecordHarness(page)
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return { hydrated: await h.hydrateAccountJournalRecords(), entries: h.loadEntries(), retained: h.legacyRaw(), view: await h.view("ordinary") }
  })).toEqual({ hydrated: true, entries: [], retained: before.raw, view: null })
})

test("edit policy rejects changed date, kind, non-newer timestamp and planned link on schema-valid records", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const original = h.linkedEntry()
    const created = await h.persistAccountJournalRecord(original)
    const later = "2026-09-02T02:00:00.000Z"
    const alternatives = [
      { ...original, date: "2026-09-03", savedAt: later },
      { id: original.id, date: original.date, savedAt: later, syncState: "local" as const,
        kind: "race" as const, stage: "post" as const, record: "", rank: "", result: "", memo: "" },
      { ...original, memo: "CHANGED_WITHOUT_NEW_TIME" },
      { ...original, savedAt: later, plannedSessionLink: { ...original.plannedSessionLink!, linkedAt: later } },
    ]
    const valid = alternatives.map(entry => h.parseJournalEntryForWrite(entry) !== null)
    const rejected = []
    for (const entry of alternatives) rejected.push(await h.persistAccountJournalRecord(entry, original.savedAt))
    return { created, valid, rejected, view: await h.view("ordinary") }
  })
  expect(result.created).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(result.valid).toEqual([true, true, true, true])
  expect(result.rejected).toEqual(Array(4).fill({ ok: false, storage: "FAILED" }))
  expect(result.view).toMatchObject({ serverRevision: 1, localSequence: 1 })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(1)
})

test("edit policy rejects generic imported edits and changed imported objective facts", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    const imported = { ...h.ordinary, distanceKm: "5", objectiveDataState: "CONFIRMED" as const,
      fieldProvenance: { ...h.ordinary.fieldProvenance,
        distanceKm: { provenance: "DERIVED" as const, derivedFrom: ["import:activity-file"], derivationRuleId: "ACTIVITY_IMPORT_V1" } } }
    const generic = { ...imported, id: "generic-import" }
    delete (generic as { captureDepth?: unknown }).captureDepth
    const created = [await h.persistAccountJournalRecord(imported), await h.persistAccountJournalRecord(generic)]
    const edits = [
      { ...imported, distanceKm: "8", savedAt: "2026-09-02T02:00:00.000Z" },
      { ...generic, memo: "GENERIC_EDIT", savedAt: "2026-09-02T02:00:00.000Z" },
    ]
    const valid = edits.map(entry => h.parseJournalEntryForWrite(entry) !== null)
    const rejected = []
    for (const entry of edits) rejected.push(await h.persistAccountJournalRecord(entry, imported.savedAt))
    const allowed = await h.persistAccountJournalRecord({ ...imported, memo: "ALLOWED_MIXED_EDIT", savedAt: "2026-09-02T03:00:00.000Z" }, imported.savedAt)
    return { created, valid, rejected, allowed, view: await h.view("ordinary") }
  })
  expect(result.created.every(value => value.ok)).toBe(true)
  expect(result.valid).toEqual([true, true])
  expect(result.rejected).toEqual(Array(2).fill({ ok: false, storage: "FAILED" }))
  expect(result.allowed).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(result.view).toMatchObject({ draft: { entry: { distanceKm: "5", memo: "ALLOWED_MIXED_EDIT" } } })
})

test("edit policy preserves unchanged provenance instead of promoting or discarding it", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.privateRecord)
    const edited = await h.persistAccountJournalRecord({ ...h.privateRecord, memo: "PRIVATE_EDIT", savedAt: "2026-09-02T02:00:00.000Z",
      fieldProvenance: { rpe: { provenance: "MISSING" } } }, h.privateRecord.savedAt)
    return { edited, view: await h.view("private") }
  })
  expect(result.edited).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(result.view).toMatchObject({ draft: { entry: { fieldProvenance: { rpe: { provenance: "EXPLICIT" } } } } })
})

test("lifecycle delete reconciles a newer remote edit for review without deleting it", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })
  const stored = [...server.documents.values()][0]!
  stored.revision = 2
  stored.document = { ...stored.document, entry: { ...stored.document.entry, savedAt: "2026-09-02T02:00:00.000Z" } }
  expect(await page.evaluate(() => window.accountRecordHarness.deleteAccountJournalRecord("ordinary"))).toBe(false)
  expect(server.calls.filter(call => call.request.action === "delete")).toHaveLength(0)
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ serverRevision: 2 })
  expect(await page.evaluate(() => window.accountRecordHarness.deleteAccountJournalRecord("ordinary"))).toBe(true)
})

test("lifecycle history rejects another entry identity and cannot restore it", async ({ page }) => {
  await page.evaluate(async () => { const h = window.accountRecordHarness; await h.persistAccountJournalRecord(h.ordinary); await h.deleteAccountJournalRecord("ordinary") })
  const [key, versions] = [...server.history.entries()][0]!
  versions[0]!.document = { ...versions[0]!.document, entry: { ...versions[0]!.document.entry, id: "WRONG_ENTRY" } }
  const documentId = key.slice(key.indexOf(":") + 1)
  expect(await page.evaluate(documentId => window.accountRecordHarness.accountJournalRecordHistory(documentId), documentId)).toBeNull()
  expect(await page.evaluate(documentId => window.accountRecordHarness.restoreAccountJournalVersion(documentId, 1, 2), documentId)).toBe(false)
  expect(server.calls.filter(call => call.request.action === "restore")).toHaveLength(0)
})

test("lifecycle reload reconciles a lost delete receipt without deleting again", async ({ page }) => {
  await page.evaluate(() => { const h = window.accountRecordHarness; return h.persistAccountJournalRecord(h.ordinary) })
  server.loseReceipt("delete")
  expect(await page.evaluate(() => window.accountRecordHarness.deleteAccountJournalRecord("ordinary"))).toBe(false)
  await loadRecordHarness(page)
  expect(await page.evaluate(() => window.accountRecordHarness.deleteAccountJournalRecord("ordinary"))).toBe(true)
  expect(server.calls.filter(call => call.request.action === "delete")).toHaveLength(1)
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toBeNull()
})

test("after-local-save thrown flush resumes a failed edit with its original expectedSavedAt", async ({ page }) => {
  await page.route("**/src/domain/account/account-journal-sync.ts*", async route => {
    const response = await route.fetch()
    const body = await response.text()
    const marker = /async function flushAccountJournalDraft\([^]*?\) \{/u
    expect(body.match(marker)).not.toBeNull()
    await route.fulfill({ response, body: body.replace(marker, value => `${value}
      if (globalThis.__recordFlushFailOnce) { globalThis.__recordFlushFailOnce = false; throw new Error('Synthetic flush failure'); }
    `) })
  })
  await loadRecordHarness(page)
  const result = await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.ordinary)
    const edited = { ...h.ordinary, memo: "EDIT_BEFORE_FLUSH_FAILURE", savedAt: "2026-09-02T02:00:00.000Z" }
    Object.assign(window, { __recordFlushFailOnce: true })
    const first = await h.persistAccountJournalRecord(edited, h.ordinary.savedAt)
    const retry = await h.persistAccountJournalRecord(edited, h.ordinary.savedAt)
    return { first, retry, view: await h.view("ordinary") }
  })
  expect(result.first).toEqual({ ok: true, storage: "PENDING" })
  expect(result.retry).toEqual({ ok: true, storage: "ACCOUNT" })
  expect(result.view).toMatchObject({ localSequence: 2, serverRevision: 2, draft: { entry: { memo: "EDIT_BEFORE_FLUSH_FAILURE" } } })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(2)
})
