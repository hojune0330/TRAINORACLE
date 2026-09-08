import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import type {} from "./fixtures/account-journal-draft-buffer"

async function load(page: Page) {
  await page.goto("/__account_draft_buffer_test__")
  await page.evaluate(async () => {
    const path = "/e2e/fixtures/account-journal-draft-buffer.ts"
    const fixture = await import(/* @vite-ignore */ path)
    fixture.setup()
  })
}

test.beforeEach(async ({ context, page }) => {
  // Isolated browser context per test. No logged-in profile or external requests.
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin !== "http://127.0.0.1:4381") return route.abort()
    if (url.pathname === "/__account_draft_buffer_test__") {
      return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native draft buffer test</title>" })
    }
    return route.continue()
  })
  await load(page)
})

test("native key + ciphertext survive page reload and tab close; pending body remains fixed", async ({ page, context }) => {
  const initial = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.buffer.queue(h.owner, h.doc, h.op)
    await h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "NEWER_SYNTHETIC_BODY" })
    const stored = await h.raw()
    return { key: await h.keyInfo(), stored: JSON.stringify(stored), view: await h.buffer.read(h.owner, h.doc) }
  })
  expect(initial.key).toEqual({ native: true, extractable: false, algorithm: "AES-GCM",
    usages: ["decrypt", "encrypt"], exportRejected: true })
  for (const plaintext of ["SYNTHETIC_TITLE_ONLY", "SYNTHETIC_BODY_ONLY", "NEWER_SYNTHETIC_BODY"]) {
    expect(initial.stored).not.toContain(plaintext)
  }
  expect(initial.view).toMatchObject({ state: "PENDING", serverRevision: 0, localSequence: 2,
    acknowledgedSequence: 0, pending: { sequence: 1, expectedRevision: 0, draft: { body: "SYNTHETIC_BODY_ONLY" } } })
  await page.reload()
  await load(page)
  expect(await page.evaluate(() => {
    const h = window.accountDraftHarness
    return h.buffer.read(h.owner, h.doc)
  })).toEqual(initial.view)
  await page.close()
  const replacement = await context.newPage()
  await load(replacement)
  expect(await replacement.evaluate(() => {
    const h = window.accountDraftHarness
    return h.buffer.list(h.owner)
  })).toEqual([initial.view])
})

test("matching ack confirms only queued sequence; retry cannot change snapshot or reuse ID", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    const b = h.buffer
    await b.saveDraft(h.owner, h.doc, h.draft)
    await b.queue(h.owner, h.doc, h.op)
    const before = (await h.raw()).operation
    await b.saveDraft(h.owner, h.doc, { ...h.draft, body: "EDIT_DURING_SEND" })
    await b.queue(h.owner, h.doc, h.op)
    const after = (await h.raw()).operation
    const wrongId = await b.ack(h.owner, h.doc, h.otherOp, 1)
    const wrongRevision = await b.ack(h.owner, h.doc, h.op, 2)
    const competingQueue = await h.rejected(() => b.queue(h.owner, h.doc, h.otherOp))
    const applied = await b.ack(h.owner, h.doc, h.op, 1)
    const duplicate = await b.ack(h.owner, h.doc, h.op, 1)
    const reusedId = await h.rejected(() => b.queue(h.owner, h.doc, h.op))
    const view = await b.read(h.owner, h.doc)
    await b.queue(h.owner, h.doc, h.otherOp)
    const next = await b.read(h.owner, h.doc)
    return { before, after, wrongId, wrongRevision, competingQueue, applied, duplicate, reusedId, view, next }
  })
  expect(result.after).toEqual(result.before)
  expect(result).toMatchObject({ wrongId: false, wrongRevision: false, applied: true, duplicate: false,
    competingQueue: "Another operation pending", reusedId: "Operation ID already used",
    view: { state: "LOCAL_CHANGES", serverRevision: 1, localSequence: 2, acknowledgedSequence: 1,
      draft: { body: "EDIT_DURING_SEND" }, pending: null },
    next: { pending: { expectedRevision: 1, sequence: 2, draft: { body: "EDIT_DURING_SEND" } } } })
})

