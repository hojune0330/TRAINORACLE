import { expect, test, type Page } from "@playwright/test"
import { mockRecordServer } from "./fixtures/account-journal-record-server"
import type { AccountCalendarDecorationDocument } from "../src/domain/account/account-calendar-decoration-schema"
import type { AccountDecorationDocument } from "../src/domain/account/account-decoration-schema"
import type {} from "./fixtures/account-calendar-decoration-service"
async function load(page: Page) {
  await page.goto("/__account_record_test__")
  await page.addScriptTag({ type: "module", url: "/e2e/fixtures/account-calendar-decoration-service.ts" })
  await page.waitForFunction(() => !!window.accountCalendarDecorationHarness)
}
let server: ReturnType<typeof mockRecordServer<AccountCalendarDecorationDocument | AccountDecorationDocument>>
test.beforeEach(async ({ context, page }) => {
  // The existing harness aborts every non-loopback request. No real account or credentials.
  server = mockRecordServer<AccountCalendarDecorationDocument | AccountDecorationDocument>(); await server.install(context)
  await page.route("**/__record_api__", async route => {
    const { request } = route.request().postDataJSON()
    if (request.action !== "calendarDecorationSupport") return route.fallback()
    return route.fulfill({ contentType: "application/json", body: JSON.stringify({ kind: "calendar-decoration-support", version: 1 }) })
  })
  await load(page)
})
async function save(page: Page) {
  return page.evaluate(async () => {
    const h = window.accountCalendarDecorationHarness
    const current = h.loadCalendarDecorationState()
    const state = { ...current, items: [{ placementId: "11111111-1111-4111-8111-111111111111", itemId: "EMOJI_SUN" as const,
      region: "HEADER_MARGIN" as const, transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }] }
    return h.persistCalendarDecorationStateIfCurrent(state, h.readCalendarDecorationStateSerialized())
  })
}
test("calendar immutable outbox survives native IndexedDB reopen and receipt loss with no plaintext localStorage", async ({ page }) => {
  await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations())
  expect(await save(page)).toMatchObject({ ok: true, storage: "ACCOUNT" })
  server.loseReceipt(); expect(await save(page)).toMatchObject({ ok: true, storage: "PENDING" })
  const before = await page.evaluate(() => window.accountCalendarDecorationHarness.view())
  await page.reload(); await load(page)
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations())).toBe(true)
  const result = await page.evaluate(async () => {
    const h = window.accountCalendarDecorationHarness
    return { view: await h.view(), raw: JSON.stringify(await h.rawRecords()), local: { ...localStorage } }
  })
  expect(result.view).toMatchObject({ state: "DRAFT_ACKNOWLEDGED", serverRevision: 2, pending: null })
  const saves = server.calls.filter(call => call.request.action === "save" && call.request.document.kind === "CALENDAR_DECORATIONS")
  expect(saves).toHaveLength(3); expect(saves[2]).toEqual(saves[1])
  expect(saves[1]!.request).toMatchObject({ operationId: before?.pending?.operationId })
  expect(result.raw).not.toContain("EMOJI_SUN")
  expect(Object.keys(result.local).some(key => key.includes("calendar-decorations"))).toBe(false)
})
test("calendar unsupported or offline support never replays or replaces an already encrypted pending outbox", async ({ page }) => {
  await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations())
  expect(await save(page)).toMatchObject({ ok: true, storage: "ACCOUNT" })
  server.offline(true); expect(await save(page)).toMatchObject({ ok: true, storage: "PENDING" })
  const before = await page.evaluate(() => window.accountCalendarDecorationHarness.view())
  const saves = server.calls.filter(call => call.request.action === "save").length
  await page.route("**/__record_api__", async route => route.request().postDataJSON().request.action === "calendarDecorationSupport"
    ? route.fulfill({ status: 503, contentType: "application/json", body: "{}" }) : route.fallback())
  await page.reload(); await load(page)
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations())).toBe(false)
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.view())).toEqual(before)
  expect(await save(page)).toMatchObject({ ok: false })
  expect(server.calls.filter(call => call.request.action === "save")).toHaveLength(saves)
})
test("calendar A-B-A late save cannot publish or acknowledge another account and remains recoverable", async ({ page }) => {
  await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations()); await save(page)
  const release = server.holdNext("save"), count = server.calls.filter(call => call.request.action === "save").length
  const saving = save(page)
  await expect.poll(() => server.calls.filter(call => call.request.action === "save").length).toBe(count + 1)
  expect(await page.evaluate(() => {
    const h = window.accountCalendarDecorationHarness
    h.setActiveLocalAccount(h.other); const other = h.readAccountCalendarDecorationState()
    h.setActiveLocalAccount(h.owner); return { other, returned: h.readAccountCalendarDecorationState() }
  })).toEqual({ other: null, returned: null })
  release(); expect(await saving).toMatchObject({ ok: false })
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.view())).toMatchObject({ state: "PENDING" })
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations())).toBe(true)
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.view())).toMatchObject({ state: "DRAFT_ACKNOWLEDGED", pending: null })
})

