import { expect, test, type Page } from "@playwright/test"
import { loadRecordHarness, mockRecordServer } from "./fixtures/account-journal-record-server"
import type {} from "./fixtures/account-journal-record-service"
import type { AccountJournalRecord } from "../src/domain/account/account-journal-record-schema"

let server: ReturnType<typeof mockRecordServer>
test.beforeEach(async ({ context, page }) => {
  server = mockRecordServer()
  await server.install(context)
  await loadRecordHarness(page)
})

async function conflict(page: Page, deletion = false) {
  await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.persistAccountJournalRecord(h.ordinary)
  })
  const [key, original] = [...server.documents.entries()][0]!
  const remote = { ...structuredClone(original), document: structuredClone(original.document) as AccountJournalRecord }
  remote.revision = 2
  Object.assign(remote.document.entry, { memo: "REMOTE_VERSION", savedAt: "2026-09-02T02:00:00.000Z" })
  if (deletion) { server.documents.delete(key); server.tombstones.set(key, { documentId: original.documentId, revision: 2 }) }
  else server.documents.set(key, remote)
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return h.persistAccountJournalRecord({ ...h.ordinary, memo: "LOCAL_VERSION", savedAt: "2026-09-02T03:00:00.000Z" }, h.ordinary.savedAt)
  })).toEqual({ ok: true, storage: "CONFLICT" })
  return { key, documentId: original.documentId }
}

test("receipt fetches real body; remote choice archives BOTH encrypted versions across reload without a save", async ({ page }) => {
  const { documentId } = await conflict(page)
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ remoteDraft: null, blocked: { kind: "RECEIPT" } })
  const saves = server.calls.filter(call => call.request.action === "save").length
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness
    const review = await h.reviewAccountJournalConflict(id)
    if (!review || review.remote?.entry.kind !== "post-session") throw new Error("Missing remote")
    return { remote: review.remote.entry.memo, result: await h.resolveAccountJournalConflict(review, "REMOTE") }
  }, documentId)).toEqual({ remote: "REMOTE_VERSION", result: "ACCOUNT" })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(saves)
  await page.reload(); await loadRecordHarness(page)
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.hydrateAccountJournalRecords()
    const raw = (await h.rawRecords())[0] as { conflictArchive: { encryptedLocal: unknown; encryptedRemote: unknown }[] }
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("trainoracle-account-journal-records-v1", 1); r.onsuccess = () => resolve(r.result) })
    const key = await new Promise<CryptoKey>(resolve => { const r = db.transaction("ownerKeys").objectStore("ownerKeys").get(h.owner); r.onsuccess = () => resolve(r.result) })
    db.close()
    const doc = await h.accountJournalDocumentId(h.owner, "ordinary")
    async function decrypt(cipher: unknown) {
      const c = cipher as { iv: number[]; ciphertext: number[] }
      const bytes = await crypto.subtle.decrypt({ name: "AES-GCM", iv: new Uint8Array(c.iv),
        additionalData: new TextEncoder().encode(JSON.stringify(["trainoracle-account-journal-records-v1", 1, h.owner, doc])) }, key, new Uint8Array(c.ciphertext))
      return JSON.parse(new TextDecoder().decode(bytes)).entry.memo
    }
    const pair = raw.conflictArchive.at(-1)!
    return { local: await decrypt(pair.encryptedLocal), remote: await decrypt(pair.encryptedRemote),
      plaintextAtRest: /LOCAL_VERSION|REMOTE_VERSION/.test(JSON.stringify(raw)), entries: h.loadEntries().length,
      current: (await h.view("ordinary"))?.draft.entry }
  })).toMatchObject({ local: "LOCAL_VERSION", remote: "REMOTE_VERSION", plaintextAtRest: false, entries: 1, current: { memo: "REMOTE_VERSION" } })
})