test("receipt conflict persists blocked metadata and retains current + attempted ciphertext", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.buffer.queue(h.owner, h.doc, h.op)
    await h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "CONFLICT_LOCAL" })
    const wrong = await h.buffer.conflict(h.owner, h.doc, h.otherOp, 5)
    const same = await h.buffer.conflict(h.owner, h.doc, h.op, 0)
    const applied = await h.buffer.conflict(h.owner, h.doc, h.op, 5)
    const before = await h.raw()
    const ack = await h.buffer.ack(h.owner, h.doc, h.op, 1)
    const queue = await h.rejected(() => h.buffer.queue(h.owner, h.doc, h.otherOp))
    const clear = await h.rejected(() => h.buffer.clear(h.owner, h.doc))
    return { wrong, same, applied, ack, queue, clear, unchanged: JSON.stringify(before) === JSON.stringify(await h.raw()) }
  })
  expect(result).toEqual({ wrong: false, same: false, applied: true, ack: false,
    queue: "Draft conflict blocked", clear: "Cannot clear unsaved draft", unchanged: true })
  await load(page)
  expect(await page.evaluate(() => {
    const h = window.accountDraftHarness
    return h.buffer.read(h.owner, h.doc)
  })).toMatchObject({ state: "CONFLICT", serverRevision: 0, acknowledgedSequence: 0,
    draft: { body: "CONFLICT_LOCAL" }, pending: { draft: { body: "SYNTHETIC_BODY_ONLY" } },
    blocked: { kind: "RECEIPT", currentRevision: 5 } })
})

test("remote import acknowledges clean data, rejects same-revision mismatch and preserves dirty local", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    const b = h.buffer
    const imported = await b.importRemote(h.owner, h.doc, h.draft, 4)
    const initial = await b.read(h.owner, h.doc)
    const same = await b.importRemote(h.owner, h.doc, h.draft, 4)
    const mismatch = await h.rejected(() => b.importRemote(h.owner, h.doc, { ...h.draft, body: "DIFFERENT" }, 4))
    const stale = await h.rejected(() => b.importRemote(h.owner, h.doc, h.draft, 3))
    const newer = await b.importRemote(h.owner, h.doc, { ...h.draft, body: "REMOTE_5" }, 5)
    await b.saveDraft(h.owner, h.doc, { ...h.draft, body: "LOCAL_6" })
    await b.queue(h.owner, h.doc, h.op)
    const conflict = await b.importRemote(h.owner, h.doc, { ...h.draft, body: "REMOTE_6" }, 6)
    const view = await b.read(h.owner, h.doc)
    const stored = JSON.stringify(await h.raw())
    return { imported, initial, same, mismatch, stale, newer, conflict, view, stored }
  })
  expect(result).toMatchObject({ imported: "IMPORTED", same: "UNCHANGED", newer: "IMPORTED", conflict: "CONFLICT",
    mismatch: "Remote revision content mismatch", stale: "Stale remote revision",
    initial: { localSequence: 1, acknowledgedSequence: 1, serverRevision: 4, state: "DRAFT_ACKNOWLEDGED" },
    view: { state: "CONFLICT", serverRevision: 5, draft: { body: "LOCAL_6" },
      pending: { draft: { body: "LOCAL_6" } }, remoteDraft: { body: "REMOTE_6" }, blocked: { kind: "REMOTE", currentRevision: 6 } } })
  expect(result.stored).not.toContain("LOCAL_6")
  expect(result.stored).not.toContain("REMOTE_6")
})

test("two tabs race native key creation and serialize twenty saves without lost sequence", async ({ page, context }) => {
  const second = await context.newPage()
  await load(second)
  const saveTen = (tab: Page, prefix: string) => tab.evaluate(async prefix => {
    const h = window.accountDraftHarness
    await Promise.all(Array.from({ length: 10 }, (_, index) => h.buffer.saveDraft(h.owner,
      h.doc, { ...h.draft, body: `${prefix}-${index}` })))
  }, prefix)
  await Promise.all([saveTen(page, "TAB_A"), saveTen(second, "TAB_B")])
  const first = await page.evaluate(() => {
    const h = window.accountDraftHarness
    return h.buffer.read(h.owner, h.doc)
  })
  expect(first).toMatchObject({ localSequence: 20, acknowledgedSequence: 0, serverRevision: 0 })
  expect(first?.draft.body).toMatch(/^TAB_[AB]-[0-9]$/)
  expect(await second.evaluate(() => {
    const h = window.accountDraftHarness
    return h.buffer.read(h.owner, h.doc)
  })).toEqual(first)
})

test("owner isolation and logout retain encrypted pending data; clean clear retains key", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    const b = h.buffer
    await b.saveDraft(h.owner, h.doc, h.draft)
    await b.queue(h.owner, h.doc, h.op)
    const absent = await b.read(h.otherOwner, h.doc)
    const empty = await b.list(h.otherOwner)
    await b.importRemote(h.otherOwner, h.doc, { ...h.draft, body: "OTHER_OWNER" }, 1)
    const before = await h.raw()
    b.logout(h.owner)
    const refused = await h.rejected(() => b.list(h.owner))
    const other = await b.read(h.otherOwner, h.doc)
    const cleanClear = await b.clear(h.otherOwner, h.doc)
    const key = await h.keyInfo(h.otherOwner)
    const cleared = await b.read(h.otherOwner, h.doc)
    const fresh = h.create(indexedDB)
    const recovered = await fresh.read(h.owner, h.doc)
    fresh.close()
    return { absent, empty, refused, other, cleanClear, cleared, key, recovered,
      unchanged: JSON.stringify(before) === JSON.stringify(await h.raw()) }
  })
  expect(result).toMatchObject({ absent: null, empty: [], refused: "Draft buffer scope disposed",
    other: { draft: { body: "OTHER_OWNER" } }, cleanClear: true, cleared: null,
    key: { native: true, extractable: false }, recovered: { state: "PENDING" }, unchanged: true })
})

