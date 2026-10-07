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
  await context.route("**/*", route => {
    const url = new URL(route.request().url())
    if (url.origin !== "http://127.0.0.1:4381") return route.abort()
    if (url.pathname === "/__account_draft_buffer_test__") {
      return route.fulfill({ contentType: "text/html", body: "<!doctype html><title>Native deletion boundary test</title>" })
    }
    return route.continue()
  })
  await load(page)
})

test("deletion is terminal after reload while native ciphertext, pending snapshot and nonextractable key are retained", async ({ page }) => {
  const before = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.buffer.queue(h.owner, h.doc, h.op)
    await h.buffer.saveDraft(h.owner, h.doc, { ...h.draft, body: "NEWER_UNSENT_SYNTHETIC" })
    const raw = JSON.stringify(await h.raw())
    const key = await h.keyInfo()
    const path = "/src/domain/account/account-deletion-boundary.ts"
    const deletion = await import(/* @vite-ignore */ path)
    deletion.closeAccountDeletionBoundary(h.owner, "2026-10-07T00:00:00Z")
    return { raw, key, refused: await h.rejected(() => h.buffer.read(h.owner, h.doc)) }
  })
  expect(before.refused).toBe("Draft buffer scope disposed")
  expect(before.key).toMatchObject({ native: true, extractable: false, exportRejected: true })
  await page.reload()
  await load(page)
  const after = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    const send = async () => { throw new Error("deleted owner must never send") }
    const status = await h.flush(h.buffer, h.owner, h.doc, send, () => true)
    const read = await h.rejected(() => h.buffer.read(h.owner, h.doc))
    // This same durable buffer still works for a different, valid owner.
    await h.buffer.saveDraft(h.otherOwner, h.doc, h.draft)
    await h.buffer.queue(h.otherOwner, h.doc, h.otherOp)
    const ack = await h.buffer.ack(h.otherOwner, h.doc, h.otherOp, 1)
    return { status, read, raw: JSON.stringify(await h.raw()), key: await h.keyInfo(),
      other: { ack, state: (await h.buffer.read(h.otherOwner, h.doc))?.state } }
  })
  expect(after).toEqual({ status: "ACCOUNT_DELETION_REQUESTED", read: "Draft buffer scope disposed",
    raw: before.raw, key: before.key, other: { ack: true, state: "DRAFT_ACKNOWLEDGED" } })
  expect(after.raw).not.toContain("NEWER_UNSENT_SYNTHETIC")
  expect(after.raw).not.toContain("SYNTHETIC_BODY_ONLY")
})

test("deletion rejects late native ACK and remote import without changing the retained operation", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.buffer.queue(h.owner, h.doc, h.op)
    const before = JSON.stringify(await h.raw())
    let sent!: () => void, release!: () => void
    const started = new Promise<void>(done => { sent = done })
    const waiting = new Promise<void>(done => { release = done })
    const status = h.flush(h.buffer, h.owner, h.doc, async request => {
      if (request.action !== "save") throw new Error("expected fixed save")
      sent()
      await waiting
      return { ok: true, data: { kind: "saved", documentId: request.documentId, operationId: request.operationId, revision: 1 } }
    }, () => true)
    await started
    let encrypted!: () => void, resumeImport!: () => void
    const importStarted = new Promise<void>(done => { encrypted = done })
    const importWaiting = new Promise<void>(done => { resumeImport = done })
    const encrypt = crypto.subtle.encrypt.bind(crypto.subtle)
    crypto.subtle.encrypt = async (...args: Parameters<typeof encrypt>) => {
      const ciphertext = await encrypt(...args)
      encrypted()
      await importWaiting
      return ciphertext
    }
    const remoteImport = h.rejected(() => h.buffer.importRemote(h.owner, h.doc, { ...h.draft, body: "LATE_REMOTE" }, 2))
    await importStarted
    const path = "/src/domain/account/account-deletion-boundary.ts"
    const deletion = await import(/* @vite-ignore */ path)
    deletion.closeAccountDeletionBoundary(h.owner, "2026-10-07T00:00:00Z")
    release()
    resumeImport()
    const imported = await remoteImport
    crypto.subtle.encrypt = encrypt
    return { status: await status, before, after: JSON.stringify(await h.raw()),
      ack: await h.rejected(() => h.buffer.ack(h.owner, h.doc, h.op, 1)),
      imported,
      key: await h.keyInfo() }
  })
  expect(result.status).toBe("ACCOUNT_DELETION_REQUESTED")
  expect(result.ack).toBe("Draft buffer scope disposed")
  expect(result.imported).toBe("Draft buffer scope disposed")
  expect(result.after).toBe(result.before)
  expect(result.key).toMatchObject({ native: true, extractable: false, exportRejected: true })
})