test("local choice uses fresh revision and new operation on SAME finalized record, lost receipt retries once", async ({ page }) => {
  const { documentId } = await conflict(page)
  server.loseReceipt()
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness, review = await h.reviewAccountJournalConflict(id)
    return review && h.resolveAccountJournalConflict(review, "LOCAL")
  }, documentId)).toBe("PENDING")
  await page.reload(); await loadRecordHarness(page)
  expect(await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())).toBe(true)
  const saves = server.calls.filter(call => call.request.action === "save").map(call => call.request)
  expect(saves.at(-1)).toEqual(saves.at(-2))
  expect(saves.at(-1)).toMatchObject({ documentId, expectedRevision: 2 })
  expect(server.documents.size).toBe(1)
  expect([...server.documents.values()][0]).toMatchObject({ revision: 3, document: { entry: { memo: "LOCAL_VERSION" } } })
  expect(await page.evaluate(() => window.accountRecordHarness.loadEntries().length)).toBe(1)
})

test("remote changes after review refuse selection without overwriting or losing local", async ({ page }) => {
  const { documentId, key } = await conflict(page)
  const review = await page.evaluate(id => window.accountRecordHarness.reviewAccountJournalConflict(id), documentId)
  server.documents.get(key)!.revision = 3
  Object.assign((server.documents.get(key)!.document as AccountJournalRecord).entry, { memo: "NEW_REMOTE" })
  expect(await page.evaluate(review => window.accountRecordHarness.resolveAccountJournalConflict(review!, "LOCAL"), review)).toBe("REVIEW_REQUIRED")
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ state: "CONFLICT", draft: { entry: { memo: "LOCAL_VERSION" } } })
  expect(server.documents.get(key)!.revision).toBe(3)
})

test("repeat review does not grow archive and same-revision different body is refused", async ({ page }) => {
  const { documentId, key } = await conflict(page)
  const archiveCounts = await page.evaluate(async id => {
    const h = window.accountRecordHarness
    await h.reviewAccountJournalConflict(id)
    const count = async () => ((await h.rawRecords())[0] as { conflictArchive: unknown[] }).conflictArchive.length
    const before = await count()
    await h.reviewAccountJournalConflict(id)
    return [before, await count()]
  }, documentId)
  expect(archiveCounts).toEqual([1, 1])
  Object.assign((server.documents.get(key)!.document as AccountJournalRecord).entry, { memo: "INVALID_SAME_REVISION" })
  expect(await page.evaluate(id => window.accountRecordHarness.reviewAccountJournalConflict(id), documentId)).toBeNull()
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ remoteDraft: { entry: { memo: "REMOTE_VERSION" } } })
})

test("native second buffer localSequence CAS rejects a stale selection", async ({ page }) => {
  const { documentId } = await conflict(page)
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness, review = await h.reviewAccountJournalConflict(id)
    const bufferPath = "/src/domain/account/account-journal-draft-buffer.ts"
    const schemaPath = "/src/domain/account/account-journal-record-schema.ts"
    const { createAccountDocumentBuffer } = await import(/* @vite-ignore */ bufferPath)
    const { accountJournalRecordSchema } = await import(/* @vite-ignore */ schemaPath)
    const buffer = createAccountDocumentBuffer(accountJournalRecordSchema, "trainoracle-account-journal-records-v1")
    try {
      await buffer.saveDraft(h.owner, id, { ...review!.local, entry: { ...review!.local.entry, memo: "NEW_LOCAL" } }, review!.localSequence)
      let cas = "accepted"
      try { await buffer.resolveConflict(h.owner, id, "REMOTE", review!.remoteRevision, review!.localSequence) } catch { cas = "refused" }
      return { cas, result: await h.resolveAccountJournalConflict(review!, "REMOTE"), view: await buffer.read(h.owner, id) }
    } finally { buffer.close() }
  }, documentId)).toMatchObject({ cas: "refused", result: "REVIEW_REQUIRED", view: { state: "CONFLICT", draft: { entry: { memo: "NEW_LOCAL" } } } })
})