test("corrupt record refuses read/list/save and does not silently replace storage", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.mutate(record => { record.acknowledgedSequence = 900 })
    const before = JSON.stringify(await h.raw())
    const read = await h.rejected(() => h.buffer.read(h.owner, h.doc))
    const list = await h.rejected(() => h.buffer.list(h.owner))
    const save = await h.rejected(() => h.buffer.saveDraft(h.owner, h.doc, h.draft))
    return { read, list, save, unchanged: before === JSON.stringify(await h.raw()) }
  })
  expect(result).toEqual({ read: "Invalid stored draft record", list: "Invalid stored draft record",
    save: "Invalid stored draft record", unchanged: true })
})

test("tampered GCM ciphertext and cross-document copy fail authenticated decryption", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.buffer.saveDraft(h.owner, h.otherOp, h.draft)
    const original = await h.raw()
    await h.mutate(record => { record.encryptedCurrent.ciphertext[0] = record.encryptedCurrent.ciphertext[0]! ^ 1 })
    const tampered = await h.rejected(() => h.buffer.read(h.owner, h.doc))
    await h.mutate(record => { record.encryptedCurrent = original.encryptedCurrent }, h.owner, h.otherOp)
    const copied = await h.rejected(() => h.buffer.read(h.owner, h.otherOp))
    return { tampered, copied }
  })
  expect(result).toEqual({ tampered: "Cannot decrypt journal draft", copied: "Cannot decrypt journal draft" })
})

test("missing persisted key fails closed and is not regenerated for existing drafts", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    const before = JSON.stringify(await h.raw())
    await h.removeKey()
    const read = await h.rejected(() => h.buffer.read(h.owner, h.doc))
    const save = await h.rejected(() => h.buffer.saveDraft(h.owner, h.doc, h.draft))
    return { read, save, unchanged: before === JSON.stringify(await h.raw()) }
  })
  expect(result).toEqual({ read: "Missing device key", save: "Missing device key for existing drafts", unchanged: true })
})

test("native transaction abort rolls back save without resolving success", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    const before = await h.buffer.read(h.owner, h.doc)
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const request = put.apply(this, args)
      if (this.name === "drafts") this.transaction.abort()
      return request
    }
    let error: string | null
    try { error = await h.rejected(() => h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "ABORTED" })) }
    finally { IDBObjectStore.prototype.put = put }
    return { error, before, after: await h.buffer.read(h.owner, h.doc) }
  })
  expect(result.error).toMatch(/Draft (storage failed|transaction aborted)/)
  expect(result.after).toEqual(result.before)
})

test("stale tab CAS refuses overwriting a newer draft; zero means absent document", async ({ page, context }) => {
  await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft, 0)
  })
  const second = await context.newPage()
  await load(second)
  const oldSequence = await second.evaluate(async () => {
    const h = window.accountDraftHarness
    return (await h.buffer.read(h.owner, h.doc))!.localSequence
  })
  await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "LATEST_TAB_A" }, 1)
  })
  const result = await second.evaluate(async expected => {
    const h = window.accountDraftHarness
    const before = JSON.stringify(await h.raw())
    const stale = await h.rejected(() => h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "STALE_TAB_B" }, expected))
    const zero = await h.rejected(() => h.buffer.saveDraft(h.owner, h.doc, h.draft, 0))
    const missing = await h.rejected(() => h.buffer.saveDraft(h.owner, h.otherOp, h.draft, 1))
    const unchanged = before === JSON.stringify(await h.raw())
    const view = await h.buffer.read(h.owner, h.doc)
    await h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "REBASED_TAB_B" }, 2)
    return { stale, zero, missing, unchanged, view, rebased: await h.buffer.read(h.owner, h.doc) }
  }, oldSequence)
  expect(result).toMatchObject({ stale: "Draft local sequence mismatch", zero: "Draft local sequence mismatch",
    missing: "Draft local sequence mismatch", unchanged: true,
    view: { localSequence: 2, draft: { body: "LATEST_TAB_A" } },
    rebased: { localSequence: 3, draft: { body: "REBASED_TAB_B" } } })
})