test("calendar ownership rejection survives native IndexedDB and explicit retry reuses its fixed operation", async ({ page }) => {
  await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations()); await save(page)
  let rejected = false
  await page.route("**/__record_api__", async route => {
    const { request } = route.request().postDataJSON()
    if (!rejected && request.action === "save" && request.document.kind === "CALENDAR_DECORATIONS") {
      rejected = true
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "OWNERSHIP_STATE_CHANGED" }) })
    }
    return route.fallback()
  })
  expect(await save(page)).toMatchObject({ ok: false, code: "OWNERSHIP_STATE_CHANGED" })
  const before = await page.evaluate(() => window.accountCalendarDecorationHarness.view())
  expect(before).toMatchObject({ state: "PENDING", pending: { rejection: "OWNERSHIP_STATE_CHANGED" } })
  expect(await save(page)).toMatchObject({ ok: true, storage: "ACCOUNT" })
  const retried = server.calls.find(call => call.request.action === "save" && call.request.operationId === before?.pending?.operationId)
  expect(retried?.request).toMatchObject({ document: before?.pending?.draft, expectedRevision: before?.pending?.expectedRevision })
})

test("corrected ownership replacement archives rejected bytes, guards native CAS and survives offline reopen", async ({ page }) => {
  const inventory = await page.evaluate(async () => {
    const h = window.accountCalendarDecorationHarness
    return { owner: h.owner, id: await h.accountDecorationDocumentId(h.owner), empty: h.createEmptyDecorationState() }
  })
  // Synthetic canonical inventory only; this harness is not paid-grant authority proof.
  server.documents.set(`${inventory.owner}:${inventory.id}`, { documentId: inventory.id, revision: 1,
    document: { version: 3, state: "ACCOUNT_STATE", kind: "DECORATIONS", data: { ...inventory.empty,
      spentPoints: 100_000, ownedItemIds: [...inventory.empty.ownedItemIds, "STICKER_FINISH_LINE"] } } })
  await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations())
  let rejected = false
  await page.route("**/__record_api__", async route => {
    const { request } = route.request().postDataJSON()
    if (!rejected && request.action === "save" && request.document.kind === "CALENDAR_DECORATIONS") {
      rejected = true
      return route.fulfill({ status: 409, contentType: "application/json", body: JSON.stringify({ error: "OWNERSHIP_STATE_CHANGED" }) })
    }
    return route.fallback()
  })
  expect(await page.evaluate(async () => {
    const h = window.accountCalendarDecorationHarness
    return h.persistCalendarDecorationStateIfCurrent({ ...h.createEmptyCalendarDecorationState(), items: [{
      placementId: "11111111-1111-4111-8111-111111111111", itemId: "STICKER_FINISH_LINE", region: "HEADER_MARGIN",
      transform: { xPercent: 50, yPercent: 50, scale: 1, rotationDeg: 0 } }] }, h.readCalendarDecorationStateSerialized())
  })).toMatchObject({ ok: false, code: "OWNERSHIP_STATE_CHANGED" })
  const original = await page.evaluate(() => window.accountCalendarDecorationHarness.view())
  expect(original?.pending).toMatchObject({ expectedRevision: 0, rejection: "OWNERSHIP_STATE_CHANGED" })
  const guards = await page.evaluate(async () => {
    const h = window.accountCalendarDecorationHarness, id = await h.accountCalendarDecorationDocumentId(h.owner)
    const b = h.createAccountDocumentBuffer(h.accountCalendarDecorationDocumentSchema, h.ACCOUNT_CALENDAR_DECORATION_DATABASE)
    try {
      const v = (await b.read(h.owner, id))!, p = v.pending!, fresh = crypto.randomUUID()
      const candidate: AccountCalendarDecorationDocument = { version: 3, state: "ACCOUNT_STATE", kind: "CALENDAR_DECORATIONS", data: h.createEmptyCalendarDecorationState() }
      const replace = b.replaceOwnershipRejectedDraft!
      const results = [
        await replace(h.owner, id, candidate, p.operationId, v.localSequence, 0, null, fresh, () => false),
        await replace(h.owner, id, candidate, crypto.randomUUID(), v.localSequence, 0, null, fresh),
        await replace(h.owner, id, candidate, p.operationId, v.localSequence + 1, 0, null, fresh),
        await replace(h.owner, id, candidate, p.operationId, v.localSequence, 1, candidate, fresh),
        await replace(h.owner, id, candidate, p.operationId, v.localSequence, 0, null, p.operationId),
        await replace(h.owner, id, p.draft, p.operationId, v.localSequence, 0, null, fresh),
      ]
      let journalRefused = false, otherOwnerRefused = false
      try { await replace(h.owner, id, { version: 1, state: "DRAFT", visibility: "PRIVATE", date: "2026-10-02", title: "", body: "" } as unknown as AccountCalendarDecorationDocument,
        p.operationId, v.localSequence, 0, null, fresh) } catch { journalRefused = true }
      try { await replace(h.other, id, candidate, p.operationId, v.localSequence, 0, null, fresh) } catch { otherOwnerRefused = true }
      return { results, journalRefused, otherOwnerRefused, unchanged: JSON.stringify(v) === JSON.stringify(await b.read(h.owner, id)) }
    } finally { b.close() }
  })
  expect(guards).toEqual({ results: [false, false, false, false, false, false], journalRefused: true, otherOwnerRefused: true, unchanged: true })
  server.documents.set(`${inventory.owner}:${inventory.id}`, { documentId: inventory.id, revision: 2,
    document: { version: 3, state: "ACCOUNT_STATE", kind: "DECORATIONS", data: inventory.empty } })
  server.offline(true)
  expect(await page.evaluate(() => {
    const h = window.accountCalendarDecorationHarness
    return h.persistCalendarDecorationStateIfCurrent(h.createEmptyCalendarDecorationState(), h.readCalendarDecorationStateSerialized())
  })).toMatchObject({ ok: true, storage: "PENDING" })
  const replacement = await page.evaluate(() => window.accountCalendarDecorationHarness.view())
  expect(replacement?.pending?.operationId).not.toBe(original?.pending?.operationId)
  const archived = await page.evaluate(() => {
    const h = window.accountCalendarDecorationHarness
    return h.readAccountCalendarDecorationConflictArchive(h.owner)
  })
  expect(archived?.[0]?.pending).toEqual(original?.pending)
  const raw = JSON.stringify(await page.evaluate(() => window.accountCalendarDecorationHarness.rawRecords()))
  expect(raw).not.toContain("STICKER_FINISH_LINE")
  expect(raw).toContain(original!.pending!.operationId)
  server.offline(false); await page.reload(); await load(page)
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.hydrateAccountCalendarDecorations())).toBe(true)
  expect(await page.evaluate(() => window.accountCalendarDecorationHarness.view()))
    .toMatchObject({ state: "DRAFT_ACKNOWLEDGED", serverRevision: 1, pending: null, draft: { data: { items: [] } } })
  const reopenedArchive = await page.evaluate(() => {
    const h = window.accountCalendarDecorationHarness
    return h.readAccountCalendarDecorationConflictArchive(h.owner)
  })
  expect(reopenedArchive?.[0]?.pending).toEqual(original?.pending)
  const accepted = server.calls.filter(call => call.request.action === "save" && call.request.document.kind === "CALENDAR_DECORATIONS")
  expect(accepted).toHaveLength(2); expect(accepted[0]?.request).toEqual(accepted[1]?.request)
  expect(accepted[0]?.request).toMatchObject({ operationId: replacement?.pending?.operationId, expectedRevision: 0 })
})