test("two real tabs retain the newer edit while a resolution server read is held", async ({ page, context }) => {
  const { documentId } = await conflict(page)
  const review = await page.evaluate(id => window.accountRecordHarness.reviewAccountJournalConflict(id), documentId)
  const reads = server.calls.filter(call => call.request.action === "read").length
  const release = server.holdNext("read")
  const second = await context.newPage()
  try {
    await loadRecordHarness(second)
    await page.evaluate(review => { const h = window.accountRecordHarness; h.pending = h.resolveAccountJournalConflict(review!, "REMOTE") }, review)
    await expect.poll(() => server.calls.filter(call => call.request.action === "read").length).toBe(reads + 1)
    await second.evaluate(async id => {
      const h = window.accountRecordHarness
      const bufferPath = "/src/domain/account/account-journal-draft-buffer.ts", schemaPath = "/src/domain/account/account-journal-record-schema.ts"
      const { createAccountDocumentBuffer } = await import(/* @vite-ignore */ bufferPath)
      const { accountJournalRecordSchema } = await import(/* @vite-ignore */ schemaPath)
      const buffer = createAccountDocumentBuffer(accountJournalRecordSchema, "trainoracle-account-journal-records-v1")
      try {
        const current = await buffer.read(h.owner, id)
        await buffer.saveDraft(h.owner, id, { ...current.draft, entry: { ...current.draft.entry, memo: "SECOND_TAB_EDIT" } }, current.localSequence)
      } finally { buffer.close() }
    }, documentId)
    release()
    expect(await page.evaluate(() => window.accountRecordHarness.pending)).toBe("FAILED")
    expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ state: "CONFLICT", draft: { entry: { memo: "SECOND_TAB_EDIT" } } })
  } finally { release(); await second.close() }
})

test("old records parse defaults without read rewriting or import CAS fingerprint mismatch", async ({ page }) => {
  const { documentId } = await conflict(page)
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("trainoracle-account-journal-records-v1", 1); r.onsuccess = () => resolve(r.result) })
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite"), store = tx.objectStore("drafts"), r = store.get([h.owner, id])
      r.onsuccess = () => { const old = r.result; delete old.conflictArchive; delete old.resolvedDeletion; delete old.blocked.deleted; store.put(old) }
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
    })
    db.close()
    const rawBefore = JSON.stringify(await h.rawRecords())
    const parsed = await h.view("ordinary")
    const rawAfter = JSON.stringify(await h.rawRecords())
    const review = await h.reviewAccountJournalConflict(id)
    return { unchangedByRead: rawBefore === rawAfter, parsed, selected: review && await h.resolveAccountJournalConflict(review, "REMOTE") }
  }, documentId)).toMatchObject({ unchangedByRead: true, parsed: { recoverableVersions: 0, resolvedDeletion: null, remoteDeleted: false }, selected: "ACCOUNT" })
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    return { hydrated: await h.hydrateAccountJournalRecords(), state: (await h.view("ordinary"))?.state }
  })).toEqual({ hydrated: true, state: "DRAFT_ACKNOWLEDGED" })
})

test("owner-only archive recovery exposes metadata and ceiling refuses changes without dropping versions", async ({ page }) => {
  const { documentId } = await conflict(page)
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness
    const review = await h.reviewAccountJournalConflict(id)
    const versions = await h.readAccountJournalConflictArchive(h.owner, id)
    const db = await new Promise<IDBDatabase>(resolve => { const r = indexedDB.open("trainoracle-account-journal-records-v1", 1); r.onsuccess = () => resolve(r.result) })
    const bufferPath = "/src/domain/account/account-journal-draft-buffer.ts"
    const { MAX_CONFLICT_ARCHIVE_ENTRIES } = await import(/* @vite-ignore */ bufferPath)
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction("drafts", "readwrite"), store = tx.objectStore("drafts"), r = store.get([h.owner, id])
      r.onsuccess = () => { const record = r.result; record.conflictArchive = Array.from({ length: MAX_CONFLICT_ARCHIVE_ENTRIES }, () => structuredClone(record.conflictArchive[0])); store.put(record) }
      tx.oncomplete = () => resolve(); tx.onabort = () => reject(tx.error)
    })
    db.close()
    const before = JSON.stringify(await h.rawRecords())
    const result = await h.resolveAccountJournalConflict(review!, "REMOTE")
    const unchanged = before === JSON.stringify(await h.rawRecords())
    h.setActiveLocalAccount(h.otherOwner)
    const denied = await h.readAccountJournalConflictArchive(h.owner, id)
    return { versions, result, unchanged, denied }
  }, documentId)).toMatchObject({ versions: [{ version: 1, createdAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    localServerRevision: 1, localSequence: 2, remoteRevision: 2, local: { entry: { memo: "LOCAL_VERSION" } }, remote: { entry: { memo: "REMOTE_VERSION" } } }],
    result: "FAILED", unchanged: true, denied: null })
})