test("deletion aborts an already-started native ACK transaction and retains the fixed snapshot", async ({ page }) => {
  const result = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.buffer.queue(h.owner, h.doc, h.op)
    const before = JSON.stringify(await h.raw())
    const path = "/src/domain/account/account-deletion-boundary.ts"
    const deletion = await import(/* @vite-ignore */ path)
    const put = IDBObjectStore.prototype.put
    let closed = false
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      const request = put.apply(this, args)
      if (this.name === "drafts" && !closed) {
        closed = true
        deletion.closeAccountDeletionBoundary(h.owner, "2026-10-07T00:00:00Z")
      }
      return request
    }
    let error: string | null
    try { error = await h.rejected(() => h.buffer.ack(h.owner, h.doc, h.op, 1)) }
    finally { IDBObjectStore.prototype.put = put }
    return { error, closed, before, after: JSON.stringify(await h.raw()), key: await h.keyInfo() }
  })
  expect(result.closed).toBe(true)
  expect(result.error).toMatch(/Draft (storage failed|transaction aborted)/u)
  expect(result.after).toBe(result.before)
  expect(result.key).toMatchObject({ native: true, extractable: false, exportRejected: true })
})

test("a cross-tab deletion closes native scope without a Supabase signout event and preserves both owners", async ({ page, context }) => {
  const before = await page.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.saveDraft(h.owner, h.doc, h.draft)
    await h.buffer.queue(h.owner, h.doc, h.op)
    return JSON.stringify(await h.raw())
  })
  const otherTab = await context.newPage()
  await load(otherTab)
  await otherTab.evaluate(async () => {
    const h = window.accountDraftHarness
    await h.buffer.read(h.owner, h.doc)
    const path = "/src/domain/account/local-journal-ownership.ts"
    const ownership = await import(/* @vite-ignore */ path)
    ownership.setActiveLocalAccount(h.otherOwner)
  })
  await page.evaluate(async () => {
    const path = "/src/domain/account/account-deletion-boundary.ts"
    const deletion = await import(/* @vite-ignore */ path)
    deletion.closeAccountDeletionBoundary(window.accountDraftHarness.owner, "2026-10-07T00:00:00Z")
  })
  await expect.poll(async () => otherTab.evaluate(async () => {
    const h = window.accountDraftHarness
    return h.rejected(() => h.buffer.read(h.owner, h.doc))
  })).toBe("Draft buffer scope disposed")
  const after = await otherTab.evaluate(async () => {
    const h = window.accountDraftHarness
    const path = "/src/domain/account/local-journal-ownership.ts"
    const ownership = await import(/* @vite-ignore */ path)
    await h.buffer.saveDraft(h.otherOwner, h.doc, h.draft)
    return { raw: JSON.stringify(await h.raw()), owner: ownership.activeLocalAccount(),
      body: (await h.buffer.read(h.otherOwner, h.doc))?.draft.body }
  })
  expect(after).toEqual({ raw: before, owner: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", body: "SYNTHETIC_BODY_ONLY" })
})