test("simultaneous expected-zero saves have exactly one CAS winner", async ({ page, context }) => {
  const second = await context.newPage()
  await load(second)
  const save = (tab: Page) => tab.evaluate(async () => {
    const h = window.accountDraftHarness
    return h.rejected(() => h.buffer.saveDraft(h.owner, h.doc, h.draft, 0))
  })
  const results = await Promise.all([save(page), save(second)])
  expect(results.filter(result => result === null)).toHaveLength(1)
  expect(results.filter(result => result === "Draft local sequence mismatch")).toHaveLength(1)
  expect(await page.evaluate(async () => {
    const h = window.accountDraftHarness
    return (await h.buffer.read(h.owner, h.doc))?.localSequence
  })).toBe(1)
})

test("flush retries fixed HTTP payload then sends edits made during pending with a new operation", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft, 0)
    const requests: Array<{ operationId: string; expectedRevision: number; body: string }> = []
    const transport = h.httpTransport(async request => {
      if (request.action !== "save") throw new Error("Expected save")
      requests.push({ operationId: request.operationId, expectedRevision: request.expectedRevision, body: request.document.body })
      if (requests.length === 1) {
        await h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "EDIT_DURING_HTTP" }, 1)
        return new Response(null, { status: 503 })
      }
      return Response.json({ kind: "saved", documentId: request.documentId,
        operationId: request.operationId, revision: request.expectedRevision + 1 })
    })
    const first = await h.flush(h.buffer, h.owner, h.doc, transport, () => true)
    const waiting = await h.buffer.read(h.owner, h.doc)
    const second = await h.flush(h.buffer, h.owner, h.doc, transport, () => true)
    return { first, waiting, second, requests, final: await h.buffer.read(h.owner, h.doc) }
  })
  expect(result).toMatchObject({ first: "PENDING", second: "SAVED",
    waiting: { state: "PENDING", localSequence: 2, acknowledgedSequence: 0,
      draft: { body: "EDIT_DURING_HTTP" }, pending: { sequence: 1, draft: { body: "SYNTHETIC_BODY_ONLY" } } },
    final: { state: "DRAFT_ACKNOWLEDGED", serverRevision: 2, localSequence: 2,
      acknowledgedSequence: 2, pending: null, draft: { body: "EDIT_DURING_HTTP" } } })
  expect(result.requests).toHaveLength(3)
  expect(result.requests[1]).toEqual(result.requests[0])
  expect(result.requests[2]).toMatchObject({ expectedRevision: 1, body: "EDIT_DURING_HTTP" })
  expect(result.requests[2]?.operationId).not.toBe(result.requests[0]?.operationId)
})

test("flush applies HTTP 409 conflict receipt without replacing local draft", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft, 0)
    const transport = h.httpTransport(async request => {
      if (request.action !== "save") throw new Error("Expected save")
      return Response.json({ kind: "conflict", documentId: request.documentId,
        operationId: request.operationId, currentRevision: 7 }, { status: 409 })
    })
    const status = await h.flush(h.buffer, h.owner, h.doc, transport, () => true)
    return { status, view: await h.buffer.read(h.owner, h.doc) }
  })
  expect(result).toMatchObject({ status: "CONFLICT", view: { state: "CONFLICT",
    serverRevision: 0, acknowledgedSequence: 0, draft: { body: "SYNTHETIC_BODY_ONLY" },
    pending: { draft: { body: "SYNTHETIC_BODY_ONLY" } }, blocked: { kind: "RECEIPT", currentRevision: 7 } } })
})

test("same-base remote refresh preserves dirty and pending drafts without false conflict", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.importRemote(h.owner, h.doc, h.draft, 4)
    await h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "LOCAL_UNSENT" }, 1)
    const dirtyBefore = JSON.stringify(await h.raw())
    const dirtyRefresh = await h.buffer.importRemote(h.owner, h.doc, h.draft, 4)
    const dirtyUnchanged = dirtyBefore === JSON.stringify(await h.raw())
    await h.buffer.queue(h.owner, h.doc, h.op)
    const pendingBefore = JSON.stringify(await h.raw())
    const pendingRefresh = await h.buffer.importRemote(h.owner, h.doc, h.draft, 4)
    const stale = await h.rejected(() => h.buffer.importRemote(h.owner, h.doc, h.draft, 3))
    return { dirtyRefresh, dirtyUnchanged, pendingRefresh, stale,
      pendingUnchanged: pendingBefore === JSON.stringify(await h.raw()), view: await h.buffer.read(h.owner, h.doc) }
  })
  expect(result).toMatchObject({ dirtyRefresh: "UNCHANGED", dirtyUnchanged: true,
    pendingRefresh: "UNCHANGED", pendingUnchanged: true, stale: "Stale remote revision",
    view: { state: "PENDING", blocked: null, serverRevision: 4, localSequence: 2,
      acknowledgedSequence: 1, draft: { body: "LOCAL_UNSENT" }, pending: { draft: { body: "LOCAL_UNSENT" } } } })
})