test("remote deletion is explicit and cannot resurrect on reload or local selection", async ({ page }) => {
  const { documentId } = await conflict(page, true)
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness, review = await h.reviewAccountJournalConflict(id)
    return { remote: review?.remote, forbidden: await h.resolveAccountJournalConflict(review!, "LOCAL"),
      accepted: await h.resolveAccountJournalConflict(review!, "DELETE") }
  }, documentId)).toEqual({ remote: null, forbidden: "FAILED", accepted: "ACCOUNT" })
  await page.reload(); await loadRecordHarness(page)
  expect(await page.evaluate(async () => {
    const h = window.accountRecordHarness
    await h.hydrateAccountJournalRecords()
    return { entries: h.loadEntries(), view: await h.view("ordinary"), save: await h.persistAccountJournalRecord(h.ordinary) }
  })).toMatchObject({ entries: [], view: { resolvedDeletion: 2, state: "DRAFT_ACKNOWLEDGED" }, save: { ok: false } })
  expect(server.documents.size).toBe(0)
})

test("owner switch rejects a held review and never writes to either account", async ({ page }) => {
  const { documentId } = await conflict(page)
  const count = server.calls.length
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness, review = await h.reviewAccountJournalConflict(id)
    h.setActiveLocalAccount(h.otherOwner)
    return h.resolveAccountJournalConflict(review!, "LOCAL")
  }, documentId)).toBe("FAILED")
  expect(server.calls.slice(count).map(call => call.request.action)).toEqual(["read"])
})

test("invalid fetched server identity cannot become a selectable remote version", async ({ page }) => {
  const { documentId } = await conflict(page)
  await page.route("**/__record_api__", async route => {
    if (route.request().postDataJSON().request.action !== "read") return route.fallback()
    await route.fulfill({ contentType: "application/json", body: JSON.stringify({ kind: "deleted",
      documentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", revision: 2 }) })
  })
  expect(await page.evaluate(id => window.accountRecordHarness.reviewAccountJournalConflict(id), documentId)).toBeNull()
  expect(await page.evaluate(() => window.accountRecordHarness.view("ordinary"))).toMatchObject({ state: "CONFLICT", remoteDraft: null, blocked: { kind: "RECEIPT" } })
})

test("resolution transaction abort leaves both reviewed versions and blocked operation intact", async ({ page }) => {
  const { documentId } = await conflict(page)
  expect(await page.evaluate(async id => {
    const h = window.accountRecordHarness, review = await h.reviewAccountJournalConflict(id)
    const before = await h.view("ordinary")
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function(value, key) {
      const request = key === undefined ? put.call(this, value) : put.call(this, value, key)
      if (this.name === "drafts" && value.conflictArchive?.at(-1)?.choice === "REMOTE") this.transaction.abort()
      return request
    }
    try { return { before, result: await h.resolveAccountJournalConflict(review!, "REMOTE"), after: await h.view("ordinary") } }
    finally { IDBObjectStore.prototype.put = put }
  }, documentId)).toMatchObject({ result: "FAILED", before: { state: "CONFLICT", localSequence: 2 },
    after: { state: "CONFLICT", localSequence: 2, draft: { entry: { memo: "LOCAL_VERSION" } }, remoteDraft: { entry: { memo: "REMOTE_VERSION" } } } })
})

test("stale localSequence assertion detects a route-only resolution CAS mutation", async ({ page }) => {
  await page.route("**/src/domain/account/account-journal-draft-buffer.ts*", async route => {
    const response = await route.fetch(), body = await response.text()
    const guard = '!blocked || blocked.kind !== "REMOTE" || record.localSequence !== expectedLocalSequence'
    expect(body.split(guard)).toHaveLength(2)
    await route.fulfill({ response, body: body.replace(guard, '!blocked || blocked.kind !== "REMOTE"') })
  })
  await loadRecordHarness(page)
  const { documentId } = await conflict(page)
  const refused = await page.evaluate(async id => {
    const h = window.accountRecordHarness, review = await h.reviewAccountJournalConflict(id)
    const bufferPath = "/src/domain/account/account-journal-draft-buffer.ts", schemaPath = "/src/domain/account/account-journal-record-schema.ts"
    const { createAccountDocumentBuffer } = await import(/* @vite-ignore */ bufferPath)
    const { accountJournalRecordSchema } = await import(/* @vite-ignore */ schemaPath)
    const buffer = createAccountDocumentBuffer(accountJournalRecordSchema, "trainoracle-account-journal-records-v1")
    try {
      await buffer.saveDraft(h.owner, id, { ...review!.local, entry: { ...review!.local.entry, memo: "NEW_LOCAL" } }, review!.localSequence)
      try { await buffer.resolveConflict(h.owner, id, "REMOTE", review!.remoteRevision, review!.localSequence); return false }
      catch { return true }
    } finally { buffer.close() }
  }, documentId)
  expect(() => expect(refused, "stale localSequence must reject resolution").toBe(true)).toThrow()
})

async function mountConflictUI(page: Page) {
  await page.evaluate(async () => {
    const refreshPath = "/@react-refresh"
    const refresh = await import(/* @vite-ignore */ refreshPath)
    refresh.default.injectIntoGlobalHook(window)
    Object.assign(window, { $RefreshReg$: () => {}, $RefreshSig$: () => (type: unknown) => type, __vite_plugin_react_preamble_installed__: true })
    const fixturePath = "/e2e/fixtures/account-journal-conflict-ui.tsx"
    const { mount } = await import(/* @vite-ignore */ fixturePath)
    mount()
  })
}

test("storage status UI compares real versions, requires a choice, fits mobile and recovers archive after reload", async ({ page }, testInfo) => {
  await conflict(page)
  await mountConflictUI(page)
  await page.getByRole("button", { name: /충돌 확인$/ }).click()
  await expect(page.getByRole("region", { name: "이 기기 내용" })).toContainText("LOCAL_VERSION")
  await expect(page.getByRole("region", { name: "계정의 최신 내용" })).toContainText("REMOTE_VERSION")
  await expect(page.getByRole("button", { name: "선택한 내용 반영" })).toBeDisabled()
  for (const width of [375, 1280]) {
    await page.setViewportSize({ width, height: 800 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`conflict-${width}.png`), fullPage: true })
  }
  await page.getByRole("radio", { name: "계정의 최신 내용 사용" }).check()
  await page.getByRole("button", { name: "선택한 내용 반영" }).click()
  await expect(page.locator(".account-conflict").getByRole("status")).toContainText("선택을 반영했어요")
  await page.reload(); await loadRecordHarness(page)
  await page.evaluate(() => window.accountRecordHarness.hydrateAccountJournalRecords())
  await mountConflictUI(page)
  await page.getByRole("button", { name: /보존본 .*건 보기/ }).click()
  await page.getByRole("region", { name: "충돌 보존본" }).locator("summary").first().click()
  await expect(page.getByRole("region", { name: "보존된 기기 내용" }).first()).toContainText("LOCAL_VERSION")
  await expect(page.getByRole("region", { name: "보존된 계정 내용" }).first()).toContainText("REMOTE_VERSION")
  await page.evaluate(() => window.accountRecordHarness.setActiveLocalAccount(null))
  await expect(page.getByText("REMOTE_VERSION", { exact: true })).toHaveCount(0)
  await expect(page.getByText("LOCAL_VERSION", { exact: true })).toHaveCount(0)
})
